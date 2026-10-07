import type { CallStatus, CallView } from "@pop/core/browser";

export interface Flip {
  callId: number;
  from: CallStatus;
  to: CallStatus;
  /** trimmed/exited: the caller sold; closed: the caller ended the call; exit-recorded: the exit became permanent. */
  kind: "trimmed" | "exited" | "closed" | "exit-recorded";
}

/** Compares two reads of the same calls and reports what flipped between them (new calls are not flips). */
export function diffCalls(previous: readonly CallView[], next: readonly CallView[]): Flip[] {
  const before = new Map(previous.map((call) => [call.id, call]));
  const flips: Flip[] = [];
  for (const call of next) {
    const old = before.get(call.id);
    if (!old) continue;
    if (old.status !== call.status) {
      if (call.status === "EXITED") flips.push({ callId: call.id, from: old.status, to: call.status, kind: "exited" });
      else if (call.status === "TRIMMED") flips.push({ callId: call.id, from: old.status, to: call.status, kind: "trimmed" });
      else if (call.status === "CLOSED") flips.push({ callId: call.id, from: old.status, to: call.status, kind: "closed" });
    } else if (old.exitBlock === 0n && call.exitBlock > 0n) {
      flips.push({ callId: call.id, from: old.status, to: call.status, kind: "exit-recorded" });
    }
  }
  return flips;
}
