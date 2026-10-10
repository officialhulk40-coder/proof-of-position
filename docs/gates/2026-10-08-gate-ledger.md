# Gate ledger — Proof of Position (BNB Hack: Tokenized Stocks Edition)

Closing pass, gate-concierge (Step 3). One ledger per campaign: extend this file, never fork it.
**Deadline:** Sun 11 Oct 2026, 12:00 UTC (17:30 IST). Submissions lock and repos freeze.
**Network rule:** BSC mainnet only, spot, small live amounts (`event.md` §6). Every gate that signs,
broadcasts or spends is Tier C (the user runs it) unless the user moves a named gate to the concierge
in chat. Overrides are recorded per gate below.
**Secrets:** this file carries env-var names and public addresses only. It never holds values,
the contact email or the prize wallet.

## Session tollgate (closing pass)

| Row | Requirement | Result | Checked |
|---|---|---|---|
| 1 | git + identity | PASS (2.55.0) | 2026-10-09 |
| 2 | `gh` logged in | PASS (officialhulk40-coder, scopes repo) | 2026-10-09 |
| 3 | kit checkout synced | N-A: `build-system-main` is not a git checkout, so sync can't be checked | 2026-10-09 |
| 5 | claude-in-chrome | PASS ("Browser 1", Windows, local) after the user reconnected it; FAIL at first probe | 2026-10-09 |
| 6 | computer-use | N-A (no extension installs) | 2026-10-09 |
| 7 | email inbox | N-A (signup automation not authorized) | 2026-10-09 |
| 8 | wallet extension | N-A (on-chain gates run from the CLI with burner keys) | 2026-10-09 |
| 9 | Node / pnpm / Forge | PASS (Node 24.19, pnpm 10.34, Forge 1.8.5) | 2026-10-09 |
| 15 | env store | PASS: User-scope env var written and read back (`DEPLOYER_PK`) | 2026-10-10 |

Not installed locally: `bag`, `baw`, `docker`. agents:12 needs `bag`, launch:7 needs `baw`, and launch:5 runs `docker` on the VPS.

## Regression (read-only)

| Check | Result |
|---|---|
| `node contracts/run-forge.mjs test` | PASS: 73 passed, 0 failed (on 4be3622 and again on 58f7225) |
| `pnpm -r --if-present run verify` | 4be3622: FAIL, 1 follower test (`src/cli.test.ts:114`, tsx bin cold start 3.3–21 s against a 5 s timeout). Not a load flake: it also failed in isolation. Routed to the orchestrator and fixed in 58f7225. **58f7225: PASS** (follower 34/34). core 63/63, demo 23/23, server 34/34, web 45/45 + vite build PASS |
| `npm run verify:analyst` | PASS: 23/23 |
| README conformance (launch Task 9) | PASS |
| `node scripts/public-ready.mjs` | PASS (2 expected WARN lines: the removed pack files are still in git history) |
| `pnpm typecheck` | PASS |
| `git status` | clean |

Notes for the orchestrator: the README env table names `BSCSCAN_API_KEY`, but contracts Task 11 Step 6 uses
`ETHERSCAN_API_KEY`. `manifest.json` shows all 63 tasks `pending` (it doesn't track status), so gate status lives here.

## Gates

| # | Gate | Tier | Pass | Tools | Human moment | Risk | Status |
|---|---|---|---|---|---|---|---|
| a | **contracts:11**: deploy CallRegistry on BSC mainnet, record, check | A by user override (10 Oct); C by default | closing | Bash (`cast wallet new`, `run-forge.mjs`, `deployment.mjs`), User-scope env | Fund the deployer burner | Burner only, about 0.00013 BNB of gas; immutable contract, owner = burner | **done** 10 Oct: `0x7eCB…a901`, see evidence (user's go, 10 Oct: "you do a and b steps yourself… autonomously") |
| b | **contracts:12**: list the 675 pack tokens (7 txs) | A by user override (10 Oct); C by default | closing | Bash (`deployment.mjs probe-tokens`, `run-forge.mjs`) | none (same burner) | About 0.0025 BNB of gas; owner-only `setTokens` | **done** 10 Oct: 7 txs, 675 tokens, `tokens=6/6` (same go; viem fallback, see evidence) |
| c | **agents:12**: analyst wallet, Pieverse paid model, CMC trust, budget | C | closing | user terminal (`bag` 0.0.14); concierge runs `check-studio-setup.mjs` | Install `bag`, `wallet new`, fund (≈0.005 BNB, 10 USDT, 2 U), `llm activate`, `topup 1`, `x402 trust cmc`: **confirm only if the payee is `0x3C5f3a6cE224BB89D72f5EB4232ecC27F67B3eeA`**; `budget enable --max-per-day-usd 1 --max-per-topup-usd 1 --max-per-month-usd 5`; `bag doctor` | Real funds on a burner; budget caps the spend at $1/day | **done** 10 Oct: gate PASS 6/6 (CMC trust ran locally once DNS cleared); `llm topup --amount 1` still optional, the user's |
| d | **launch:5**: Singapore VPS, deploy, smoke S1 | C | closing | user (VPS, DNS, secrets, `docker compose`); concierge runs `demo health` | Provision the VPS (Ubuntu 24.04, 2 vCPU, 4 GB); `sslip.io` name; `deploy/.env`, `server.env` (`W3W_API_KEY`, `W3W_API_SECRET`, `KEEPER_PK`), `analyst.env` (`ANALYST_ENABLED=false`); `scp -r` `.studio/`; `docker compose -f deploy/docker-compose.yml up -d --build` | **`40304` (region refusal)**: if the server log shows it, record the exact message and move region before continuing | **in progress**: local + tunnels up, S1 code 0 from India; blocked on the RWA null-field bug |
| e | **launch:6**: ERC-8004 register the analyst, enable the loop | C | closing | user (`bag erc8004 register`); concierge runs `demo agent` | Run the register tx; set `ANALYST_AGENT_ID` and `ANALYST_ENABLED=true` on the VPS; restart analyst | Mainnet tx from the analyst burner | **done** 10 Oct: agent 370830; loop on; first call posted |
| f | **launch:7**: smoke S2–S4 | C | closing | user (`demo caller buy`, `demo trades`, `demo api get`, `pop-follower`); concierge runs `devex-check S2,S3,S4` | `CALLER_PK` burner (≈5 USDT + BNB) buys 3 USDT NVDAB; **Agentic Wallet sign-in** (`baw auth signin`); `smoke --usdt 0.5 --yes` | Real trades, a few USDT; AW stays out of the judge path | pending (needs d) |
| g | **launch:8**: S5 and the money-shot rehearsal | C | closing | user (VPS env, `demo caller …`, follower `run`); concierge runs `devex-check S5,Rehearsal` | S5: `ANALYST_HOLD_HOURS=0.1`, wait for "held through ✓", `demo agent` → integrity 100, reset to 24. Rehearsal timed against spec §10: badge ≤ 1.5 s, exit recorded ≤ 2 s, evidence ≤ 3 s, follower SELL ≤ 2 s / FINISHED ≤ 15 s; `try-gate --broadcast` on TSLAB | Real trades; one deliberate reverted tx | pending (needs e, f) |
| h | Demo video (demo-studio's deliverable) | C | closing | claude-in-chrome (check only) | Record and upload; set sharing to public | A video that won't play logged-out doesn't count | pending. Check: plays logged-out, ≤ 4:00 |
| i | Resolve TBDs: README (6) + draft (8) + feed screenshot | A | closing | Bash, claude-in-chrome (screenshot) | none | Wrong address/id: verified from `deployments/bsc-mainnet.json` and BscScan | pending (needs a–h) |
| j | Pre-public | A (sweep) / C (decision) | closing | Bash, git | **Decide: squashed snapshot vs history rewrite** (both presented at the gate) | Telegram invite link at pack `INDEX.md:101`; SharePay mention in `prior-art.md` lines 28–29 and 57; secret sweep of the tree **and** history | pending |
| k | Repo public flip | C (explicit go) | closing | `gh repo edit --visibility public` after `gh auth status` | Your go | Irreversible exposure: j must be done first | pending (needs j) |
| l | DevEx report (**goes FIRST**) | C (human-written) | closing | none: the concierge points to `DEVEX_LOG.md` only | You write and submit https://forms.gle/EUQ39xf54GHjC2ys5 | AI-written reports are rejected; same contact email as registration | pending |
| m | Main form https://forms.gle/yToDUzaDMwWnq6R6A | A (fill) / C (Submit) | closing | claude-in-chrome | Paste contact email + prize wallet; **Fill and Submit are two separate goes**; logged-in identity re-read first | Wrong identity or missing video = not scored | pending (needs h, i, k, l) |
| n | Freeze | — | closing | none | No pushes after **12:00 UTC Sun 11 Oct** | A late push breaks "repos frozen" | pending |

## Cost control (user directive, 10 Oct 18:00Z)

Goal: pass every gate and keep every judged feature visible, spending as little as possible, then sweep everything back
at the end of judging. **Authority:** trades, swaps, topups and transfers are the user's (the concierge prepares and
verifies); config edits, checks and read-only calls are the concierge's. Burner balances are reported after each gate
(`local-run/balances.sh`). No broadcast unless gas is ≈ 0.05 gwei. Hosting: local + quick tunnels for demo day, then the
Mac mini for judging; no paid VPS unless the user says so.

Deviations from the plans (applied):
- Analyst for demo day and judging: `ANALYST_WATCHLIST=NVDAB,TSLAB`, `ANALYST_BUY_USDT=1`, `ANALYST_HOLD_HOURS=48`,
  `ANALYST_INTERVAL_MIN=60` (plan: 4 tokens, 2 USDT, 24 h, 30 min). S5 keeps `HOLD_HOURS=0.1` for one round trip in gate g.
  Applied 18:00Z; log `loop started: every 60 min, 1 USDT per call, hold 48 h, watchlist NVDAB,TSLAB`.
- Pieverse budget: `bag budget enable --max-per-day-usd 1 --max-per-topup-usd 1 --max-per-month-usd 2` (was 5/month);
  `check-studio-setup.mjs` still PASS. `bag llm topup --amount 1` stays the user's (one only).
- Caller (gate g, planned): no second 3-USDT buy. The S2 NVDAB from gate f is reused for the rehearsal; the declared post
  amount is ≤ the `demo balances` holding. The demo video is recorded in the same run; retakes are the user's call.
- Follower: plan minimums only (`smoke --usdt 0.5`, `run --budget-usdt 1`).

**Blocker found 18:2xZ (vendor incompatibility, routed to the orchestrator; brief `local-run/fix-brief-x402-resource.md`):**
the user's `bag llm topup --amount 1` failed with `x402 challenge resource does not exactly match the caller-requested URL`
(no U spent). `@bnbagent/studio-runtime@0.0.14` (latest on npm) `exactResource` requires `resource.url === requestedUrl`.
Pieverse returns the relative `/v1/topup/x402`; CMC returns its URL without the query the analyst sends
(`?pair_address=…`). Both judged x402 features (Pieverse self-funding, CMC research) are blocked until a patch or a user
decision. Raw facts logged in DEVEX_LOG (AI stack).
**User decision 18:30Z: option 1, a tracked `pnpm patch` of studio-runtime 0.0.14 in the analyst** (accept a relative resource
resolved against the requested origin, or the requested URL without its query; payTo pin, asset, caps and budget unchanged).
Routed to the orchestrator together with the RWA null-field fix.

Open check: CMC x402 research must be exercised at least once (judged). The first two cycles show no CMC spend (U
unchanged at 3.0061) and "thesis by template" (Pieverse credit $0). Watch the logs after the user's topup.

### Balances and cost per gate

| After | deployer BNB | keeper BNB | caller BNB / USDT | analyst BNB / USDT / U | analyst positions | Gate cost |
|---|---|---|---|---|---|---|
| a | 0.0048980 | — | — | — | — | 2,045,457 gas = 0.000102 BNB |
| b | 0.0040605 | — | — | — | — | 16,744,265 gas = 0.000837 BNB |
| c | 0.000259 (user moved 0.0038 to the analyst) | — | — | 0.009 / 12 / 3.0061 | — | 0 (config only) |
| e (18:03Z) | 0.000259 | 0.0005 | 0.002 / 5.0015 | 0.008911 / 9.0 / 3.0061 | NVDAB 0.008669 (call #0), TSLAB 0.002613 (call #1) | register 0 (sponsored); 2 cycles ≈ 0.000089 BNB gas; 3 USDT moved into positions (swap fees inside) |

## Recommended order

1. a + b (concierge, now) ∥ c (user). 2. d → e. 3. f → g; record g as the demo video (h).
4. Sunday morning: l first, then i, j, k, m. All done well before 12:00 UTC.

## Evidence log

### a — contracts:11
- 2026-10-10: burner deployer generated with `cast wallet new` and stored only in the User-scope env var
  `DEPLOYER_PK` (value never printed). Address `0x0150be747aC5955566Df0CD1AAf929F311463F71`.
- Step 1: `run-forge.mjs test` on 58f7225: 73 passed, 0 failed.
- Step 2 dry-run: `SIMULATION COMPLETE`, owner `0x0150…3F71`, chain 56, 2,659,094 gas at 0.05 gwei
  = 0.0001329547 BNB.
- Funded by the user: 0.005 BNB, seen 11:03:53Z.
- Step 3 broadcast (concierge, on the user's go): `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.`
  CallRegistry [`0x7eCB8700D7cc4d3CddD3fe74217228F24845a901`](https://bscscan.com/address/0x7eCB8700D7cc4d3CddD3fe74217228F24845a901),
  tx [`0xe18d650f…6aa8cf`](https://bscscan.com/tx/0xe18d650feb7b9c237dc9a79209ae515e6272ec41a45b72f8c84f995fab6aa8cf),
  block 126816613. `cast receipt`: status 1, from the burner, 2,045,457 gas at 0.05 gwei.
- Step 4: `recorded CallRegistry 0x7ecb…a901 (block 126816613) -> deployments/bsc-mainnet.json`.
- Step 5 gate: `PASS registry=0x7ecb8700d7cc4d3cddd3fe74217228f24845a901 owner=0x0150be747ac5955566df0cd1aaf929f311463f71 callCount=0`.
- Step 6 (optional BscScan source verification): not run. `ETHERSCAN_API_KEY` isn't set; nothing depends on it.
- **Status: done.**

### b — contracts:12
- Step 1: `deployment.mjs probe-tokens` → `PASS probed=675 failed=0` (19 s), re-run right before listing: PASS again.
- Step 2 as planned (`forge script ListTokens` dry-run) **failed twice** with `missing trie node` (`Failed to decode
  return value: 0x`), about 65 s per run. Cause: the registry now exists on chain, so forge fetches each of about 675
  storage slots from the RPC one by one (1.5–2.5 s per call from this machine). That outlives the ~1 minute of state
  public BSC nodes keep. The planning-time "~12 s" figure came from a simulation where the registry was deployed in the
  same fork. **Plan note for the orchestrator:** the ListTokens dry-run can't work against an already-deployed registry
  over public RPC.
- Fallback (concierge, documented deviation): a viem script (scratchpad, not committed) that makes the same
  `setTokens(address[],uint8[])` calls as `ListTokens.list` (BATCH 100, PLAIN first, then XSTOCK) from the same owner
  key. The dry-run is one `eth_call` + `estimateGas` per batch; it checks that the signer is `owner()`; after
  broadcast each receipt's `TokenListed` events are compared token-by-token and model-by-model with `tokens.json`.
- Dry-run: 7/7 batches simulated OK; 547 PLAIN + 128 XSTOCK; 16,885,327 gas ≈ 0.00084 BNB.
- Step 3 broadcast (concierge, on the user's go), all `status success`, events matched:

  | Batch | Tx | Block | Gas used | Events |
  |---|---|---|---|---|
  | 1 | [`0xf705bd60…b233a3`](https://bscscan.com/tx/0xf705bd6001918a4b2dfc9942b099acab91abefb7ff6a68dffaabff01feb233a3) | 126817464 | 2,479,732 | 100 |
  | 2 | [`0xfb61a295…908894f`](https://bscscan.com/tx/0xfb61a29535bdc88a376b3e792445b9f5cd499b578727c9eae024c8dcd908894f) | 126817474 | 2,479,696 | 100 |
  | 3 | [`0x16735ef3…1084ac`](https://bscscan.com/tx/0x16735ef3a5966dd1e7a4dac17facdc21294881da97c4ce39057a3207981084ac) | 126817481 | 2,479,708 | 100 |
  | 4 | [`0x1d627291…bdfdb7d`](https://bscscan.com/tx/0x1d627291bef5f12c7b5ce0c083e91c24109b1fa8dc69a1d98c45a1296bdfdb7d) | 126817490 | 2,479,696 | 100 |
  | 5 | [`0x3b80910f…4a86631`](https://bscscan.com/tx/0x3b80910fe8a054d6ec1b4a275472fb8f1bc334f0825a38c46731223bf4a86631) | 126817499 | 2,479,732 | 100 |
  | 6 | [`0x71c167f0…4188a4`](https://bscscan.com/tx/0x71c167f0b93272111a2bea5411be004c66caba35c535ce0ca24dd9926b4188a4) | 126817507 | 2,479,732 | 100 |
  | 7 | [`0x50421752…a2e8fe`](https://bscscan.com/tx/0x504217529ffc53aa6f4735c8ab713478ffd3e4c4f6ebd256303d56e1a9a2e8fe) | 126817514 | 1,865,969 | 75 |

  `listed PLAIN 547 XSTOCK 128`. Deployer balance after: 0.0040605139 BNB.
- Step 4 gate: `PASS registry=0x7ecb8700d7cc4d3cddd3fe74217228f24845a901 owner=0x0150be747ac5955566df0cd1aaf929f311463f71 callCount=0 tokens=6/6`.
- **Status: done.**
- Deployer leftover: the user asked for a refund to their address. Sending funds is the user's action; the exact
  command is in the session report. `DEPLOYER_PK` (registry owner) stays in the User env for any later delisting.

### c — agents:12
- `bag` 0.0.14 was already installed (`bag --version` → 0.0.14).
- `.studio/.env.local` held only empty scaffold placeholders (lengths checked, values never read), so nothing was overwritten.
- Step 2 (concierge, on the user's go "move toward c"): `bag wallet new --generate-password` from `app/agent`.
  Analyst wallet `0x8B031D852ba4358F291774aBC345ED781bc93950`; keystore
  `agents/popanalyst/.studio/wallets/0x8B03…3950.json`; `WALLET_PASSWORD` in `agents/popanalyst/.studio/.env.local`
  (both git-ignored by `agents/popanalyst/.gitignore` `.studio/`; `git status` shows only `studio.toml`).
- `bag config set llm.model auto/paid` (concierge).
- `check-studio-setup.mjs`: PASS wallet, PASS password, PASS paid model; FAIL Pieverse key, FAIL CMC trust,
  FAIL budget. Those, plus funding (≈0.005 BNB, 10 USDT, 2 U), are the user's steps (spend, signup or payment authorization).
- `studio.toml` change is held uncommitted until the gate passes (plan commit:
  `chore(analyst): agent wallet, Pieverse paid model, CMC x402 trust and a $1/day budget`).
- User funded the analyst: on chain 0.005 BNB, 12 USDT, 0 U.
- The user asked the concierge to swap 2 USDT→U, run `llm activate`, `llm topup` and the rest. The swap and the topup are
  trades/payments and `llm activate` creates a Pieverse account and key, so they stay the user's. Config-only steps were run on
  the user's explicit go:
  - `bag budget enable --max-per-day-usd 1 --max-per-topup-usd 1 --max-per-month-usd 5` → `[budget] enabled = true`, caps 1/1/5.
  - `bag x402 trust cmc --pay-to 0x3C5f3a6cE224BB89D72f5EB4232ecC27F67B3eeA --yes` → **failed twice**:
    `could not obtain a 402 challenge from https://pro-api.coinmarketcap.com/x402/v3/…: The operation was aborted due to timeout`.
    Root cause: **this machine's ISP DNS (Reliance Jio, AS55836) answers `pro-api.coinmarketcap.com` with `49.44.79.236`,
    a Jio-owned address.** Cloudflare DoH resolves it to CloudFront (`dq4fzes75m7bc.cloudfront.net`). coinmarketcap.com and
    api.coinmarketcap.com time out the same way, while google.com answers in 1.6 s. Not circumvented by the concierge
    (that would mean DNS/hosts changes). Options: the user runs it from another network/DNS, or it runs on the Singapore VPS.
- `bag doctor` funding warnings: **BNB 0.005 < 0.02 wanted** ("each on-chain action reserves ≈ 0.006 BNB worst-case", which
  affects `bag erc8004 register` in gate e); **U 0 < 2 wanted** for Pieverse auto-renew (topup chunk × 2), plus 1 U for the
  first topup and CMC x402 calls → about 3 U.
- Gate check now: PASS wallet, PASS password, PASS paid model, PASS budget; **FAIL Pieverse key**, **FAIL CMC trust**.
- User topped up the analyst: on chain 0.009 BNB, 12 USDT, 3.006 U (the user moved 0.0038 BNB of the deployer leftover
  there; deployer keeps 0.00026 BNB for owner actions). User ran `bag llm activate`. `bag llm status`: key_credit $0.0000,
  auto_renew on (chunk $1). `bag llm topup --amount 1` (spends 1 U) not yet run (user's).
- Trust retried: same timeout (ISP DNS block). **User decision (10 Oct): CMC trust runs after gate d, on the Singapore
  VPS**, with `bag x402 trust cmc --pay-to 0x3C5f3a6cE224BB89D72f5EB4232ecC27F67B3eeA --yes`. The resulting
  `[payments.x402.merchants.cmc]` block is then committed with the plan's message.
- Gate check: PASS wallet, password, **Pieverse key**, paid model, budget; FAIL CMC trust (deferred) → 5/6.
- `studio.toml` committed now (public address, model, Pieverse `key_hash`, budget caps; no secrets) so the VPS clone has it.
- 12:03Z: CMC reachable again from this machine (DNS → CloudFront `54.182.2.37`; the x402 URL answers `402` in 0.85 s).
  Live challenge read without paying: x402Version 2, 7 offers, **every `payTo` = `0x3C5f3a6cE224BB89D72f5EB4232ecC27F67B3eeA`**
  (the reviewed pin); 0.01 per call in U/USD1/USDT/USDC on BSC (and USDC on Base).
- On the user's "run trust": `bag x402 trust cmc --pay-to 0x3C5f…3eeA --yes` → `✓ Wrote [payments.x402.merchants.cmc]`:
  `pay_to` pinned, assets U + USD1, `per_call_cap_usd = 0.02`, `verified = true`; plus `[wallet.signing] extra_domains` for
  the U and USD1 EIP-712 domains (chain 56). The deferral to the VPS no longer applies.
- **Step 6 gate: `check-studio-setup.mjs` → six `PASS` lines, then `PASS`.** **Status: done.**

### Burners for d and f (prepared 10 Oct)
Generated with `cast wallet new`, stored only as User-scope env vars (values never printed):
- `KEEPER_PK` → `0xcaC988d8964fbedCfE0f325f877043e07F6F1a5D` (server `recordExit`; needs a few cents of BNB; goes into
  `deploy/server.env` on the VPS).
- `CALLER_PK` → `0x0773c6d1cB7b906CbB69BAe81D7ea836bdb109A9` (demo caller for f/g; needs ≈5 USDT + ≈0.002 BNB; demo
  scripts run locally and read it from the env).
- `W3W_API_KEY` / `W3W_API_SECRET`: not present on this machine (user's; needed in `server.env`, `analyst.env` and locally for f).

### d — launch:5 runbook (prepared, not started; needs c PASS)
Non-secret values (secrets go in by name only, on the VPS):
- `deploy/.env`: `PUBLIC_HOST=<vps-ip-with-dashes>.sslip.io`, `REGISTRY_ADDRESS=0x7ecb8700d7cc4d3cddd3fe74217228f24845a901`,
  `BSC_RPC_URLS` optional.
- `deploy/server.env`: `REGISTRY_ADDRESS` (same), `W3W_API_KEY`, `W3W_API_SECRET`, `KEEPER_PK` (new burner, a few cents of BNB),
  `CORS_ORIGINS=https://<PUBLIC_HOST>`; the rest optional.
- `deploy/analyst.env`: `REGISTRY_ADDRESS` (same), `W3W_API_KEY`, `W3W_API_SECRET`, `ANALYST_ENABLED=false`,
  `BNBAGENT_PUBLIC_URL=https://<PUBLIC_HOST>/agent`, `POP_FEED_URL=https://<PUBLIC_HOST>`.
- `agents/popanalyst/.studio/` copied with `scp -r` (holds the analyst keystore and `.env.local`); compose mounts it.
- **Blockers to plan for:** (1) the repo is private, so the VPS needs read access to clone it (a read-only deploy key or
  `gh auth login` on the VPS) or a `git bundle` copied over scp. (2) The analyst reads `studio.toml` from the clone, so c's
  `studio.toml` must be committed and pushed **before** the clone. (3) If the server log shows `40304`, record the exact
  message and move region.
- Concierge verification after deploy: `POP_FEED_URL=https://<PUBLIC_HOST> pnpm --filter @pop/demo run demo health` →
  five PASS lines, then `PASS`.

### d — launch:5, adapted: local hosting + Cloudflare quick tunnels (user decision, 10 Oct)
- User decision: run locally for demo day (10–11 Oct), then choose VPS vs a 24/7 Mac mini M4 at home. US-only VPS locations
  were rejected because the Binance Web3 API restricts US server IPs (`40304`).
- **S1 from this machine (India): `GET /api/v1/dex/market/rwa/tokens binanceChainId=56 → code 0 in 1563 ms`.** India is not
  restricted; the result carries over to the Mac mini on the same connection.
- Burners funded by the user (on chain): keeper 0.0005 BNB; caller 5.0015 USDT + 0.002 BNB.
- Local services. Run scripts live in `D:\bnb-tokenized-hackathon\local-run\`, outside the repo; secrets are read at run time
  from User env and `.studio/.env.local` and never stored.
  - server `:8787` → `[server] listening on :8787 — registry 0x7ecb…a901, W3W on, keeper on`
  - feed (Vite) `:5173`
  - analyst `:9000`/`:8088` with `ANALYST_ENABLED=false`
- `cloudflared` 2026.10.0 installed via winget on the user's go. Quick tunnels (URLs change on restart; not for judging):
  - feed `https://hiking-researcher-root-nothing.trycloudflare.com` → 200; `/api/health` → w3w true, keeper enabled
  - analyst `https://begin-tsunami-amy-wanted.trycloudflare.com` → agent card 200, card `url` = that URL
- Keyless judge path verified: "Try the gate" → `Reverted: "No position, no call." via BSC eth_call`.
- **Blocker: a product bug, routed to the orchestrator** (brief: `local-run/fix-brief-rwa-null.md`). `/api/tokens` → 400 because
  live RWA Data returns `statusInfo.marketStatus: null` (weekend) and `underlyingName: null` (3 tokens), while
  `packages/core/src/w3w/rwa.ts:8,25` require strings. `demo health` fails on it, so gate d stays open until the fix lands.
- Deploy note for the orchestrator: the Studio agent card's `url` comes from `AGENTCORE_RUNTIME_URL` (`src/agentCard.ts:116`),
  not `BNBAGENT_PUBLIC_URL`. `deploy/analyst.env.example` should list it, or the card advertises `http://localhost:9000/`.
  It is set in the local run script.

### e — launch:6 (on the user's "run gate e", 10 Oct)
- Step 1: `bag erc8004 register --endpoint https://begin-tsunami-amy-wanted.trycloudflare.com --name popanalyst
  --description "Proof of Position analyst: buys a bStock, then posts the call it holds"` → **agent id 370830**.
  Tx [`0xea887946…c1478d629`](https://bscscan.com/tx/0xea887946e4a3cc6479e7c133ac6ae6ec96c587db4927f06de25a0cfc1478d629),
  block 126870519, status 1, gas sponsored (effectiveGasPrice 0). The CLI timed out waiting ("broadcast but not confirmed
  yet") although the tx was mined; stale `[identity] pending_*` cleared with `clear-pending --force` after checking the
  receipt; `identity.endpoint` recorded. On chain: `ownerOf(370830)` = `getAgentWallet(370830)` = `0x8B03…3950`.
- Step 2 (local equivalent of the VPS env edit): `ANALYST_AGENT_ID=370830`, `ANALYST_ENABLED=true` in
  `local-run/run-analyst.ps1`; log: `[analyst] loop started: every 30 min, 2 USDT per call, hold 24 h, watchlist NVDAB,TSLAB,AAPLB,SPYB`.
  First cycle: `posted call #0: LONG NVDAB 0.008668 (thesis by template)`, tx
  [`0x317d224a…51ba94b9`](https://bscscan.com/tx/0x317d224a0aac1b783dc4425998808552a2c5a133300e19fd65fc727251ba94b9)
  (status 1); `deployment.mjs check` → `callCount=1`.
- Step 3 gate: `demo agent` → `agent #370830 wallet 0x8B031D852ba4358F291774aBC345ED781bc93950 ✓`, `integrity no feedback yet`, `PASS`.
- **Status: done.** When hosting moves, run `bag erc8004 update-endpoint` (gas) and update `AGENTCORE_RUNTIME_URL`/`BNBAGENT_PUBLIC_URL`.
