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
- 2026-10-11 Pieverse self-funding exercised (after the studio-runtime patches c4f9ff7 + 3d62869, `PIEVERSE_BUDGET_COLD_START_SECONDS=0`, and AAPLB temporarily added to the watchlist so the cycle needed a thesis): `AUDIT … "op":"auto_topup" … "status":"confirmed"`, `auto-topup: spent $1.00 wallet U via x402 (key=406225f6c6eb…, network=bsc-mainnet)`. On chain: 1 U from the analyst in tx [0x3537a74e…b280cd](https://bscscan.com/tx/0x3537a74ed8e88989b18cdcad85fc9fae7992d9b05b2297b5c7049545e8b280cd) (block 126994384); analyst U 3.0061 → 2.0061. The immediate allocate then failed 5 times with `allocate not ready (deposit scanner lag)` (retries 1.0 s → 5.1 s, ~13 s total), so that cycle still used the template thesis (call #4 LONG AAPLB). A later `bag llm allocate --amount 1` succeeded (`key_credit: $1.0000`).
- 2026-10-11 the second Pieverse blocker after the resource-URL patch: `x402 EIP-3009 domain metadata does not match catalog asset U`. Pieverse's 402 offers U with `extra = {"name":"United Stables","version":"1"}` and no `assetTransferMethod`; studio-runtime 0.0.14 requires `assetTransferMethod === "eip3009"` (CoinMarketCap's U offer includes it). Patched to accept a missing method when name/version match the catalog.
- 2026-10-11 CoinMarketCap x402: analyst telemetry reports `cmcPaidUsd: 0.01` on calls #3 (06:39Z) and #4 (09:18Z), and research data came back, but no U left the analyst wallet for CMC (U fell by exactly the 1.0000 Pieverse topup). The CMC EIP-3009 authorization had not been settled on chain hours later.
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
- 2026-10-10 caller `demo caller buy --token NVDAB --usdt 3` → 0.012999342999563718 NVDAB, tx [0x7db03012…1d00a679](https://bscscan.com/tx/0x7db03012527e58956713849ae460eb3d32be6f4242e9ac5e379ce4991d00a679), block 126886705 at 19:50:30Z. `GET /api/v1/dex/market/trades` (NVDAB, limit 100) had it indexed by the first verified query at 19:53:37Z (lag ≤ 3 min 07 s; a precise figure comes from the rehearsal sell) as `type buy`, `userAddress` = caller, `dexName "Uniswap v4 (BSC)"`, `time` = block time. **`walletAddressFilter=<caller>` was not applied:** the filtered and unfiltered responses were the same 100 trades from 38 distinct `userAddress` values, so the client has to filter by `userAddress` itself. Response 511 ms, code 0.

### S3

- (pending) Address Portfolio dex-history and token/latest-pnl coverage for that swap.
- 2026-10-10 19:5xZ (≈ 3–4 min after the swap): `GET /api/v1/dex/market/portfolio/dex-history binanceChainId=56 walletAddress=<caller>` → code 0 in 528 ms; the first `transactionList` entry is the NVDAB buy (`amount 0.012999342999563719`, `valueUsd 2.997`, `price 230.55`, cursor `1791661830000` = block time); `pnlUsd null`. `GET …/portfolio/token/latest-pnl … tokenContractAddress=0x02fca66c…7436` → code 0 in 367 ms: `buyAmount 0.012999342999563718`, `buyTxCount 1`, `buyAvgPrice 230.552305`, `tokenBalanceUsd 3.0004`, `holdingDuration 229`, `isPnlSupported true`. Both cover the swap.

### S4

- (pending) baw buy-and-sell round trip (pop-follower smoke): order ids, submit→FINISHED latencies.
- 2026-10-11 05:43Z `pop-follower smoke --token NVDAB --usdt 0.5 --yes` (Agentic Wallet 0x859fc4055d1a9879878c63f1012ec5fcafc00cf2, baw 1.10.0, tradeAllTokens on): the BUY executed, but the follower exited with `order 26101100001956594351 is still unknown after 90 s`. `baw market-order swap --json` returned orderId `26101100001956594351`; `baw market-order list --orderId 26101100001956594351` → `No orders found`; `baw market-order list --binanceChainId 56` shows the only order as `26101100001956594394` (USDT → NVDAB, 0.5 USDT → 0.002169936093013576 NVDAB, FINISHED, tx 0x7e56b884…61e3f5, bookTime 2026-10-11T11:13:51+05:30). The two ids differ by 43, so this is not JS number rounding (that moves in steps of 4096 at this size): the place-order response id is not the id the order-query API knows. On-chain NVDAB received 0.002168248710365175 vs the list's 0.002169936. The follower now falls back to matching recent orders by pair + amount (838022c). Sell leg pending.
- 2026-10-11 S4 round trip, Agentic Wallet 0x859fc4055d1a9879878c63f1012ec5fcafc00cf2:
  - **BUY:** order `26101100001956594394`, 0.5 USDT → 0.002169936093013576 NVDAB (on-chain received 0.002168248710365175). Tx [0x7e56b884…61e3f5](https://bscscan.com/tx/0x7e56b88468c771840ef60aa4db12cc2a2ed0bf70637660e5265b9a423261e3f5): booked 05:43:51Z, mined 05:43:52Z (block 126965792), `updatedTime` 05:43:53Z → **submit→FINISHED ≈ 2 s**.
  - **SELL:** order `26101100001956630463` (`baw market-order swap` printed `26101100001956630483`, not findable by id), 0.002168248710365175 NVDAB → 0.499590345115718397 USDT. Tx [0x5c94c5b5…baf602e0](https://bscscan.com/tx/0x5c94c5b5b0709248989a580a077c6692930a1bf23354c0e32525f316baf602e0): booked 06:03:23Z, mined 06:03:24Z (block 126968396), updated 06:03:25Z → **≈ 2 s**.
  - Round-trip cost: 0.5 → 0.49959 USDT (≈ 0.08%), plus 0.0000017 NVDAB left as dust.
- 2026-10-11 two earlier sell attempts were rejected before submission with `[30003001] Insufficient balance. Please check your available funds and try again.` The printed ids were `26101100001956608014` and `26101100001956616144`; the list shows them as FAILED `…608121` and `…615979`. The wallet held the NVDAB; what it lacked was BNB for gas (0.000085 BNB; `baw wallet gas-price` MEDIUM 0.094 gwei). The message doesn't say that the shortfall is BNB for gas, and the preceding `baw market-order quote` showed `Gas (USD): $0`. Adding 0.0005 BNB fixed it. The printed-id ≠ listed-id mismatch happened on all four orders.

### S5

- (pending) analyst posted and closed a call; ReputationRegistry readFeedback = 100.
- 2026-10-11 06:22Z S5: `ANALYST_HOLD_HOURS=0.1`, restart. One cycle: `closed call #0 (held through ✓)` tx [0x05c4e046…6db5bcc4](https://bscscan.com/tx/0x05c4e0467c96580f44fa1cefde51e1ba88e29ac4e9a08d14e722fb006db5bcc4), `sold 0.008668 NVDAB for 1.999 USDT` tx [0x71553921…5c21501f](https://bscscan.com/tx/0x71553921a6b8f0f010ad5e93e5697f24f66e4dca064fcc45ca9cc5111c21501f); `closed call #1 (held through ✓)` tx [0x3bdf237e…7e48c2a9](https://bscscan.com/tx/0x3bdf237ed313fdf3d5585a48649be0fd3f4b63da80b2ed6ad56927447e48c2a9), `sold 0.002613 TSLAB for 0.9988 USDT` tx [0xbbd1ebbc…8c57312e](https://bscscan.com/tx/0xbbd1ebbc7c6d6bc0a84b54af32e8cbf3782e6ae064bac7772ce97fe38c57312e); then `posted call #2: LONG NVDAB 0.004334` tx [0x690ea7ec…76126050](https://bscscan.com/tx/0x690ea7ec13d863a9446f8cb4c9cfa99c5924f8009a5770a7cc6fed3776126050). `pop-demo agent` → `agent #370830 wallet 0x8B031D852ba4358F291774aBC345ED781bc93950 ✓`, **`integrity 100 over 2 call(s)`**, `PASS`. The registry wrote ERC-8004 feedback itself on each held-through close.
- 2026-10-11 same cycle: still "thesis by template", `cmcPaidUsd: null`, analyst U unchanged (3.0061). Two causes: (1) Market `GET /api/v1/dex/market/token/top-liquidity` returned `liquidityUsd: null` for all 5 NVDAB pools (Sunday), which our schema rejected, so no pool → no CMC call (fix in progress); (2) Studio's Pieverse budget auto-topup has a 60 s cold-start gate (`DEFAULT_COLD_START_SECONDS = 60`, env `PIEVERSE_BUDGET_COLD_START_SECONDS`), and the analyst's first cycle runs at boot, inside that window. The `auto_renew` hook logged "allocating 1.00 USD from Account Balance" with a $0 Account Balance.

### Rehearsal

- (pending) money-shot timings: sell mined → badge flip → exit recorded → evidence → follower FINISHED.
