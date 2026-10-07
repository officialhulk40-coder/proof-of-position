import { DEFAULT_WATCHLIST, getTokenBySymbol, isFollowable, parseRpcUrls } from "@pop/core";

/** Spend cap per call: ANALYST_BUY_USDT above this is refused at startup. */
export const MAX_BUY_USDT = 5;

export interface AnalystConfig {
  /** ANALYST_ENABLED=true starts the loop; anything else leaves the agent a plain Studio seller. */
  enabled: boolean;
  registry: `0x${string}` | null;
  /** ERC-8004 agent id from `bag erc8004 register`; null until registered (the loop then stays idle). */
  agentId: bigint | null;
  /** bStock symbols, in priority order. */
  watchlist: string[];
  /** USDT per new call, decimal string. */
  buyUsdt: string;
  holdHours: number;
  intervalMinutes: number;
  rpcUrls: string[];
  w3w: { apiKey: string; apiSecret: string } | null;
  /** Public feed URL used in the latest-call face (e.g. https://<host>). */
  feedUrl: string | null;
  telemetryFile: string | null;
}

function positiveNumber(name: string, raw: string | undefined, fallback: number, min: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) throw new Error(`${name} must be a number ≥ ${min}`);
  return value;
}

/** Reads the analyst's environment (names in spec §14; values live in the VPS env file, never in git). */
export function loadAnalystConfig(env: Record<string, string | undefined>): AnalystConfig {
  const registryRaw = env.REGISTRY_ADDRESS?.trim() ?? "";
  if (registryRaw !== "" && !/^0x[0-9a-fA-F]{40}$/.test(registryRaw)) throw new Error("REGISTRY_ADDRESS must be a 0x-prefixed 20-byte address");
  const agentRaw = env.ANALYST_AGENT_ID?.trim() ?? "";
  if (agentRaw !== "" && !/^\d+$/.test(agentRaw)) throw new Error("ANALYST_AGENT_ID must be the numeric ERC-8004 agent id");

  const watchlist = (env.ANALYST_WATCHLIST?.trim() ? env.ANALYST_WATCHLIST.split(",") : [...DEFAULT_WATCHLIST]).map((s) => s.trim()).filter((s) => s !== "");
  for (const symbol of watchlist) {
    const token = getTokenBySymbol(symbol);
    if (!token || !isFollowable(token)) throw new Error(`ANALYST_WATCHLIST: ${symbol} is not a bStock in the catalog`);
  }
  if (watchlist.length === 0) throw new Error("ANALYST_WATCHLIST is empty");

  const buyUsdt = env.ANALYST_BUY_USDT?.trim() || "2";
  if (!/^\d+(\.\d+)?$/.test(buyUsdt) || Number(buyUsdt) <= 0 || Number(buyUsdt) > MAX_BUY_USDT) {
    throw new Error(`ANALYST_BUY_USDT must be a positive amount of at most ${MAX_BUY_USDT}`);
  }

  const apiKey = env.W3W_API_KEY?.trim() ?? "";
  const apiSecret = env.W3W_API_SECRET?.trim() ?? "";
  if ((apiKey === "") !== (apiSecret === "")) throw new Error("set both W3W_API_KEY and W3W_API_SECRET, or neither");

  return {
    enabled: env.ANALYST_ENABLED?.trim().toLowerCase() === "true",
    registry: registryRaw === "" ? null : (registryRaw as `0x${string}`),
    agentId: agentRaw === "" ? null : BigInt(agentRaw),
    watchlist,
    buyUsdt,
    holdHours: positiveNumber("ANALYST_HOLD_HOURS", env.ANALYST_HOLD_HOURS, 24, 0.05),
    intervalMinutes: positiveNumber("ANALYST_INTERVAL_MIN", env.ANALYST_INTERVAL_MIN, 30, 1),
    rpcUrls: parseRpcUrls(env.BSC_RPC_URLS),
    w3w: apiKey === "" ? null : { apiKey, apiSecret },
    feedUrl: env.POP_FEED_URL?.trim().replace(/\/$/, "") || null,
    telemetryFile: env.DEVEX_TELEMETRY_FILE?.trim() || null,
  };
}

/** Why the loop cannot start with this config, or null when it can. */
export function loopBlocker(config: AnalystConfig): string | null {
  if (!config.enabled) return "ANALYST_ENABLED is not true";
  if (config.registry === null) return "REGISTRY_ADDRESS is not set";
  if (config.agentId === null) return "ANALYST_AGENT_ID is not set (register the agent on ERC-8004 first)";
  if (config.w3w === null) return "W3W_API_KEY / W3W_API_SECRET are not set";
  return null;
}
