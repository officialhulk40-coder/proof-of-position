import { ERC20_ABI, toShares, type CallView } from "@pop/core/browser";
import { useState } from "react";
import { ApiError, type TokenDto } from "../api/client";
import { companyName, links, shortAddress } from "../format";
import { useServices } from "../services";
import { useWallet, WalletButton } from "../wallet/useWallet";

type Step = "confirm" | "working" | "done" | "failed";

/** "Follow with USDT": quote → (approve: simulate → wallet) → swap: simulate → wallet, all on BSC through the Trading API. */
export function FollowModal({ call, token, onClose }: { call: CallView; token: TokenDto | undefined; onClose: () => void }) {
  const { api, chain } = useServices();
  const wallet = useWallet();
  const [step, setStep] = useState<Step>("confirm");
  const [accepted, setAccepted] = useState(false);
  const [usdt, setUsdt] = useState("1");
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const name = companyName(token);
  const log = (line: string) => setProgress((lines) => [...lines, line]);

  async function follow() {
    if (wallet.address === null) return;
    const request = { token: call.token, usdtAmount: usdt.trim(), wallet: wallet.address };
    setStep("working");
    setProgress([]);
    setError(null);
    try {
      const quote = await api.followQuote(request);
      log(`Quote: ≈ ${quote.toTokenFormatted} ${token?.symbol ?? "tokens"} for ${request.usdtAmount} USDT via ${quote.route.vendorName}`);
      for (let round = 0; round < 3; round += 1) {
        const built = await api.followBuild(request);
        if (built.next === "approve") {
          log("Approve USDT · simulated ✓ · confirm in your wallet");
          const hash = await wallet.send(built.tx);
          const receipt = await chain.waitForTransactionReceipt({ hash });
          if (receipt.status !== "success") throw new Error(`USDT approval reverted · ${hash}`);
          log(`Approved · tx ${shortAddress(hash)}`);
          continue;
        }
        log("Swap · simulated ✓ · confirm in your wallet");
        const hash = await wallet.send(built.tx);
        const receipt = await chain.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`Swap reverted · ${hash}`);
        log(`Swapped · tx ${shortAddress(hash)}`);
        const balance = await chain.readContract({ address: call.token, abi: ERC20_ABI, functionName: "balanceOf", args: [wallet.address] });
        setHeld(toShares(balance, token?.tokenToShareRatio ?? "1", 6));
        setStep("done");
        return;
      }
      throw new Error("The USDT approval did not take effect. Try again.");
    } catch (cause) {
      setError(cause instanceof ApiError ? `${cause.message}${cause.hint ? ` (${cause.hint})` : ""}` : cause instanceof Error ? cause.message : String(cause));
      setStep("failed");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="follow-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="follow-title">
          Follow call #{call.id} · {name}
        </h2>
        {step === "confirm" && (
          <>
            <label className="check">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>
                I am not a US person or otherwise restricted from buying tokenized stocks (bStocks, Ondo, xStocks), and I understand this is not investment
                advice.
              </span>
            </label>
            <label className="field">
              <span>USDT to spend</span>
              <input value={usdt} inputMode="decimal" onChange={(event) => setUsdt(event.target.value)} />
            </label>
            <div className="field">
              <span>Wallet</span>
              <WalletButton />
            </div>
            <div className="actions">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={!accepted || wallet.address === null || !/^\d+(\.\d+)?$/.test(usdt.trim())} onClick={() => void follow()}>
                Buy {name} with {usdt.trim() || "0"} USDT
              </button>
            </div>
          </>
        )}
        {step !== "confirm" && (
          <ol className="progress">
            {progress.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        )}
        {step === "working" && <p className="muted">Every transaction is simulated before your wallet sees it.</p>}
        {step === "done" && (
          <p className="outcome outcome-ok">
            You hold {held} {name} shares alongside them.{" "}
            <a href={links.holding(call.token, wallet.address ?? "")} target="_blank" rel="noreferrer">
              Verify on BscScan
            </a>
          </p>
        )}
        {step === "failed" && <p className="error">{error}</p>}
        {(step === "done" || step === "failed") && (
          <div className="actions">
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
