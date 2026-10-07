import { parseRpcUrls } from "@pop/core";

export interface DemoEnv {
  registry: `0x${string}` | null;
  rpcUrls: string[];
  w3w: { apiKey: string; apiSecret: string } | null;
  /** The caller persona's burner key (CALLER_PK). Never printed. */
  callerKey: `0x${string}` | null;
  telemetryFile: string | null;
  /** The deployed feed (POP_FEED_URL), e.g. https://<host>. */
  feedUrl: string | null;
  analystAgentId: bigint | null;
  analystWallet: `0x${string}` | null;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function optionalAddress(name: string, raw: string | undefined): `0x${string}` | null {
  const value = raw?.trim() ?? "";
  if (value === "") return null;
  if (!ADDRESS.test(value)) throw new Error(`${name} must be a 0x-prefixed 20-byte address`);
  return value as `0x${string}`;
}

/** Reads the demo environment (names only in docs: REGISTRY_ADDRESS, BSC_RPC_URLS, W3W_API_KEY/SECRET, CALLER_PK, …). */
export function loadDemoEnv(env: Record<string, string | undefined>): DemoEnv {
  const apiKey = env.W3W_API_KEY?.trim() ?? "";
  const apiSecret = env.W3W_API_SECRET?.trim() ?? "";
  if ((apiKey === "") !== (apiSecret === "")) throw new Error("set both W3W_API_KEY and W3W_API_SECRET, or neither");
  const callerRaw = env.CALLER_PK?.trim() ?? "";
  if (callerRaw !== "" && !/^0x[0-9a-fA-F]{64}$/.test(callerRaw)) throw new Error("CALLER_PK must be a 0x-prefixed 32-byte hex key");
  const agentRaw = env.ANALYST_AGENT_ID?.trim() ?? "";
  if (agentRaw !== "" && !/^\d+$/.test(agentRaw)) throw new Error("ANALYST_AGENT_ID must be the numeric ERC-8004 agent id");
  return {
    registry: optionalAddress("REGISTRY_ADDRESS", env.REGISTRY_ADDRESS),
    rpcUrls: parseRpcUrls(env.BSC_RPC_URLS),
    w3w: apiKey === "" ? null : { apiKey, apiSecret },
    callerKey: callerRaw === "" ? null : (callerRaw as `0x${string}`),
    telemetryFile: env.DEVEX_TELEMETRY_FILE?.trim() || null,
    feedUrl: env.POP_FEED_URL?.trim().replace(/\/$/, "") || null,
    analystAgentId: agentRaw === "" ? null : BigInt(agentRaw),
    analystWallet: optionalAddress("ANALYST_WALLET", env.ANALYST_WALLET),
  };
}
