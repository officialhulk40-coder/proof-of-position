import { W3wApiError, getRwaTokens, getTopLiquidityPools, type TokenInfo, type W3wClient } from "@pop/core";

/** CoinMarketCap x402 "DEX Pairs Quotes" (studio-reviewed merchant `cmc`, $0.01 per call). */
export const CMC_PAIR_QUOTES_URL = "https://pro-api.coinmarketcap.com/x402/v4/dex/pairs/quotes/latest";

/** Per-call ceiling passed to buyWithX402; the merchant's per_call_cap_usd in studio.toml applies on top. */
export const CMC_MAX_USD = 0.02;

/** The x402-buyer recipe's buyWithX402 (src/x402Buyer.ts), injected so tests never pay. */
export type BuyWithX402 = (url: string, maxUsd: number) => Promise<Record<string, unknown>>;

export interface Research {
  symbol: string;
  ticker: string;
  token: `0x${string}`;
  name: string | null;
  priceUsd: string | null;
  market: { openState: boolean; marketStatus: string; reasonMsg: string | null } | null;
  pool: { address: string; protocol: string | null; liquidityUsd: string } | null;
  /** A one-line digest of the paid CMC pair quote, and what it cost. */
  cmc: { summary: string; paidUsd: number | null } | null;
  /** What could not be fetched (research degrades, it never blocks a cycle). */
  notes: string[];
}

const CMC_FIELDS = ["price", "volume_24h", "liquidity", "percent_change_price_24h"] as const;

/** Finds the first numeric value of each wanted key anywhere in a JSON document. */
export function pickNumbers(json: unknown, keys: readonly string[]): Record<string, number> {
  const found: Record<string, number> = {};
  const queue: unknown[] = [json];
  while (queue.length > 0) {
    const node = queue.shift();
    if (Array.isArray(node)) queue.push(...node);
    else if (node !== null && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (keys.includes(key) && found[key] === undefined) {
          const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
          if (Number.isFinite(number)) found[key] = number;
        }
        if (value !== null && typeof value === "object") queue.push(value);
      }
    }
  }
  return found;
}

/** The API code and verbatim message for Web3 API failures (what the DevEx log needs), else the error text. */
function message(error: unknown): string {
  if (error instanceof W3wApiError) return `${error.code} ${error.msg}`;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Research for one bStock: RWA Data (name, price, market status), the deepest pool from the Market
 * API, and CoinMarketCap's paid DEX pair quote for that pool via x402. Every source is optional.
 */
export async function researchToken(deps: { w3w: W3wClient; buyWithX402: BuyWithX402 }, token: TokenInfo): Promise<Research> {
  const result: Research = { symbol: token.symbol, ticker: token.ticker, token: token.address, name: null, priceUsd: null, market: null, pool: null, cmc: null, notes: [] };

  try {
    const rwa = (await getRwaTokens(deps.w3w, { platformId: "bstock" })).find((entry) => entry.tokenContractAddress.toLowerCase() === token.address);
    if (rwa) {
      result.name = rwa.underlyingName;
      result.priceUsd = rwa.tokenPrice ?? null;
      result.market = rwa.statusInfo ? { openState: rwa.statusInfo.openState, marketStatus: rwa.statusInfo.marketStatus, reasonMsg: rwa.statusInfo.reasonMsg ?? null } : null;
    } else result.notes.push("RWA Data has no entry for this token");
  } catch (error) {
    result.notes.push(`RWA Data unavailable: ${message(error)}`);
  }

  try {
    const [deepest] = await getTopLiquidityPools(deps.w3w, token.address);
    if (deepest) result.pool = { address: deepest.poolAddress, protocol: deepest.protocolName ?? null, liquidityUsd: deepest.liquidityUsd };
    else result.notes.push("no liquidity pool listed");
  } catch (error) {
    result.notes.push(`Market API top-liquidity unavailable: ${message(error)}`);
  }

  if (result.pool) {
    try {
      const paid = await deps.buyWithX402(`${CMC_PAIR_QUOTES_URL}?pair_address=${result.pool.address}`, CMC_MAX_USD);
      if (paid.ok === true) {
        const numbers = pickNumbers(paid.json, CMC_FIELDS);
        const parts = CMC_FIELDS.filter((key) => numbers[key] !== undefined).map((key) => `${key} ${numbers[key]}`);
        result.cmc = {
          summary: parts.length > 0 ? parts.join(", ") : JSON.stringify(paid.json).slice(0, 200),
          paidUsd: typeof paid.paid_usd === "number" ? paid.paid_usd : null,
        };
      } else result.notes.push(`CMC x402 refused: ${String(paid.message ?? paid.error ?? "unknown")}`);
    } catch (error) {
      result.notes.push(`CMC x402 failed: ${message(error)}`);
    }
  }
  return result;
}
