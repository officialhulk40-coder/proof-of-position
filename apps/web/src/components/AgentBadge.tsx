import { ADDRESSES, readAgentIntegrity, type AgentIntegrity } from "@pop/core/browser";
import { useEffect, useState } from "react";
import { links } from "../format";
import { useServices } from "../services";

/** ERC-8004 getSummary(agentId, [registry], "integrity", ""): only the registry's own feedback counts. */
export function useAgentIntegrity(agentId: bigint, refreshKey: string): AgentIntegrity | null {
  const { chain, registry } = useServices();
  const [integrity, setIntegrity] = useState<AgentIntegrity | null>(null);
  useEffect(() => {
    if (registry === null) return;
    let cancelled = false;
    readAgentIntegrity(chain, { reputationRegistry: ADDRESSES.reputationRegistry, registry, agentId })
      .then((value) => {
        if (!cancelled) setIntegrity(value);
      })
      .catch(() => {
        if (!cancelled) setIntegrity(null);
      });
    return () => {
      cancelled = true;
    };
  }, [chain, registry, agentId, refreshKey]);
  return integrity;
}

export function AgentBadge({ agentId, refreshKey }: { agentId: bigint; refreshKey: string }) {
  const integrity = useAgentIntegrity(agentId, refreshKey);
  const score = integrity === null ? "integrity n/a" : integrity.score === null ? "integrity: no record yet" : `integrity ${Math.round(integrity.score)}`;
  return (
    <a className="agent" href={links.agent(agentId)} target="_blank" rel="noreferrer" title="ERC-8004 agent identity on BscScan">
      AGENT #{agentId.toString()} <span className="agent-score">· {score}</span>
    </a>
  );
}
