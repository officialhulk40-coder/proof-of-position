import { TOKEN_CATALOG } from "@pop/core/browser";
import { useEffect, useState } from "react";
import type { ApiClient, TokenDto } from "./client";

export interface TokensState {
  /** Lower-case address → token. Always has the 675 catalog entries, enriched when the API answers. */
  byAddress: Map<string, TokenDto>;
  /** Why enrichment is missing (server down, 40304, not configured), or null. */
  degraded: string | null;
}

export function catalogOnly(): Map<string, TokenDto> {
  return new Map(
    TOKEN_CATALOG.map((token) => [token.address, { ...token, name: null, tokenToShareRatio: null, priceUsd: null, status: null }]),
  );
}

/** Loads /api/tokens once; the feed still renders from the bundled catalog if the server is unreachable. */
export function useTokens(api: ApiClient): TokensState {
  const [state, setState] = useState<TokensState>(() => ({ byAddress: catalogOnly(), degraded: null }));
  useEffect(() => {
    let cancelled = false;
    api
      .tokens()
      .then((response) => {
        if (cancelled) return;
        setState({
          byAddress: new Map(response.tokens.map((token) => [token.address.toLowerCase(), token])),
          degraded: response.degraded?.msg ?? null,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState((current) => ({ ...current, degraded: error instanceof Error ? error.message : String(error) }));
      });
    return () => {
      cancelled = true;
    };
  }, [api]);
  return state;
}
