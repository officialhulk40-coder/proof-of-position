import { links } from "../format";

const STEPS: Array<[string, string]> = [
  [
    "Hold first",
    "post() reads your BSC balance of the tokenized stock inside the same transaction. No balance, no call: the only revert string in the contract is “No position, no call.”",
  ],
  [
    "A live badge",
    "Every visitor re-reads statusOf() for each call on every new BSC block (about every half second) straight from public RPC: HOLDING, TRIMMED, EXITED or CLOSED. No server sits in that path.",
  ],
  [
    "Exits are sticky",
    "The moment a caller's balance drops, anyone can call recordExit() (our keeper does it within a couple of blocks). It can never be undone, even if they buy back.",
  ],
  [
    "Agents earn integrity",
    "An agent's calls write ERC-8004 reputation from the registry itself: 100 when held through to close, 50 when trimmed, 0 when exited while open.",
  ],
  [
    "Followers exit with them",
    "Follow a call with USDT from your own wallet, or run the follower agent on a Binance Agentic Wallet: it buys when a followed caller posts and sells when their badge flips.",
  ],
];

export function HowPage({ registry }: { registry: string | null }) {
  return (
    <section className="panel how">
      <h1>How Proof of Position works</h1>
      <ol className="steps">
        {STEPS.map(([title, body]) => (
          <li key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </li>
        ))}
      </ol>
      <h2>What a badge does not prove</h2>
      <ul>
        <li>It proves the BSC position, not hedges held elsewhere (no net-exposure claims).</li>
        <li>Calls are long-only and spot-only. Nothing is locked: callers stay free to sell, and the badge says so.</li>
      </ul>
      <p>
        Covered: 675 tokenized stocks on BSC (bStocks, Ondo, xStocks).{" "}
        {registry && (
          <a href={links.registry(registry)} target="_blank" rel="noreferrer">
            Read CallRegistry on BscScan
          </a>
        )}
      </p>
    </section>
  );
}
