import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  createBscPublicClient,
  createTelemetryRecorder,
  createW3wClient,
  requireTokenBySymbol,
  viemAccountSigner,
  type RegistryReader,
  type SwapClient,
  type TxSigner,
  type W3wClient,
} from "@pop/core";
import { privateKeyToAccount } from "viem/accounts";
import { callerBuy, callerPost, callerSell, callerTryGate } from "./caller";
import { agentCheck, apiGet, balanceLines, healthCheck, statusLines, tradesLines } from "./checks";
import { devexProblems } from "./devex";
import { loadDemoEnv, type DemoEnv } from "./env";

export const USAGE = `pop-demo — demo personas and smoke checks (BSC mainnet; small amounts)

  pop-demo caller buy --token NVDAB --usdt 3
  pop-demo caller post --token NVDAB --amount 0.02 --note "…"
  pop-demo caller sell --token NVDAB --all
  pop-demo caller try-gate --token TSLAB --amount 0.01 [--broadcast]
  pop-demo status [--limit 10]
  pop-demo agent
  pop-demo health
  pop-demo api get <path> [key=value …]
  pop-demo trades --token NVDAB --wallet <0x…>
  pop-demo balances --wallet <0x…>
  pop-demo devex-check --sections S1,S2

Run with: pnpm --filter @pop/demo run demo <command> …
Environment: REGISTRY_ADDRESS, BSC_RPC_URLS, W3W_API_KEY, W3W_API_SECRET, CALLER_PK, POP_FEED_URL,
ANALYST_AGENT_ID, ANALYST_WALLET, DEVEX_TELEMETRY_FILE`;

export interface CliDeps {
  env: Record<string, string | undefined>;
  out: (line: string) => void;
  err: (line: string) => void;
  /** Builds the chain client (tests pass a fake). */
  chain: (env: DemoEnv) => SwapClient & RegistryReader;
  /** Builds the Web3 API client (tests pass a fake). */
  w3w: (env: DemoEnv) => W3wClient;
  /** The caller persona's signer (tests pass a fake; the real one wraps CALLER_PK). */
  signer: (env: DemoEnv) => TxSigner;
  fetchImpl: typeof fetch;
  now: () => number;
  devexLogPath: string;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function defaultDeps(env: Record<string, string | undefined>): CliDeps {
  return {
    env,
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    chain: (demo) => createBscPublicClient(demo.rpcUrls),
    w3w: (demo) => {
      if (!demo.w3w) throw new Error("set W3W_API_KEY and W3W_API_SECRET");
      const onTiming = demo.telemetryFile ? createTelemetryRecorder({ filePath: demo.telemetryFile, service: "demo" }) : undefined;
      return createW3wClient({ apiKey: demo.w3w.apiKey, apiSecret: demo.w3w.apiSecret, onTiming });
    },
    signer: (demo) => {
      if (!demo.callerKey) throw new Error("set CALLER_PK to the caller persona's burner key");
      return viemAccountSigner(privateKeyToAccount(demo.callerKey));
    },
    fetchImpl: (input, init) => fetch(input, init),
    now: () => Date.now(),
    devexLogPath: join(repoRoot, "DEVEX_LOG.md"),
  };
}

function requireRegistry(env: DemoEnv): `0x${string}` {
  if (!env.registry) throw new Error("set REGISTRY_ADDRESS to the deployed CallRegistry");
  return env.registry;
}

async function caller(deps: CliDeps, demo: DemoEnv, action: string | undefined, values: Record<string, string | boolean | undefined>): Promise<number> {
  const token = requireTokenBySymbol(String(values.token ?? ""));
  const persona = { w3w: deps.w3w(demo), client: deps.chain(demo), signer: deps.signer(demo), registry: requireRegistry(demo) };
  deps.out(`caller ${persona.signer.address}`);
  switch (action) {
    case "buy": {
      const bought = await callerBuy(persona, token, String(values.usdt ?? ""));
      deps.out(`bought ${bought.received} raw ${token.symbol} in ${bought.txHash}`);
      return 0;
    }
    case "post": {
      const posted = await callerPost(persona, token, String(values.amount ?? ""), String(values.note ?? ""));
      deps.out(`posted call #${posted.callId} on ${token.symbol} in ${posted.txHash}`);
      return 0;
    }
    case "sell": {
      if (values.all !== true) throw new Error("caller sell needs --all (it sells the caller's whole balance)");
      const sold = await callerSell(persona, token);
      deps.out(sold ? `sold ${sold.sold} raw ${token.symbol} for ${sold.received} raw USDT in ${sold.txHash}` : `the caller holds no ${token.symbol}`);
      return 0;
    }
    case "try-gate": {
      const gate = await callerTryGate(persona, token, String(values.amount ?? ""), values.broadcast === true);
      if (gate.wouldSucceed) deps.out(`this caller holds ${token.symbol}: the post would succeed (use a caller without it)`);
      else deps.out(`simulate → ${gate.failReason}${gate.txHash ? ` · broadcast anyway: ${gate.txHash} (reverted on-chain)` : ""}`);
      return 0;
    }
    default:
      return usage(deps, `unknown caller action ${action ?? ""}`);
  }
}

function usage(deps: CliDeps, problem: string): number {
  deps.err(`error: ${problem}`);
  deps.err(USAGE);
  return 1;
}

export async function main(argv: readonly string[], overrides: Partial<CliDeps> = {}): Promise<number> {
  const deps: CliDeps = { ...defaultDeps(overrides.env ?? process.env), ...overrides };
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "help") {
    deps.out(USAGE);
    return 0;
  }
  let values: Record<string, string | boolean | undefined>;
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: [...rest],
      allowPositionals: true,
      strict: true,
      options: {
        token: { type: "string" },
        usdt: { type: "string" },
        amount: { type: "string" },
        note: { type: "string" },
        all: { type: "boolean" },
        broadcast: { type: "boolean" },
        limit: { type: "string" },
        wallet: { type: "string" },
        sections: { type: "string" },
      },
    }));
  } catch (error) {
    return usage(deps, error instanceof Error ? error.message : String(error));
  }
  try {
    const demo = loadDemoEnv(deps.env);
    switch (command) {
      case "caller":
        return await caller(deps, demo, positionals[0], values);
      case "status":
        for (const line of await statusLines({ client: deps.chain(demo), registry: requireRegistry(demo) }, Number(values.limit ?? "10"))) deps.out(line);
        return 0;
      case "agent": {
        if (demo.analystAgentId === null) throw new Error("set ANALYST_AGENT_ID (and ANALYST_WALLET to check it)");
        const result = await agentCheck({ client: deps.chain(demo), registry: requireRegistry(demo), agentId: demo.analystAgentId, expectedWallet: demo.analystWallet });
        for (const line of result.lines) deps.out(line);
        deps.out(result.ok ? "PASS" : "FAIL");
        return result.ok ? 0 : 1;
      }
      case "health": {
        if (!demo.feedUrl) throw new Error("set POP_FEED_URL to the deployed feed, e.g. https://<host>");
        const result = await healthCheck(demo.feedUrl, deps.fetchImpl);
        for (const line of result.lines) deps.out(line);
        deps.out(result.ok ? "PASS" : "FAIL");
        return result.ok ? 0 : 1;
      }
      case "api": {
        const [verb, path, ...pairs] = positionals;
        if (verb !== "get" || !path?.startsWith("/api/")) return usage(deps, "api get <path starting with /api/> [key=value …]");
        const query = Object.fromEntries(pairs.map((pair) => pair.split("=", 2) as [string, string]));
        for (const line of await apiGet(deps.w3w(demo), path, query)) deps.out(line);
        return 0;
      }
      case "trades": {
        const wallet = String(values.wallet ?? "");
        if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return usage(deps, "--wallet <0x address> is required");
        const token = requireTokenBySymbol(String(values.token ?? ""));
        for (const line of await tradesLines(deps.w3w(demo), token.address, wallet as `0x${string}`, deps.now())) deps.out(line);
        return 0;
      }
      case "balances": {
        const wallet = String(values.wallet ?? "");
        if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return usage(deps, "--wallet <0x address> is required");
        for (const line of await balanceLines(deps.w3w(demo), wallet as `0x${string}`)) deps.out(line);
        return 0;
      }
      case "devex-check": {
        const sections = String(values.sections ?? "").split(",").map((s) => s.trim()).filter((s) => s !== "");
        if (sections.length === 0) return usage(deps, "--sections S1,S2,… is required");
        const problems = devexProblems(readFileSync(deps.devexLogPath, "utf8"), sections);
        for (const problem of problems) deps.out(`FAIL ${problem}`);
        deps.out(problems.length === 0 ? "PASS" : "FAIL");
        return problems.length === 0 ? 0 : 1;
      }
      default:
        return usage(deps, `unknown command ${command}`);
    }
  } catch (error) {
    deps.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
