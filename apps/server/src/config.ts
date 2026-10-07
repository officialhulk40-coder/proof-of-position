import { DEFAULT_LOGS_RPC_URL, parseRpcUrls } from "@pop/core";
import { z } from "zod";

export interface ServerConfig {
  port: number;
  registry: `0x${string}`;
  rpcUrls: string[];
  logsRpcUrl: string;
  /** null → the W3W-backed routes answer 503 W3W_NOT_CONFIGURED; badges never need the API. */
  w3w: { apiKey: string; apiSecret: string } | null;
  /** Burner key for the recordExit keeper; null disables the keeper. Never logged. */
  keeperKey: `0x${string}` | null;
  telemetryFile: string | null;
  corsOrigins: string[];
}

const addressSchema = z
  .string({ required_error: "REGISTRY_ADDRESS is required" })
  .regex(/^0x[0-9a-fA-F]{40}$/, "REGISTRY_ADDRESS must be a 0x-prefixed 20-byte address");
const keySchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "KEEPER_PK must be a 0x-prefixed 32-byte hex key");

/** Reads the server's environment (names only in docs; values come from the VPS env file). */
export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  const registry = addressSchema.parse(env.REGISTRY_ADDRESS) as `0x${string}`;
  const port = env.PORT === undefined || env.PORT === "" ? 8787 : Number(env.PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`PORT must be an integer 1-65535`);
  const apiKey = env.W3W_API_KEY?.trim() ?? "";
  const apiSecret = env.W3W_API_SECRET?.trim() ?? "";
  if ((apiKey === "") !== (apiSecret === "")) throw new Error("set both W3W_API_KEY and W3W_API_SECRET, or neither");
  const keeperRaw = env.KEEPER_PK?.trim() ?? "";
  return {
    port,
    registry,
    rpcUrls: parseRpcUrls(env.BSC_RPC_URLS),
    logsRpcUrl: env.BSC_LOGS_RPC_URL?.trim() || DEFAULT_LOGS_RPC_URL,
    w3w: apiKey === "" ? null : { apiKey, apiSecret },
    keeperKey: keeperRaw === "" ? null : (keySchema.parse(keeperRaw) as `0x${string}`),
    telemetryFile: env.DEVEX_TELEMETRY_FILE?.trim() || null,
    corsOrigins: (env.CORS_ORIGINS ?? "*")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  };
}
