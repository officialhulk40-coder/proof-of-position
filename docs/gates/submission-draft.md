# Submission draft — BNB Hack: Tokenized Stocks Edition

Pre-answered copy of the project submission form ([SUB] https://forms.gle/yToDUzaDMwWnq6R6A; field names verbatim from `docs/resources/2026-10-05-bnb-hack-tokenized-stocks/event.md` §3.1). The gate-concierge's closing pass resolves every `TBD-post-build:` line and pastes this into the form on the user's go. Deadline: **Sun 11 Oct 2026, 12:00 UTC** (17:30 IST) — submissions lock and repos freeze at that moment.

Two fields are deliberately not written here because this file becomes public with the repo: the **contact email** and the **prize wallet / Binance UID**. The user supplies them at paste time (the email must match the registration form and the DevEx report).

---

## Team or project name *(required)*

Proof of Position

## Contact email *(required)*

Filled in by the user at submission — the same address used on the registration form and the Developer Experience Report.

## Wallet address (ERC-20) *(required)*

Filled in by the user at submission — a BSC address that can receive the prize (or the Binance UID).

## Telegram handle *(optional)*

Filled in by the user at submission if wanted (include the @).

## What did you build? *(required — "What it does, who it is for, which parts of the Binance Web3 API you used, and which tokenized stocks it touches.")*

**Proof of Position: stock calls you can't post unless you hold the tokenized stock.** A call such as "LONG NVIDIA · 0.02 shares" is accepted by our `CallRegistry` contract on BSC mainnet only if the caller's wallet holds that position right now; otherwise the transaction reverts with "No position, no call." Every call's badge — HOLDING, TRIMMED, EXITED or CLOSED — is read live from the caller's on-chain balance and flips the moment they sell. Anyone can make an exit permanent on-chain, so a dump can't be hidden by buying back. There is no oracle and no indexer: anyone can check a badge on BscScan.

Followers' agents exit with the caller. Our follower agent, packaged as a Wallet Skill, drives Binance Agentic Wallet to mirror a verified call within a budget and sells the moment the caller's badge flips. Our analyst agent, built with BNB Agent Studio and registered on ERC-8004 on BSC mainnet, buys before it posts, pays for its research over x402, and earns an integrity score that the registry itself writes to the ERC-8004 ReputationRegistry (held = 100, trimmed = 50, exited = 0).

**Who it is for:** retail investors who buy on stock tips from X, Telegram and YouTube and have no way to tell whether the caller owns the stock or is selling into their buying.

**Binance Web3 API modules used:**
- **RWA Data** — `rwa/tokens`, `rwa/price`: token-to-share ratio, issuer and live market status (open/closed/paused with the reason) on every card.
- **Market** — `trades` with `walletAddressFilter`: the exit evidence on a flipped badge ("sold 0.02 NVIDIA · tx 0x…"); `token/top-liquidity`: the analyst's pool research.
- **Trading** — `quote`, `swap`, `approve-transaction`: "Follow with USDT" and the agents' buys and sells, SWAP routes only.
- **Transaction** — `simulate` before every signed leg, including a no-wallet dry-run of a post that shows the exact on-chain revert reason; `broadcast-transaction` with MEV protection; `gas-price`.
- **Wallet** — `token-balances-by-address`.
- **Agentic Wallet / Wallet Skills** — `baw market-order swap` / `list` in the follower agent's entry and its badge-triggered exit.
- **BNB Agent Studio** — the analyst's ERC-8004 identity, autonomous runtime, x402 research purchases (CoinMarketCap, paid in U) and self-funded Pieverse LLM credits.

**Tokenized stocks:** bStocks are central — follows and the analyst's buys execute on NVDAB, TSLAB, AAPLB and SPYB through 24/7 SWAP routes. The registry verifies holdings of all 675 BSC tokenized stocks in the Binance list: 87 bStocks, 458 Ondo and 130 xStocks (rebasing xStocks are measured in non-rebasing shares, so a dividend or split can't flip a badge).

## Which tracks are you applying for? *(required — checkboxes)*

- [x] Main track: Tokenized Stocks Products & Agents
- [x] Best Use of Agentic Wallet / Wallet Skills ($2,000)
- [x] Best Use of BNB Agent Studio ($2,000)

## Public repository URL *(required — "It has to be public at submission time and stay public through judging.")*

TBD-post-build:public-repo-url (https://github.com/officialhulk40-coder/proof-of-position after the consent-gated public flip)

## Demo video URL *(required — "Four minutes or less. Check the sharing settings: if a judge cannot open it, it does not count.")*

TBD-post-build:demo-video-url

## Deployed link, or instructions a judge can run *(required — "A live URL is best. Add anything a judge needs to test it, but never share private keys or seed phrases.")*

https://anujs-mac-mini.tail5830cd.ts.net

Judge path (no wallet, no keys needed):
1. Open the live feed. Badges are read straight from BSC mainnet every block, and each card links to BscScan.
2. Press **Try the gate**. It dry-runs a LONG TESLA post from a wallet that holds no TSLAB through the Transaction API `simulate` and shows the real revert: "No position, no call."
3. Open any call. You'll see the live badge, the market status from RWA Data, and, on flipped calls, the exit transaction with whether it was a sale.
4. Optional, with your own BSC wallet holding a few USDT: **Follow with USDT** quotes, simulates, then lets your wallet approve and buy the same bStock.

Contract and agent facts for the judge note:
- TBD-post-build:call-registry-address
- TBD-post-build:call-registry-deploy-tx
- TBD-post-build:analyst-erc8004-agent-id
- Analyst agent card: https://anujs-mac-mini.tail5830cd.ts.net/agent/.well-known/agent-card.json

## Developer Experience Report *(required — checkbox "Yes, I have submitted it")*

Submitted separately through https://forms.gle/EUQ39xf54GHjC2ys5 **before** this form. It must be written by the human team member ("Perfunctory or AI-generated reports are not accepted"). Raw material — exact endpoints, error strings, latencies, slippage, time-to-first-call — is logged throughout the build in `DEVEX_LOG.md`.

---

## Reference facts for the paste (not form fields)

- **Tech stack:** Solidity 0.8.28 + Foundry 1.8.5; TypeScript (strict, ESM) on Node ≥ 22.12 with pnpm workspaces; React 19 + Vite 7 feed; Hono API server; viem; Binance Web3 API; Binance Agentic Wallet CLI (`baw` 1.10.0); BNB Agent Studio (`@bnbagent/studio-cli` 0.0.14) and BNB Agent SDK 0.6.0; ERC-8004 v2.0.0 registries on BSC mainnet; Docker Compose + Caddy on a Singapore VPS.
- **Team:** solo builder plus an AI build pipeline (architect → executor subagents → reviewer). Everything was built during the event window; work on this project started on 6 Oct 2026.
- **Qualification checklist** (`tracks.md` §4): ≥ 1 Binance Web3 API module ✓ (five, plus Agentic Wallet and Agent Studio) · bStocks central ✓ · spot only, BSC mainnet, small live amounts, Transaction API dry-runs shown ✓ · public repo with no pushes after the freeze · demo video ≤ 4:00, public · judge path needs no keys; the API-calling server is hosted in Singapore · DevEx report human-written · same contact email on registration, submission and DevEx forms · registration form done · both specials ticked.
- **Before the public flip:** remove `docs/resources/2026-10-05-bnb-hack-tokenized-stocks/2026-10-05-sharepay-brief.md` and `telegram-intel-2026-10-06.md` (spec D8; a launch-plan task).
