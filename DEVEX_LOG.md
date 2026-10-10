# DevEx log (raw notes)

Running raw notes for the **human-written** Developer Experience Report (mandatory, 25% of the score).
The report is submitted through the DX form and must be written by a human: AI-generated reports are
rejected. This file only collects evidence while we build: exact URLs, endpoint names, request
parameters, error strings (verbatim), latencies, rate limits and slippage. One bullet per observation,
newest last, each starting with the UTC date. Machine telemetry (`DEVEX_TELEMETRY_FILE`, JSONL) holds
per-call timings; copy the figures that matter here.

## Onboarding

- (pending) docs → first successful call time; time to a working API key; where it got stuck.

## Documentation issues

- (pending) page URL · section · what is wrong · what it should say.

## API pitfalls

- (pending) endpoint · request · response · what was unexpected.

## Latency

- (pending) endpoint · p50/p95 or single samples, from the VPS (Singapore).

## Rate limits

- (pending) endpoint · limit hit · exact error · Retry-After.

## Signing

- (pending) request-signing problems (40102 / 40103), clock skew, requestPath with /build.

## Data trust

- (pending) stale prices, decimals, token addresses, balances that did not reconcile.

## AI stack

- (pending) Agentic Wallet, Wallet Skills, BNB Agent Studio (bag init, wallet, Pieverse, x402, ERC-8004): what worked, what did not, what is missing.
- 2026-10-10 ERC-8004 registration (launch:6): `bag erc8004 register --endpoint <analyst URL> --name popanalyst` → agent id **370830**, tx [0xea887946…c1478d629](https://bscscan.com/tx/0xea887946e4a3cc6479e7c133ac6ae6ec96c587db4927f06de25a0cfc1478d629) (block 126870519, status 1, 575,575 gas, effectiveGasPrice 0, sponsored by the MegaFuel paymaster). The CLI waited about 5 min (17:48:53Z → 17:54:02Z), then exited 1 with `ERC-8004 register transaction broadcast but not confirmed yet: tx_hash=0xea88…d629`, although the tx had been mined. It left `[identity] pending_*` in studio.toml; `bag erc8004 clear-pending` refuses while the tx is known to the RPC, so `--force` was needed after checking the receipt.
- 2026-10-10 18:21Z `bag llm topup --amount 1` (studio-cli 0.0.14, the latest on npm) → `error: topup failed: x402 challenge resource does not exactly match the caller-requested URL`. No U spent. The Pieverse 402 for `POST https://llm.pieverse.io/v1/topup/x402` (body `{chainId:56, tokenAddress:U, amountUsd:1}`) carries `resource.url = "/v1/topup/x402"` (relative), while studio-runtime's `exactResource` requires the full requested URL byte for byte. Same check vs CoinMarketCap: the analyst requests `…/x402/v4/dex/pairs/quotes/latest?pair_address=0x…` but the challenge resource is `…/quotes/latest` (no query), so the paid CMC research call is rejected client-side as well. Net effect: x402 self-funding (Pieverse) and x402 research (CMC) cannot complete with the published 0.0.14 tooling against the live merchants.
- 2026-10-10 Studio agent card: its `url` comes from `AGENTCORE_RUNTIME_URL` (src/agentCard.ts), not `BNBAGENT_PUBLIC_URL`; without it the card advertises `http://localhost:9000/`.
- 2026-10-10 first analyst cycle: `posted call #0: LONG NVDAB 0.008668 (thesis by template)` in [0x317d224a…51ba94b9](https://bscscan.com/tx/0x317d224a0aac1b783dc4425998808552a2c5a133300e19fd65fc727251ba94b9). The Pieverse key had $0.00 credit ("allocating 1.00 USD from Account Balance") with no prior `bag llm topup`, so the thesis fell back to the template.

## Tokenized-stock specifics

- (pending) bStocks / Ondo / xStocks: liquidity depth, slippage at our sizes, behaviour outside market hours, reference-price gaps, representation differences.

## Redesign ideas

- (pending) what would let a developer call immediately after landing.

## Requested capabilities

- (pending) one per line, with what we would build with it.

## Smoke evidence

### S1

- (pending) signed GET /api/v1/dex/market/rwa/tokens?binanceChainId=56 from the VPS: code, latency.
- 2026-10-10 local host in India (no VPS; Cloudflare quick tunnel for the public URL): signed `GET /api/v1/dex/market/rwa/tokens?binanceChainId=56` → `code 0` in 1563 ms (no 40304). On a Saturday, `/api/tokens` first came back 400: RWA Data returned `statusInfo.marketStatus: null` (closed market) for many tokens and `underlyingName: null` for 3, which the documented schema (marketStatus enum string, underlyingName string) does not allow. After the nullable fix (801870c), `/api/tokens` is undegraded with 675 tokens enriched, locally and through the tunnel.

### S2

- (pending) Market trades with walletAddressFilter: fresh NVDAB swap visible after N s.

### S3

- (pending) Address Portfolio dex-history and token/latest-pnl coverage for that swap.

### S4

- (pending) baw buy-and-sell round trip (pop-follower smoke): order ids, submit→FINISHED latencies.

### S5

- (pending) analyst posted and closed a call; ReputationRegistry readFeedback = 100.

### Rehearsal

- (pending) money-shot timings: sell mined → badge flip → exit recorded → evidence → follower FINISHED.
