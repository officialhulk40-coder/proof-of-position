import { pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { createBscPublicClient, createTelemetryRecorder, createW3wClient, viemAccountSigner } from "@pop/core";
import type { Hono } from "hono";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import { createApp, type RouteModule } from "./app";
import { loadConfig, type ServerConfig } from "./config";
import type { KeeperStatus } from "./deps";
import { createKeeper, startKeeperLoop, type Keeper } from "./keeper/keeper";
import { dryRunRoutes } from "./routes/dryRun";
import { exitRoutes } from "./routes/exit";
import { followRoutes } from "./routes/follow";
import { tokensRoutes } from "./routes/tokens";

export const ROUTES: readonly RouteModule[] = [tokensRoutes, dryRunRoutes, followRoutes, exitRoutes];

export interface BuiltServer {
  app: Hono;
  config: ServerConfig;
  keeper: Keeper | null;
}

/** Wires real dependencies from the environment. Starts nothing; main() serves and runs the keeper. */
export function buildServer(env: Record<string, string | undefined>, options: { fetchImpl?: typeof fetch } = {}): BuiltServer {
  const config = loadConfig(env);
  const onTiming = config.telemetryFile ? createTelemetryRecorder({ filePath: config.telemetryFile, service: "server" }) : undefined;
  const w3w = config.w3w
    ? createW3wClient({ apiKey: config.w3w.apiKey, apiSecret: config.w3w.apiSecret, fetchImpl: options.fetchImpl, onTiming })
    : null;
  const chain = createBscPublicClient(config.rpcUrls);
  const logs = createPublicClient({ chain: bsc, transport: http(config.logsRpcUrl, { timeout: 10_000, retryCount: 1 }) });

  const status: KeeperStatus = { enabled: false, address: null, recorded: 0, lastError: null };
  let keeper: Keeper | null = null;
  if (config.keeperKey !== null && w3w !== null) {
    const account = privateKeyToAccount(config.keeperKey);
    status.enabled = true;
    status.address = account.address;
    keeper = createKeeper({
      chain,
      w3w,
      signer: viemAccountSigner(account),
      registry: config.registry,
      onRecorded: (callId, txHash) => {
        status.recorded += 1;
        console.log(`[keeper] recorded exit for call ${callId}: ${txHash}`);
      },
      onError: (callId, message) => {
        status.lastError = `call ${callId}: ${message}`;
        console.warn(`[keeper] ${status.lastError}`);
      },
    });
  }

  const app = createApp({ config, w3w, chain, logs, now: () => Date.now(), keeperStatus: () => ({ ...status }) }, ROUTES);
  return { app, config, keeper };
}

function main(): void {
  const { app, config, keeper } = buildServer(process.env);
  serve({ fetch: app.fetch, port: config.port, hostname: "0.0.0.0" });
  console.log(`[server] listening on :${config.port} — registry ${config.registry}, W3W ${config.w3w ? "on" : "off"}, keeper ${keeper ? "on" : "off"}`);
  if (keeper) startKeeperLoop(keeper, 1_000);
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
