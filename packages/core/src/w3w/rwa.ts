import { z } from "zod";
import { BINANCE_CHAIN_ID } from "../chain/constants";
import type { W3wClient } from "./client";

/** RWA Data statusInfo. marketStatus is a free string: "offhours" is returned although undocumented. */
export const statusInfoSchema = z.object({
  openState: z.boolean(),
  marketStatus: z.string(),
  reasonCode: z.string().nullish(),
  reasonMsg: z.string().nullish(),
  nextOpenTime: z.number().nullish(),
  nextCloseTime: z.number().nullish(),
});
export type StatusInfo = z.infer<typeof statusInfoSchema>;

export const rwaTokenSchema = z.object({
  binanceChainId: z.string(),
  tokenContractAddress: z.string(),
  platformId: z.string(),
  assetType: z.number().nullish(),
  tokenName: z.string(),
  tokenSymbol: z.string(),
  decimals: z.union([z.string(), z.number()]).transform((value) => Number(value)),
  underlyingTicker: z.string(),
  underlyingName: z.string(),
  tokenToShareRatio: z.string(),
  statusInfo: statusInfoSchema.nullish(),
  tokenPrice: z.string().nullish(),
  referencePrice: z.string().nullish(),
});
export type RwaToken = z.infer<typeof rwaTokenSchema>;

export const rwaPriceSchema = z.object({
  tokenContractAddress: z.string(),
  platformId: z.string().nullish(),
  tokenPrice: z.string(),
  referencePrice: z.string().nullish(),
  tokenPriceUpdatedAt: z.number().nullish(),
});
export type RwaPrice = z.infer<typeof rwaPriceSchema>;

/** GET /api/v1/dex/market/rwa/tokens on BSC (bStock + Ondo; xStocks are not covered by RWA Data). */
export function getRwaTokens(client: W3wClient, params: { platformId?: "ondo" | "bstock" } = {}): Promise<RwaToken[]> {
  return client.get(
    "/api/v1/dex/market/rwa/tokens",
    { binanceChainId: BINANCE_CHAIN_ID, platformId: params.platformId },
    z.array(rwaTokenSchema),
  );
}

/** GET /api/v1/dex/market/rwa/price, at most 100 addresses per request (batched here). */
export async function getRwaPrices(client: W3wClient, addresses: readonly string[]): Promise<RwaPrice[]> {
  const prices: RwaPrice[] = [];
  for (let start = 0; start < addresses.length; start += 100) {
    const batch = addresses.slice(start, start + 100);
    prices.push(
      ...(await client.get(
        "/api/v1/dex/market/rwa/price",
        { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddresses: batch.join(",") },
        z.array(rwaPriceSchema),
      )),
    );
  }
  return prices;
}
