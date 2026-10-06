# Idea Forge Brief — Proof of Position: stock calls you can't post unless you hold the stock

> "Proof of Position" is a provisional working title, and the builder may rename it. This brief is the
> single source of truth handed to the architect (Step 1). It fixes **what** and **why**, not how. It is
> a brief, not a spec.

## Event + constraints

- **Date written:** 2026-10-06 (idea-forge, Step 0).
- **Hackathon:** BNB Hack: Tokenized Stocks Edition (BNB Chain × Binance Web3 Wallet), $20,000 pool.
  - Event page: https://www.bnbchain.org/en/hackathons/tokenized-stocks?tab=overview
  - Resource pack (pre-verified, read it first): `docs/resources/2026-10-05-bnb-hack-tokenized-stocks/`,
    starting at `INDEX.md`. One brief in that folder is **another team's
    project**, kept only for its API facts.
- **Hard deadline.** This is an inert calendar fact. idea-forge did not gate on it; the builder scopes to
  the calendar.
  - **Sun 11 Oct 2026, 12:00 UTC (17:30 IST).** Quote: "Submissions lock. Repos frozen. Videos, links and
    DevEx reports due."
  - Judging runs 12–23 Oct. The repo, the demo and the deployed link must stay reachable through judging.
- **Track rules (verbatim):**
  - "At least one of **bStocks**, **Ondo** or **xStocks** has to be central to what you submit."
  - "Spot only. Perps are out."
  - "**BSC mainnet only.** Dry-run with the Transaction API while you build, then demo with small live
    amounts. Teams fund their own wallets, and a few dollars is enough to prove the flow works."
- **Team:** solo builder plus the AI pipeline (architect → executor pool → reviewer). Builder skills:
  TypeScript/React, Python, Solidity/DeFi, AI agents/LLM tooling (MCP, agent frameworks).
- **Target tracks:** Main Track, plus both stack specials (see below).
- **Risk posture:** `novel-wow`. It is applied as −5 buildability / +5 novelty from the kit default, and
  buildability stays the highest single weight.
- **Submission obligations** (`event.md` §3):
  - A public repo.
  - A demo video of 4:00 or less. Treat it as required (conflict C1).
  - A deployed link or judge-runnable instructions, with no keys.
  - The **Developer Experience Report** is mandatory, worth 25%, and must be human-written. Quote:
    "Perfunctory or AI-generated reports are not accepted". The build keeps a running `DEVEX_LOG.md` for
    the humans to write from: exact endpoints, error strings, latencies, slippage and time-to-first-call.

## Problem

Retail investors buy on stock tips from X, Telegram and YouTube with no way to check whether the caller
owns the stock or is selling into their buying. The SEC alleged exactly this against eight Twitter/Discord
influencers in December 2022 ([LR-25591](https://www.sec.gov/litigation/litreleases/lr-25591), a $100M
pump-and-dump). Brokerage positions are private, so "I'm long" is unverifiable. Tokenized stocks on BSC
make a caller's position public, but no product binds a call to it.

## Solution (one line)

**Stock calls you can't post unless you hold the tokenized stock: each call's badge is read on-chain from
the caller's live BSC balance, flips the moment they sell, and followers' agents exit with them.**

## Must-have demo features (the minimum that makes the money shot land)

1. **`CallRegistry`: "No position, no call."** This is a Solidity contract on BSC mainnet, and the only
   custom contract.
   - `post` reverts unless the caller's wallet holds at least the declared amount of the called tokenized
     stock **right now**. Any bStocks / Ondo / xStocks token qualifies, read with `balanceOf`.
   - It records the call (token, declared amount, block, optional ERC-8004 agent id) and emits an event.
   - A view returns the call's live status from the current balance:
     - **HOLDING**: at least the declared amount;
     - **TRIMMED**: more than 0 but less than declared;
     - **EXITED**: 0.
   - There is no oracle and no indexer. Anyone can check a badge on BscScan.
2. **Live verified feed + "Follow with $X"** (React web app).
   - **Display.** Calls render in shares, normalized with RWA Data `tokenToShareRatio`. Each card shows
     the issuer and `statusInfo` (open, closed or paused, with the reason).
   - **Badges.** They refresh from the on-chain view every block. On TRIMMED or EXITED, the card shows
     the exact exit transaction and whether it was a sale or a transfer. That comes from Market API
     `trades` with `walletAddressFilter`, or the WebSocket `tx` channel.
   - **Follow.** "Follow with $X" buys the same stock for real: Trading API `quote` → `swap`, then
     Transaction API `simulate` → `broadcast-transaction` with MEV protection.
   - **Alerts.** Followers are alerted when their caller trims or exits.
   - **Judge path.** The hosted judge path never depends on an Agentic Wallet session.
3. **An agent on each side.**
   - **Follower agent** (Agentic Wallet / Wallet Skills).
     - It mirrors a verified call within a user budget (`baw market-order swap`).
     - It **auto-exits when the caller's badge flips**.
     - It ships as an installable Wallet Skill that acts only on registry status.
   - **Analyst agent** (BNB Agent Studio).
     - It has an ERC-8004 identity on BSC mainnet and runs autonomously on a self-hosted runtime.
     - It **buys before it posts**, so every call it makes passes the registry.
     - Its closed calls feed integrity feedback (held through vs. exited, read from the registry) to the
       ERC-8004 ReputationRegistry.
     - It pays for its research inputs over x402 in U/USD1, buyer side only (e.g. CoinMarketCap's x402
       MCP, about $0.01 a call).

## Target sponsor track(s)

- **Main Track: Tokenized Stocks Products & Agents.**
  - **bStocks are central.** Follows execute on `NVDAB`, `TSLAB`, `AAPLB` and `SPYB` through the 24/7
    bStock SWAP route. The registry also verifies Ondo and xStocks holdings.
  - **Rules.** Spot only, BSC mainnet, small live amounts, and `simulate` on every signed leg.
  - **W3W modules:** RWA Data, Market (trades and WebSocket), Address Portfolio, Wallet, Trading and
    Transaction. This feeds the tie-break ("depth of W3W API usage first").
- **Best Use of Agentic Wallet / Wallet Skills ($2,000).**
  - The criterion is "Deepest, most credible use of the AI execution layer".
  - Agentic Wallet is in the real execution path for the follower agent's entry and for its
    evidence-triggered exit. It is packaged as a Wallet Skill.
- **Best Use of BNB Agent Studio ($2,000).**
  - The criterion is "agent identity, autonomous runtime, self-funding via x402".
  - The analyst agent is built with Studio and carries an ERC-8004 identity and reputation on BSC
    mainnet. It posts autonomously and buys its own research over x402.
  - Stretch: it earns a creator fee on followers' API-path follows. That is the Trading API `feePercent`,
    which works on bStock SWAP routes only. It would close the self-funding loop.

## Judging criteria (published)

From the event page's Tracks tab, "How You're Judged". The text is verbatim; the [BLOG] lists identical
weights:

| Criterion | Weight | What we look at |
| --- | --- | --- |
| **Technical implementation** | 30% | Does it run, and how deep does the integration go? Modules used, error handling, how it holds up. |
| **Creativity & originality** | 25% | Were the APIs used in ways nobody expected? Does this already exist five times over? |
| **Developer Experience Report** | 25% | Specific, actionable, honest, no fluff. Includes the AI stack section. |
| **Product quality & UX** | 20% | Is it usable by the people it is for? Would it bring non-crypto-native users on-chain? |

Other published rules that shape the build:
- [BLOG] "Tie-breaks go on depth of W3W API usage first, then the quality of your feedback report."
- [BLOG] "There's no live PnL scoring." [EP] "Agents are welcome and expected, and are scored on how well
  they are built rather than on the PnL they could print".
- [EP] Agentic Wallet / Wallet Skills: "Optional, heavily weighted in scoring and tied to a special prize."
- [EP] "Combining API modules in a way that looks like it should not work but does is exactly what we are
  hoping to see."
- [BLOG] "Judges need to run it. If they can't, you're scored on the video alone."
- Specials (verbatim):
  - Agentic Wallet: "Deepest, most credible use of the AI execution layer."
  - Agent Studio: "Deepest use of Agent Studio: agent identity, autonomous runtime, self-funding via x402."

## Why it wins

**White space.**
- About 40 entries are already known for this event (`prior-art.md` §1, `telegram-intel-2026-10-06.md`
  §1/§3). They cluster on:
  - gap and fair-price radars (~16);
  - pre-trade guards (~8);
  - trading/DCA agents (~8);
  - research and signal feeds (~7).
- None of them, as described, binds a public stock call to the caller's live position.
- A bounded GitHub search (2026-10-06) found no "verified stock calls" repo. The nearest primitives prove a
  balance at one moment, but they neither gate a public claim nor track it:
  - [InsumerModel's holdings checks on Robinhood Chain](https://insumermodel.com/blog/verify-tokenized-stock-holdings-robinhood-chain.html);
  - [StockProof's ZK portfolio-ownership proofs](https://ethglobal.com/showcase/stockproof-uan1f).
- Memecoin KOL wallet trackers watch wallets but don't bind claims to them.

**Head-to-head** on the event's criteria, against the three strongest rivals named in
`telegram-intel-2026-10-06.md` §4 (Roost, executable-gap-desk, CaptainX's bStocks agent):
- **Creativity & originality: wins against all three.**
  - It uses Portfolio, Market and Wallet reads as an integrity layer for equity claims, enforced by a
    contract.
  - The rivals' paid or core products sit in the spread-report, gap-gate and indicator-trading clusters.
  - Roost's creature framing is itself original, so that win is the narrowest.
- **Technical implementation: ties** Roost and the gap desk on module breadth. It adds a mainnet
  enforcement contract and a mainnet ERC-8004 identity with reputation writes; Roost's agent is ERC-8004
  testnet #2565.
- **Product & UX: ties** Roost's polished live app. It aims at non-crypto-native stock-tip followers (a
  feed and one button) rather than at traders.

## Demo money shot (~15 seconds)

**"The caller sold. The badge knew first."**

1. **The setup.** The feed shows a human caller's card: "LONG NVIDIA · 0.02 shares · HOLDING ✓ verified
   on-chain". A follower's Agentic Wallet agent has just mirrored it ("You hold 0.011 NVIDIA alongside
   them"). Next to it, the analyst agent's own NVIDIA call is green too.
2. **The dump.** In the other pane, the caller sells all their `NVDAB` on BSC mainnet.
3. **The flip.** Within seconds the caller's badge turns red: "EXITED · sold 0.02 NVIDIA · tx 0x…". The
   follower is alerted and their agent sells. The analyst agent's card stays green.
4. **The gate.** The caller tries to post "LONG TESLA" without holding Tesla. The `CallRegistry` reverts
   on-chain: **"No position, no call."**

## Out of scope (explicit — keeps the build on the money shot)

- **Calls:**
  - No short calls. The track is spot only, and a short can't be position-proven without borrowing or
    perps.
  - No PnL leaderboard or "best caller" ranking. Reputation measures integrity (held, trimmed, exited),
    not returns.
- **Custody:** positions stay in callers' and followers' own wallets. No vault, escrow, staking or
  locking of stocks, and no custom token.
- **Payments:**
  - No x402 selling: B402 merchant credentials look unavailable.
  - Nothing in another team's claimed angle.
- **Surfaces:** no X/Twitter API, browser extension, mobile app or Telegram bot. A Telegram channel mirror
  of badges is a stretch only.
- **Privacy:** no ZK or private proofs. Positions are public by design.
- **Assets:**
  - No xStocks follow execution (negligible BSC liquidity); xStocks and Ondo holdings are verify-only.
  - Follows execute on bStocks. Ondo RFQ is optional, in US hours.
- **Agents:** no signal or strategy engine beyond the single demo analyst agent, and no backtesting.
- **Claims:**
  - No net-exposure claim. A badge proves the BSC position, not hedges held elsewhere, and the UI says so.
  - No investment-advice claims.
- **Chains:** BSC mainnet only.

## Feasibility notes for the architect (primitives, not design)

Transcribed from the resource pack, which names its source per fact. Items marked *(participant claim)*
come from the builder Telegram and were not verified. Another team's feasibility notes are reused
here as API facts only.

**Binance Web3 API: access** (`sponsors/binance-web3-wallet.md` §2)
- **Base URL:** `https://web3.binance.com/build`. Every path is `/build/api/v1/...`.
  - The **signed `requestPath` must include `/build`**. Quote: "omitting it is the most common cause of
    `40102 Invalid signature`".
- **Headers:** `X-OC-APIKEY`, `X-OC-TIMESTAMP` (ISO 8601 with ms), `X-OC-SIGN` (Base64). Optional:
  `X-OC-RECV-WINDOW` (default `5000`, max `60000` ms) and `X-OC-NONCE`.
- **Signature:** `preHash = timestamp + method + requestPath + body`, then `signature = Base64(
  HMAC-SHA256(preHash, secretKey) )`.
- **Key permissions:** keys bind permissions by capability domain. Tick **Trading, Market, Wallet,
  Transaction**.
- **Rate limits:**
  - **5 RPS per endpoint** by default, plus 1,200 req / 60 s per IP and per key.
  - Over the limit you get HTTP 429 + `Retry-After`.
  - Organizer: ping Gwen in the builder Telegram if you hit the cap.
- **Response envelope:** `{"code","msg","data","timestamp"}`; `code` `0` = success.
- **Chain id:** `binanceChainId` = `"56"` for BSC.
- **SDKs:**
  - JS `npm install @binance-web3/wallet` (Node `v22.12.0`+, server-side only).
  - Python `pip install binance-web3-wallet`.
  - Examples use the env vars `BINANCE_API_KEY` / `BINANCE_API_SECRET`.
- **Region rule:** "IP checks are enforced on both the Developer Portal and the API server side."
- **`40304` "Service not available due to compliance restriction"** *(participant claims)*:
  - Five teams hit it, from a Cloudflare Worker, US Vercel, serverless hosting, a deployed server, and
    GitHub Actions plus a local machine in Nigeria.
  - The Singapore region is reported to work.
  - The on-chain badge doesn't need the API (public RPC is enough), so the feed still works if the API is
    blocked.

**Endpoints this idea leans on** (`sponsors/binance-web3-api-reference.md`, generated from the official
OpenAPI)
- **Market:** `GET /api/v1/dex/market/trades`. Required: `binanceChainId`, `tokenContractAddress`.
  Optional: `cursor`, `limit`, `tagFilter`, `walletAddressFilter`.
- **WebSocket:** `GET /api/v1/dex/market/wss/auth/token`, then
  `wss://web3-stream.binance.com/w3w/stream?token=…`. Channels: price, tx-data, tx (trades), candles.
- **Address Portfolio:**
  - `GET /api/v1/dex/market/portfolio/token/latest-pnl` (`binanceChainId`, `walletAddress`,
    `tokenContractAddress`).
  - `GET /api/v1/dex/market/portfolio/dex-history` (`binanceChainId`, `walletAddress`; optional `begin`,
    `end`, `tokenContractAddress`, `type`, `cursor`, `limit`).
- **Wallet:** `POST /api/v1/dex/balance/token-balances-by-address` (`body.address`,
  `body.tokenContractAddresses`; optional `body.excludeRiskToken`).
- **RWA Data:** `GET /api/v1/dex/market/rwa/{tokens, price, search, underlying-profile,
  underlying-market, platforms}`.
  - `platformId` ∈ `["ondo","bstock"]`: **xStocks is not covered**.
  - `/rwa/tokens` returns `tokenToShareRatio` ("1 token ≈ N underlying shares"), `statusInfo{openState,
    marketStatus, reasonCode, reasonMsg, nextOpenTime, nextCloseTime}`, `tokenPrice` and
    `referencePrice`.
  - `/rwa/price` takes up to 100 comma-separated addresses.
  - ⚠️ `referencePrice` is "derived from the on-chain token price, not an official quote".
- **Trading:** `GET /api/v1/dex/aggregator/{quote, swap, quote-and-swap, approve-transaction}`,
  `POST /api/v1/dex/aggregator/order/submit` and `GET /api/v1/dex/aggregator/order/{orderId}`.
  - `quoteId` TTL is about 30 s (`40401 QUOTE_EXPIRED`).
  - `userWalletAddress` is required for RFQ quotes.
  - `vendor` is required in `/approve-transaction` for equity tokens.
  - **Custom fee:** `feePercent` in `(0, 5]` on EVM, with exactly one of
    `fromTokenReferrerWalletAddress` / `toTokenReferrerWalletAddress` on `/swap`. Quote: "Equity / RWA
    token (Ondo, BStock) RFQ routes ignore fee parameters".
  - `/quote-and-swap` (Flash) needs `vendor=LiquidMesh`. Its `enableRFQ` defaults to `"true"` for
    BStock pairs.
  - **Aggregation router (BSC):** `0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5`.
- **Transaction:**
  - **Simulate:** `POST /api/v1/dex/pre-transaction/simulate` takes `{binanceChainId,
    evmTx:{from,to,value,data}}` and returns `status`, `failReason`, `balanceChanges[]` and
    `allowanceChanges[]`. There are no state overrides, so `from` must hold the input.
  - **Broadcast:** `POST /api/v1/dex/pre-transaction/broadcast-transaction` takes `{binanceChainId,
    signedTransaction, address, enableMevProtection}`.
  - RFQ legs are EIP-712 orders, not simulatable transactions.

**Equity routing and hours** (`sponsors/binance-web3-wallet.md` §4)
- **Routing (verbatim):**
  - "**Ondo tokens** … Always routed via **3-vendor RFQ** (InchFusion + CowSwap + PcsXRfq)."
  - "**BStock tokens** … Routed via **LiquidMesh (SWAP) + PcsXRfq (RFQ)** in a mixed result."
  - "**xStock tokens** … Traded via regular AMM liquidity pools — no RFQ route."
- **Error codes:**
  - `40366` Ondo max single order.
  - `40367` Ondo market not tradable.
  - `40368` Ondo must pair with USDT on BSC.
  - `40369` bStock invalid trading time.
  - `40370` bStock counter-token not whitelisted.
  - `40374` insufficient liquidity.
  - `40375` Ondo below minimum USD.
- **Hours:**
  - bStock AMM pools trade 24/7, while the bStock RFQ leg closes outside US hours (`40369`).
  - Ondo RFQ closes (`40367`) except for Off-Hours assets.
  - Observed but undocumented *(participant claims)*: `marketStatus = "offhours"`, and a LiquidMesh SWAP
    route for NVDAon.

**Tokens** (`sponsors/tokenized-stock-issuers.md` §2; all 18 decimals; symbol verified on-chain)

| Ticker | bStock | Ondo | xStocks |
|---|---|---|---|
| NVDA | `NVDAB` `0x02fca66c1d1afb4e2a7884261eb00f63598a7436` | `NVDAon` `0xa9ee28c80f960b889dfbd1902055218cba016f75` | `NVDAx` `0xc845b2894dbddd03858fd2d643b4ef725fe0849d` |
| TSLA | `TSLAB` `0x5b1910eaad6450e50f816082aa078c41f10c292f` | `TSLAon` `0x2494b603319d4d9f9715c9f4496d9e0364b59d93` | `TSLAx` `0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0` |
| AAPL | `AAPLB` `0x431a3bee82e2ca41e49895cbece5bb0f76a89b7a` | `AAPLon` `0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4` | `AAPLx` `0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a` |
| SPY | `SPYB` `0x7138b48df7d98d7e3cc221bfe7192d0a178182d8` | `SPYon` `0x6a708ead771238919d85930b5a0f10454e1c331a` | `SPYx` `0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48` |

- **Stable legs (18 decimals):** USDT `0x55d398326f99059fF775485246999027B3197955`, U
  `0xcE24439F2D9C6a2289F741120FE202248B666666`, USD1 `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d`.
- **Full registry:** 675 rows in `data/bsc-tokenized-stocks-2026-10-05.csv`.

**Balances and multipliers: a token is not a share** (`tokenized-stock-issuers.md` §1, §3, §5, §6)
- **bStock:**
  - `uiMultiplier()` (1e18 = 1.0×; NVDAB ≈ 1.00078 on 2026-10-05).
  - Also `balanceOfUI(address)`, `toUIAmount`, `fromUIAmount` and the event `UIMultiplierUpdated`
    *(sub-agent ABI)*.
- **Ondo:** shares-per-token come from the `SyntheticSharesOracle`
  `0xF4Fd8a1B412633e10527454137A29Db7Aa35F15e`. The token itself has no getter.
- **xStocks:** **rebasing**. Quote: "The `balanceOf()` function automatically returns the adjusted
  balance (equivalent to underlying shares)". The multiplier comes from `getCurrentMultiplier()`.
- **Normalize per share before comparing across systems.** Corporate actions move the multipliers:
  dividends are reinvested, and a split rebases the balance.
- **Compliance hooks** exist on all three (blacklist, `compliance()`, sanctions, pause). Transfers to
  restricted addresses may revert, and assets can be paused for corporate actions.

**Liquidity** (GeckoTerminal, 2026-10-05)
- NVDAB/USDT PancakeSwap v3 0.25% `0x8fb4243b553ac29ba088acf00b9b7da24bd6690c`: ≈ $4.38M reserve,
  ≈ $8.25M 24h volume.
- TSLAB/USDT 0.25%: ≈ $1.94M.
- SPYB/USDT 0.01%: ≈ $252k.
- NVDAon AMM pools are idle (Ondo is RFQ). NVDAx's only pool is ≈ $474.
- So follow execution runs on bStocks, and xStocks are verify-only.

**Agentic Wallet** (`sponsors/binance-web3-wallet.md` §8; `tracks.md` §2)
- **Install:** `npx skills add binance/binance-skills-hub/skills/binance-web3/binance-agentic-wallet`.
  The CLI is `baw` from npm `@binance/agentic-wallet` 1.10.0.
- **Sign-in:** **the user signs in** (`baw auth signin --json` → QR → `baw auth verify --qrCodeId <id>
  --json`). The pipeline never does.
- **Swap:** `baw market-order swap --fromTokenQty … --fromToken … --toToken … --binanceChainId 56
  [--slippage auto] [--mev true] --json` → `orderId`.
  - Poll `market-order list --orderId` until `FINISHED`/`FAILED`. Quote: "an orderId only means
    submitted".
- **Settings:**
  - Limits are set only in the Binance App. There is no testnet.
  - Developer mode (`contract-call`, `sign-message`) "can only be enabled or configured in the Binance
    App".
- **Limit orders:**
  - "only supported on BSC and Solana", with `--fromToken` "only USDT, USDC, and Native Token".
  - Stock tokens are reportedly refused.
- **Session:** sign-in lasts about 48 h and sign-out is silent *(participant claims)*. So the hosted judge
  path must not depend on Agentic Wallet.
- **Adjacent official skill:** `binance-onchain-copy-trader` (Agentic Wallet, Read + Write). The follower
  agent differs because it acts on **registry status**, not on raw wallet mirroring.

**BNB Agent Studio** (`sponsors/bnb-chain.md` §2, §7; `telegram-intel-2026-10-06.md` §2)
- **Install:** `npm install -g @bnbagent/studio-cli` (0.0.14), then `bag skills install`. Needs Node ≥ 22,
  Corepack + pnpm 10, and Bun 1.3+.
- **Local run:** `bag dev` serves A2A on `:9000`, MCP at `http://localhost:8000/mcp`, and x402 at `/x402`.
- **Deploy:** `bag deploy --provider bnb|aws|azure|nodeops`, or a manual `bag erc8004 register --endpoint
  <url>`.
- **Runtime trap:**
  - The managed trial is "Testnet-only" for 48 h.
  - Organizer (previous hack): it is "by design … not for hosting agents through judging". Self-host for
    mainnet.
- **Secrets and signing:**
  - The `envvars` secrets mode is "testnet only — refused on mainnet".
  - The signing policy is fixed code. It allows EIP-3009 and denies Permit2 by default.
- **LLM:** the default (Pieverse `auto/free`) returns HTTP 429 (two teams). Bring your own LLM key as an
  env var.
- **CLI minimum** (organizer): `bag ≥ 0.0.13`.

**ERC-8004 on BSC mainnet** (`sponsors/bnb-chain.md` §3; code-verified)
- **Addresses:**
  - IdentityRegistry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (`name()` → `"AgentIdentity"`).
  - ReputationRegistry `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`.
- **Identity:**
  - `register(string agentURI)`.
  - `setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)`.
  - `getAgentWallet(uint256)`.
  - Event `Registered(uint256 agentId, string agentURI, address owner)`.
- **Reputation:**
  - `giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string
    endpoint, string feedbackURI, bytes32 feedbackHash)`.
  - `getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2)`.
- These signatures come from the EIP/SDK *(sub-agent)*. **Diff them against the deployed ABI and check
  who may call `giveFeedback`** before coding.
- Registration is gas-sponsored via the MegaFuel paymaster *(sub-agent)*. Both EIPs are Draft.

**x402, buyer side only** (API facts from the bStock competition doc)
- **CMC MCP:** `https://mcp.coinmarketcap.com/x402/mcp`, about $0.01 a call.
  - It is **synchronous**: `tools/call` → 402 → sign → replay with `PAYMENT-SIGNATURE` → 200, with the
    data in the SSE `data:` line.
  - The free discovery tools cost nothing.
- **Payment tokens:** U and USD1 implement EIP-3009 `transferWithAuthorization`, so they need no
  approval. EIP-712 domains:
  - U: name `"United Stables"`, version `"1"`;
  - USD1: name `"World Liberty Financial USD"`, version `"1"`;
  - both: chainId 56, verifyingContract = the token address.
- **B402 merchant credentials:** treat them as unavailable (two builders found the form locked). Not
  needed here, because this build only buys over x402.

**BSC** (`sponsors/bnb-chain.md` §4)
- Chain 56.
- RPC `https://bsc-dataseed.bnbchain.org` ("10K/5min"). **`eth_getLogs` is disabled on the official
  mainnet endpoints.**
- Explorers: BscScan, BscTrace.

**Day-1 external dependencies** (user actions, request immediately)
1. In the Developer Portal, create the API key with Trading, Market, Wallet and Transaction permissions.
   Use a desktop-width browser.
2. Fill the registration (Apply-as-Hacker) form for elevated rate limits.
3. Sign in to Agentic Wallet (Binance App MPC wallet). Only the user does this.
4. Fund three burner wallets (caller persona, follower persona, analyst agent): a few dollars of USDT plus
   BNB for gas each, and cents of U/USD1 for x402.
5. Provide an LLM API key as an env var for the analyst agent.

**Day-1 smoke checks** (gate the build on these, cheapest first)
1. A signed `GET /build/api/v1/dex/market/rwa/tokens?binanceChainId=56` from the **exact hosting region**
   returns `code 0`, not `40304`.
2. `trades?walletAddressFilter=<persona>` shows a just-made NVDAB swap. Record the lag. It only annotates
   the exit tx; the badge itself reads chain state.
3. Address Portfolio `dex-history` / `token/latest-pnl` return tokenized-stock activity. Coverage is
   unverified.
4. One `baw market-order swap` buys and sells a few cents of NVDAB end to end. Record the latency.
5. ERC-8004: `register` on mainnet, then one `giveFeedback` from a non-owner address.
6. Stretch: `feePercent` is honored on a bStock SWAP route.

**Longest pole.**
- **The `CallRegistry`.** It is the trust anchor and the only security-sensitive code. It must handle:
  - the holding check at post time;
  - the status view across three balance models: a plain ERC-20, the bStock UI multiplier, and rebasing
    xStocks, where a split or dividend changes `balanceOf`;
  - abuse cases: a transfer out, a post made from a borrowed balance that is then returned, and a
    declared amount of zero.

  Give it the highest reasoning effort and the most review.
- **The end-to-end exit loop.** The caller sells → the badge flips → the follower agent exits. It must
  close in seconds, and that time is measured.

## Rubric mapping (why this won, for the record)

**Weights.** The kit rubric (`references/ideation-rubric.md`) is re-mapped to mirror the published
30 / 25 / 25 / 20, and buildability stays the highest single weight:
- **Intrinsic buildability 30.** The kit default of 35 drops 5 for `novel-wow`. It covers "Does it run".
- **Creativity / Novelty 25.** The kit's 20 gains 5 for `novel-wow`. It mirrors Creativity & originality
  at 25%.
- **Integration depth & track fit 25.** This covers "how deep does the integration go", the tie-break on
  W3W depth and the two specials. The human-written DevEx report (25%) draws its raw material from the
  modules the build actually exercises.
- **Demo WOW + Product/UX 20.** It mirrors Product quality & UX at 20%.

**Divergence and gate.**
- The field held 33 candidates across about 14 seeds, plus a bolder-pass that rewrote the 10 most generic
  and kept both versions: 43 in total.
- Six were knocked out at the gate for external blockers:
  - an earnings-calendar agent: it needs a real earnings event and a live reaction;
  - card-to-stock onboarding: it needs a fiat ramp plus KYC;
  - range orders built through the DeFi API's LP endpoints: the fill needs a live price cross;
  - an MEV watch on stock pools: it needs real sandwich victims;
  - staked weekend forecasts: they resolve on the live Monday open;
  - a price "truth serum" on xStocks' Chainlink Data Streams: it needs Data Streams credentials.
- One more was excluded by instruction: it adapted another team's taken angle.

**Top survivors** (scores 1–5; total out of 500; "Final" applies the head-to-head and pressure-test
adjustments):

| Candidate | Build ×30 | Novelty ×25 | Depth/fit ×25 | WOW/UX ×20 | Total | Final |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **Proof of Position** | 5 | 4 | 5 | 5 | **475** | **475** |
| Investment club with an AI member (Safe + votes) | 4 | 4 | 4 | 4 | 400 | 375 |
| Creator baskets with copy fees | 4 | 3 | 5 | 4 | 400 | 370 |
| ERC-8183 research bounties with an API-verified evaluator | 4 | 3 | 5 | 4 | 400 | 380 |
| Call your broker (voice → Agentic Wallet) | 4 | 3 | 4 | 5 | 395 | 395 |
| Dividend paycheck (reinvested dividends revealed and paid out) | 4 | 4 | 4 | 3 | 380 | 380 |
| Shariah screen + dividend purification | 4 | 4 | 4 | 3 | 380 | 380 |

**White space.**
- Gap radars, routers, weekend pricers, chat brokers, MCP wrappers and DCA bots were classed as
  duplicates (Novelty 1).
- Proof of Position is white space in the event. It stays at 4, not 5, because holdings-verification
  primitives and KOL wallet trackers exist elsewhere.

**Head-to-head** (top candidates vs. Roost, executable-gap-desk and CaptainX's agent):
- **Proof of Position** wins Creativity against all three, with no clear loss elsewhere (see "Why it
  wins").
- **ERC-8183 bounties** only tie Creativity. Roost already uses ERC-8183 plus a Studio seller, and
  MANDATE and AGOS run the same agent-commerce pattern. They lose on Product & UX (a job board for agents
  vs. a consumer app), so WOW drops 4 → 3.

**Pressure test** (top 3 after the head-to-head):
- **Proof of Position: no hidden blocker.** Buildability stays 5.
  - The badge is a pure on-chain view, so it needs no oracle or indexer.
  - Exit detection can fall back to RPC.
  - ERC-8004 `register` is permissionless.
  - bStock AMM pools trade 24/7, so the demo is controllable at any hour.
  - Agentic Wallet sign-in is the user's own step, not a third-party approval.
- **Investment club.** Whether bStocks can sit in a Safe is unverified. Agentic Wallet as a Safe signer
  needs developer mode, which is App-only. Depth/fit drops 4 → 3.
- **Creator baskets.** The core revenue depends on `feePercent` on bStock SWAP routes, which is
  unverified (RFQ routes ignore fees). Buildability drops 4 → 3.

Committed: **Proof of Position**.
