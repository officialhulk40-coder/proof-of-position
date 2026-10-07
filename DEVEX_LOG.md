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

## Tokenized-stock specifics

- (pending) bStocks / Ondo / xStocks: liquidity depth, slippage at our sizes, behaviour outside market hours, reference-price gaps, representation differences.

## Redesign ideas

- (pending) what would let a developer call immediately after landing.

## Requested capabilities

- (pending) one per line, with what we would build with it.

## Smoke evidence

### S1

- (pending) signed GET /api/v1/dex/market/rwa/tokens?binanceChainId=56 from the VPS: code, latency.

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
