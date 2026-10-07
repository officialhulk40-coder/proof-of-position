import { isFollowable, type CallView } from "@pop/core/browser";
import type { TokenDto } from "../api/client";
import { companyName, declaredShares, links, marketStatusLabel, shortAddress, timeAgo } from "../format";
import { hrefFor } from "../router";
import { AgentBadge } from "./AgentBadge";
import { exitLine, hasFlipped } from "./badge";
import { ExitEvidenceLine } from "./ExitEvidenceLine";
import { StatusBadge } from "./StatusBadge";

export interface CallCardProps {
  call: CallView;
  token: TokenDto | undefined;
  nowMs: number;
  watched: boolean;
  flash: boolean;
  onToggleWatch: (callId: number) => void;
  onFollow: (call: CallView) => void;
}

/** Why "Follow" is unavailable for this call, or null when it can be followed. */
export function followBlocker(call: CallView, token: TokenDto | undefined): string | null {
  if (call.status !== "HOLDING") return "Only calls that are still HOLDING can be followed";
  if (!token || !isFollowable(token)) return "Follows execute on bStocks only (Ondo is RFQ-only, xStocks are illiquid on BSC)";
  const market = marketStatusLabel(token.status, token.issuer);
  if (market.tone === "paused") return market.text;
  return null;
}

export function CallCard({ call, token, nowMs, watched, flash, onToggleWatch, onFollow }: CallCardProps) {
  const market = marketStatusLabel(token?.status ?? null, token?.issuer);
  const sticky = exitLine(call);
  const blocker = followBlocker(call, token);
  return (
    <article className={`card${flash ? " flash" : ""}`} data-testid={`call-${call.id}`}>
      <header className="card-head">
        <a className="call-id" href={hrefFor({ name: "call", id: call.id })}>
          #{call.id}
        </a>
        {call.hasAgent ? (
          <AgentBadge agentId={call.agentId} refreshKey={`${call.exitBlock}:${call.closedBlock}`} />
        ) : (
          <a className="caller" href={links.address(call.caller)} target="_blank" rel="noreferrer">
            {shortAddress(call.caller)}
          </a>
        )}
        <span className="muted">{timeAgo(call.postedAt, nowMs)}</span>
      </header>
      <h2 className="headline">
        LONG {companyName(token)} · {declaredShares(call, token)} shares · {token?.issuer ?? "unlisted"}
      </h2>
      <div className="row">
        <StatusBadge call={call} />
        <span className={`pill pill-${market.tone}`}>{market.text}</span>
      </div>
      {sticky && <p className="exit-line">{sticky}</p>}
      {hasFlipped(call) && <ExitEvidenceLine callId={call.id} token={token} />}
      {call.note && <blockquote className="thesis">{call.note}</blockquote>}
      <footer className="actions">
        <a href={links.holding(call.token, call.caller)} target="_blank" rel="noreferrer">
          Verify on BscScan
        </a>
        <button type="button" disabled={blocker !== null} title={blocker ?? "Buy alongside the caller with USDT"} onClick={() => onFollow(call)}>
          Follow with USDT
        </button>
        <button type="button" aria-pressed={watched} onClick={() => onToggleWatch(call.id)}>
          {watched ? "Alerts on ✓" : "Alert me"}
        </button>
      </footer>
    </article>
  );
}
