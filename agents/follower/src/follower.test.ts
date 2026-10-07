import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RawCall, RegistryReader, TelemetryEvent } from "@pop/core";
import { describe, expect, it } from "vitest";
import { WalletSignedOutError } from "./executor";
import { createFollower } from "./follower";
import { loadState } from "./state";
import { CALLER, manualClock, NVDAB, REGISTRY, scriptedBaw, WALLET } from "./testing";

interface ChainCall {
  raw: Partial<RawCall>;
  status: number;
}

function rawCall(overrides: Partial<RawCall>): RawCall {
  return {
    caller: CALLER,
    token: NVDAB,
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

/** A registry fake over a mutable call list (callCount + getCalls pages). */
function registry(calls: ChainCall[]): RegistryReader {
  return {
    readContract: async (request: { functionName: string; args?: readonly unknown[] }) => {
      if (request.functionName === "callCount") return BigInt(calls.length);
      const [start, count] = (request.args ?? []) as [bigint, bigint];
      const page = calls.slice(Number(start), Number(start) + Number(count));
      return [page.map((c) => rawCall(c.raw)), page.map((c) => c.status)];
    },
  } as unknown as RegistryReader;
}

function setup(calls: ChainCall[], walletState = "CONNECTED") {
  const dir = mkdtempSync(join(tmpdir(), "pop-follower-"));
  const statePath = join(dir, "state.json");
  let balance = 0n;
  let submitted = 0;
  const { runner, calls: bawCalls } = scriptedBaw({
    "wallet status": () => ({ status: walletState }),
    "wallet tx-lock": () => ({ status: "UNLOCKED" }),
    "market-order swap": (args) => {
      submitted += 1;
      balance += args[5] === NVDAB ? 0n : 5_300_000_000_000_000n;
      if (args[5] === NVDAB) balance = 0n;
      return { orderId: `o${submitted}` };
    },
    "market-order list": (args) => ({ list: [{ orderId: args[3], status: "FINISHED", txHash: `0xtx${args[3]}` }] }),
  });
  const clock = manualClock();
  const lines: string[] = [];
  const events: TelemetryEvent[] = [];
  const deps = {
    chain: registry(calls),
    registry: REGISTRY as `0x${string}`,
    executor: { baw: runner, balanceOf: async () => balance, wallet: WALLET as `0x${string}`, now: clock.now, sleep: clock.sleep, log: (line: string) => lines.push(line) },
    config: { callers: [CALLER], budgetUsdt: "1", maxOpen: 1 },
    statePath,
    log: (line: string) => lines.push(line),
    record: (event: TelemetryEvent) => events.push(event),
  };
  return { deps, statePath, lines, events, bawCalls };
}

describe("follower", () => {
  it("mirrors only calls posted after it starts, then exits with the caller", async () => {
    const calls: ChainCall[] = [{ raw: {}, status: 0 }];
    const { deps, statePath, lines, events } = setup(calls);
    const follower = await createFollower(deps);
    expect(follower.state.cursor).toBe(1);
    expect(await follower.tick()).toEqual([]);

    calls.push({ raw: {}, status: 0 });
    const bought = await follower.tick();
    expect(bought.map((a) => [a.kind, a.call.id])).toEqual([["BUY", 1]]);
    expect(loadState(statePath)?.mirrors["1"]).toMatchObject({ status: "open", quantity: "5300000000000000", buyOrderId: "o1", buyTxHash: "0xtxo1" });
    expect(lines).toContain("Mirrored call #1: you hold 0.0053 NVDAB alongside them (order o1, 2.0 s)");

    calls[1] = { raw: {}, status: 2 };
    const sold = await follower.tick();
    expect(sold.map((a) => [a.kind, a.call.id])).toEqual([["SELL", 1]]);
    expect(loadState(statePath)?.mirrors["1"]).toMatchObject({ status: "closed", sellOrderId: "o2", exitReason: "EXITED" });
    expect(lines.some((line) => line.startsWith("Caller exited — sold 0.0053 NVDAB in 2.0 s"))).toBe(true);
    expect(events.map((e) => e.kind)).toEqual(["follower.buy", "follower.sell"]);
    expect(events[1]).toMatchObject({ callId: 1, reason: "EXITED", detectToSubmitMs: 0, submitToFinishMs: 2000 });
  });

  it("can include calls that were already open", async () => {
    const { deps } = setup([{ raw: {}, status: 0 }]);
    const follower = await createFollower(deps, { includeExisting: true });
    expect((await follower.tick()).map((a) => a.kind)).toEqual(["BUY"]);
  });

  it("stops when the Agentic Wallet is signed out", async () => {
    const { deps, bawCalls } = setup([{ raw: {}, status: 0 }], "UNCONNECTED");
    const follower = await createFollower(deps, { includeExisting: true });
    await expect(follower.tick()).rejects.toBeInstanceOf(WalletSignedOutError);
    expect(bawCalls.map((c) => c.slice(0, 2).join(" "))).toEqual(["wallet status"]);
  });
});
