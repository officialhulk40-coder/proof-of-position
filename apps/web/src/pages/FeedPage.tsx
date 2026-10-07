import type { CallView } from "@pop/core/browser";
import type { TokensState } from "../api/useTokens";
import type { LiveCallsState } from "../chain/useLiveCalls";
import { CallCard } from "../components/CallCard";
import { TryTheGate } from "../components/TryTheGate";
import { hrefFor } from "../router";

export interface CardHandlers {
  watched: ReadonlySet<number>;
  flashing: ReadonlySet<number>;
  onToggleWatch: (callId: number) => void;
  onFollow: (call: CallView) => void;
}

export function ChainStatus({ live, registry }: { live: LiveCallsState; registry: string | null }) {
  if (registry === null) return <p className="chain-status error">CallRegistry is not configured on this build (VITE_REGISTRY_ADDRESS).</p>;
  if (live.error) return <p className="chain-status error">Chain unreachable, retrying… ({live.error})</p>;
  if (live.blockNumber === null) return <p className="chain-status muted">Connecting to BSC…</p>;
  return (
    <p className="chain-status">
      <span className="live-dot" aria-hidden="true" /> Live from BSC · block {live.blockNumber.toString()} · {live.total} calls
    </p>
  );
}

export function FeedPage({ live, tokens, registry, handlers }: { live: LiveCallsState; tokens: TokensState; registry: string | null; handlers: CardHandlers }) {
  const nowMs = Date.now();
  return (
    <>
      <section className="hero">
        <h1>Stock calls you can't post unless you hold the stock.</h1>
        <p>
          Every badge is read on-chain from the caller's live BSC balance of the tokenized stock. It flips the moment they sell, and followers' agents exit
          with them.
        </p>
        <ChainStatus live={live} registry={registry} />
      </section>
      <TryTheGate />
      {tokens.degraded && <p className="muted small">Market data unavailable ({tokens.degraded}); badges are unaffected.</p>}
      <section className="feed" aria-label="Calls">
        {live.calls.length === 0 && !live.loading && registry !== null && (
          <p className="panel muted">
            No calls yet. <a href={hrefFor({ name: "post" })}>Post the first one</a>: you need to hold the stock.
          </p>
        )}
        {live.calls.map((call) => (
          <CallCard
            key={call.id}
            call={call}
            token={tokens.byAddress.get(call.token.toLowerCase())}
            nowMs={nowMs}
            watched={handlers.watched.has(call.id)}
            flash={handlers.flashing.has(call.id)}
            onToggleWatch={handlers.onToggleWatch}
            onFollow={handlers.onFollow}
          />
        ))}
      </section>
    </>
  );
}
