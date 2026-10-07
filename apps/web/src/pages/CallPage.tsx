import type { CallView } from "@pop/core/browser";
import type { ReactNode } from "react";
import type { TokensState } from "../api/useTokens";
import { useLiveCall } from "../chain/useLiveCalls";
import { CallCard } from "../components/CallCard";
import { links, shortAddress, tokenAmount } from "../format";
import { hrefFor } from "../router";
import { useServices } from "../services";
import type { CardHandlers } from "./FeedPage";

function Detail({ call, registry }: { call: CallView; registry: string }) {
  const rows: Array<[string, ReactNode]> = [
    [
      "Caller",
      <a href={links.address(call.caller)} target="_blank" rel="noreferrer">
        {call.caller}
      </a>,
    ],
    [
      "Token",
      <a href={links.address(call.token)} target="_blank" rel="noreferrer">
        {call.token}
      </a>,
    ],
    ["Measured by", call.model === "XSTOCK" ? "sharesOf (xStocks, rebase-proof)" : "balanceOf"],
    ["Declared", `${tokenAmount(call.declaredAmount)} tokens`],
    ["Posted", `block ${call.postedBlock.toString()} · ${new Date(call.postedAt * 1000).toISOString()}`],
    ["Exit recorded", call.exitBlock === 0n ? "none" : `block ${call.exitBlock.toString()} (${call.exitStatus})`],
    ["Closed", call.closedBlock === 0n ? "open" : `block ${call.closedBlock.toString()}${call.heldThrough ? " · held through" : ""}`],
    ["Agent", call.hasAgent ? `ERC-8004 #${call.agentId.toString()}` : "none (wallet)"],
  ];
  return (
    <section className="panel">
      <h2>On-chain record</h2>
      <dl className="details">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        <a href={links.registry(registry)} target="_blank" rel="noreferrer">
          Check statusOf({call.id}) yourself on BscScan
        </a>{" "}
        · registry {shortAddress(registry)}
      </p>
    </section>
  );
}

export function CallPage({ id, calls, tokens, handlers }: { id: number; calls: CallView[]; tokens: TokensState; handlers: CardHandlers }) {
  const { chain, registry } = useServices();
  const fromFeed = calls.find((call) => call.id === id);
  // Older calls are not in the feed's newest page: read this one on its own (also block by block).
  const own = useLiveCall(chain, fromFeed || registry === null ? null : registry, id);
  const call = fromFeed ?? own.call;
  if (registry === null) return <p className="panel error">CallRegistry is not configured on this build (VITE_REGISTRY_ADDRESS).</p>;
  if (!call) {
    return <p className="panel muted">{own.loading ? `Reading call #${id} from BSC…` : `There is no call #${id}.`}</p>;
  }
  return (
    <>
      <p>
        <a href={hrefFor({ name: "feed" })}>← All calls</a>
      </p>
      <CallCard
        call={call}
        token={tokens.byAddress.get(call.token.toLowerCase())}
        nowMs={Date.now()}
        watched={handlers.watched.has(call.id)}
        flash={handlers.flashing.has(call.id)}
        onToggleWatch={handlers.onToggleWatch}
        onFollow={handlers.onFollow}
      />
      <Detail call={call} registry={registry} />
    </>
  );
}
