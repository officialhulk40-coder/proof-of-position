// Test helpers for @pop/follower (imported by *.test.ts only).
import { toCallView, type CallView, type RawCall } from "@pop/core";
import type { BawResult, BawRunner } from "./baw";

export const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
export const CALLER = "0x1111111111111111111111111111111111111111";
export const OTHER_CALLER = "0x4444444444444444444444444444444444444444";
export const WALLET = "0x3333333333333333333333333333333333333333";
export const NVDAB = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";

/** A CallView: live status 0 HOLDING, 1 TRIMMED, 2 EXITED, 3 CLOSED. */
export function call(id: number, overrides: Partial<RawCall> = {}, status = 0): CallView {
  const raw: RawCall = {
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
  return toCallView(id, raw, status);
}

/**
 * A scripted `baw`: handlers are keyed by the command words ("wallet status", "market-order swap",
 * "cli-check"); each returns `data` (wrapped as { success: true, data }) or a raw BawResult.
 */
export function scriptedBaw(handlers: Record<string, (args: readonly string[]) => unknown>): { runner: BawRunner; calls: string[][] } {
  const calls: string[][] = [];
  const runner: BawRunner = async (args) => {
    calls.push([...args]);
    const words = args[1] !== undefined && !args[1].startsWith("--") ? `${args[0]} ${args[1]}` : String(args[0]);
    const handler = handlers[words];
    if (!handler) return { code: 1, stdout: JSON.stringify({ success: false, error: { message: `unscripted: ${words}` } }), stderr: "" };
    const answer = handler(args);
    if (answer && typeof answer === "object" && "stdout" in answer) return answer as BawResult;
    return { code: 0, stdout: JSON.stringify({ success: true, data: answer }), stderr: "" };
  };
  return { runner, calls };
}

/** A manual clock: sleep() advances it instantly. */
export function manualClock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    sleep: async (ms: number) => {
      now += ms;
    },
  };
}
