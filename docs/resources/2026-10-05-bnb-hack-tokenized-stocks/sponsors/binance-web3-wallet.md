# Sponsor: Binance Web3 Wallet (W3W)

Binance Web3 Wallet co-funds the main track and funds the **Best Use of Agentic Wallet / Wallet
Skills** special. It ships the **Binance Web3 API** (the required integration), **Agentic Wallet**
and **Wallet Skills**. Fetched 2026-10-05.

**Provenance tags:**
- **[W3D:doc]** a web3.binance.com dev-docs page. The lead read these from the static mirror, which is SHA-256-identical to the live site (see INDEX).
- **[OAS]** the official OpenAPI 3.1.1 schema. The lead parsed it.
- **[SKH]** the `binance/binance-skills-hub` repo, read via `gh`.
- **[DBC]** developers.binance.com, captured by a sub-agent in Chrome. Marked *(sub-agent)* where the lead did not re-read it.
- **[BAPI]** Binance public endpoints. The lead fetched them.
- **[RPC]** an on-chain check by the lead (BSC mainnet, `bsc-dataseed.bnbchain.org`).
- **[NPM]** the npm registry. The lead checked it.

## 1. What they reward

- Tie-break: "Tie-breaks go on depth of W3W API usage first, then the quality of your feedback report." [BLOG]
- Special: "Best Use of Agentic Wallet / Wallet Skills: Deepest, most credible use of the AI execution layer." [EP]. Agentic Wallet is "Optional, heavily weighted in scoring and tied to a special prize." [EP]
- The DX report (25%) is read by the "W3W product team" [DX]. They want docs errors with URLs, endpoint pitfalls, latency, and redesign ideas (event.md §3.2).
- Free API access for the event. "Winners keep elevated rate limits afterwards." [BLOG]

## 2. Binance Web3 API: overview and access

| Item | Fact | Source |
|---|---|---|
| Base URL | `https://web3.binance.com/build`. Every path is `/build/api/v1/...` and the **signed `requestPath` must include `/build`** | [W3D:authentication] |
| Auth | "All Binance Web3 API endpoints are protected by **API Key authentication**." API Key + Secret Key from the Developer Portal (`https://web3.binance.com/en/dev-portal/project`) | [W3D:authentication] |
| Required headers | `X-OC-APIKEY`, `X-OC-TIMESTAMP` (ISO 8601 with ms, e.g. `2026-05-11T10:08:57.715Z`), `X-OC-SIGN` (Base64). Optional: `X-OC-RECV-WINDOW` (default `5000`, max `60000` ms), `X-OC-NONCE` | [W3D:authentication] |
| Signature | `preHash = timestamp + method + requestPath + body`, then `signature = Base64( HMAC-SHA256(preHash, secretKey) )`. Example `requestPath`: `/build/api/v1/dex/market/price?chainId=1&symbol=ETH%20USDT` (raw URL-encoded, query included) | [W3D:authentication] |
| Key permissions | Since 2026-08-27, "API Keys now support binding permissions by business capability domain (e.g. Trading, Market, Wallet, Transaction, DeFi, B402) … select the required domains when creating or editing an API Key." | [W3D:change-log] |
| Rate limits | Per IP `1 200` req / `60 s`; per API Key `1 200` / `60 s`; per User `6 000` / `60 s`; **per Endpoint `5 RPS` (default)**. Over the limit → **HTTP 429** + `Retry-After` | [W3D:authentication] |
| Auth error codes | `40001` invalid params · `40101` key missing/invalid/disabled · `40102` signature mismatch · `40103` timestamp expired / replayed · `40104` key lacks permission · `42900` rate limit · `50000` internal · `50001` unavailable | [W3D:authentication] |
| Response envelope | `{"code": …, "msg": …, "data": …, "timestamp": …}`. `code` `0` = success | [W3D:authentication], [OAS] |
| Chain id param | `binanceChainId` (string). BSC = `"56"`. Solana = `"CT_501"` | [OAS], [W3D:supported-chains] |
| SDK connectors | Python `pip install binance-web3-wallet` · JS `npm install @binance-web3/wallet` · Java Maven `io.github.binance:binance-web3-wallet`. Repos `binance/binance-web3-connector-{python,js,java}`. Examples use env vars `BINANCE_API_KEY` / `BINANCE_API_SECRET`. Server-side only (no browser JS) | [W3D:sdks-tools, python, javascript, java] |
| LLM docs | `https://web3.binance.com/en/dev-docs/llms.txt` and `…/llms-full.txt`. Non-browser clients get **HTTP 202 + empty body** (bot challenge). Identical copies are served at `https://bin.bnbstatic.com/static/w3w-dev-docs/html/en/dev-docs/llms-full.txt` (and `/llms.txt`, `/<page>.md`) | lead probe + SHA-256 match |
| MCP server | **"Coming soon"**: planned SSE transport for Claude Code / Cursor / Windsurf. No install/config is published | [W3D:mcp-server, agent-native] |
| Region IP checks | "IP checks are enforced on both the Developer Portal and the API server side." Restricted list incl. US + territories, CA, NL, IR, CU, KP, Crimea/DPR/LPR, GB, JP (conditional) | [W3D:service-restricted-countries-regions] |

**Full endpoint reference:** [binance-web3-api-reference.md](binance-web3-api-reference.md). It is
generated from the OpenAPI schema and has 65 operations. Full parameter and response tables are
kept for RWA Data, Trading and Transaction.

### Modules → endpoints (summary)

| Module | Endpoints (prefix `/api/v1`, unless v2) |
|---|---|
| **RWA Data** | `GET /dex/market/rwa/platforms`, `/rwa/price`, `/rwa/search`, `/rwa/underlying-profile`, `/rwa/tokens`, `/rwa/underlying-market` |
| Market / General Data | `POST /dex/market/price`, `/price-info`, `/token/basic-info`. `GET /candles`, `/token/search`, `/token/advanced-info`, `/token/hot-token`, `/token/holder`, `/token/top-trader`, `/token/top-liquidity`, `/trades`, … |
| Address Portfolio | `GET /dex/market/portfolio/{supported/chain, overview, recent-pnl, token/latest-pnl, dex-history}`, leaderboard, address-tracker |
| **Trading** | `GET /dex/aggregator/{supported/chain, approve-transaction, quote, swap, quote-and-swap, swap-instruction, history}`. `POST /dex/aggregator/order/submit`. `GET /dex/aggregator/order/{orderId}` |
| **Transaction** | `GET /dex/pre-transaction/{supported/chain, gas-price, block-height}`. `POST /dex/pre-transaction/{gas-limit, simulate, broadcast-transaction}`. `GET /dex/post-transaction/orders` |
| Wallet | `GET /dex/balance/{supported/chain, all-token-balances-by-address}`. `POST /dex/balance/token-balances-by-address`. `GET /dex/post-transaction/{transactions-by-address, transaction-detail-by-txhash}` |
| DeFi | `POST /defi/data/{position,protocol,investment}/…`. `POST /defi/transaction/{deposit, redeem, lp-add, lp-add/calculate, lp-remove, claim}` |
| b402 | `POST /api/v2/b402/{supported, verify, settle}` (also v1) |
| WebSocket | `GET /dex/market/wss/auth/token`, then `wss://web3-stream.binance.com/w3w/stream?token=…`. Channels: price, tx-data (market stats), tx (trades), candles |

## 3. RWA Data API: the tokenized-stocks layer

All fields below are from [OAS].

- **Platforms:** `platformId` enum = **`["ondo", "bstock"]`** ("ondo=Ondo Finance, bstock=bStocks"). **xStocks is not a platform here.** It is reachable through Trading/Market by contract address, and through Binance's public list (§7).
- **`/rwa/tokens`** returns per token:
  - Identity: `binanceChainId`, `tokenContractAddress`, `platformId`, `assetType` (`1=Stock, 2=Pre-IPO, 3=ETF`), `tokenName`, `tokenSymbol`, `decimals`.
  - Underlying: `underlyingTicker`, `underlyingName`, `tokenToShareRatio` ("E.g. \"1.003701\" means 1 token ≈ 1.003701 underlying shares").
  - Market: `tags`, `statusInfo{…}`, `tokenPrice`, `referencePrice`, `volume24H`, `marketCap`, `peRatioTTM`.
- **`statusInfo`:**
  - `openState` (bool).
  - `marketStatus` ∈ `premarket, regular, postmarket, overnight, closed, pause`.
  - `reasonCode` ∈ `TRADING, MARKET_CLOSED, MARKET_PAUSED, MARKET_MAINTENANCE, ASSET_PAUSED, ASSET_LIMITED, UNSUPPORTED`.
  - `reasonMsg`. For `ASSET_PAUSED` it is one of `cash_dividend, stock_dividend, stock_split, merger, acquisition, spinoff, maintenance, corporate action`. For `ASSET_LIMITED` it is `earnings`. The common case is "Weekend or Holiday".
  - `nextOpenTime`, `nextCloseTime` (Unix ms).
- **`tabId` sector filter:** 1=Serenity Call, 2=SpaceX, 3=Upcoming Earnings, 4=AI Chips, 5=Storage, 6=Energy, 7=Precious Metals, 8=China ADR, 9=Magnificent 7, 10=Crypto, 11=ETF, 12=Tech Leaders, 13=Buffett Portfolio.
- **`/rwa/underlying-profile` → `protections`:** "Known keys: dailyAttestationReport, monthlyAttestationReport, collateralReport." Each entry has a supported flag and a report link. It also returns `companyInfo` (CEO, website, industry, concepts, description).
- **`/rwa/underlying-market` → `marketData`:**
  - `referencePrice`, `high52W`/`low52W`, `volumeShares24H`, `avgDailyVolume1Y`, `totalShares`, `marketCap`.
  - `turnoverRate`, `amplitude`, `peRatioTTM`, `pbRatio`, `dividendYield`, `latestDividend`.
- **`/rwa/price`:** up to **100** comma-separated addresses per request. Returns `tokenPrice`, `referencePrice` and `tokenPriceUpdatedAt`.
- ⚠️ **`referencePrice` semantics (verbatim):** "Underlying reference price (USD). A per-share converted price derived from the on-chain token price, not an official quote from the traditional stock market."
  - So `tokenPrice` vs `referencePrice` is a share-ratio conversion, **not** an independent market gap.
  - The Ondo skill states the same relation: "`referencePrice = tokenPrice ÷ sharesMultiplier`" [W3D:supported-skills].
  - **INFERENCE:** a real "on-chain vs underlying" monitor needs an independent quote source. Options include the xStocks Chainlink Data Streams feeds (see the issuers file), Ondo's quote API, or a market-data provider. This contradicts the organizers' idea text (event.md C7).

## 4. Trading API: how tokenized stocks actually execute

| Fact | Value | Source |
|---|---|---|
| Aggregation router (BSC) | `0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5` (same address on all 12 listed EVM chains). [RPC]: code present, 180 bytes | [W3D:supported-chains] |
| Execution modes | `SWAP` (sign tx, broadcast) and `RFQ` (sign EIP-712, submit order) | [W3D:introduction-4] |
| Flash API | `GET /quote-and-swap?vendor=LiquidMesh`. "Currently the `vendor` parameter only accepts `LiquidMesh`." | [W3D:introduction-4] |
| Custom fee | `feePercent` in `(0, 5]` on EVM (max 2 decimals). `FROM_TOKEN`/`TO_TOKEN`. "Equity / RWA token (Ondo, BStock) RFQ routes ignore fee parameters" | [W3D:change-log, introduction-4] |

**Equity token routing (verbatim, [W3D:introduction-4]):**

> - **Ondo tokens** (type=1): … Always routed via **3-vendor RFQ** (InchFusion + CowSwap + PcsXRfq). All routes return `executionMode=RFQ`.
> - **BStock tokens** (type=3): … Routed via **LiquidMesh (SWAP) + PcsXRfq (RFQ)** in a mixed result — one SWAP route and one RFQ route may be returned simultaneously.
> - **xStock tokens** (type=2): … Traded via regular AMM liquidity pools — no RFQ route. Returns `executionMode=SWAP`, same flow as regular crypto tokens.
>
> **Note**: Ondo, xStock, and BStock token sets are mutually exclusive.

The RFQ flow: `GET /quote → GET /swap → Sign rfq.typedDataToSign (EIP-712) → POST /order/submit → GET /order/{orderId} (poll until FILLED / FAILED)`.

**Key constraints for equity tokens (verbatim table, [W3D:introduction-4]):**

| Constraint | Details |
|---|---|
| `userWalletAddress` | **Required** in `/quote` for RFQ routes. Used as the swap receiver in the RFQ order. |
| `quoteId` TTL | 30 seconds. Call `/swap` within 30s of `/quote` or you will get `QUOTE_EXPIRED` (40401). |
| EIP-712 signature | Sign `rfq.typedDataToSign` from `/swap`. The signing wallet must match `userWalletAddress`. |
| `vendor` in approve | **Required** for equity tokens in `/approve-transaction`. Use `vendorName` from `/quote`. |
| Idempotency (`requestId`) | Reuse the same UUID when retrying `/order/submit`. A new UUID creates a new order. |
| Market hours | Ondo tokens may be unavailable outside US market hours (error 40367); BStock similarly (40369). |

**RWA-specific error codes ([W3D:error-codes-4], names verbatim, meanings paraphrased):**

| Code | Name | Meaning |
|---|---|---|
| `40365` | `ONDO_TOKEN_PAIR_NOT_SUPPORTED` | Ondo-only mode and neither side is Ondo |
| `40366` | `ONDO_MAX_SINGLE_ORDER_LIMIT` | Over the market maker's single-order cap |
| `40367` | `ONDO_MARKET_STATE_NOT_TRADABLE` | Underlying market closed or halted |
| `40368` | `ONDO_STABLECOIN_PAIR_INVALID` | Counter stablecoin not whitelisted ("must pair with USDT on BSC or USDC on ETH") |
| `40369` | `BSTOCK_INVALID_TRADING_TIME` | Underlying exchange closed |
| `40370` | `BSTOCK_INVALID_TRADING_PAIR` | Counter token not on the bStock whitelist |
| `40374` | `RWA_INSUFFICIENT_LIQUIDITY` | No vendor quote ("Common for newly listed or thinly traded equity tokens") |
| `40375` | `ONDO_FROM_USD_AMOUNT_TOO_SMALL` | Below the minimum USD order (minimum given in `msg`) |

## 5. Transaction API (dry-run requirement)

- The track rule says "Dry-run with the Transaction API while you build" [EP].
- The endpoints are `POST /api/v1/dex/pre-transaction/simulate`, `/gas-limit` and `/broadcast-transaction`, plus `GET /gas-price`, `/block-height` and `/supported/chain`. Field tables are in the reference [OAS].
- **INFERENCE:** `simulate` applies to signed-transaction paths: SWAP mode, approvals and DeFi calldata. RFQ orders (Ondo, and the bStock PcsXRfq route) are EIP-712 orders submitted to `/order/submit`, not broadcast transactions. The demo should show a simulate step on the SWAP/approve legs and explain the RFQ leg.
- The DeFi transaction builders accept `simulate=true` to return a `preview` [W3D:change-log 2026-08-31].

## 6. DeFi API and b402 (supporting modules)

- **DeFi (BSC protocols, [W3D:supported-chains-protocols]):**
  - Earn: Venus (`venus`), Venus Flux (`venusflux`), Lista DAO (`helio`), Aave V3 (`aave3`), Aster (`astherus`), Solv (`solv`), Nest Credit (`nestcredit`).
  - Liquidity pools: Uniswap V2/V3/V4 (`uniswap2/3/4`), PancakeSwap V2/V3/Infinity (`pancakeswap`/`pancakeswap3`/`pancakeswap4`).
  - 2026-09-30: coverage expanded from BSC to 10 EVM chains. Error `40470` was renumbered to `40490` [W3D:change-log].
- **b402** ("Gas-sponsored stablecoin payments for x402-compatible services"). Launched 2026-08-27 [W3D:change-log].
  - Networks: BSC mainnet `eip155:56` (production) and BSC testnet `eip155:97` ("QA only").
  - Methods: `eip3009` (U, USD1; no approval), `permit2-exact` and `permit2-upto` (any configured ERC-20; one-time allowance to canonical Permit2). "Configuration returned by `POST /api/v2/b402/supported` is authoritative." [W3D:supported-payment-methods]
  - Production assets. All have code on BSC with matching `symbol()`; decimals are 18 [RPC]:

| Token | Address | EIP-3009 | Permit2 |
|---|---|---|---|
| U | `0xcE24439F2D9C6a2289F741120FE202248B666666` | Yes | Yes |
| USD1 | `0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d` | Yes | Yes |
| USDC | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | No | Yes |
| USDT | `0x55d398326f99059fF775485246999027B3197955` | No | Yes |

  - Canonical (Uniswap) Permit2 on BSC is `0x000000000022D473030F116dDEE9F6B43aC78BA3` [RPC: 9,152-byte code]. ⚠️ PancakeSwap uses a **different** Permit2: `0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768` (see `bnb-chain.md`).

## 7. Public, no-key endpoints used by Binance's own skills

The `binance-agentic-wallet` skill tells agents to resolve tickers through this endpoint [SKH]. The lead fetched it live with headers `Accept-Encoding: identity` and `User-Agent: binance-web3/1.1 (Skill)`, as the skill specifies. **These are undocumented `bapi` endpoints. Treat their stability as unknown.**

- `GET https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai?type=<n>`, where `type=1` = Ondo (`…on`), `type=2` = xStocks (`…x`), `type=3` = bStock (`…B`). Live counts on 2026-10-05:

| type | total | on BSC (chainId 56) |
|---|---|---|
| 1 Ondo | 1366 | 458 (also chains `1`, `CT_501`) |
| 2 xStocks | 269 | 130 (also `CT_501`) |
| 3 bStock | 87 | 87 |

  - Fields: `chainId, contractAddress, symbol, ticker, type, assetType, multiplier, …`.
  - The extracted BSC registry is in [../data/bsc-tokenized-stocks-2026-10-05.csv](../data/bsc-tokenized-stocks-2026-10-05.csv).
- `GET …/token/rwa/market/status/ai`. Live sample: `{"marketStatus":"regular","openState":true,…,"nextOpen":"2026-10-05T20:01:00Z","nextClose":"2026-10-05T19:59:00Z",…,"offhours":{"openState":false,…}}`.
- Further endpoints, *(sub-agent, from SKH)*. The lead did not call them:
  - `…/rwa/asset/market/status/ai?chainId=56&contractAddress=<addr>`
  - `v2/…/rwa/dynamic/ai?chainId=&contractAddress=` (price, holders, fundamentals, `limitInfo`)
  - `…/rwa/meta/ai`
  - `…/dex/market/token/kline/ai`

## 8. Agentic Wallet: the AI execution layer (special prize)

| Item | Fact | Source |
|---|---|---|
| What | "MPC Keyless". "Your private key is never fully reconstructed on any single device or server." | [DBC] *(sub-agent)* |
| Prerequisites | "You need a Binance account to get started". An MPC Wallet must be created in the Binance App first | [DBC] *(sub-agent)* |
| Install | `npx skills add binance/binance-skills-hub/skills/binance-web3/binance-agentic-wallet` (the hackathon's own one-liner). The skill auto-installs the CLI on first use | [EP Resources], [DBC] |
| CLI | **`baw`** from npm **`@binance/agentic-wallet`**. Latest on npm is **1.10.0** (modified 2026-09-09), `bin: baw` [NPM]. The skill frontmatter says `version: '1.12.0'`, `requiredCliVersion: '1.10.0'` | [NPM], [SKH] |
| Sign-in | `baw auth signin --json` returns a QR/pairing code; `baw auth verify --qrCodeId <id> --json` blocks up to about 5 min; `baw wallet status --json` is the source of truth. **The user signs in. The pipeline never does.** | [SKH] *(sub-agent)* |
| Commands | `wallet {status, chains, gas-price, address, balance, tx-history, settings, tx-lock, speed-up, cancel, send}`, `approvals {list, detail, revoke}`, `market-order {swap, quote, list}`, `limit-order {buy, sell, list, cancel}`, `contract-call {preview, execute}`, `sign-message …`, `prediction …`, `x402-payment {preview, sign}`, `defi …` | [SKH] *(sub-agent)* |
| Swap | `baw market-order swap --fromTokenQty … --fromToken … --toToken … --binanceChainId 56 [--slippage auto] [--mev true] [--gasLevel MEDIUM] --json` returns `orderId`. Poll `market-order list --orderId` until `FINISHED`/`FAILED`. "an orderId only means submitted" | [SKH] *(sub-agent)* |
| Limit orders | "Limit orders are only supported on BSC and Solana." `--fromToken` "only USDT, USDC, and Native Token". The skill says to determine support "at runtime from the CLI's actual response … do not hard-code which assets do or don't support limit orders". Third-party reports say stock tokens are refused | [DBC], [SKH] (lead-verified rule 7 text), prior-art |
| Limits / settings | Changed **only in the Binance App**; the CLI is read-only. Sample: `dailyLimit: 50000`, `defiDailyLimit: 5000`, `x402DailyLimit: 20`, `devMode.dailyLimit: 10000`, `maxSigninDuration: "48h"`. These are sample values, not confirmed defaults. Docs suggest starting with a small daily limit (e.g. $50) | [SKH], [DBC] *(sub-agent)* |
| Developer mode | Unlocks external signing (`contract-call`, `sign-message`). "can only be enabled or configured in the Binance App" | [SKH] *(sub-agent)* |
| Chains | BSC `56`, Ethereum `1`, Base `8453`, Solana `CT_501` (docs). The repo also shows Arbitrum, Polygon and Robinhood. **No testnet** anywhere | [DBC], [SKH] *(sub-agent)* |
| Tokenized stocks | Use case "Tokenized Securities": "Research and trade tokenized stocks (bStock and Ondo)…". Flow: **Resolve → Check status → Trade**. Needs "USDT to buy, plus native token (BNB) for gas" | [W3D:tokenized-securities] |
| Risk notice | "Tokenized securities are not covered by securities insurance, may be restricted in your jurisdiction, and can be halted for corporate actions." | [W3D:tokenized-securities] |

## 9. Wallet Skills (`binance/binance-skills-hub`)

- **Repo** [SKH, lead-verified]: description "Binance Skills Hub is an open skills marketplace that gives AI agents native access to crypto". 1047 stars, last push `2026-09-11T09:32:52Z`, branch `main`, **license: none declared**.
- **Docs table** [W3D:supported-skills]:
  - Published Wallet Skills, all "Read", "✅ Live", no wallet required: `query-token-info`, `query-token-audit`, `query-address-info`, `crypto-market-rank`, `meme-rush`, `trading-signal`, `binance-trading-signal`, `binance-wallet-tracker`, `binance-leaderboard`, `binance-tokenized-securities-info`.
  - Agentic Wallet Skills, Read + Write, wallet required: `binance-agentic-wallet`, `binance-onchain-copy-trader`.
- **`binance-tokenized-securities-info`** = "Query real-time on-chain data and status for **Ondo Finance** tokenized US stocks". It covers asset list, company info, market status, corporate actions, live on-chain data and candles. Supported chains: Ethereum, BSC [W3D:supported-skills]. Its repo frontmatter also says "Query Ondo tokenized US stock data" [SKH, lead-verified].
  - ⚠️ It does **not** cover bStock or xStocks. The agentic-wallet skill says "Older versions of it only know `type=1` (Ondo), so resolve bStock against the endpoint above" [SKH, lead-verified].
- Other skills in the repo, *(sub-agent)*:
  - `binance/*`: `binance` (binance-cli, Spot/Futures), `fiat`, `onchain-pay`, `p2p`, `payment`, `square-post`, `academy-skill`.
  - `binance-web3/binance-sports-ai-analyzer`.
  - `crypto-market-rank` "includes a tokenized-stocks rank".
- Doc drift: the developers.binance.com overview says "8 Skills are currently published" *(sub-agent)*. The web3 docs list 12, and the repo has 13 under `binance-web3`.

## 10. bStock AI PnL Trading Competition (ended; context only)

- The campaign file in the skill shows `2026-08-17 09:00:00 ~ 2026-09-01 00:00:00 (UTC)` *(sub-agent; SKH `references/campaign.md`)*. The eligible-token page covers "2026-08-11 → 2026-09-01 (UTC)", last updated 2026-08-27 [W3D:eligible-bstock-tokens].
- Ranked on realized PnL, with payment tokens "BNB, USDT, USDC, U, USD1" [W3D:eligible-bstock-tokens]. Required x402 calls to CoinMarketCap and Agent Studio `https://stock-agent.bnbchain.org` *(sub-agent)*.
- The eligible list's 68 bStock addresses all verify on-chain [RPC] and match Binance's live list. They are in [../data/bstock-eligible-week-2026-08-11.csv](../data/bstock-eligible-week-2026-08-11.csv).

## 11. Gotchas (each sourced)

1. **xStocks are absent from RWA Data** (`platformId` = `ondo|bstock`) and from the Agentic Wallet tokenized-securities flow. They are reachable by address via the Trading API (AMM-only) [OAS, W3D].
2. **`referencePrice` is derived from the on-chain price**, not an exchange quote [OAS].
3. **Ondo = RFQ only.** It needs `userWalletAddress`, EIP-712 signing, `/order/submit`, and a 30 s `quoteId` TTL. It must pair with **USDT on BSC** (40368), and has a minimum USD size (40375) and a max single order (40366) [W3D].
4. **Market-hours errors** 40367 (Ondo) and 40369 (bStock) outside US market hours. Ondo runs a weekend **Off-Hours** session for select assets on BNB Chain (see the issuers file), so handle both [W3D, Ondo docs].
5. **5 RPS per endpoint** by default. Batch `/rwa/price` (≤ 100 addresses) instead of per-token polling [W3D, OAS].
6. **Signing must include the `/build` prefix**, and the exact raw-encoded query string. The doc's warning: "omitting it is the most common cause of `40102 Invalid signature`." [W3D:authentication].
7. **Region IP checks** apply on both the portal and the API server [W3D].
8. **No official MCP server yet** ("Coming soon") [W3D].
9. **No testnet** in Agentic Wallet. The track itself is mainnet-only [SKH, EP].
10. **Agentic Wallet limits are App-only.** The CLI cannot raise them. `wallet send` needs an address-book entry *(sub-agent)*.
11. **Docs ↔ repo drift**: Node 18+ (DBC quickstart) vs Node 22+ (SKH README) *(sub-agent)*. The JS connector needs Node `v22.12.0`+ [W3D:javascript].
12. **Undocumented `bapi` endpoints** may change without notice. Prefer the RWA Data API where it covers the need.

## 12. Feasibility notes for the architect (INFERENCE, all of it)

- **Minimum credible integration:** RWA Data (discovery, status, reference) + Trading (quote/swap, or RFQ for Ondo) + Transaction (simulate, broadcast) on BSC. This covers the "depth of W3W API usage" tie-break.
- **Execution path choice:**
  - Raw API with your own key: an EOA signs and broadcasts. RFQ needs EIP-712 signing.
  - **Agentic Wallet (`baw`)**: MPC, user-signed-in, App-limited, wins the special prize.
  - Both are possible: data via API, execution via `baw`.
- **Weekends:** bStock AMM pools trade 24/7 at market-set prices, while RFQ routes close. Ondo Off-Hours covers a select set. xStocks AMM depth on BSC is negligible. A "weekend" product must be built around which route is live when.
- **Budget for the DX report:** log time-to-first-call, every signature failure, 429s, 40367/40369 incidents, quote-to-fill slippage and latency per endpoint. These map 1:1 onto [DX] questions.
