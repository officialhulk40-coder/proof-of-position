import { ADDRESSES, formatUnits18 } from "@pop/core";
import { getMarketOrder, marketSwap, txLock, walletStatus, type BawRunner } from "./baw";

export interface ExecutorDeps {
  baw: BawRunner;
  /** Raw ERC-20 balance read from BSC (viem readContract balanceOf). */
  balanceOf: (token: `0x${string}`, owner: `0x${string}`) => Promise<bigint>;
  /** The Agentic Wallet's BSC address. */
  wallet: `0x${string}`;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
  /** Order and lock polling interval. Default 2 s. */
  pollMs?: number;
  /** Cap on waiting for a lock to clear or an order to finish. Default 90 s. */
  timeoutMs?: number;
}

/** The Agentic Wallet is signed out: stop the loop and ask the user to sign in again. */
export class WalletSignedOutError extends Error {
  constructor(status: string) {
    super(`Agentic Wallet is ${status}: sign in again with \`baw auth signin\`, then restart pop-follower`);
    this.name = "WalletSignedOutError";
  }
}

export class OrderFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderFailedError";
  }
}

export interface OrderOutcome {
  orderId: string;
  txHash: string | null;
  submittedAt: number;
  finishedAt: number;
}

/** Throws WalletSignedOutError unless `baw wallet status` is CONNECTED. */
export async function requireConnected(baw: BawRunner): Promise<void> {
  const status = await walletStatus(baw);
  if (status !== "CONNECTED") throw new WalletSignedOutError(status);
}

/** Waits while the wallet is LOCKED (a pending tx, or a double-confirm waiting in the Binance App). */
async function waitUnlocked(deps: ExecutorDeps): Promise<void> {
  const deadline = deps.now() + (deps.timeoutMs ?? 90_000);
  for (;;) {
    if ((await txLock(deps.baw)) !== "LOCKED") return;
    if (deps.now() >= deadline) throw new OrderFailedError("the wallet stayed LOCKED (pending tx or Binance App confirmation) for 90 s");
    deps.log("wallet LOCKED (a pending tx, or a confirmation waiting in the Binance App); waiting");
    await deps.sleep(deps.pollMs ?? 2_000);
  }
}

/** Submits one market order and polls it to FINISHED or FAILED: a submitted order is not a fill. */
async function runOrder(deps: ExecutorDeps, order: { fromTokenQty: string; fromToken: string; toToken: string }): Promise<OrderOutcome & { status: string }> {
  await waitUnlocked(deps);
  const submittedAt = deps.now();
  const orderId = await marketSwap(deps.baw, { ...order, slippage: "auto", mev: true });
  const deadline = submittedAt + (deps.timeoutMs ?? 90_000);
  for (;;) {
    await deps.sleep(deps.pollMs ?? 2_000);
    const state = await getMarketOrder(deps.baw, orderId);
    if (state && (state.status === "FINISHED" || state.status === "FAILED")) {
      return { orderId, txHash: state.txHash ?? null, status: state.status, submittedAt, finishedAt: deps.now() };
    }
    if (deps.now() >= deadline) throw new OrderFailedError(`order ${orderId} is still ${state?.status ?? "unknown"} after 90 s`);
  }
}

/** A FAILED order (slippage, liquidity, routing) is logged and retried once. */
async function runOrderWithRetry(deps: ExecutorDeps, order: { fromTokenQty: string; fromToken: string; toToken: string }, label: string): Promise<OrderOutcome> {
  const first = await runOrder(deps, order);
  if (first.status === "FINISHED") return first;
  deps.log(`${label}: order ${first.orderId} FAILED; retrying once`);
  const second = await runOrder(deps, order);
  if (second.status === "FINISHED") return second;
  throw new OrderFailedError(`${label}: order ${second.orderId} FAILED twice`);
}

/** Buys `budgetUsdt` USDT of `token`; the quantity is the wallet's on-chain balance increase. */
export async function executeBuy(deps: ExecutorDeps, params: { token: `0x${string}`; budgetUsdt: string }): Promise<OrderOutcome & { quantity: bigint }> {
  const before = await deps.balanceOf(params.token, deps.wallet);
  const outcome = await runOrderWithRetry(deps, { fromTokenQty: params.budgetUsdt, fromToken: ADDRESSES.usdt, toToken: params.token }, "BUY");
  // FINISHED means mined, but a public RPC can lag a block: re-read briefly until the balance moves.
  let after = await deps.balanceOf(params.token, deps.wallet);
  for (let attempt = 0; attempt < 5 && after <= before; attempt += 1) {
    await deps.sleep(1_000);
    after = await deps.balanceOf(params.token, deps.wallet);
  }
  if (after <= before) throw new OrderFailedError(`BUY order ${outcome.orderId} finished but the token balance did not increase`);
  return { ...outcome, quantity: after - before };
}

/** Sells exactly `quantity` (raw units) of `token` back to USDT: only what the follower bought. */
export async function executeSell(deps: ExecutorDeps, params: { token: `0x${string}`; quantity: bigint }): Promise<OrderOutcome> {
  return runOrderWithRetry(deps, { fromTokenQty: formatUnits18(params.quantity, 18), fromToken: params.token, toToken: ADDRESSES.usdt }, "SELL");
}
