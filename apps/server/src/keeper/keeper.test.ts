import { CALL_REGISTRY_ABI, createFakeW3wClient, type PipelineClient, type RecordedCall, type RegistryReader, type TxSigner } from "@pop/core";
import { decodeFunctionData, type TransactionReceipt } from "viem";
import { describe, expect, it } from "vitest";
import { TEST_REGISTRY, rawCall } from "../testing";
import { createKeeper } from "./keeper";

const KEEPER = "0x9999999999999999999999999999999999999999";

function chainWith(calls: ReturnType<typeof rawCall>[], statuses: number[]) {
  return {
    async readContract(request: { functionName: string; args?: readonly unknown[] }) {
      if (request.functionName === "callCount") return BigInt(calls.length);
      if (request.functionName === "getCalls") {
        const start = Number(request.args?.[0]);
        const count = Number(request.args?.[1]);
        return [calls.slice(start, start + count), statuses.slice(start, start + count)];
      }
      throw new Error(`unexpected ${request.functionName}`);
    },
    async getTransactionCount() {
      return 1;
    },
    async getGasPrice() {
      return 100_000_000n;
    },
    async estimateGas() {
      return 500_000n;
    },
    async waitForTransactionReceipt({ hash }: { hash: `0x${string}` }) {
      return { status: "success", transactionHash: hash } as unknown as TransactionReceipt;
    },
  } as unknown as RegistryReader & PipelineClient;
}

const signer: TxSigner = { address: KEEPER, signTransaction: async () => "0xf86c" };

function api(simulation: (call: RecordedCall) => unknown) {
  return createFakeW3wClient((call) => {
    if (call.path === "/api/v1/dex/pre-transaction/simulate") return simulation(call);
    if (call.path === "/api/v1/dex/pre-transaction/broadcast-transaction") return { orderId: "1", txHash: `0x${"ab".repeat(32)}` };
    throw new Error(`unexpected ${call.path}`);
  });
}

describe("keeper", () => {
  it("records exits only for open calls that are no longer HOLDING", async () => {
    const calls = [rawCall(), rawCall(), rawCall({ exitBlock: 9n, exitStatus: 2 }), rawCall({ closedBlock: 9n }), rawCall()];
    const statuses = [0, 2, 2, 3, 1];
    const { client, calls: apiCalls } = api(() => ({ status: "SUCCESS", failReason: null }));
    const recorded: number[] = [];
    const keeper = createKeeper({ chain: chainWith(calls, statuses), w3w: client, signer, registry: TEST_REGISTRY, onRecorded: (id) => recorded.push(id) });
    await expect(keeper.tick()).resolves.toEqual([1, 4]);
    expect(recorded).toEqual([1, 4]);
    const simulated = apiCalls.filter((call) => call.path === "/api/v1/dex/pre-transaction/simulate");
    const ids = simulated.map((call) => {
      const tx = (call.body as { evmTx: { to: string; data: `0x${string}` } }).evmTx;
      expect(tx.to).toBe(TEST_REGISTRY);
      const decoded = decodeFunctionData({ abi: CALL_REGISTRY_ABI, data: tx.data });
      expect(decoded.functionName).toBe("recordExit");
      return decoded.args?.[0];
    });
    expect(ids).toEqual([1n, 4n]);
  });

  it("reports a failed simulation (e.g. a race with another recorder) and carries on", async () => {
    const calls = [rawCall(), rawCall()];
    const { client } = api((call) =>
      (call.body as { evmTx: { data: string } }).evmTx.data.endsWith("0".repeat(63) + "0")
        ? { status: "FAILED", failReason: "execution reverted: ExitAlreadyRecorded(0)" }
        : { status: "SUCCESS", failReason: null },
    );
    const errors: string[] = [];
    const keeper = createKeeper({ chain: chainWith(calls, [2, 2]), w3w: client, signer, registry: TEST_REGISTRY, onError: (id, message) => errors.push(`${id}: ${message}`) });
    await expect(keeper.tick()).resolves.toEqual([1]);
    expect(errors).toEqual(["0: simulation failed: execution reverted: ExitAlreadyRecorded(0)"]);
  });

  it("never throws when the chain read fails, and skips overlapping ticks", async () => {
    let release: () => void = () => {};
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chain = {
      async readContract() {
        await blocked;
        throw new Error("rpc down");
      },
    } as unknown as RegistryReader & PipelineClient;
    const errors: string[] = [];
    const keeper = createKeeper({ chain, w3w: api(() => null).client, signer, registry: TEST_REGISTRY, onError: (id, message) => errors.push(`${id}: ${message}`) });
    const first = keeper.tick();
    await expect(keeper.tick()).resolves.toEqual([]);
    release();
    await expect(first).resolves.toEqual([]);
    expect(errors).toEqual(["-1: rpc down"]);
  });
});
