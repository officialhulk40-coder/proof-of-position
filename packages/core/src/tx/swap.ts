import { encodeFunctionData, parseEventLogs, type PublicClient } from "viem";
import { ADDRESSES } from "../chain/constants";
import { ERC20_ABI } from "../registry/abis";
import { getTokenInfo } from "../tokens/catalog";
import type { W3wClient } from "../w3w/client";
import { buildSwap, getApproveTransaction, getQuote, pickSwapRoute, type QuoteRoute } from "../w3w/trading";
import { sendWithTransactionApi, type PipelineClient, type SendTxResult, type TxSigner } from "./pipeline";

/** Chain capabilities a swap needs: the pipeline's plus an allowance read. */
export type SwapClient = PipelineClient & Pick<PublicClient, "readContract">;

/** Only RFQ routes (or none) came back: Ondo is RFQ-only and bStock RFQ closes outside US market hours. */
export class NoSwapRouteError extends Error {
  constructor(fromToken: string, toToken: string) {
    super(`no SWAP route from ${fromToken} to ${toToken} right now (RFQ-only routes are not used)`);
    this.name = "NoSwapRouteError";
  }
}

export interface TradingSwapParams {
  w3w: W3wClient;
  client: SwapClient;
  signer: TxSigner;
  fromToken: `0x${string}`;
  toToken: `0x${string}`;
  /** Sell amount in the from-token's smallest unit. */
  amount: bigint;
  /** Broadcast the approval and the swap through the Transaction API's private mempool. */
  mev: boolean;
  /** Max slippage percent for /swap. Default "1". */
  slippagePercent?: string;
  receiptTimeoutMs?: number;
}

export interface TradingSwapResult {
  route: QuoteRoute;
  /** The approval transaction, or null when the allowance already covered `amount`. */
  approval: SendTxResult | null;
  swap: SendTxResult;
  /** `toToken` received by the signer in the swap transaction (its Transfer logs to the signer). */
  received: bigint;
}

async function quoteSwapRoute(params: TradingSwapParams): Promise<QuoteRoute> {
  const routes = await getQuote(params.w3w, {
    fromToken: params.fromToken,
    toToken: params.toToken,
    amount: params.amount,
    userWalletAddress: params.signer.address,
  });
  const route = pickSwapRoute(routes);
  if (!route) throw new NoSwapRouteError(params.fromToken, params.toToken);
  return route;
}

/**
 * Trading API quote → approve when the allowance is short (then re-quote: quotes expire in about 30 s)
 * → /swap calldata → the Transaction API pipeline (simulate, sign, broadcast, receipt). Every signature
 * is preceded by a successful simulation; a failed one throws SimulationFailedError and signs nothing.
 */
export async function swapWithTradingApi(params: TradingSwapParams): Promise<TradingSwapResult> {
  let route = await quoteSwapRoute(params);
  const spender = (route.approveTarget ?? ADDRESSES.binanceAggregatorRouter) as `0x${string}`;
  const allowance = await params.client.readContract({
    address: params.fromToken,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [params.signer.address, spender],
  });

  let approval: SendTxResult | null = null;
  if (allowance < params.amount) {
    // Equity tokens (bStocks, Ondo, xStocks) need the route's vendor to get their approval calldata.
    const vendor = getTokenInfo(params.fromToken) ? route.vendorName : undefined;
    const approve = await getApproveTransaction(params.w3w, { token: params.fromToken, amount: params.amount, vendor });
    const data =
      approve.dexContractAddress.toLowerCase() === spender.toLowerCase()
        ? (approve.data as `0x${string}`)
        : encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [spender, params.amount] });
    approval = await sendWithTransactionApi({
      w3w: params.w3w,
      client: params.client,
      signer: params.signer,
      tx: { to: params.fromToken, data },
      mev: params.mev,
      receiptTimeoutMs: params.receiptTimeoutMs,
    });
    route = await quoteSwapRoute(params);
  }

  const built = await buildSwap(params.w3w, {
    fromToken: params.fromToken,
    toToken: params.toToken,
    amount: params.amount,
    userWalletAddress: params.signer.address,
    quoteId: route.quoteId,
    slippagePercent: params.slippagePercent ?? "1",
  });
  const swap = await sendWithTransactionApi({
    w3w: params.w3w,
    client: params.client,
    signer: params.signer,
    tx: { to: built.tx.to as `0x${string}`, data: built.tx.data as `0x${string}`, value: BigInt(built.tx.value || "0") },
    mev: params.mev,
    receiptTimeoutMs: params.receiptTimeoutMs,
  });

  const me = params.signer.address.toLowerCase();
  const received = parseEventLogs({ abi: ERC20_ABI, eventName: "Transfer", logs: swap.receipt.logs })
    .filter((log) => log.address.toLowerCase() === params.toToken.toLowerCase() && log.args.to.toLowerCase() === me)
    .reduce((sum, log) => sum + log.args.value, 0n);
  return { route, approval, swap, received };
}
