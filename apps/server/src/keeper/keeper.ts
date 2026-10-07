import {
  CALL_REGISTRY_ABI,
  SimulationFailedError,
  needsExitRecord,
  readCallsFrom,
  sendWithTransactionApi,
  type PipelineClient,
  type RegistryReader,
  type TxSigner,
  type W3wClient,
} from "@pop/core";
import { encodeFunctionData } from "viem";

export interface KeeperDeps {
  chain: RegistryReader & PipelineClient;
  w3w: W3wClient;
  signer: TxSigner;
  registry: `0x${string}`;
  onRecorded?: (callId: number, txHash: string) => void;
  /** callId -1 = the read itself failed. */
  onError?: (callId: number, message: string) => void;
}

export interface Keeper {
  /** One pass: record every open call that is no longer HOLDING and has no recorded exit. Never throws. */
  tick(): Promise<number[]>;
}

export function createKeeper(deps: KeeperDeps): Keeper {
  let running = false;
  return {
    async tick() {
      if (running) return [];
      running = true;
      const recorded: number[] = [];
      try {
        const calls = await readCallsFrom(deps.chain, deps.registry, 0);
        for (const call of calls.filter(needsExitRecord)) {
          try {
            const data = encodeFunctionData({ abi: CALL_REGISTRY_ABI, functionName: "recordExit", args: [BigInt(call.id)] });
            const result = await sendWithTransactionApi({ w3w: deps.w3w, client: deps.chain, signer: deps.signer, tx: { to: deps.registry, data }, mev: false });
            recorded.push(call.id);
            deps.onRecorded?.(call.id, result.txHash);
          } catch (error) {
            const message = error instanceof SimulationFailedError ? `simulation failed: ${error.reason}` : error instanceof Error ? error.message : String(error);
            deps.onError?.(call.id, message);
          }
        }
      } catch (error) {
        deps.onError?.(-1, error instanceof Error ? error.message : String(error));
      } finally {
        running = false;
      }
      return recorded;
    },
  };
}

/** Runs keeper.tick() every intervalMs (a tick still running is skipped). Returns a stop function. */
export function startKeeperLoop(keeper: Keeper, intervalMs = 1_000): () => void {
  const timer = setInterval(() => {
    void keeper.tick();
  }, intervalMs);
  return () => clearInterval(timer);
}
