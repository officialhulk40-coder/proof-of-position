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
| `pnpm -r --if-present run verify` | 4be3622: FAIL, 1 follower test (`src/cli.test.ts:114`, tsx bin cold start 3.3–21 s against a 5 s timeout). Not a load flake: it also failed in isolation. Routed to the orchestrator and fixed in 58f7225. Re-run pending. core 63/63, demo 23/23, server 34/34, web 45/45 + vite build PASS |
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
| a | **contracts:11**: deploy CallRegistry on BSC mainnet, record, check | A by user override (10 Oct); C by default | closing | Bash (`cast wallet new`, `run-forge.mjs`, `deployment.mjs`), User-scope env | Fund the deployer burner | Burner only, about 0.00013 BNB of gas; immutable contract, owner = burner | approved (user, 10 Oct: "you do a and b steps yourself… autonomously") |
| b | **contracts:12**: list the 675 pack tokens (7 txs) | A by user override (10 Oct); C by default | closing | Bash (`deployment.mjs probe-tokens`, `run-forge.mjs`) | none (same burner) | About 0.0025 BNB of gas; owner-only `setTokens` | approved (same go) |
| c | **agents:12**: analyst wallet, Pieverse paid model, CMC trust, budget | C | closing | user terminal (`bag` 0.0.14); concierge runs `check-studio-setup.mjs` | Install `bag`, `wallet new`, fund (≈0.005 BNB, 10 USDT, 2 U), `llm activate`, `topup 1`, `x402 trust cmc`: **confirm only if the payee is `0x3C5f3a6cE224BB89D72f5EB4232ecC27F67B3eeA`**; `budget enable --max-per-day-usd 1 --max-per-topup-usd 1 --max-per-month-usd 5`; `bag doctor` | Real funds on a burner; budget caps the spend at $1/day | pending |
| d | **launch:5**: Singapore VPS, deploy, smoke S1 | C | closing | user (VPS, DNS, secrets, `docker compose`); concierge runs `demo health` | Provision the VPS (Ubuntu 24.04, 2 vCPU, 4 GB); `sslip.io` name; `deploy/.env`, `server.env` (`W3W_API_KEY`, `W3W_API_SECRET`, `KEEPER_PK`), `analyst.env` (`ANALYST_ENABLED=false`); `scp -r` `.studio/`; `docker compose -f deploy/docker-compose.yml up -d --build` | **`40304` (region refusal)**: if the server log shows it, record the exact message and move region before continuing | pending (needs a, b, c) |
| e | **launch:6**: ERC-8004 register the analyst, enable the loop | C | closing | user (`bag erc8004 register`); concierge runs `demo agent` | Run the register tx; set `ANALYST_AGENT_ID` and `ANALYST_ENABLED=true` on the VPS; restart analyst | Mainnet tx from the analyst burner | pending (needs d) |
| f | **launch:7**: smoke S2–S4 | C | closing | user (`demo caller buy`, `demo trades`, `demo api get`, `pop-follower`); concierge runs `devex-check S2,S3,S4` | `CALLER_PK` burner (≈5 USDT + BNB) buys 3 USDT NVDAB; **Agentic Wallet sign-in** (`baw auth signin`); `smoke --usdt 0.5 --yes` | Real trades, a few USDT; AW stays out of the judge path | pending (needs d) |
| g | **launch:8**: S5 and the money-shot rehearsal | C | closing | user (VPS env, `demo caller …`, follower `run`); concierge runs `devex-check S5,Rehearsal` | S5: `ANALYST_HOLD_HOURS=0.1`, wait for "held through ✓", `demo agent` → integrity 100, reset to 24. Rehearsal timed against spec §10: badge ≤ 1.5 s, exit recorded ≤ 2 s, evidence ≤ 3 s, follower SELL ≤ 2 s / FINISHED ≤ 15 s; `try-gate --broadcast` on TSLAB | Real trades; one deliberate reverted tx | pending (needs e, f) |
| h | Demo video (demo-studio's deliverable) | C | closing | claude-in-chrome (check only) | Record and upload; set sharing to public | A video that won't play logged-out doesn't count | pending. Check: plays logged-out, ≤ 4:00 |
| i | Resolve TBDs: README (6) + draft (8) + feed screenshot | A | closing | Bash, claude-in-chrome (screenshot) | none | Wrong address/id: verified from `deployments/bsc-mainnet.json` and BscScan | pending (needs a–h) |
| j | Pre-public | A (sweep) / C (decision) | closing | Bash, git | **Decide: squashed snapshot vs history rewrite** (both presented at the gate) | Telegram invite link at pack `INDEX.md:101`; SharePay mention in `prior-art.md` lines 28–29 and 57; secret sweep of the tree **and** history | pending |
| k | Repo public flip | C (explicit go) | closing | `gh repo edit --visibility public` after `gh auth status` | Your go | Irreversible exposure: j must be done first | pending (needs j) |
| l | DevEx report (**goes FIRST**) | C (human-written) | closing | none: the concierge points to `DEVEX_LOG.md` only | You write and submit https://forms.gle/EUQ39xf54GHjC2ys5 | AI-written reports are rejected; same contact email as registration | pending |
| m | Main form https://forms.gle/yToDUzaDMwWnq6R6A | A (fill) / C (Submit) | closing | claude-in-chrome | Paste contact email + prize wallet; **Fill and Submit are two separate goes**; logged-in identity re-read first | Wrong identity or missing video = not scored | pending (needs h, i, k, l) |
| n | Freeze | — | closing | none | No pushes after **12:00 UTC Sun 11 Oct** | A late push breaks "repos frozen" | pending |

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

### b — contracts:12
- Step 1: `deployment.mjs probe-tokens` → `PASS probed=675 failed=0` (19 s).
