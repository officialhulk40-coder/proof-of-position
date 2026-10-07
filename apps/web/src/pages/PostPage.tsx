import { CALL_REGISTRY_ABI, findTokens, parseUnits18, requireTokenBySymbol, toShares, type TokenInfo } from "@pop/core/browser";
import { useState } from "react";
import { parseEventLogs } from "viem";
import type { TokensState } from "../api/useTokens";
import { DryRunOutcome } from "../components/TryTheGate";
import { companyName, links, shortAddress } from "../format";
import { dryRunPost, encodePost, type DryRunResult } from "../gate";
import { hrefFor } from "../router";
import { useServices } from "../services";
import { useWallet, WalletButton } from "../wallet/useWallet";

const MAX_NOTE_BYTES = 280;

function parseAmount(value: string): bigint | null {
  try {
    const amount = parseUnits18(value);
    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}

export function PostPage({ tokens }: { tokens: TokensState }) {
  const { api, chain, registry } = useServices();
  const wallet = useWallet();
  const [query, setQuery] = useState("");
  const [token, setToken] = useState<TokenInfo>(() => requireTokenBySymbol("NVDAB"));
  const [amount, setAmount] = useState("0.02");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState<"dry-run" | "post" | null>(null);
  const [posted, setPosted] = useState<{ hash: `0x${string}`; callId: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseAmount(amount);
  const noteBytes = new TextEncoder().encode(note).length;
  const dto = tokens.byAddress.get(token.address);
  const matches = findTokens(query, 8);
  const args = registry !== null && wallet.address !== null && parsed !== null && noteBytes <= MAX_NOTE_BYTES ? { registry, from: wallet.address, token: token.address, amount: parsed, note } : null;

  async function dryRun(): Promise<DryRunResult | null> {
    if (!args) return null;
    setBusy("dry-run");
    setError(null);
    setResult(null);
    try {
      const outcome = await dryRunPost(api, chain, args);
      setResult(outcome);
      return outcome;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function post() {
    if (!args) return;
    const check = await dryRun();
    if (!check?.ok) return; // never ask the wallet to sign a call that would revert
    setBusy("post");
    try {
      const hash = await wallet.send({ to: args.registry, data: encodePost(args.token, args.amount, args.note), value: "0" });
      setPosted({ hash, callId: null });
      const receipt = await chain.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted on-chain.");
      const [event] = parseEventLogs({ abi: CALL_REGISTRY_ABI, eventName: "CallPosted", logs: receipt.logs });
      setPosted({ hash, callId: event ? Number(event.args.callId) : null });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel post">
      <h1>Post a call</h1>
      <p className="muted">CallRegistry reads your BSC balance inside the same transaction. No position, no call.</p>
      <div className="field">
        <span>Wallet</span>
        <WalletButton />
      </div>
      <label className="field">
        <span>Token</span>
        <input value={query} placeholder="Search 675 tokenized stocks: NVDA, TSLAB, SPYon…" onChange={(event) => setQuery(event.target.value)} />
      </label>
      {matches.length > 0 && (
        <ul className="matches">
          {matches.map((match) => (
            <li key={match.address}>
              <button
                type="button"
                onClick={() => {
                  setToken(match);
                  setQuery("");
                  setResult(null);
                }}
              >
                {match.symbol} · {match.ticker} · {match.issuer}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p>
        Selected: <strong>{token.symbol}</strong> · {token.issuer} · {shortAddress(token.address)}
      </p>
      <label className="field">
        <span>Amount ({token.symbol})</span>
        <input
          value={amount}
          inputMode="decimal"
          onChange={(event) => {
            setAmount(event.target.value);
            setResult(null);
          }}
        />
      </label>
      <p className="muted">
        {parsed === null ? "Enter a positive amount" : `≈ ${toShares(parsed, dto?.tokenToShareRatio ?? "1", 6)} ${companyName(dto)} shares`}
      </p>
      <label className="field">
        <span>
          Thesis ({noteBytes}/{MAX_NOTE_BYTES} bytes)
        </span>
        <textarea
          value={note}
          rows={3}
          onChange={(event) => {
            setNote(event.target.value);
            setResult(null);
          }}
        />
      </label>
      <div className="actions">
        <button type="button" disabled={args === null || busy !== null} onClick={() => void dryRun()}>
          {busy === "dry-run" ? "Simulating…" : "Dry-run"}
        </button>
        <button type="button" className="primary" disabled={args === null || busy !== null} onClick={() => void post()}>
          {busy === "post" ? "Confirm in your wallet…" : "Post on-chain"}
        </button>
      </div>
      {result && <DryRunOutcome result={result} />}
      {posted && (
        <p className="outcome">
          Sent ·{" "}
          <a href={links.tx(posted.hash)} target="_blank" rel="noreferrer">
            tx {shortAddress(posted.hash)}
          </a>
          {posted.callId !== null && (
            <>
              {" "}
              · <a href={hrefFor({ name: "call", id: posted.callId })}>view call #{posted.callId}</a>
            </>
          )}
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {registry === null && <p className="error">CallRegistry is not configured on this build (VITE_REGISTRY_ADDRESS).</p>}
    </section>
  );
}
