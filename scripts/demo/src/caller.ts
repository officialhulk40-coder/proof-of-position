import {
  ADDRESSES,
  BSC_CHAIN_ID,
  CALL_REGISTRY_ABI,
  ERC20_ABI,
  broadcastTx,
  isSimulationSuccess,
  parseUnits18,
  sendWithTransactionApi,
  simulateTx,
  simulationFailure,
  swapWithTradingApi,
  type RegistryReader,
  type SwapClient,
  type TokenInfo,
  type TxSigner,
  type W3wClient,
} from "@pop/core";
import { encodeFunctionData, parseEventLogs } from "viem";

export interface CallerDeps {
  w3w: W3wClient;
  client: SwapClient & RegistryReader;
  signer: TxSigner;
  registry: `0x${string}`;
}

/** Gas limit for the deliberately reverting try-gate post (a revert cannot be estimated). */
export const TRY_GATE_GAS = 200_000n;

/** Buys `usdt` USDT of `token` (Trading API, simulate first, MEV protection on). */
export async function callerBuy(deps: CallerDeps, token: TokenInfo, usdt: string): Promise<{ received: bigint; txHash: `0x${string}` }> {
  const swap = await swapWithTradingApi({ ...deps, fromToken: ADDRESSES.usdt, toToken: token.address, amount: parseUnits18(usdt), mev: true });
  return { received: swap.received, txHash: swap.swap.txHash };
}

/** post(token, amount, note) from the caller; the simulation refuses ("No position, no call.") when it does not hold enough. */
export async function callerPost(deps: CallerDeps, token: TokenInfo, amount: string, note: string): Promise<{ callId: number; txHash: `0x${string}` }> {
  const data = encodeFunctionData({ abi: CALL_REGISTRY_ABI, functionName: "post", args: [token.address, parseUnits18(amount), note] });
  const result = await sendWithTransactionApi({ w3w: deps.w3w, client: deps.client, signer: deps.signer, tx: { to: deps.registry, data }, mev: false });
  const [event] = parseEventLogs({ abi: CALL_REGISTRY_ABI, eventName: "CallPosted", logs: result.receipt.logs });
  if (!event) throw new Error(`post mined in ${result.txHash} but emitted no CallPosted`);
  return { callId: Number(event.args.callId), txHash: result.txHash };
}

/** Sells the caller's whole balance of `token` back to USDT: the money shot's "the caller sold". */
export async function callerSell(deps: CallerDeps, token: TokenInfo): Promise<{ sold: bigint; received: bigint; txHash: `0x${string}` } | null> {
  const balance = await deps.client.readContract({ address: token.address, abi: ERC20_ABI, functionName: "balanceOf", args: [deps.signer.address] });
  if (balance === 0n) return null;
  const swap = await swapWithTradingApi({ ...deps, fromToken: token.address, toToken: ADDRESSES.usdt, amount: balance, mev: true });
  return { sold: balance, received: swap.received, txHash: swap.swap.txHash };
}

/**
 * The gate, shown two ways: the Transaction API simulate of post(token, amount) from a caller that does
 * not hold it (the revert reason, nothing signed), and with `broadcast` the same post signed and sent
 * anyway, so BscScan shows the failed transaction with "No position, no call.".
 */
export async function callerTryGate(
  deps: CallerDeps,
  token: TokenInfo,
  amount: string,
  broadcast: boolean,
): Promise<{ wouldSucceed: boolean; failReason: string | null; txHash: `0x${string}` | null }> {
  const data = encodeFunctionData({ abi: CALL_REGISTRY_ABI, functionName: "post", args: [token.address, parseUnits18(amount), "Try the gate"] });
  const simulation = await simulateTx(deps.w3w, { from: deps.signer.address, to: deps.registry, value: "0", data });
  if (isSimulationSuccess(simulation)) return { wouldSucceed: true, failReason: null, txHash: null };
  const failReason = simulationFailure(simulation);
  if (!broadcast) return { wouldSucceed: false, failReason, txHash: null };
  const nonce = await deps.client.getTransactionCount({ address: deps.signer.address, blockTag: "pending" });
  const gasPrice = await deps.client.getGasPrice();
  const signedTransaction = await deps.signer.signTransaction({ chainId: BSC_CHAIN_ID, nonce, to: deps.registry, data, value: 0n, gas: TRY_GATE_GAS, gasPrice });
  const { txHash } = await broadcastTx(deps.w3w, { signedTransaction, address: deps.signer.address, enableMevProtection: false });
  await deps.client.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 90_000 });
  return { wouldSucceed: false, failReason, txHash: txHash as `0x${string}` };
}
