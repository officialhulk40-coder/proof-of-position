import { z } from "zod";
import { BINANCE_CHAIN_ID } from "../chain/constants";
import type { W3wClient } from "./client";

const tokenMetaSchema = z.object({
  tokenContractAddress: z.string(),
  tokenSymbol: z.string().nullish(),
  tokenUnitPrice: z.string().nullish(),
  decimal: z.union([z.string(), z.number()]).nullish(),
});

export const quoteRouteSchema = z.object({
  /** Per-route id; /swap must be called with it within about 30 s (40401 QUOTE_EXPIRED). */
  quoteId: z.string(),
  vendorName: z.string(),
  fromTokenAmount: z.string(),
  toTokenAmount: z.string(),
  priceImpactPercent: z.string().nullish(),
  /** "SWAP" (sign + broadcast a tx) or "RFQ" (EIP-712 order; not used by this project). */
  executionMode: z.string(),
  /** Spender to approve for this route. */
  approveTarget: z.string().nullish(),
  isBest: z.boolean().nullish(),
  tradeFee: z.string().nullish(),
  fromToken: tokenMetaSchema.nullish(),
  toToken: tokenMetaSchema.nullish(),
});
export type QuoteRoute = z.infer<typeof quoteRouteSchema>;

export interface QuoteParams {
  fromToken: string;
  toToken: string;
  /** Sell amount in the from-token's smallest unit. */
  amount: bigint;
  /** Required for equity-token quotes. */
  userWalletAddress: string;
}

/** GET /api/v1/dex/aggregator/quote — every vendor's route, best first. */
export function getQuote(client: W3wClient, params: QuoteParams): Promise<QuoteRoute[]> {
  return client.get(
    "/api/v1/dex/aggregator/quote",
    {
      binanceChainId: BINANCE_CHAIN_ID,
      amount: params.amount.toString(),
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      userWalletAddress: params.userWalletAddress,
    },
    z.array(quoteRouteSchema),
  );
}

/** The SWAP route with the largest output, or null when only RFQ routes exist (e.g. Ondo, or bStock RFQ-only). */
export function pickSwapRoute(routes: readonly QuoteRoute[]): QuoteRoute | null {
  let best: QuoteRoute | null = null;
  for (const route of routes) {
    if (route.executionMode !== "SWAP") continue;
    if (best === null || BigInt(route.toTokenAmount) > BigInt(best.toTokenAmount)) best = route;
  }
  return best;
}

export const swapTxSchema = z.object({
  from: z.string(),
  to: z.string(),
  data: z.string(),
  value: z.string(),
  gas: z.string().nullish(),
  gasPrice: z.string().nullish(),
  minReceiveAmount: z.string().nullish(),
  slippagePercent: z.string().nullish(),
});
export type SwapTx = z.infer<typeof swapTxSchema>;

export const swapResultSchema = z.object({
  routerResult: z.object({
    vendorName: z.string().nullish(),
    fromTokenAmount: z.string(),
    toTokenAmount: z.string(),
    priceImpactPercent: z.string().nullish(),
  }),
  tx: swapTxSchema,
  executionMode: z.string(),
  rfq: z.unknown().nullish(),
});
export type SwapResult = z.infer<typeof swapResultSchema>;

export interface SwapParams extends QuoteParams {
  quoteId: string;
  /** Max slippage as a percent string (default "1"). Ignored when autoSlippage is true. */
  slippagePercent?: string;
  autoSlippage?: boolean;
}

/** GET /api/v1/dex/aggregator/swap — calldata for a quoted route (40462 if params differ from the quote). */
export function buildSwap(client: W3wClient, params: SwapParams): Promise<SwapResult> {
  return client.get(
    "/api/v1/dex/aggregator/swap",
    {
      binanceChainId: BINANCE_CHAIN_ID,
      amount: params.amount.toString(),
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      userWalletAddress: params.userWalletAddress,
      quoteId: params.quoteId,
      slippagePercent: params.autoSlippage ? undefined : (params.slippagePercent ?? "1"),
      autoSlippage: params.autoSlippage ? "true" : undefined,
    },
    swapResultSchema,
  );
}

export const approveTxSchema = z.object({
  data: z.string(),
  dexContractAddress: z.string(),
  gasLimit: z.string().nullish(),
  gasPrice: z.string().nullish(),
});
export type ApproveTx = z.infer<typeof approveTxSchema>;

/**
 * GET /api/v1/dex/aggregator/approve-transaction — ERC-20 approve calldata for the DEX router.
 * `vendor` is required only when approving an equity token (pass the route's vendorName).
 */
export async function getApproveTransaction(
  client: W3wClient,
  params: { token: string; amount: bigint; vendor?: string },
): Promise<ApproveTx> {
  const list = await client.get(
    "/api/v1/dex/aggregator/approve-transaction",
    {
      binanceChainId: BINANCE_CHAIN_ID,
      tokenContractAddress: params.token,
      approveAmount: params.amount.toString(),
      vendor: params.vendor,
    },
    z.array(approveTxSchema),
  );
  const first = list[0];
  if (!first) throw new Error("approve-transaction returned no transaction");
  return first;
}
