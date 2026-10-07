import { useEffect, useState } from "react";
import type { ExitEvidence, TokenDto } from "../api/client";
import { companyName, links, shortAddress } from "../format";
import { useServices } from "../services";

export interface ExitEvidenceState {
  evidence: ExitEvidence | null;
  searching: boolean;
  error: string | null;
}

/** Asks the server where the caller's tokens went; retries until found (the Market API indexes with a lag). */
export function useExitEvidence(callId: number, enabled: boolean, options: { retryMs?: number; maxAttempts?: number } = {}): ExitEvidenceState {
  const { api } = useServices();
  const retryMs = options.retryMs ?? 4_000;
  const maxAttempts = options.maxAttempts ?? 15;
  const [state, setState] = useState<ExitEvidenceState>({ evidence: null, searching: enabled, error: null });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const attempt = async () => {
      attempts += 1;
      try {
        const response = await api.exit(callId);
        if (cancelled) return;
        if (response.evidence !== null) {
          setState({ evidence: response.evidence, searching: false, error: null });
          return;
        }
      } catch (error) {
        if (cancelled) return;
        setState({ evidence: null, searching: false, error: error instanceof Error ? error.message : String(error) });
        return;
      }
      if (attempts >= maxAttempts) setState({ evidence: null, searching: false, error: null });
      else timer = setTimeout(() => void attempt(), retryMs);
    };
    setState({ evidence: null, searching: true, error: null });
    void attempt();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [api, callId, enabled, retryMs, maxAttempts]);
  return state;
}

export function evidenceText(evidence: ExitEvidence, token: TokenDto | undefined): string {
  const amount = evidence.amount ?? "";
  const symbol = token?.symbol ?? "tokens";
  switch (evidence.kind) {
    case "sale":
      return `sold ${amount} ${companyName(token)}${evidence.dexName ? ` · ${evidence.dexName}` : ""}${evidence.priceUsd ? ` @ $${evidence.priceUsd}` : ""}`;
    case "contract":
      return `moved ${amount} ${symbol} into a contract (likely a sale)`;
    case "transfer":
      return `transferred ${amount} ${symbol} to ${evidence.counterparty ? shortAddress(evidence.counterparty) : "another wallet"}`;
  }
}

export function ExitEvidenceLine({ callId, token, options }: { callId: number; token: TokenDto | undefined; options?: { retryMs?: number; maxAttempts?: number } }) {
  const state = useExitEvidence(callId, true, options);
  if (state.evidence) {
    return (
      <p className="evidence">
        {evidenceText(state.evidence, token)} ·{" "}
        <a href={links.tx(state.evidence.txHash)} target="_blank" rel="noreferrer">
          tx {shortAddress(state.evidence.txHash)}
        </a>
      </p>
    );
  }
  if (state.searching) return <p className="evidence muted">Looking for the exit transaction…</p>;
  if (state.error) return <p className="evidence muted">Exit evidence unavailable: {state.error}</p>;
  return <p className="evidence muted">Exit transaction not found in the recent blocks.</p>;
}
