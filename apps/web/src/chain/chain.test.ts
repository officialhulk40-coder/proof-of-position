import { toCallView, type RawCall } from "@pop/core/browser";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { diffCalls } from "./diff";
import { useLiveCall, useLiveCalls, type LiveCallsClient } from "./useLiveCalls";

const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

function raw(overrides: Partial<RawCall> = {}): RawCall {
  return {
    caller: "0x1111111111111111111111111111111111111111",
    token: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436",
    model: 1,
    hasAgent: false,
    heldThrough: false,
    exitStatus: 0,
    postedBlock: 100n,
    postedAt: 1_791_000_000n,
    closedBlock: 0n,
    exitBlock: 0n,
    agentId: 0n,
    declaredAmount: 20_000_000_000_000_000n,
    declaredBase: 20_000_000_000_000_000n,
    note: "",
    ...overrides,
  };
}

describe("diffCalls", () => {
  it("reports exits, trims, closes and newly recorded exits", () => {
    const before = [toCallView(0, raw(), 0), toCallView(1, raw(), 0), toCallView(2, raw(), 0), toCallView(3, raw(), 2), toCallView(4, raw(), 0)];
    const after = [
      toCallView(0, raw(), 2),
      toCallView(1, raw(), 1),
      toCallView(2, raw({ closedBlock: 9n }), 3),
      toCallView(3, raw({ exitBlock: 9n, exitStatus: 2 }), 2),
      toCallView(4, raw(), 0),
      toCallView(5, raw(), 2),
    ];
    expect(diffCalls(before, after)).toEqual([
      { callId: 0, from: "HOLDING", to: "EXITED", kind: "exited" },
      { callId: 1, from: "HOLDING", to: "TRIMMED", kind: "trimmed" },
      { callId: 2, from: "HOLDING", to: "CLOSED", kind: "closed" },
      { callId: 3, from: "EXITED", to: "EXITED", kind: "exit-recorded" },
    ]);
  });

  it("ignores buy-backs to HOLDING", () => {
    expect(diffCalls([toCallView(0, raw(), 2)], [toCallView(0, raw(), 0)])).toEqual([]);
  });
});

describe("useLiveCalls", () => {
  it("re-reads calls on each block and reports flips", async () => {
    let statuses = [0];
    let emit: (n: bigint) => void = () => {};
    const client = {
      async readContract(request: { functionName: string; args?: readonly unknown[] }) {
        if (request.functionName === "callCount") return 1n;
        return [[raw()], statuses];
      },
      watchBlockNumber(options: { onBlockNumber: (n: bigint) => void }) {
        emit = options.onBlockNumber;
        emit(100n);
        return () => {};
      },
    } as unknown as LiveCallsClient;
    const seen: string[] = [];
    const { result } = renderHook(() => useLiveCalls(client, REGISTRY, { onFlips: (flips) => seen.push(...flips.map((f) => f.kind)) }));
    await waitFor(() => expect(result.current.calls[0]?.status).toBe("HOLDING"));
    expect(result.current.blockNumber).toBe(100n);
    statuses = [2];
    await act(async () => emit(101n));
    await waitFor(() => expect(result.current.calls[0]?.status).toBe("EXITED"));
    expect(seen).toEqual(["exited"]);
  });

  it("does nothing without a registry", () => {
    const client = {
      readContract: async () => {
        throw new Error("should not read");
      },
      watchBlockNumber: () => {
        throw new Error("should not watch");
      },
    } as unknown as LiveCallsClient;
    const { result } = renderHook(() => useLiveCalls(client, null));
    expect(result.current).toEqual({ calls: [], total: 0, blockNumber: null, loading: false, error: null });
  });

  it("reads a single call by id", async () => {
    const seen: unknown[] = [];
    const client = {
      async readContract(request: { functionName: string; args?: readonly unknown[] }) {
        seen.push(request.functionName, request.args);
        return [[raw({ note: "seven" })], [0]];
      },
      watchBlockNumber(options: { onBlockNumber: (n: bigint) => void }) {
        options.onBlockNumber(5n);
        return () => {};
      },
    } as unknown as LiveCallsClient;
    const { result } = renderHook(() => useLiveCall(client, REGISTRY, 7));
    await waitFor(() => expect(result.current.call?.note).toBe("seven"));
    expect(result.current.call?.id).toBe(7);
    expect(seen.slice(0, 2)).toEqual(["getCalls", [7n, 1n]]);
  });
});
