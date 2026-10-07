import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tokensByIssuer } from "@pop/core";
import { describe, expect, it } from "vitest";
import { decide, exitReason, type FollowerConfig, type FollowerState, type Mirror } from "./decide";
import { defaultStatePath, loadState, saveState } from "./state";
import { CALLER, OTHER_CALLER, call } from "./testing";

const ONDO_TOKEN = tokensByIssuer("Ondo")[0]?.address ?? "0x";
const config: FollowerConfig = { callers: [CALLER.toUpperCase().replace("0X", "0x")], budgetUsdt: "1", maxOpen: 2 };

function mirror(callId: number, status: Mirror["status"] = "open"): Mirror {
  return {
    callId,
    caller: CALLER,
    token: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436",
    status,
    quantity: "5300000000000000",
    buyOrderId: "1",
    buyTxHash: "0xb",
    sellOrderId: null,
    sellTxHash: null,
    openedAt: "2026-10-09T10:00:00.000Z",
    closedAt: null,
    exitReason: null,
    error: null,
  };
}

function state(mirrors: Mirror[] = [], cursor = 0): FollowerState {
  return { version: 1, cursor, mirrors: Object.fromEntries(mirrors.map((m) => [String(m.callId), m])) };
}

describe("decide", () => {
  it("buys a new HOLDING bStock call by a followed caller", () => {
    expect(decide([call(5)], state(), config)).toEqual([{ kind: "BUY", call: call(5) }]);
  });

  it("skips calls it must not buy", () => {
    const calls = [
      call(1, { caller: OTHER_CALLER }),
      call(2, {}, 2),
      call(3, { exitBlock: 120n, exitStatus: 2 }),
      call(4, { closedBlock: 130n }, 3),
      call(6, { token: ONDO_TOKEN }),
      call(7, { token: "0x9999999999999999999999999999999999999999" }),
    ];
    expect(decide(calls, state(), config)).toEqual([]);
    expect(decide([call(1)], state([], 2), config)).toEqual([]);
    expect(decide([call(8)], state([mirror(8, "failed")]), config)).toEqual([]);
  });

  it("respects maxOpen, oldest first", () => {
    const actions = decide([call(9), call(8), call(10)], state([mirror(3)]), config);
    expect(actions.map((a) => [a.kind, a.call.id])).toEqual([["BUY", 8]]);
  });

  it("sells when the caller trims, exits, closes or an exit is recorded — before any buy", () => {
    const calls = [call(1, {}, 1), call(2, {}, 2), call(3, { closedBlock: 9n, heldThrough: true }, 3), call(4, { exitBlock: 9n, exitStatus: 2 }, 0), call(5)];
    const actions = decide(calls, state([mirror(1), mirror(2), mirror(3), mirror(4)], 0), { ...config, maxOpen: 10 });
    expect(actions.map((a) => (a.kind === "SELL" ? [a.kind, a.call.id, a.reason] : [a.kind, a.call.id]))).toEqual([
      ["SELL", 1, "TRIMMED"],
      ["SELL", 2, "EXITED"],
      ["SELL", 3, "CLOSED"],
      ["SELL", 4, "EXIT_RECORDED"],
      ["BUY", 5],
    ]);
  });

  it("keeps holding while the caller holds", () => {
    expect(exitReason(call(1))).toBeNull();
    expect(decide([call(1)], state([mirror(1)]), config)).toEqual([]);
  });
});

describe("state", () => {
  it("round-trips, starts empty and rejects corrupt files", () => {
    const dir = mkdtempSync(join(tmpdir(), "pop-follower-"));
    const path = join(dir, "nested", "state.json");
    expect(loadState(path)).toBeNull();
    const saved = state([mirror(4)], 3);
    saveState(path, saved);
    expect(loadState(path)).toEqual(saved);
    writeFileSync(path, "{\"version\":2}");
    expect(() => loadState(path)).toThrow();
  });

  it("uses POP_FOLLOWER_STATE when set", () => {
    expect(defaultStatePath({ POP_FOLLOWER_STATE: "/tmp/f.json" })).toBe("/tmp/f.json");
    expect(defaultStatePath({})).toMatch(/[\\/]\.pop-follower[\\/]state\.json$/);
  });
});
