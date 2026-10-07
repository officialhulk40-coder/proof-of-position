import {
  ADDRESSES,
  ERC20_ABI,
  buildSwap,
  formatUnits18,
  getApproveTransaction,
  getQuote,
  getTokenInfo,
  isFollowable,
  isSimulationSuccess,
  parseUnits18,
  pickSwapRoute,
  simulateTx,
  type QuoteRoute,
  type Simulation,
} from "@pop/core";
import { Hono } from "hono";
import { encodeFunctionData } from "viem";
import { z } from "zod";
import { requireW3w, type ServerDeps } from "../deps";
import { HttpError } from "../errors";

const followBodySchema = z.object({
  token: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "token must be a 0x address"),
  /** USDT to spend, decimal string, e.g. "5". */
  usdtAmount: z.string().regex(/^\d+(\.\d{1,18})?$/, "usdtAmount must be a positive decimal"),
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "wallet must be a 0x address"),
});
type FollowBody = z.infer<typeof followBodySchema>;

export interface UnsignedTx {
  from: string;
  to: string;
  data: string;
  value: string;
  gas: string | null;
  gasPrice: string | null;
}

export type FollowBuildResponse =
  | { next: "approve"; tx: UnsignedTx; simulation: Simulation; spender: string }
  | { next: "swap"; tx: UnsignedTx; simulation: Simulation; toTokenAmount: string; minReceiveAmount: string | null };

async function quoteSwapRoute(deps: ServerDeps, body: FollowBody): Promise<{ route: QuoteRoute; amount: bigint }> {
  const token = getTokenInfo(body.token);
  if (!token) throw new HttpError(400, "UNKNOWN_TOKEN", "token is not in the tokenized-stock catalog");
  if (!isFollowable(token)) throw new HttpError(400, "NOT_FOLLOWABLE", "follows execute on bStocks only (Ondo is RFQ-only, xStocks are illiquid on BSC)");
  const amount = parseUnits18(body.usdtAmount);
  if (amount === 0n) throw new HttpError(400, "ZERO_AMOUNT", "usdtAmount must be greater than zero");
  const routes = await getQuote(requireW3w(deps), { fromToken: ADDRESSES.usdt, toToken: token.address, amount, userWalletAddress: body.wallet });
  const route = pickSwapRoute(routes);
  if (!route) throw new HttpError(409, "NO_SWAP_ROUTE", "no SWAP route right now (only RFQ, which closes outside US market hours)");
  return { route, amount };
}

function asUnsigned(tx: { from: string; to: string; data: string; value: string; gas?: string | null; gasPrice?: string | null }): UnsignedTx {
  return { from: tx.from, to: tx.to, data: tx.data, value: tx.value, gas: tx.gas ?? null, gasPrice: tx.gasPrice ?? null };
}

/** POST /follow/quote and /follow/build — "Follow with $X" on a bStock via the Trading + Transaction APIs. */
export function followRoutes(deps: ServerDeps): Hono {
  const app = new Hono();

  app.post("/follow/quote", async (c) => {
    const body = followBodySchema.parse(await c.req.json());
    const { route } = await quoteSwapRoute(deps, body);
    return c.json({
      route: {
        quoteId: route.quoteId,
        vendorName: route.vendorName,
        toTokenAmount: route.toTokenAmount,
        priceImpactPercent: route.priceImpactPercent ?? null,
        approveTarget: route.approveTarget ?? null,
      },
      toTokenFormatted: formatUnits18(BigInt(route.toTokenAmount), 6),
    });
  });

  app.post("/follow/build", async (c) => {
    const body = followBodySchema.parse(await c.req.json());
    const w3w = requireW3w(deps);
    const { route, amount } = await quoteSwapRoute(deps, body);
    const spender = (route.approveTarget ?? ADDRESSES.binanceAggregatorRouter) as `0x${string}`;
    const allowance = await deps.chain.readContract({
      address: ADDRESSES.usdt,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [body.wallet as `0x${string}`, spender],
    });
    if (allowance < amount) {
      const approve = await getApproveTransaction(w3w, { token: ADDRESSES.usdt, amount });
      const data =
        approve.dexContractAddress.toLowerCase() === spender.toLowerCase()
          ? approve.data
          : encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [spender, amount] });
      const tx = asUnsigned({ from: body.wallet, to: ADDRESSES.usdt, data, value: "0", gas: approve.gasLimit, gasPrice: approve.gasPrice });
      const simulation = await simulateTx(w3w, tx);
      const response: FollowBuildResponse = { next: "approve", tx, simulation, spender };
      return c.json(response);
    }
    const swap = await buildSwap(w3w, {
      fromToken: ADDRESSES.usdt,
      toToken: body.token,
      amount,
      userWalletAddress: body.wallet,
      quoteId: route.quoteId,
      slippagePercent: "1",
    });
    const tx = asUnsigned(swap.tx);
    const simulation = await simulateTx(w3w, tx);
    if (!isSimulationSuccess(simulation)) {
      return c.json({ error: { code: "SIMULATION_FAILED", msg: simulation.failReason ?? simulation.status }, simulation }, 409);
    }
    const response: FollowBuildResponse = {
      next: "swap",
      tx,
      simulation,
      toTokenAmount: swap.routerResult.toTokenAmount,
      minReceiveAmount: swap.tx.minReceiveAmount ?? null,
    };
    return c.json(response);
  });

  return app;
}
