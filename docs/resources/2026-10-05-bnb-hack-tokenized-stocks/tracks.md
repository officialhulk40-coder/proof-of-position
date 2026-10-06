# Tracks and bounties

The event has **one main track plus two "stack specials"**. Specials are awarded across every
submission with no separate entry, and a project can win a main placement and a special. Quoted
text is verbatim from the event page CMS record, Tracks and Prizes tabs ([EP], fetched 2026-10-05),
unless tagged [BLOG] or [SUB]. See [event.md](event.md) for tag definitions.

| Track / bounty | Sponsor (funder) | Prize | Entry |
|---|---|---|---|
| **Main Track: Tokenized Stocks Products & Agents** | BNB Chain + Binance Web3 Wallet | 1st $6,000 · 2nd $4,000 · 3rd $3,000 · 4th $2,000 · 5th $1,000 | Required. One entry per team |
| **Best Use of Agentic Wallet / Wallet Skills** | Binance Web3 Wallet | $2,000 | Automatic. Tick it in [SUB] |
| **Best Use of BNB Agent Studio** | BNB Chain | $2,000 | Automatic. Tick it in [SUB] |

---

## 1. Main Track: Tokenized Stocks Products & Agents

**Problem statement (verbatim):** "Build something people would actually use with tokenized stocks on BSC."

> An autonomous agent, a trading interface, a portfolio tool, a dashboard, a Telegram bot, an MCP
> server, an SDK: attack it from whatever angle suits you. The deliverable is a working project, not
> a deck. Agents are welcome and expected, and are scored on how well they are built rather than on
> the PnL they could print, we don't track it for this edition.

The CMS one-line description: "Build the layer that makes that difference real: agents, trading and
portfolio tools on tokenized stocks, through one aggregated API."

### 1.1 The Rules of the Track (verbatim)

> - At least one of **bStocks**, **Ondo** or **xStocks** has to be central to what you submit.
> - Cross-asset products are in scope, including pairing a tokenized equity leg with crypto or stablecoins.
> - Spot only. Perps are out.
> - **BSC mainnet only.** Dry-run with the Transaction API while you build, then demo with small live amounts. Teams fund their own wallets, and a few dollars is enough to prove the flow works.

### 1.2 Minimum bar to qualify

Derived from the rules above and [EP]/[BLOG]/[SUB]. The derivation is the lead's; every line traces to a quote in event.md.

1. Built on **one or more Binance Web3 API modules**. Quote: "A working project built on one or more Binance Web3 API modules, and optionally Agentic Wallet or Wallet Skills."
2. **bStocks, Ondo or xStocks central** to the product, not incidental.
3. **Spot only.** No perps.
4. **BSC mainnet** execution, demoed with small live amounts. Dry-runs use the Transaction API `simulate` endpoint.
5. Built **inside 16 Sep – 11 Oct 2026** ([BLOG]). An existing product may enter "a new integration into it, with a before and after."
6. Submission: public repo, demo video ≤ 4:00 (treat as required, per event.md C1), and a deployed link or judge-runnable instructions. All must stay accessible through judging.
7. **Developer Experience Report** submitted through the [DX] form. It is mandatory: "A submission without it is not scored." It must not be AI-generated.
8. Eligibility: not resident in, located in, or a citizen of a restricted jurisdiction.

### 1.3 Required and offered tech: "The Stack" (verbatim table)

| Component | What it gives you |
| --- | --- |
| **RWA Data API** | The tokenized stocks layer: token and platform lists, on-chain price against the underlying reference price, search by ticker, company profile with attestation reports, market status and next open time, sector filters (Magnificent 7, AI Chips, ETF, Buffett Portfolio). |
| **Market API** | Real-time prices, candlesticks and token analytics across tokenized equities and crypto pairs. The research and signal layer. |
| **Trading API** | Cross-DEX aggregated quotes, swaps and approvals, with built-in MEV protection. |
| **Transaction API** | On-chain simulation and broadcasting, so you can dry-run every call before you commit real funds. |
| **Wallet API** | Balances, positions and portfolio state across chains. |
| **DeFi API** | Protocol information, TVL, APY rankings and on-chain positions, plus unsigned calldata for deposit, redeem and LP across BSC DeFi. |
| **b402 Payments** | Pay-per-call payments, for agents that buy data or inference from other agents. |
| **Agentic Wallet / Wallet Skills** | The AI execution layer. Optional, heavily weighted in scoring and tied to a special prize. |
| **BNB Agent Studio** | One-prompt deployment of a persistent on-chain agent: wallet provisioning, ERC-8004 identity, ERC-8183 task interface and managed cloud runtime, with the MCP server auto-registered into Cursor or Claude Code. Optional, tied to a special prize. |
| **BNB Chain** | Execution venue: PancakeSwap and BSC tokenized-equity liquidity. |

> Combining API modules in a way that looks like it should not work but does is exactly what we are hoping to see.

Integration facts for every row are in
[sponsors/binance-web3-wallet.md](sponsors/binance-web3-wallet.md), the generated
[endpoint reference](sponsors/binance-web3-api-reference.md),
[sponsors/bnb-chain.md](sponsors/bnb-chain.md) and
[sponsors/tokenized-stock-issuers.md](sponsors/tokenized-stock-issuers.md).

**Lead's verified caveats on this table:**
- **RWA Data API**: its `platformId` filter covers only `ondo` and `bstock`. xStocks is not included.
- **RWA Data API**: `referencePrice` is "derived from the on-chain token price, not an official quote" (OpenAPI).
- **Sector filters**: the full `tabId` enum has 13 sectors, not just the four listed above (see the sponsor file).

### 1.4 Ideas to Build (organizers' list, verbatim)

| Build | What it does |
| --- | --- |
| **Natural-language strategy agent** | Reads a strategy in plain English ("rotate into defensives when volatility spikes"), then writes and executes the rules itself. |
| **Market-hours arbitrage** | Tokenized equities trade around the clock while the underlying market is shut. |
| **Cross-protocol arbitrage** | Prices the gap between two representations of the same underlying, for example bStocks against Ondo. |
| **On-chain vs reference price monitor** | The RWA Data API returns both prices. Track the spread and act on it. |
| **Auto-DCA and rebalancing** | Buys into a tokenized stock basket on a schedule, rebalances on drift thresholds. |
| **Earnings-calendar agent** | Positions ahead of scheduled events and flattens afterwards. |
| **TradFi-crypto portfolio agent** | Holds a target equity/crypto ratio and rebalances as correlation shifts. |
| **"Buy your first stock on-chain"** | Card to tokenized equity in under a minute, no seed phrase in sight. |
| **One-tap thematic baskets** | AI, semis, energy, with transparent on-chain composition. |
| **MCP server or SDK wrapper** | Makes the Binance Web3 API one-line callable from any agent framework, or straight from Agent Studio. |

The [BLOG] adds: "Market-hours arbitrage. … an agent that prices that gap properly is genuinely new
work." It also lists "Cross-protocol arbitrage between the bSTOCKS and Ondo representations of the
same underlying."

> **Crowding warning (from [prior-art.md](prior-art.md)):** by 2026-10-05, public repos already
> exist for cross-issuer gap/price radars, best-execution routers, weekend fair-value guards,
> Telegram NL agents, and MCP wrappers on these exact assets. Judges explicitly ask "Does this
> already exist five times over?" (Creativity & originality, 25%).

---

## 2. Special: Best Use of Agentic Wallet / Wallet Skills ($2,000)

- **Funder:** Binance Web3 Wallet.
- **Criteria (verbatim):** "Deepest, most credible use of the AI execution layer."
- **The Stack row:** "The AI execution layer. Optional, heavily weighted in scoring and tied to a special prize."
- **Minimum bar (INFERENCE):** Agentic Wallet (`baw` CLI / `binance-agentic-wallet` skill) or Wallet Skills must sit in the real execution path of the submitted product, on BSC mainnet. The DX form's "AI stack feedback" section must also be completed.
- **Access prerequisites** (from sponsor docs; see `sponsors/binance-web3-wallet.md`):
  - A Binance account plus an MPC Wallet in the Binance App.
  - The user signs in with `baw auth signin`. The pipeline never does this.
  - Daily limits are set only in the Binance App. Tokenized-stock trading uses `baw market-order swap`. Limit orders may refuse stock tokens.

## 3. Special: Best Use of BNB Agent Studio ($2,000)

- **Funder:** BNB Chain.
- **Criteria (verbatim):** "Deepest use of Agent Studio: agent identity, autonomous runtime, self-funding via x402."
- **The Stack row:** "One-prompt deployment of a persistent on-chain agent: wallet provisioning, ERC-8004 identity, ERC-8183 task interface and managed cloud runtime, with the MCP server auto-registered into Cursor or Claude Code. Optional, tied to a special prize."
- **Perk (verbatim, [EP] Prizes):** "Agent Studio runtime credits for the event window, so you are not paying to keep an agent alive while you build (depending the hosting you choose, between 72 and 24h, only on testnet)."
- **Tension to resolve at architecture time:** the main track is "BSC mainnet only", but the managed trial runtime is testnet-only. Agent Studio docs say this is a 48h trial, not 72/24h (event.md C5).
  - Studio can target BSC mainnet on self-paid hosts (`aws` / `azure` / `nodeops`).
  - The ERC-8004 and ERC-8183 (APEX) contracts are deployed on BSC **mainnet** (verified on-chain; see `sponsors/bnb-chain.md`).
- **Minimum bar (INFERENCE):** an Agent Studio-built agent with ERC-8004 identity registered on BSC, running autonomously, that pays or gets paid via x402/b402. The DX form asks specifically about "One-prompt deployment, wallet provisioning, ERC-8004 identity, ERC-8183 task interface, managed runtime, x402 self-funding, MCP registration into Cursor or Claude Code."

---

## 4. Qualification checklist (copy into the plan)

- [ ] Uses ≥ 1 Binance Web3 API module, and the DX form lists every module actually called
- [ ] bStocks / Ondo / xStocks central (name the tickers in [SUB] "What did you build?")
- [ ] Spot only, BSC mainnet, small live amounts demoed, Transaction API dry-run path shown
- [ ] Public repo (public at submission, through judging). No pushes after the 11 Oct 12:00 UTC freeze
- [ ] Demo video ≤ 4:00, publicly viewable
- [ ] Deployed link or judge-runnable instructions, with no keys or seed phrases. API-calling server hosted outside restricted regions
- [ ] DX report written by the humans on the team, with exact URLs, endpoints, error strings, latencies and slippage figures
- [ ] Same contact email on registration, submission and DX form
- [ ] Registration form done, with the Binance UID / API-key account, for elevated rate limits
- [ ] Specials ticked in [SUB] if Agentic Wallet or Agent Studio are used
