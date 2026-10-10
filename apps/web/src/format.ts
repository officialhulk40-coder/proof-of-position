import { ADDRESSES, formatUnits18, toShares, type CallView, type StatusInfo } from "@pop/core/browser";
import type { TokenDto } from "./api/client";

const EXPLORER = "https://bscscan.com";

export function shortAddress(address: string): string {
  return address.length < 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** "NVIDIA Corporation" → "NVIDIA" for headlines; falls back to the ticker (xStocks have no RWA name). */
export function companyName(token: TokenDto | undefined): string {
  if (!token) return "UNKNOWN";
  const name = token.name?.replace(/,? (Inc\.?|Corporation|Corp\.?|Ltd\.?|plc|Holdings|Company|Co\.)$/i, "").trim();
  return name && name.length > 0 ? name.toUpperCase() : token.ticker;
}

/** Declared amount in underlying shares (token amount × RWA tokenToShareRatio; 1:1 when unknown). */
export function declaredShares(call: CallView, token: TokenDto | undefined): string {
  return toShares(call.declaredAmount, token?.tokenToShareRatio ?? "1", 4);
}

export function tokenAmount(raw: bigint): string {
  return formatUnits18(raw, 6);
}

export function marketStatusLabel(status: StatusInfo | null, issuer: string | undefined): { text: string; tone: "open" | "closed" | "paused" | "unknown" } {
  if (status === null) {
    return { text: issuer === "xStocks" ? "Market status n/a (xStocks not in RWA Data)" : "Market status unavailable", tone: "unknown" };
  }
  if (status.marketStatus === "pause" || status.reasonCode === "ASSET_PAUSED" || status.reasonCode === "MARKET_PAUSED") {
    return { text: `Paused${status.reasonMsg ? ` — ${status.reasonMsg}` : ""}`, tone: "paused" };
  }
  if (status.openState) {
    return { text: status.marketStatus === "regular" || status.marketStatus === null ? "Market open" : `Trading (${status.marketStatus})`, tone: "open" };
  }
  return { text: status.reasonMsg ? `Closed — ${status.reasonMsg}` : status.marketStatus === null ? "Market closed" : "Closed", tone: "closed" };
}

export function timeAgo(unixSeconds: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round(nowMs / 1000 - unixSeconds));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export const links = {
  tx: (hash: string) => `${EXPLORER}/tx/${hash}`,
  address: (address: string) => `${EXPLORER}/address/${address}`,
  /** The caller's live holding of the called token — the badge's source of truth, one click away. */
  holding: (token: string, holder: string) => `${EXPLORER}/token/${token}?a=${holder}`,
  agent: (agentId: bigint) => `${EXPLORER}/token/${ADDRESSES.identityRegistry}?a=${agentId.toString()}`,
  registry: (registry: string) => `${EXPLORER}/address/${registry}#readContract`,
};
