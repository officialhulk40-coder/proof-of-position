import { TOKEN_CATALOG } from "./catalog.generated";
import type { Issuer, TokenInfo } from "./types";

export { TOKEN_CATALOG };

const byAddress = new Map<string, TokenInfo>(TOKEN_CATALOG.map((token) => [token.address, token]));
const bySymbol = new Map<string, TokenInfo>(TOKEN_CATALOG.map((token) => [token.symbol.toLowerCase(), token]));

/** The four bStocks the analyst watches and follows execute on (deep 24/7 AMM liquidity). */
export const DEFAULT_WATCHLIST: readonly string[] = ["NVDAB", "TSLAB", "AAPLB", "SPYB"];

export function getTokenInfo(address: string): TokenInfo | undefined {
  return byAddress.get(address.toLowerCase());
}

export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return bySymbol.get(symbol.toLowerCase());
}

export function requireTokenBySymbol(symbol: string): TokenInfo {
  const token = getTokenBySymbol(symbol);
  if (!token) throw new Error(`unknown token symbol ${symbol}`);
  return token;
}

export function tokensByIssuer(issuer: Issuer): TokenInfo[] {
  return TOKEN_CATALOG.filter((token) => token.issuer === issuer);
}

/** Case-insensitive search: exact symbol first, then symbol/ticker prefix matches, bStocks before others. */
export function findTokens(query: string, limit = 20): TokenInfo[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const issuerRank: Record<Issuer, number> = { bStocks: 0, Ondo: 1, xStocks: 2 };
  return TOKEN_CATALOG.filter((token) => token.symbol.toLowerCase().startsWith(q) || token.ticker.toLowerCase().startsWith(q))
    .sort((a, b) => {
      const exactA = a.symbol.toLowerCase() === q ? 0 : 1;
      const exactB = b.symbol.toLowerCase() === q ? 0 : 1;
      return exactA - exactB || issuerRank[a.issuer] - issuerRank[b.issuer] || a.symbol.localeCompare(b.symbol);
    })
    .slice(0, limit);
}

/** Follow execution runs on bStocks only (spec §8.1): Ondo is RFQ-only and xStocks are illiquid on BSC. */
export function isFollowable(token: TokenInfo): boolean {
  return token.issuer === "bStocks";
}
