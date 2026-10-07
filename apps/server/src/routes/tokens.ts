import { TOKEN_CATALOG, W3wApiError, getRwaTokens, type RwaToken, type StatusInfo, type TokenInfo } from "@pop/core";
import { Hono } from "hono";
import { createTtlCache } from "../cache";
import type { ServerDeps } from "../deps";

export interface TokenDto extends TokenInfo {
  /** Underlying company / fund name from RWA Data (null for xStocks: not covered). */
  name: string | null;
  tokenToShareRatio: string | null;
  priceUsd: string | null;
  status: StatusInfo | null;
}

export interface TokensResponse {
  updatedAt: number;
  /** Set when RWA enrichment failed or is not configured; the catalog part is always present. */
  degraded: { code: number; msg: string } | null;
  tokens: TokenDto[];
}

export async function loadTokens(deps: ServerDeps): Promise<TokensResponse> {
  let rwa: RwaToken[] = [];
  let degraded: TokensResponse["degraded"] = null;
  if (deps.w3w === null) {
    degraded = { code: -1, msg: "the Binance Web3 API is not configured on this server" };
  } else {
    try {
      rwa = await getRwaTokens(deps.w3w);
    } catch (error) {
      if (!(error instanceof W3wApiError)) throw error;
      degraded = { code: error.code, msg: error.msg };
    }
  }
  const byAddress = new Map(rwa.map((token) => [token.tokenContractAddress.toLowerCase(), token]));
  const tokens = TOKEN_CATALOG.map((token): TokenDto => {
    const enriched = byAddress.get(token.address);
    return {
      ...token,
      name: enriched?.underlyingName ?? null,
      tokenToShareRatio: enriched?.tokenToShareRatio ?? null,
      priceUsd: enriched?.tokenPrice ?? null,
      status: enriched?.statusInfo ?? null,
    };
  });
  return { updatedAt: deps.now(), degraded, tokens };
}

/** GET /tokens — the 675-token catalog merged with RWA Data (share ratio, price, market status), cached 60 s. */
export function tokensRoutes(deps: ServerDeps): Hono {
  const app = new Hono();
  const cache = createTtlCache<TokensResponse>(60_000, deps.now);
  app.get("/tokens", async (c) => c.json(await cache.get(() => loadTokens(deps))));
  return app;
}
