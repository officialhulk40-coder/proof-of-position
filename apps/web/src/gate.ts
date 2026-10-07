import { CALL_REGISTRY_ABI } from "@pop/core/browser";
import { BaseError, ContractFunctionRevertedError, encodeFunctionData, type PublicClient } from "viem";
import { ApiError, type ApiClient } from "./api/client";

/** "Try the gate": a fixed address that holds no tokenized stock, posting 0.01 TSLAB. */
export const GATE_PROBE_ADDRESS = "0x000000000000000000000000000000000000c0de";
export const GATE_PROBE_SYMBOL = "TSLAB";
export const GATE_PROBE_AMOUNT = 10_000_000_000_000_000n;

export type DryRunVia = "Binance Transaction API simulate" | "BSC eth_call";

export interface DryRunResult {
  ok: boolean;
  /** The revert reason exactly as reported, e.g. "No position, no call." */
  reason: string | null;
  via: DryRunVia;
}

export interface PostArgs {
  registry: `0x${string}`;
  from: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  note: string;
}

export function encodePost(token: `0x${string}`, amount: bigint, note: string): `0x${string}` {
  return encodeFunctionData({ abi: CALL_REGISTRY_ABI, functionName: "post", args: [token, amount, note] });
}

/** Human-readable revert: the require string, or CustomError(args) for the registry's custom errors. */
export function revertReason(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      if (reverted.reason) return reverted.reason;
      if (reverted.data) return `${reverted.data.errorName}(${(reverted.data.args ?? []).map(String).join(", ")})`;
      return reverted.shortMessage;
    }
    return error.shortMessage;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Simulates post(token, amount, note) from `from` without signing anything: first through the server's
 * Transaction API simulate, then (server unreachable or Web3 API unavailable) straight against BSC RPC.
 */
export async function dryRunPost(api: ApiClient, chain: Pick<PublicClient, "simulateContract">, args: PostArgs): Promise<DryRunResult> {
  try {
    const simulation = await api.dryRun({ from: args.from, to: args.registry, data: encodePost(args.token, args.amount, args.note) });
    return {
      ok: simulation.success,
      reason: simulation.success ? null : (simulation.failReason ?? simulation.status),
      via: "Binance Transaction API simulate",
    };
  } catch (error) {
    if (!(error instanceof ApiError) && !(error instanceof TypeError)) throw error;
  }
  try {
    await chain.simulateContract({
      address: args.registry,
      abi: CALL_REGISTRY_ABI,
      functionName: "post",
      args: [args.token, args.amount, args.note],
      account: args.from,
    });
    return { ok: true, reason: null, via: "BSC eth_call" };
  } catch (error) {
    return { ok: false, reason: revertReason(error), via: "BSC eth_call" };
  }
}
