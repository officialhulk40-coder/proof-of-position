import { z } from "zod";
import { BINANCE_CHAIN_ID } from "../chain/constants";
import type { W3wClient } from "./client";

export const tokenTradeSchema = z.object({
  txHash: z.string(),
  userAddress: z.string(),
  dexName: z.string().nullish(),
  /** "buy" or "sell", relative to the queried token. */
  type: z.string(),
  /** USD price per token. */
  price: z.string().nullish(),
  /** USD value of the trade. */
  volume: z.string().nullish(),
  /** Unix milliseconds. */
  time: z.number(),
  /** [0] = the queried token, [1] = the pair token. */
  changedTokenInfo: z
    .array(z.object({ amount: z.string(), tokenSymbol: z.string().nullish(), tokenContractAddress: z.string() }))
    .nullish()
    .transform((value) => value ?? []),
});
export type TokenTrade = z.infer<typeof tokenTradeSchema>;

const tradesPageSchema = z.object({
  cursor: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  trades: z.array(tokenTradeSchema),
});
export type TradesPage = z.infer<typeof tradesPageSchema>;

/** GET /api/v1/dex/market/trades — newest first; walletAddressFilter takes at most two addresses. */
export function getTokenTrades(
  client: W3wClient,
  params: { token: string; wallets?: readonly string[]; limit?: number; cursor?: string },
): Promise<TradesPage> {
  if (params.wallets && params.wallets.length > 2) {
    throw new Error("walletAddressFilter takes at most two addresses");
  }
  return client.get(
    "/api/v1/dex/market/trades",
    {
      binanceChainId: BINANCE_CHAIN_ID,
      tokenContractAddress: params.token,
      walletAddressFilter: params.wallets?.join(","),
      limit: params.limit,
      cursor: params.cursor,
    },
    tradesPageSchema,
  );
}

export const liquidityPoolSchema = z.object({
  pool: z.string(),
  protocolName: z.string().nullish(),
  liquidityUsd: z.string().nullable(),
  poolAddress: z.string(),
});
export type LiquidityPool = z.infer<typeof liquidityPoolSchema>;

/** GET /api/v1/dex/market/token/top-liquidity — the token's deepest pools. */
export function getTopLiquidityPools(client: W3wClient, token: string): Promise<LiquidityPool[]> {
  return client.get(
    "/api/v1/dex/market/token/top-liquidity",
    { binanceChainId: BINANCE_CHAIN_ID, tokenContractAddress: token },
    z.array(liquidityPoolSchema),
  );
}
