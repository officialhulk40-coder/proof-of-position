import { getTokenInfo, isFollowable, type CallView } from "@pop/core";

export interface FollowerConfig {
  /** Callers to mirror (any case). */
  callers: readonly string[];
  /** USDT spent on each mirrored call, decimal string (e.g. "1"). */
  budgetUsdt: string;
  /** Most mirrors held at once. */
  maxOpen: number;
}

export type MirrorStatus = "open" | "closed" | "failed";

/** One mirrored call: what was bought, and how it ended. */
export interface Mirror {
  callId: number;
  caller: string;
  token: string;
  status: MirrorStatus;
  /** Raw token amount bought (and the exact amount to sell), as a decimal string. */
  quantity: string;
  buyOrderId: string | null;
  buyTxHash: string | null;
  sellOrderId: string | null;
  sellTxHash: string | null;
  openedAt: string | null;
  closedAt: string | null;
  /** TRIMMED, EXITED, CLOSED or EXIT_RECORDED once sold. */
  exitReason: string | null;
  error: string | null;
}

export interface FollowerState {
  version: 1;
  /** Calls with a lower id were posted before the follower started; they are never bought. */
  cursor: number;
  /** Keyed by call id. A failed mirror stays here so the same call is never retried forever. */
  mirrors: Record<string, Mirror>;
}

export type Action = { kind: "BUY"; call: CallView } | { kind: "SELL"; call: CallView; mirror: Mirror; reason: string };

/** Why a mirrored call must be sold now, or null while the caller still holds through. */
export function exitReason(call: CallView): string | null {
  if (call.status === "TRIMMED" || call.status === "EXITED" || call.status === "CLOSED") return call.status;
  if (call.exitBlock > 0n) return "EXIT_RECORDED";
  return null;
}

/**
 * Pure decision step, run on every registry read. SELL every open mirror whose call flipped
 * (TRIMMED, EXITED, CLOSED, or a recorded exit); then BUY each new HOLDING call by a followed caller on
 * a bStock, oldest first, while fewer than `maxOpen` mirrors are open. Sells come first.
 */
export function decide(calls: readonly CallView[], state: FollowerState, config: FollowerConfig): Action[] {
  const byId = new Map(calls.map((call) => [call.id, call]));
  const actions: Action[] = [];
  for (const mirror of Object.values(state.mirrors)) {
    if (mirror.status !== "open") continue;
    const call = byId.get(mirror.callId);
    const reason = call ? exitReason(call) : null;
    if (call && reason) actions.push({ kind: "SELL", call, mirror, reason });
  }

  const followed = new Set(config.callers.map((caller) => caller.toLowerCase()));
  let open = Object.values(state.mirrors).filter((mirror) => mirror.status === "open").length;
  for (const call of [...calls].sort((a, b) => a.id - b.id)) {
    if (open >= config.maxOpen) break;
    if (call.id < state.cursor || state.mirrors[String(call.id)] !== undefined) continue;
    if (!followed.has(call.caller.toLowerCase())) continue;
    if (call.status !== "HOLDING" || call.closedBlock !== 0n || call.exitBlock !== 0n) continue;
    const token = getTokenInfo(call.token);
    if (!token || !isFollowable(token)) continue;
    actions.push({ kind: "BUY", call });
    open += 1;
  }
  return actions;
}
