export type CallStatus = "HOLDING" | "TRIMMED" | "EXITED" | "CLOSED";
export const CALL_STATUSES: readonly CallStatus[] = ["HOLDING", "TRIMMED", "EXITED", "CLOSED"];

export type BalanceModelName = "UNLISTED" | "PLAIN" | "XSTOCK";
export const BALANCE_MODELS: readonly BalanceModelName[] = ["UNLISTED", "PLAIN", "XSTOCK"];

/** The Call struct exactly as viem decodes it from CallRegistry (uint8 enums → number, uint64/uint256 → bigint). */
export interface RawCall {
  caller: `0x${string}`;
  token: `0x${string}`;
  model: number;
  hasAgent: boolean;
  heldThrough: boolean;
  exitStatus: number;
  postedBlock: bigint;
  postedAt: bigint;
  closedBlock: bigint;
  exitBlock: bigint;
  agentId: bigint;
  declaredAmount: bigint;
  declaredBase: bigint;
  note: string;
}

/** A call as every client uses it: named enums, a numeric id, and the current status. */
export interface CallView {
  id: number;
  caller: `0x${string}`;
  token: `0x${string}`;
  model: BalanceModelName;
  hasAgent: boolean;
  heldThrough: boolean;
  /** Recorded exit status (TRIMMED/EXITED) when exitBlock > 0, otherwise HOLDING. */
  exitStatus: CallStatus;
  postedBlock: bigint;
  /** Unix seconds. */
  postedAt: number;
  closedBlock: bigint;
  exitBlock: bigint;
  agentId: bigint;
  declaredAmount: bigint;
  declaredBase: bigint;
  note: string;
  /** statusOf(): CLOSED once closed, otherwise the live HOLDING/TRIMMED/EXITED read. */
  status: CallStatus;
}

export function statusName(index: number): CallStatus {
  const name = CALL_STATUSES[index];
  if (!name) throw new Error(`unknown Status ordinal ${index}`);
  return name;
}

export function modelName(index: number): BalanceModelName {
  const name = BALANCE_MODELS[index];
  if (!name) throw new Error(`unknown BalanceModel ordinal ${index}`);
  return name;
}

export function toCallView(id: number, raw: RawCall, status: number): CallView {
  return {
    id,
    caller: raw.caller,
    token: raw.token,
    model: modelName(raw.model),
    hasAgent: raw.hasAgent,
    heldThrough: raw.heldThrough,
    exitStatus: statusName(raw.exitStatus),
    postedBlock: raw.postedBlock,
    postedAt: Number(raw.postedAt),
    closedBlock: raw.closedBlock,
    exitBlock: raw.exitBlock,
    agentId: raw.agentId,
    declaredAmount: raw.declaredAmount,
    declaredBase: raw.declaredBase,
    note: raw.note,
    status: statusName(status),
  };
}

/** True when the call needs a recordExit: open, no exit recorded yet, and no longer HOLDING. */
export function needsExitRecord(call: CallView): boolean {
  return call.closedBlock === 0n && call.exitBlock === 0n && (call.status === "TRIMMED" || call.status === "EXITED");
}
