import { requireTokenBySymbol } from "@pop/core/browser";
import { useState } from "react";
import { shortAddress } from "../format";
import { dryRunPost, GATE_PROBE_ADDRESS, GATE_PROBE_AMOUNT, GATE_PROBE_SYMBOL, type DryRunResult } from "../gate";
import { useServices } from "../services";

export function DryRunOutcome({ result }: { result: DryRunResult }) {
  return (
    <div className={`outcome ${result.ok ? "outcome-ok" : "outcome-revert"}`} role="status">
      {result.ok ? <strong>Simulation succeeded: this call would post.</strong> : <strong>Reverted: “{result.reason}”</strong>}
      <span className="muted"> · via {result.via}</span>
    </div>
  );
}

/** The judge path: no wallet, no signature, one click, the contract's real revert reason. */
export function TryTheGate() {
  const { api, chain, registry } = useServices();
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (registry === null) return;
    setBusy(true);
    setError(null);
    try {
      const token = requireTokenBySymbol(GATE_PROBE_SYMBOL);
      setResult(await dryRunPost(api, chain, { registry, from: GATE_PROBE_ADDRESS, token: token.address, amount: GATE_PROBE_AMOUNT, note: "Bullish TSLA, holding none" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel gate" aria-labelledby="gate-title">
      <h2 id="gate-title">Try the gate</h2>
      <p>
        Post a call on <strong>{GATE_PROBE_SYMBOL}</strong> from <code>{shortAddress(GATE_PROBE_ADDRESS)}</code>, an address that holds none. Nothing is
        signed: it is a dry run against BSC mainnet.
      </p>
      <button type="button" className="primary" onClick={() => void run()} disabled={busy || registry === null}>
        {busy ? "Simulating…" : "Try to post without holding"}
      </button>
      {result && <DryRunOutcome result={result} />}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
