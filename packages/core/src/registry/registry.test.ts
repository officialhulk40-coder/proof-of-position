import { encodeFunctionData, toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import { createBscPublicClient } from "../chain/client";
import { CALL_REGISTRY_ABI } from "./abi.generated";
import { readAgentIntegrity, readCallsFrom, readLatestCalls, type RegistryReader } from "./read";
import { needsExitRecord, statusName, toCallView, type RawCall } from "./types";

const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

function rawCall(overrides: Partial<RawCall> = {}): RawCall {
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
    note: "AI capex cycle intact",
    ...overrides,
  };
}

/** A fake CallRegistry/ReputationRegistry answering readContract from in-memory calls. */
function fakeReader(calls: RawCall[], statuses: number[], summary: readonly [bigint, bigint, number] = [0n, 0n, 0]) {
  const requests: Array<{ functionName: string; args?: readonly unknown[] }> = [];
  const reader = {
    async readContract(request: { functionName: string; args?: readonly unknown[] }) {
      requests.push({ functionName: request.functionName, args: request.args });
      if (request.functionName === "callCount") return BigInt(calls.length);
      if (request.functionName === "getCalls") {
        const start = Number(request.args?.[0]);
        const count = Number(request.args?.[1]);
        return [calls.slice(start, start + count), statuses.slice(start, start + count)];
      }
      if (request.functionName === "getSummary") return summary;
      throw new Error(`unexpected ${request.functionName}`);
    },
  } as unknown as RegistryReader;
  return { reader, requests };
}

describe("CALL_REGISTRY_ABI (generated from the forge artifact)", () => {
  it("contains the final CallRegistry surface", () => {
    const functions = new Set<string>(CALL_REGISTRY_ABI.filter((item) => item.type === "function").map((item) => item.name));
    for (const name of ["post", "postAsAgent", "recordExit", "close", "getCalls", "getCall", "statusOf", "liveStatus", "callCount", "openCallOf", "tokenModel", "setTokens"]) {
      expect(functions.has(name)).toBe(true);
    }
    const events = new Set<string>(CALL_REGISTRY_ABI.filter((item) => item.type === "event").map((item) => item.name));
    for (const name of ["CallPosted", "ExitRecorded", "CallClosed", "FeedbackWritten", "FeedbackFailed", "TokenListed"]) {
      expect(events.has(name)).toBe(true);
    }
  });

  it("encodes post with the expected selector", () => {
    const data = encodeFunctionData({
      abi: CALL_REGISTRY_ABI,
      functionName: "post",
      args: ["0x02fca66c1d1afb4e2a7884261eb00f63598a7436", 20_000_000_000_000_000n, "note"],
    });
    expect(data.slice(0, 10)).toBe(toFunctionSelector("function post(address,uint256,string)"));
    expect(data.slice(0, 10)).toBe("0xcfcf5eb9");
  });
});

describe("call views", () => {
  it("converts the decoded struct and status", () => {
    const view = toCallView(4, rawCall({ model: 2, exitStatus: 2, exitBlock: 120n }), 2);
    expect(view.id).toBe(4);
    expect(view.model).toBe("XSTOCK");
    expect(view.exitStatus).toBe("EXITED");
    expect(view.status).toBe("EXITED");
    expect(view.postedAt).toBe(1_791_000_000);
    expect(() => statusName(9)).toThrow("unknown Status ordinal 9");
  });

  it("flags open calls that need a recorded exit", () => {
    expect(needsExitRecord(toCallView(0, rawCall(), 2))).toBe(true);
    expect(needsExitRecord(toCallView(0, rawCall(), 1))).toBe(true);
    expect(needsExitRecord(toCallView(0, rawCall(), 0))).toBe(false);
    expect(needsExitRecord(toCallView(0, rawCall({ exitBlock: 5n, exitStatus: 2 }), 2))).toBe(false);
    expect(needsExitRecord(toCallView(0, rawCall({ closedBlock: 7n }), 3))).toBe(false);
  });
});

describe("registry readers", () => {
  it("reads the newest calls newest-first with correct ids", async () => {
    const calls = [rawCall({ note: "a" }), rawCall({ note: "b" }), rawCall({ note: "c" })];
    const { reader, requests } = fakeReader(calls, [0, 2, 3]);
    const { total, calls: latest } = await readLatestCalls(reader, REGISTRY, 2);
    expect(total).toBe(3);
    expect(latest.map((call) => [call.id, call.note, call.status])).toEqual([
      [2, "c", "CLOSED"],
      [1, "b", "EXITED"],
    ]);
    expect(requests.map((request) => request.functionName)).toEqual(["callCount", "getCalls"]);
    expect(requests[1]?.args).toEqual([1n, 2n]);
  });

  it("returns nothing for an empty registry without calling getCalls", async () => {
    const { reader, requests } = fakeReader([], []);
    await expect(readLatestCalls(reader, REGISTRY, 50)).resolves.toEqual({ total: 0, calls: [] });
    expect(requests).toHaveLength(1);
  });

  it("pages through every call from an id", async () => {
    const calls = Array.from({ length: 5 }, (_, i) => rawCall({ note: String(i) }));
    const { reader } = fakeReader(calls, [0, 0, 0, 0, 0]);
    const all = await readCallsFrom(reader, REGISTRY, 1, 2);
    expect(all.map((call) => call.id)).toEqual([1, 2, 3, 4]);
  });

  it("reads an agent's integrity score from the ERC-8004 summary", async () => {
    const { reader, requests } = fakeReader([], [], [2n, 100n, 0]);
    await expect(
      readAgentIntegrity(reader, { reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", registry: REGISTRY, agentId: 7n }),
    ).resolves.toEqual({ count: 2, score: 100 });
    expect(requests[0]?.args).toEqual([7n, [REGISTRY], "integrity", ""]);
    const none = fakeReader([], [], [0n, 0n, 0]);
    await expect(
      readAgentIntegrity(none.reader, { reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", registry: REGISTRY, agentId: 7n }),
    ).resolves.toEqual({ count: 0, score: null });
  });
});

describe("createBscPublicClient", () => {
  it("targets chain 56", () => {
    expect(createBscPublicClient(["https://rpc.example"]).chain?.id).toBe(56);
  });
});
