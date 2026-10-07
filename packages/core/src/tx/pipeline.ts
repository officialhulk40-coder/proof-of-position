import type { LocalAccount, PublicClient, TransactionReceipt } from "viem";
import { BSC_CHAIN_ID } from "../chain/constants";
import type { W3wClient } from "../w3w/client";
import { broadcastTx, isSimulationSuccess, simulateTx, simulationFailure, type Simulation } from "../w3w/transaction";

/** A legacy (type 0) BSC transaction ready to sign. */
export interface LegacyTxRequest {
  chainId: number;
  nonce: number;
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  gas: bigint;
  gasPrice: bigint;
}

/** Anything that can sign a raw transaction without broadcasting it. Keys never leave the signer. */
export interface TxSigner {
  address: `0x${string}`;
  signTransaction(tx: LegacyTxRequest): Promise<`0x${string}`>;
}

export type PipelineClient = Pick<PublicClient, "getTransactionCount" | "getGasPrice" | "estimateGas" | "waitForTransactionReceipt">;

export class SimulationFailedError extends Error {
  /** The Transaction API's failReason, e.g. "execution reverted: No position, no call." */
  readonly reason: string;

  constructor(reason: string) {
    super(`simulation failed: ${reason}`);
    this.name = "SimulationFailedError";
    this.reason = reason;
  }
}

export interface SendTxParams {
  w3w: W3wClient;
  client: PipelineClient;
  signer: TxSigner;
  tx: { to: `0x${string}`; data: `0x${string}`; value?: bigint; gas?: bigint; gasPrice?: bigint };
  /** Route the broadcast through the Transaction API's private mempool. */
  mev: boolean;
  /** Added on top of eth_estimateGas when tx.gas is not given. Default 20. */
  gasBufferPercent?: number;
  receiptTimeoutMs?: number;
  clock?: () => number;
}

export interface SendTxResult {
  txHash: `0x${string}`;
  orderId: string;
  receipt: TransactionReceipt;
  simulation: Simulation;
  timings: { simulateMs: number; broadcastMs: number; confirmMs: number };
}

/**
 * The project's only write path for keys it controls (demo personas, keeper, analyst):
 * Transaction API simulate → never sign on failure → sign locally → Transaction API broadcast → wait for the receipt.
 */
export async function sendWithTransactionApi(params: SendTxParams): Promise<SendTxResult> {
  const clock = params.clock ?? (() => performance.now());
  const from = params.signer.address;
  const value = params.tx.value ?? 0n;

  const started = clock();
  const simulation = await simulateTx(params.w3w, { from, to: params.tx.to, value: value.toString(), data: params.tx.data });
  if (!isSimulationSuccess(simulation)) throw new SimulationFailedError(simulationFailure(simulation));
  const simulated = clock();

  const nonce = await params.client.getTransactionCount({ address: from, blockTag: "pending" });
  const gasPrice = params.tx.gasPrice ?? (await params.client.getGasPrice());
  const buffer = BigInt(100 + (params.gasBufferPercent ?? 20));
  const gas =
    params.tx.gas ?? ((await params.client.estimateGas({ account: from, to: params.tx.to, data: params.tx.data, value })) * buffer) / 100n;
  const signedTransaction = await params.signer.signTransaction({
    chainId: BSC_CHAIN_ID,
    nonce,
    to: params.tx.to,
    data: params.tx.data,
    value,
    gas,
    gasPrice,
  });
  const { orderId, txHash } = await broadcastTx(params.w3w, { signedTransaction, address: from, enableMevProtection: params.mev });
  const broadcast = clock();

  const hash = txHash as `0x${string}`;
  const receipt = await params.client.waitForTransactionReceipt({ hash, timeout: params.receiptTimeoutMs ?? 90_000 });
  const confirmed = clock();
  if (receipt.status !== "success") throw new Error(`transaction ${hash} reverted on chain`);
  return {
    txHash: hash,
    orderId,
    receipt,
    simulation,
    timings: {
      simulateMs: Math.round(simulated - started),
      broadcastMs: Math.round(broadcast - simulated),
      confirmMs: Math.round(confirmed - broadcast),
    },
  };
}

/** Signer over a viem LocalAccount (demo personas, keeper). The key stays inside the account object. */
export function viemAccountSigner(account: LocalAccount): TxSigner {
  return {
    address: account.address,
    signTransaction: (tx) => account.signTransaction({ type: "legacy", ...tx }),
  };
}

/** The slice of @bnbagent/sdk's WalletProvider the analyst uses (getWallet() from @bnbagent/studio-runtime/wallet). */
export interface RawTxWallet {
  readonly address: `0x${string}`;
  signTransaction(tx: LegacyTxRequest): Promise<{ rawTransaction: `0x${string}` }>;
}

/** Signer over an Agent Studio / BNB Agent SDK wallet: signs in-process, never exports the key. */
export function walletProviderSigner(wallet: RawTxWallet): TxSigner {
  return {
    address: wallet.address,
    signTransaction: async (tx) => (await wallet.signTransaction(tx)).rawTransaction,
  };
}
