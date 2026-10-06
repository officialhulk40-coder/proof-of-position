# Prior art: rivals, past winners, shipped products

This feeds idea-forge's novelty and white-space pass. The judges ask: "Were the APIs used in ways
nobody expected? Does this already exist five times over?" (Creativity & originality, 25%). Fetched
2026-10-05.

Rows marked ✓ were verified by the lead via `gh repo view` (exists, dates, description) on
2026-10-05. Other rows come from sub-agent capture with the source URL given. One-line
descriptions are the lead's wording.

## 0. Read this first: crowding summary (INFERENCE)

- **Saturated for this event:** at least 14 public entries already target it, built 2026-09-16 → 2026-10-05. They cluster on:
  - cross-issuer **gap / fair-price radars**;
  - **best-execution routers** and quote guards;
  - **weekend fair-value** estimation;
  - NL / Telegram trading agents;
  - MCP / skill wrappers.
- **Thin or empty so far (as found):**
  - earnings-calendar positioning;
  - drift-threshold **rebalancing** of a basket (only Portir does DCA);
  - **thematic one-tap baskets on BSC** (baskets exist on Base, Solana, Robinhood Chain and Ondo-ETH, not BSC);
  - card-to-stock onboarding;
  - corporate-action-aware holding (dividend/split handling beyond a "halt" guard);
  - post-trade PnL/tax reporting;
  - agent evaluation / backtesting harnesses.
- **Updates since the pack was built (2026-10-06):**
  - **Taken:** one idea cluster belongs to another team's unpublished project. The Telegram pass had counted this cluster as empty.
  - **Narrower:** basket rebalancing. 4lpha's "TradFi model" (Telegram) claims rebalancing and auto-DCA.
  - The Telegram crowding table (telegram-intel-2026-10-06.md §3) puts
    about 16 entries in the gap / fair-price cluster.
- **Lead-verified technical traps that rivals' framing often misses** (see the sponsor files):
  - the RWA API `referencePrice` is *derived from* the on-chain price;
  - xStocks have negligible BSC liquidity and no RWA Data coverage;
  - Ondo is RFQ-only and closes outside hours except Off-Hours assets;
  - bStock RFQ closes outside hours while bStock AMM pools don't.

## 1. Rival entries for THIS hackathon (public repos)

| ✓ | Repo | Created → last push | Angle (lead's one-line) |
|---|---|---|---|
| ✓ | [daveaire/closing-bell-agent](https://github.com/daveaire/closing-bell-agent) | 09-18 → 09-19 | Spread scanner and safety gate over bStocks/Ondo vs Binance `referencePrice`; simulation-gated |
| ✓ | [Assassin859/executable-gap-desk](https://github.com/Assassin859/executable-gap-desk) | 09-29 → 10-02 | "Displayed vs executable" gap across all three issuers. GO/CAUTION/BLOCK gate. `baw` fills. MCP server + Studio agent + x402 |
| ✓ | [codeswithroh/sextant](https://github.com/codeswithroh/sextant) | 10-05 → 10-05 | Best execution across issuers at size, plus weekend fair value (beta × BTC move) |
| ✓ | [JemIIahh/oneticker](https://github.com/JemIIahh/oneticker) | 09-21 → 10-01 | Routing and safety layer (CLI, MCP server, Wallet Skill) across bStocks/Ondo/xStocks |
| ✓ | [yostocks-protocol/yostocks](https://github.com/yostocks-protocol/yostocks) | 09-24 → 10-03 | Telegram NL agent with a per-share quote guard and conditional buys |
| ✓ | [Benito3262/Parity](https://github.com/Benito3262/Parity) | 10-01 → 10-02 | Per-share fair price across 3 issuers vs last close. xStocks buy via PancakeSwap |
| ✓ | [Benito3262/sunday-desk](https://github.com/Benito3262/sunday-desk) | 10-02 → 10-02 | Weekend "gap desk" for tokenized stocks on BSC |
| ✓ | [srbisnes/alpharadar](https://github.com/srbisnes/alpharadar) | 09-16 → 09-17 | Non-custodial discovery engine and premium-gap feed (bStocks · Ondo · xStocks) |
| ✓ | [yeheskieltame/portir](https://github.com/yeheskieltame/portir) | 09-21 → 10-04 | Market-aware buy guard plus on-chain DCA plans (PlanRegistry contract) |
| ✓ | [zkasuran/steward-bnb](https://github.com/zkasuran/steward-bnb) | 09-24 → 09-24 | "Owning, not just buying": holdings, convictions, cross-issuer compare |
| ✓ | [Lioniee/Bystok](https://github.com/Lioniee/Bystok) | 10-02 → 10-03 | Scanner showing underlying stock, token and provider before buying |
| ✓ | [neromtoobad/roost](https://github.com/neromtoobad/roost) | 09-17 → 10-05 | Collectible creature that is also a trading rule (gamified rules) |
| ✓ | [arbincept/rwa-stock-arbitrage](https://github.com/arbincept/rwa-stock-arbitrage) | 09-19 → 10-02 | Market-hours and cross-protocol spread engine (arbitrage suite) |
| ✓ | [invertilo/bnb-builder-day](https://github.com/invertilo/bnb-builder-day) | 10-03 → 10-03 | (no description; README mentions the DX report) |

More entries turned up in the builder Telegram on 2026-10-06: 15 tokenized-stock projects, 13 of them new,
most without a public repo. They are listed in telegram-intel-2026-10-06.md
§1 and not repeated here.

Self-reported rival findings, *not independently verified*:
- Sextant measured `NVDAon` slippage of +3.5% at $1,000 and a `40374 Insufficient liquidity` at $25,000, while `NVDAB` filled.
- yostocks got a `baw` quote returning ~0.000000024 `MSTRx` for 100 USDT, and says Agentic Wallet limit orders refuse stock tokens.

## 2. Adjacent builds on the same stack: "Binance Agent OS Mini Hackathon" (Aug–Sep 2026)

| ✓ | Repo | Dates | Angle |
|---|---|---|---|
| ✓ | [Aliskasq/bstocks-agent](https://github.com/Aliskasq/bstocks-agent) | 09-03 → 09-06 | Goal-driven research and trading agent on Agent OS (MCP), with memory and a risk gate |
| ✓ | [Anwer1904/bstocks1](https://github.com/Anwer1904/bstocks1) | 09-08 | Agentic Wallet trading agent on Agent OS |
| ✓ | [sleepingF0x/range-pilot](https://github.com/sleepingF0x/range-pilot) | 09-07 → 09-08 | Rule-based bStock LP position management via Agentic Wallet |
| ✓ | [0xLokiz/bstocks-lp-assistant](https://github.com/0xLokiz/bstocks-lp-assistant) | 09-02 → 09-05 | Volatility-adjusted LP risk screener for tokenized-stock pools (★4) |
| ✓ | [yesmin77/yield-guard](https://github.com/yesmin77/yield-guard) | 09-07 | Claude skill that blocks unsafe DeFi actions before Agentic Wallet |
| ✓ | [AmazingAng/0xaa-binance-agentic-wallet](https://github.com/AmazingAng/0xaa-binance-agentic-wallet) | 08-22 | Relaxed-policy fork of the Agentic Wallet skill |
| ✓ | [bnb-chain/stockanalyst-agent-demo](https://github.com/bnb-chain/stockanalyst-agent-demo) | 07-21 → 09-14 | Official demo: paid AI stock-analysis service (x402 seller on BSC mainnet, ERC-8183) |

## 3. Past BNB Chain hackathon winners

The source is the bnbchain.org CMS `winner_layer` plus winner blog posts *(sub-agent)*. The index of
14 BNB Chain hackathons is on https://www.bnbchain.org/en/hackathons.

**BNB Hack: AI Trading Agent Edition** (2026-06-03 → 06-21, $36,000; with Trust Wallet and CoinMarketCap). This is the closest format.
- Placings come from a **secondary** source (https://en.cryptonomist.ch/2026/07/08/bnb-hack-winners/). DoraHacks showed "No Winners Announced Yet".
- **Track 1:**

| Place | Project | Note |
|---|---|---|
| 1st, $10,000 | **Neural Alpha** (ClipX) | Autonomous trading agent (CMC + Trust Wallet Agent Kit). Repo `ClipXonchain/neural-alpha` not accessible |
| 2nd, $6,000 | Genesis | Description NOT FOUND |
| 3rd, $4,000 | **Gridora** | Non-custodial grid agent that journals every trade on-chain. ERC-8004 identity #140004. https://gridora.vercel.app/ |
| 4th, $2,000 | Guarded Alpha | Description NOT FOUND |
| 5th, $2,000 | Superagente007 | Description NOT FOUND |

- **Strategy Skills track:**
  - 1st, $3,000: **Narrative Alpha**.
  - 2nd: RotorEdge. 3rd: Undertow.
- **Specials:** BNB Mission Control ($2,000, Trust Wallet Agent Kit). SOLVENT + Helm ($2,000 shared, BNB Agent SDK).
- ⚑ **Note for the team:** the user's own public repo [bitnormie01/Narrative-Alpha](https://github.com/bitnormie01/Narrative-Alpha) (created 2026-06-21) describes itself as a "Track 2 Strategy Skill" for CMC-style narrative rotation. **INFERENCE: likely the same winning project. Confirm.** If so, [BLOG] allows "Already have a product? You can enter a new integration into it, with a before and after."

**Good Vibes Only: OpenClaw Edition** (Feb 2026, $100,000):
- Listed standouts: Zhentan (behavior-learning on-chain guard), Strike (Telegram prediction market), ShieldBot (pre-execution contract blocker), AGOS Clawjob (agent-to-agent paid services), Aegis Protocol (DeFi position protector), OpButler (agentic DeFi dashboard), VibeCheck (token safety score), ProceedGate (agent spend-limit governance).
- Scoring: "40% community voting on DoraHacks 60% judge evaluation".

**BNB Hack Abu Dhabi** (Dec 2025): DeFi Pro (1st, chat-driven DeFi), Midas (2nd, Twitter→prediction-market agent), HeroPath (3rd, prop trading). Demo Night 1st: SilentSwap.

**BNB Hack: Online Edition** (BNB AI Hack, 2025 rolling, $700,000):
- 3rd-prize examples: DeFi Copilot (PancakeSwap one-click), PlayAI, MCP Forge (MCP marketplace), Stitch AI, BINK AI (a later update mentions tokenized stock trading), Tokrio.
- Prize 2 examples: FairBNB, TagAI, ChainSure.
- Tier prizes paired cash with a "$50,000 Kickstart Package".
- Relevant honourable mentions: Coinbasket (NL baskets, [mehdidotcafe/coinbasket](https://github.com/mehdidotcafe/coinbasket) ✓), NeuroBalance (AI rebalancer), Onchain SIP (recurring investing), Fylaro / SeniorFi (tokenized receivables).

**2024 quarterly BNB Hacks:** e.g. Q4 2024 2nd place Outrun and AgentArcade ($10,000 each). Q3 2024 zkGraph ($15,000).

**Patterns (INFERENCE):** 2026 winners emphasize verifiable on-chain behavior (trade journals, ERC-8004 identity), agent safety and guards, and real execution over decks.

## 4. Shipped products and competitors

*(sub-agent; traction figures are secondary and dated)*

| Category | Name | One-line | Chain / system | Link / date |
|---|---|---|---|---|
| Issuer / venue | Binance bStocks | Binance-group tokenized US stocks, 1:1-backed, 24/7, on-chain on BSC | BSC / bStocks | https://www.bnbchain.org/en/blog/introducing-bstocks-on-bnb-chain-trade-24-7-with-zero-fees-deploy-across-defi-protocols-with-full-self-custody (2026-06-11) |
| Issuer | Ondo Global Markets / Ondo Stocks | Largest tokenized-equity issuer. On BNB Chain since 2025-10-29 | ETH / SOL / BSC / HyperEVM | https://docs.ondo.finance/ondo-stocks/overview |
| Issuer | xStocks (Backed / Kraken) | Tracker certificates. On BNB Chain since 2026-04-30 | SOL / ETH / BSC / others | https://docs.xstocks.fi/ |
| Venue | PancakeSwap Tokenized Stocks Terminal | DEX front-end for stock tokens on BSC | BSC | https://pancakeswap.finance/stocks |
| Venue | Binance Wallet Pre-Access (pre-IPO) | Tokenized pre-IPO exposure via PancakeSwap campaigns (e.g. SPCXB) | BSC | [search] blockonomi.com |
| Issuer | Robinhood Stock Tokens | EU stock tokens, Arbitrum → Robinhood Chain | Arbitrum / Robinhood Chain | robinhood.com newsroom |
| Issuer | Dinari dShares | SEC-registered broker-dealer issuer, 724 stocks (2026-08-04) | ETH / Arbitrum / Base / Avalanche | [search] prnewswire.com |
| Agents | Virtuals × Treasures × Ondo | 430+ Ondo stocks opened to 40,000+ agents (2026-06-26) | ETH / SOL | finance.yahoo.com |
| Agents | BNB Agent Studio "AI stock analysts" | Paid analyst agents (x402) used in the bStock PnL competition | BSC | https://stock-agent.bnbchain.org |
| Baskets | Glider × Ondo Mag 7 | Direct-indexed Mag 7 portfolio (2026-06-17) | ETH / SOL | thedefiant.io |
| Baskets | Reserve Mag7 DTF, hMAG7, Ondo MAG7Xon | Mag 7 baskets (not on BSC) | Base / Robinhood / SOL | hmag7.com [search] |
| Tooling | binance/binance-skills-hub ✓ | Official skills incl. Agentic Wallet and tokenized-securities info | n/a | ★1047, pushed 2026-09-11 |
| Tooling | Binance Agent OS | Sub-accounts, Agentic Wallet, MCP, x402, Skill Hub (2026-08-20) | n/a | techcrunch.com |
| Tooling | ondoprotocol/ondo-global-markets-token-list ✓ | Official Ondo token list | multi | ★7, pushed 2026-09-18 |
| Tooling | 402Protocol/xstocks-mcp, manu-xmint/xstocks-skill, btschwertfeger/python-kraken-sdk | Community xStocks MCP / skill / SDK | various | GitHub (sub-agent) |

## 5. Market-behavior evidence (for "weekend gap" ideas)

*(sub-agent; secondary. Quote with care.)*

- **Talos, 2026-06-24.** NVDAx weekend volume averaged "41% of its weekday volume" vs 17% for NVDAon. These are Solana/Ethereum figures, not BSC.
- **CoinDesk opinion, 2026-09-24.** The median deviation from NYSE close in market hours was "0.87%", widest "2.71%". An after-hours spike of "$2.55 to $23.16" came from a thin pool. Hedging is "not arbitrage".
- **FXStreet, 2026-10-04.** "47% of bStocks trading happened outside US market hours".
- **Hackernoon, Sep 2026.** Total tokenized stocks about "$3.1 billion". Ondo $947M, xStocks $693M, bStocks $678M. BNB Chain is "roughly $1 billion, a third of the market".
- **Lead's verified snapshot (2026-10-05):**
  - NVDAB/USDT PancakeSwap v3 ≈ $4.38M reserve and $8.25M 24h volume.
  - NVDAon AMM pools idle (RFQ market).
  - NVDAx ≈ $474.
  - In practice, on-chain 24/7 depth on BSC means **bStocks**.

## 6. What judges have said in past editions

*(sub-agent; verbatim where quoted)*

- This event's blog: "Specific and honest beats polite." "Judges need to run it. If they can't, you're scored on the video alone." Tie-break: "depth of W3W API usage first, then the quality of your feedback report." "There's no live PnL scoring."
- BNB AI Hack rules: "Ensure the contract address has at least 2 successful transactions within the hackathon timeframe". Open source "with a reasonable commit history".
- Smart Money Era: "Single-category submissions score poorly. All four, equally deep, is the bar."
- No earlier BNB hackathon required a standalone Developer Experience Report. "Most hackathons don't ask for one." [BLOG]
