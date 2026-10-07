import { z } from "zod";
import { BINANCE_CHAIN_ID } from "../chain/constants";
import type { W3wClient } from "./client";

export const tokenAssetSchema = z.object({
  binanceChainId: z.string(),
  tokenContractAddress: z.string(),
  address: z.string().nullish(),
  symbol: z.string().nullish(),
  /** Human-readable balance. */
  balance: z.string(),
  rawBalance: z.string().nullish(),
  tokenPrice: z.string().nullish(),
});
export type TokenAsset = z.infer<typeof tokenAssetSchema>;

/**
 * POST /api/v1/dex/balance/token-balances-by-address (at most 20 tokens per call).
 * excludeRiskToken "1" includes every token: tokenized stocks must never be filtered out.
 */
export async function getTokenBalances(
  client: W3wClient,
  params: { address: string; tokens: readonly string[] },
): Promise<TokenAsset[]> {
  if (params.tokens.length === 0 || params.tokens.length > 20) {
    throw new Error("token-balances-by-address takes 1 to 20 tokens");
  }
  const data = await client.post(
    "/api/v1/dex/balance/token-balances-by-address",
    {
      address: params.address,
      tokenContractAddresses: params.tokens.map((token) => ({ binanceChainId: BINANCE_CHAIN_ID, tokenContractAddress: token })),
      excludeRiskToken: "1",
    },
    z.array(z.object({ tokenAssets: z.array(tokenAssetSchema) })),
  );
  return data.flatMap((entry) => entry.tokenAssets);
}
