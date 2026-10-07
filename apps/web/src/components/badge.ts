import type { CallView } from "@pop/core/browser";

export type BadgeTone = "holding" | "trimmed" | "exited" | "closed" | "closed-exited";

export interface Badge {
  label: string;
  detail: string;
  tone: BadgeTone;
}

/** The live badge: the registry's statusOf() for this call, read from BSC on every block. */
export function badgeFor(call: CallView): Badge {
  switch (call.status) {
    case "HOLDING":
      return { label: "HOLDING ✓", detail: "verified on-chain", tone: "holding" };
    case "TRIMMED":
      return { label: "TRIMMED", detail: "holds less than declared", tone: "trimmed" };
    case "EXITED":
      return { label: "EXITED", detail: "no longer holds it", tone: "exited" };
    case "CLOSED":
      return call.heldThrough
        ? { label: "CLOSED", detail: "held through ✓", tone: "closed" }
        : { label: "CLOSED", detail: "exited while open", tone: "closed-exited" };
  }
}

/** The sticky line: once an exit is recorded it stays, even if the caller buys back. */
export function exitLine(call: CallView): string | null {
  if (call.exitBlock === 0n) return null;
  const after = call.exitBlock - call.postedBlock;
  return `Exit recorded on-chain · block ${call.exitBlock.toString()} · ${after.toString()} blocks after post`;
}

/** True once the call has shown an exit: live TRIMMED/EXITED, a recorded exit, or closed without holding through. */
export function hasFlipped(call: CallView): boolean {
  return call.exitBlock > 0n || call.status === "TRIMMED" || call.status === "EXITED" || (call.status === "CLOSED" && !call.heldThrough);
}
