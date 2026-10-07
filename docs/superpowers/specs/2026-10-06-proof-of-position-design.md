# Proof of Position — System Design Spec

- **Status:** design approved section by section in the architect dialogue on 2026-10-06; this written spec awaits the user's review.
- **Date:** 2026-10-06 (architect, Step 1).
- **Project repo:** `officialhulk40-coder/proof-of-position` (private until the submission flip).
- **Source brief:** `docs/idea-forge/2026-10-06-proof-of-position-brief.md`.
- **Resource pack:** `docs/resources/2026-10-05-bnb-hack-tokenized-stocks/` (event, tracks, sponsors, token registry CSV).
- **One-liner:** Stock calls you can't post unless you hold the tokenized stock: each call's badge is read on-chain from the caller's live BSC balance, flips the moment they sell, and followers' agents exit with them.

## 0. Constraints (verbatim from the architect kickoff)

> BSC mainnet only (chain 56), spot only, small live amounts with Transaction API dry-runs; Solidity 0.8.x + Foundry for the single CallRegistry contract; TypeScript (strict, ESM, Node >= 22.12) + React for the feed and both agents; Python optional for scripts. Hard deadline Sun 11 Oct 2026, 12:00 UTC (submissions lock, repos frozen; inert calendar fact, idea-forge did NOT gate on it); team = solo + AI. Target track(s): Main Track (Tokenized Stocks Products & Agents), Best Use of Agentic Wallet / Wallet Skills, Best Use of BNB Agent Studio. Must land the demo money shot. Out of scope: short calls; PnL leaderboards; custody, vaults, escrow or locking of stocks; x402 selling, paying with shares or sweeping revenue into stocks; X/Twitter API, browser extension, mobile app, Telegram bot (stretch only); ZK/private proofs; xStocks follow execution (verify-only); signal/strategy engines beyond one demo analyst agent; net-exposure claims; any chain but BSC mainnet. The hosted judge path must not depend on Agentic Wallet; keep a running DEVEX_LOG.md for the human-written DevEx report.

Event rules that bind the build (`event.md`, verbatim): "At least one of **bStocks**, **Ondo** or **xStocks** has to be central to what you submit." · "Spot only. Perps are out." · "**BSC mainnet only.** Dry-run with the Transaction API while you build, then demo with small live amounts." · "Your repo, demo and deployed link must stay accessible through judging." · Submissions lock "Sun 11 Oct, 12:00" UTC; judging 12–23 Oct; winners the week of 26 Oct.

## 1. Summary

A single immutable Solidity contract, `CallRegistry`, accepts a public LONG call on a tokenized stock only if the caller's wallet holds at least the declared amount right now ("No position, no call."). A call's badge is a pure on-chain view of the caller's live balance: HOLDING, TRIMMED, EXITED, or CLOSED (the caller ended it honestly). Anyone can make an exit permanent with `recordExit`, so a dump cannot be hidden by buying back. For calls posted by an ERC-8004 agent, the registry itself writes integrity feedback to the ERC-8004 ReputationRegistry (held = 100, trimmed = 50, exited = 0).

Around it:

- **Feed (web + server):** a React feed reads the registry straight from public BSC RPC every block (chain-first: no server in the badge's trust path). A Singapore server holds the Binance Web3 API keys and adds token metadata and market status (RWA Data), exit evidence (Market `trades`), dry-runs (Transaction `simulate`), and "Follow with $X" route building (Trading `quote` / `swap` / `approve-transaction`). An optional keeper calls `recordExit` within about a block of a flip.
- **Follower agent:** a local CLI on Agentic Wallet (`baw`) that mirrors a followed caller's verified call within a budget and sells the moment the badge flips. It ships as an installable Wallet Skill.
- **Analyst agent:** an Agent Studio seller agent with an ERC-8004 identity that researches over x402 (CoinMarketCap, paid in U), writes a thesis with a self-funded Pieverse model, **buys before it posts**, posts with `postAsAgent`, and closes calls honestly after a hold window.

## 2. Design decisions (dialogue record)

| # | Question | Answer | Source |
|---|---|---|---|
| D1 | How should a call live and end on-chain? | Close + sticky exits: live badge from balance; caller-only `close`; permissionless `recordExit` that makes an exit permanent; registry writes ERC-8004 integrity feedback for agent calls. | user (dialogue Q1) |
| D2 | Where does the hosted judge path run? | A Singapore VPS running Caddy, the feed server, the static web app, and the analyst agent under Docker Compose. Day-1 gate: a signed `GET /rwa/tokens` from that box returns `code 0` (not `40304`). | user (dialogue Q2) |
| D3 | Which LLM writes the analyst's thesis? | Pieverse (Agent Studio's native provider) on a paid model, self-funded: the agent tops up its own LLM credits over x402 from its wallet (`bag budget enable`). LLM failure falls back to a templated thesis; the call still posts. | user (dialogue Q3) |
| D4 | Overall architecture | Chain-first (approach A): browser and agents read the registry from public RPC; the server is only a signed-API proxy plus the keeper. Server-centric (B) and indexer (C) rejected. | user (approach choice) |
| D5 | Contract section | Approved as written in §5, including one open call per (caller, token), the string revert "No position, no call.", and integrity values 100 / 50 / 0. | user (section 1) |
| D6 | Core + feed section | Approved as written in §6–§7, including the optional keeper and no server broadcast endpoint for browser follows (injected wallets broadcast themselves after a Transaction API `simulate`). | user (section 2) |
| D7 | Agents section | Approved as written in §8: follower mirrors bStock calls only; analyst runs on an interval loop. | user (section 3) |
| D8 | Launch section | Approved as written in §9. Before the repo goes public, delete `2026-10-05-sharepay-brief.md` and `telegram-intel-2026-10-06.md` from the pack (another team's brief; other participants' names). Local copies remain in `D:\bnb-tokenized-hackathon\resources\`. | user (section 4) |
| D9 | Token eligibility | Owner-curated on-chain allowlist seeded with all 675 rows of the pack CSV: 87 bStock + 458 Ondo + the 2 wrapped xStocks (`wPOPMTx`, `wTCENTx`) as PLAIN (547), the 128 rebasing xStocks as XSTOCK. Unlisted tokens cannot be called. | derived (fake-ticker abuse; approved in section 1; wrapped-xStock split per D12) |
| D10 | Analyst framework depth | Agent Studio scaffold (`bag init`, `@bnbagent/studio-cli@0.0.14`), analyst logic added as new files under `app/agent/src/analyst/` plus one hook line in `unifiedMain.ts`; FREE (price 0) x402 face returns the latest call — no payment is taken, so x402 selling stays out of scope. | derived (Studio special criterion) |
| D12 | Token-list validation (revision during planning, 2026-10-07) | `setTokens` makes no external calls; tokens are validated off-chain by a read-only batched probe (`deployment.mjs probe-tokens`: `balanceOf` for PLAIN, `sharesOf` for XSTOCK) before listing. Reason: an on-chain probe makes the listing's forge simulation touch all 675 tokens, which outlives the ~1 minute of state public BSC RPCs keep (measured: `missing trie node` after 55 s); without it the simulation finishes in ~12 s. The live probe found `wPOPMTx`/`wTCENTx` have no `sharesOf` (wrapped, non-rebasing) → listed as PLAIN; all 675 then pass. | derived (measured during planning) |
| D11 | README schema | `R1-web-app v1` (the demo is the UI; contracts listed under its optional `## Contract addresses`); MIT licence; no event overlay (`event.md` mandates no README sections). | derived (`references/readme-schemas.md` tie-breaker) |

## 3. Verified facts the design rests on (read-only checks, 2026-10-06)

| Fact | Evidence |
|---|---|
| ERC-8004 registries on BSC mainnet are v2.0.0. `IdentityRegistry` `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, `ReputationRegistry` `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`; the latter's `getIdentityRegistry()` returns the former. | `eth_call getVersion()` → `"2.0.0"` on both; source `bnb-chain/erc-8004-contracts` HEAD. |
| `giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)` reverts only for the agent's owner/approved operator ("Self-feedback not allowed"), `valueDecimals > 18`, or `|value| > 1e38`. Any other address — including a contract — may write. | `ReputationRegistryUpgradeable.sol` v2.0.0. |
| `register(string agentURI) returns (uint256 agentId)` sets the `agentWallet` metadata to `msg.sender`; `getAgentWallet(uint256) returns (address)` returns `address(0)` for unknown ids (no revert). | `IdentityRegistryUpgradeable.sol` v2.0.0. |
| xStocks are rebasing and expose `sharesOf(address)`, `getSharesByUnderlyingAmount(uint256)`, `getUnderlyingAmountByShares(uint256)`, `multiplier()`, and `getCurrentMultiplier() returns (uint256,uint256,uint256)`. | `eth_call` on AAPLx `0x9d27…890a`: multiplier `1003269012539818700`, nonce `5`. |
| bStock raw `balanceOf` does not rebase; `uiMultiplier()` / `balanceOfUI(address)` are display-only. | `eth_call` on NVDAB: `uiMultiplier()` = `1000778223752807865`; `balanceOf(pool)` ≠ `balanceOfUI(pool)`. |
| Ondo tokens are plain ERC-20 balances (shares-per-token lives in a separate oracle). | `eth_call` on NVDAon: `symbol()`/`decimals()` ok; no multiplier getter. |
| BSC block time is 0.45 s. | 2,000-block span = 900 s at block 126,100,368. |
| Official BSC RPC refuses `eth_getLogs` (`limit exceeded`); `bsc-rpc.publicnode.com`, `bsc.drpc.org` and `1rpc.io/bnb` serve it for recent blocks. | JSON-RPC probe, 20-block range on NVDAB `Transfer`. |
| Public BSC RPCs serve **no historical state** (even 200 blocks back): `missing trie node` / archive requests need a token. Foundry fork tests would be flaky. | `eth_call` at `latest-200` on four providers. |
| Public BSC RPCs allow browser CORS (`Access-Control-Allow-Origin: *`). | `OPTIONS`/`POST` with `Origin` header. |
| Binance Web3 API response shapes: RWA `tokens` and `price` → `data` is an array; Market `trades` → `data: { cursor, trades: [{ txHash, userAddress, dexName, type: "buy"\|"sell", price, volume, time (ms), changedTokenInfo: [{ amount, tokenSymbol, tokenContractAddress }] }] }` (`walletAddressFilter` takes up to two addresses); Trading `quote` → `data` array of routes; `swap` → `data` object `{ routerResult, tx, executionMode, rfq }`; `approve-transaction` → `data` array; Transaction `simulate` → `data: { status ("SUCCESS" on success), failReason, balanceChanges, allowanceChanges }`; `broadcast-transaction` → `data: { orderId, txHash }`; Wallet `token-balances-by-address` → `data: [{ tokenAssets: [...] }]`. | Official OpenAPI 3.1.1 asset (SHA-256 prefix `4ae094ae23e96a96`, same as the pack). |
| Request signing: `preHash = timestamp + METHOD + requestPath(/build/... + raw query) + body`, `X-OC-SIGN = Base64(HMAC-SHA256(preHash, secret))`. Test vector: secret `test-secret`, preHash `2026-05-11T10:08:57.715ZGET/build/api/v1/dex/market/rwa/tokens?binanceChainId=56` → `qi1JDOb/5OKUF6/NYwQ5LwfEpg8dSqgKFIODFA/Srfs=`. | Docs "Authentication"; vector computed independently with Node `crypto` and `openssl`. |
| Agentic Wallet CLI JSON: `baw market-order swap … --json` → `{ "success": true, "data": { "orderId": "…" } }`; `baw market-order list --orderId <id> --json` → `data.list[].status` ∈ `PENDING`/`FINISHED`/`FAILED`, with `txHash`; `baw wallet status --json` → `data.status` ∈ `UNCONNECTED`/`CREATING`/`CONNECTED`; `baw wallet address --json` → `data.addresses[]` with `binanceChainId "56"`. | `binance/binance-skills-hub` skill references (v1.12.0, CLI 1.10.0). |
| Agent Studio 0.0.14 scaffolds `app/agent/src/{unifiedMain,sellerCore,executor,agentCard,signing,tools,model,requestLimits}.ts`; `getWallet()` (`@bnbagent/studio-runtime/wallet`) returns the SDK `WalletProvider` (an `EVMWalletProvider` with `signTransaction` for `evm-local`); `buildModel()` wraps Pieverse with x402 credit auto-renew; the x402-buyer recipe exposes `buyWithX402(url, maxUsd, method)`; `main()` contains the line `const runWork = buildRunWork();`. | `@bnbagent/studio-cli@0.0.14` recipe templates; `@bnbagent/studio-runtime@0.0.14` typings; `@bnbagent/sdk@0.6.0` source. |
| Local toolchain (2026-10-06, after the user's install): Node v24.19.0, npm 11.17.0, pnpm 10.34.6, Foundry 1.8.5 (forge/cast/anvil); Bun absent (not needed: no `bag deploy`); Python absent (not used). | Version probes with the refreshed system PATH. |

## 4. Architecture

```
                     ┌──────────────────────────── BSC mainnet (chain 56) ─────────────────────────────┐
                     │  CallRegistry (ours, immutable)    ERC-8004 Identity / Reputation (v2.0.0)      │
                     │  bStocks · Ondo · xStocks tokens   PancakeSwap pools   Binance aggregator router   │
                     └───────▲──────────────▲───────────────────▲────────────────▲───────────────────────┘
          eth_call getCalls  │              │ recordExit tx     │ swap/post txs  │ Agentic Wallet swaps
          every new block    │              │                   │                │ (MPC, Binance App)
┌───────────────────┐  ┌─────┴──────┐  ┌────┴─────────────────┐ ┌┴─────────────────────┐ ┌┴────────────────────┐
│ Browser (React)   │  │ Follower   │  │ SG VPS: server        │ │ SG VPS: analyst      │ │ Demo scripts (local)│
│ feed · post ·     │  │ agent CLI  │  │ Hono /api + keeper    │ │ Agent Studio app     │ │ caller post / sell /│
│ follow · alerts   │  │ (local,    │  │ holds W3W API keys    │ │ ERC-8004 identity    │ │ try-gate            │
└────────┬──────────┘  │  baw CLI)  │  └────┬──────────────────┘ │ x402 → CMC, Pieverse │ └─────────┬───────────┘
         │ /api/*      └────────────┘       │ HMAC-signed        └────┬─────────────────┘           │ HMAC-signed
         └──────────────────────────────────┤                         │ HMAC-signed                │
                                            ▼                         ▼                            ▼
                                  Binance Web3 API (RWA Data · Market · Trading · Transaction · Wallet)
```

**Trust model.** The badge is computed by the registry from the caller's live token balance; the browser, follower and analyst each read it directly from public RPC (rotating across a fallback list). The server never sits in the badge path: if the Binance API is blocked (`40304`) or the server is down, badges still update; only enrichment (market status, share ratio, exit evidence, follow quotes) degrades.

**Repository layout (pnpm 10 workspace, Node ≥ 22.12, ESM, TypeScript strict):**

```
contracts/            Foundry project: CallRegistry + tests + scripts (soldeer forge-std 1.16.0)
packages/core/        @pop/core — W3W API client, registry ABI + readers, token catalog, tx pipeline
apps/server/          @pop/server — Hono API + keeper (Docker image)
apps/web/             @pop/web — React + Vite feed (static build served by Caddy)
agents/follower/      @pop/follower — Agentic Wallet follower CLI (`pop-follower`)
skills/pop-follower/  Wallet Skill (SKILL.md + references) for the follower
agents/popanalyst/    Agent Studio workspace (generated by `bag init popanalyst`; its own pnpm workspace)
scripts/demo/         @pop/demo — persona scripts for the money shot
deploy/               docker-compose.yml, Caddyfile, Dockerfiles, env templates (names only)
DEVEX_LOG.md          running raw notes for the human-written DevEx report
```

The root `pnpm-workspace.yaml` lists `packages/*`, `apps/*`, `agents/follower`, and `scripts/demo`. It deliberately excludes `agents/popanalyst/**`, which keeps the Studio-generated workspace intact; the analyst app depends on `@pop/core` through `link:../../../../packages/core`. Internal packages export TypeScript source (`"exports": { ".": "./src/index.ts" }`); Node processes run through `tsx`, the web app through Vite, tests through Vitest.

## 5. Subsystem A — contracts (`contracts/`)

### 5.1 Interface (authoritative; the TypeScript ABI is generated from the compiled artifact)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

enum BalanceModel { UNLISTED, PLAIN, XSTOCK }
enum Status { HOLDING, TRIMMED, EXITED, CLOSED }

struct Call {
    address caller;
    address token;
    BalanceModel model;        // snapshot of tokenModel[token] at post time
    bool hasAgent;
    bool heldThrough;          // set by close(): true iff no exit was ever recorded and live status was HOLDING
    Status exitStatus;         // TRIMMED or EXITED when exitBlock != 0, otherwise HOLDING
    uint64 postedBlock;
    uint64 postedAt;           // block.timestamp at post
    uint64 closedBlock;        // 0 while open
    uint64 exitBlock;          // 0 until an exit is recorded (sticky)
    uint256 agentId;           // meaningful iff hasAgent
    uint256 declaredAmount;    // in the token's balanceOf units at post time
    uint256 declaredBase;      // comparison units: PLAIN = declaredAmount; XSTOCK = shares
    string note;               // thesis, at most 280 bytes
}
```

| Function | Behavior |
|---|---|
| `constructor(address identityRegistry, address reputationRegistry, address initialOwner)` | Stores the two ERC-8004 registries as immutables and the owner. Reverts `ZeroAddress()` on any zero argument. |
| `setTokens(address[] tokens, BalanceModel[] models)` | Owner only (`NotOwner()`); `LengthMismatch()` if lengths differ; `ZeroAddress()` for a zero token. No external calls (D12): tokens are validated off-chain before listing. `UNLISTED` delists (affects new posts only). Emits `TokenListed(token, model)` per entry. |
| `transferOwnership(address newOwner)` | Owner only; `ZeroAddress()` guard; emits `OwnershipTransferred`. |
| `post(address token, uint256 amount, string note) returns (uint256 callId)` | Reverts `TokenNotListed(token)`, `ZeroAmount()`, `NoteTooLong(length)` (> 280 bytes), `CallAlreadyOpen(callId)` (one open call per caller per token). Then `require(IERC20(token).balanceOf(msg.sender) >= amount, "No position, no call.")`. `declaredBase` = `amount` (PLAIN) or `getSharesByUnderlyingAmount(amount)` (XSTOCK; a zero result reverts `ZeroAmount()`). Emits `CallPosted`. |
| `postAsAgent(address token, uint256 amount, uint256 agentId, string note) returns (uint256 callId)` | As `post`, plus `NotAgentWallet(agentId)` unless `IdentityRegistry.getAgentWallet(agentId) == msg.sender`. |
| `recordExit(uint256 callId)` | Anyone. Reverts `UnknownCall`, `CallNotOpen` (closed), `ExitAlreadyRecorded`, `StillHolding` (live status HOLDING). Stores `exitBlock = block.number`, `exitStatus = live status`; emits `ExitRecorded(callId, status, baseBalance, msg.sender)`; for agent calls writes feedback (§5.3). |
| `close(uint256 callId)` | Caller only (`NotCaller`); `CallNotOpen` if closed. If no exit was recorded and live status is not HOLDING, records the exit first (same effects and feedback as `recordExit`). `heldThrough = (exitBlock == 0 before close) && live == HOLDING`. Sets `closedBlock`, frees the (caller, token) slot, emits `CallClosed(callId, heldThrough)`; a held-through agent call writes `100` feedback. |
| `callCount() returns (uint256)` | Number of calls; ids are `0 … callCount()-1`. |
| `getCall(uint256 callId) returns (Call)` | `UnknownCall` for out-of-range ids. |
| `getCalls(uint256 start, uint256 count) returns (Call[] calls, Status[] statuses)` | Page read used by every client; clamps to `callCount()`; returns empty arrays when `start >= callCount()`. |
| `liveStatus(uint256 callId) returns (Status)` | HOLDING (base ≥ declaredBase) / TRIMMED (0 < base < declaredBase) / EXITED (base == 0), ignoring closure. Base = `balanceOf(caller)` (PLAIN) or `sharesOf(caller)` (XSTOCK). |
| `statusOf(uint256 callId) returns (Status)` | `CLOSED` if closed, else `liveStatus`. |
| `openCallOf(address caller, address token) returns (bool open, uint256 callId)` | The caller's open call on that token, if any. |
| `owner()`, `identityRegistry()`, `reputationRegistry()`, `tokenModel(address)` | Public getters. |

Events: `TokenListed(address indexed token, BalanceModel model)`, `CallPosted(uint256 indexed callId, address indexed caller, address indexed token, uint256 declaredAmount, uint256 agentId, bool hasAgent, string note)`, `ExitRecorded(uint256 indexed callId, Status status, uint256 baseBalance, address recordedBy)`, `CallClosed(uint256 indexed callId, bool heldThrough)`, `FeedbackWritten(uint256 indexed callId, uint256 indexed agentId, int128 value, string tag2)`, `FeedbackFailed(uint256 indexed callId, uint256 indexed agentId)`, `OwnershipTransferred(address indexed previousOwner, address indexed newOwner)`.

### 5.2 Semantics and abuse cases

- **The gate:** the only revert string in the contract is `"No position, no call."`, so it reads plainly on BscScan, in wallets, and in Transaction API `simulate.failReason`. All other failures are custom errors.
- **Units:** dividends, splits and fee accrual change xStocks `balanceOf` but not `sharesOf`; bStock UI multipliers never change raw `balanceOf`. So no corporate action can flip a badge.
- **Transfer out / sale:** the live view shows TRIMMED or EXITED immediately; `recordExit` makes it permanent.
- **Borrowed or flash balance returned in the same transaction:** the post succeeds, but the call is EXITED from the next read; the keeper (or anyone) records the exit, and the card shows "exit recorded N blocks after post".
- **Buy-back after a dump:** the sticky `exitBlock` stays; the card keeps the red "exited while open" mark even if the live balance returns.
- **Double counting:** one open call per (caller, token) stops two calls being backed by the same shares.
- **Fake tickers:** unlisted tokens revert `TokenNotListed`.
- **Owner powers:** edit the token list only. No pause, no upgrade, no fund access; the registry never holds or moves tokens.

### 5.3 Reputation writes (agent calls only)

At most one `giveFeedback` per agent call, with the registry as the client address:

| Trigger | value | valueDecimals | tag1 | tag2 | endpoint | feedbackURI | feedbackHash |
|---|---|---|---|---|---|---|---|
| exit recorded as EXITED (by `recordExit` or inside `close`) | `0` | `0` | `"integrity"` | `"exited"` | `""` | `""` | `bytes32(callId)` |
| exit recorded as TRIMMED | `50` | `0` | `"integrity"` | `"trimmed"` | `""` | `""` | `bytes32(callId)` |
| `close` with `heldThrough == true` | `100` | `0` | `"integrity"` | `"held"` | `""` | `""` | `bytes32(callId)` |

State is written before the external call; the call is `try … catch` with a 400,000 gas cap. Success emits `FeedbackWritten`; failure emits `FeedbackFailed` and never reverts the outer transaction. Clients read an agent's score with `getSummary(agentId, [registryAddress], "integrity", "")`.

### 5.4 Tests and deploy

- **Unit + fuzz + invariant tests** against mocks that mirror the verified ABIs: `MockPlainToken` (ERC-20 balance setter), `MockBStock` (raw balance + `uiMultiplier`), `MockXStock` (shares × multiplier / 1e18 with `sharesOf`, `getSharesByUnderlyingAmount`, `setMultiplier`), `MockIdentityRegistry` (`getAgentWallet`, `isAuthorizedOrOwner`), `MockReputationRegistry` (records calls, enforces the self-feedback rule), `RevertingReputationRegistry`.
- **No fork tests** (public RPCs serve no historical state). Mainnet behavior is proven in human-gated smoke tasks.
- **Tooling:** Foundry 1.8.5, solc 0.8.28 (pinned), optimizer 200 runs, `via_ir = true`, forge-std 1.16.0 via soldeer (`dependencies/` git-ignored). Every forge command runs through `node contracts/run-forge.mjs <args>`, which installs soldeer dependencies when missing; gates stay one shell-neutral command.
- **Scripts:** `DeployCallRegistry.s.sol` (constructor args: the two mainnet ERC-8004 addresses and the broadcaster as owner) and `ListTokens.s.sol` (reads `script/data/tokens.json`, generated from the pack CSV — 547 PLAIN, 128 XSTOCK — and calls `setTokens` in 7 batches of up to 100). `contracts/script/deployment.mjs` records the deployment, checks it on chain, and probes every token read-only before listing (D12). Mainnet runs are human-gated (`DEPLOYER_PK` env var, never in files). Deployed address recorded in `deployments/bsc-mainnet.json`.

## 6. Subsystem B — core (`packages/core`, `@pop/core`)

Shared by the server, the demo scripts, the follower and the analyst (the web app imports only the browser-safe modules: registry ABI/readers, token catalog, formatting).

| Module | Contract |
|---|---|
| `w3w/sign` | `signW3wRequest({ secret, timestamp, method, requestPath, body }) → string` (Base64 HMAC-SHA256); `requestPath` always starts with `/build`. |
| `w3w/client` | `createW3wClient({ apiKey, apiSecret, baseUrl?, fetchImpl?, now?, onTiming?, maxRetries? })` → `{ get(path, query, schema), post(path, body, schema) }`. Builds the raw query string once and signs exactly what goes on the wire; parses the `{ code, msg, data }` envelope; throws `W3wApiError { code, msg, httpStatus, endpoint }` for `code !== 0` or non-2xx; retries HTTP 429 using `Retry-After` (default 2 retries). |
| `devex/telemetry` | `createTelemetryRecorder(filePath)` → `onTiming` callback appending JSONL `{ ts, service, method, endpoint, httpStatus, code, msg, ms }` (file path from `DEVEX_TELEMETRY_FILE`). |
| `w3w/rwa` | `getRwaTokens(client, { platformId? })`, `getRwaPrices(client, addresses[])` (≤ 100 per call; batches). |
| `w3w/market` | `getTokenTrades(client, { token, wallets?, limit? })` → `{ cursor, trades[] }`. |
| `w3w/wallet` | `getTokenBalances(client, { address, tokens[] })`. |
| `w3w/trading` | `getQuote`, `buildSwap`, `getApproveTransaction`; `pickSwapRoute(routes)` returns the best `executionMode === "SWAP"` route or `null`. |
| `w3w/transaction` | `simulateTx`, `broadcastTx({ signedTransaction, address, enableMevProtection })`, `getGasPrice`. |
| `chain/rpc` | `createBscPublicClient(rpcUrls[])` (viem `fallback` over the list; defaults to the official dataseed endpoints), `BSC_CHAIN_ID = 56`. |
| `registry/abi` | `CALL_REGISTRY_ABI` generated from `contracts/out/CallRegistry.sol/CallRegistry.json`; `ERC20_ABI`, `REPUTATION_REGISTRY_ABI` (getSummary), `IDENTITY_REGISTRY_ABI` (getAgentWallet). |
| `registry/read` | `readCallCount`, `readCallsPage(client, registry, start, count)` → `CallView[]` (`{ id, …Call, status }` with `status` as `"HOLDING" \| "TRIMMED" \| "EXITED" \| "CLOSED"`), `readLatestCalls(client, registry, n)`, `readAgentIntegrity`. |
| `tokens/catalog` | Generated from the pack CSV (675 rows): `{ address, symbol, ticker, issuer: "bStocks" \| "Ondo" \| "xStocks", model: "PLAIN" \| "XSTOCK", assetType }`; `getTokenInfo(address)`, `findTokens(query)`. |
| `format/amounts` | `parseUnits18(decimalString) → bigint`, `formatUnits18(bigint, maxFractionDigits)`, `toShares(raw, tokenToShareRatio) → string`. |
| `tx/pipeline` | `sendWithTransactionApi({ w3w, publicClient, signer, tx, mev })`: fills nonce/gasPrice/gas, runs `simulateTx` (throws `SimulationFailedError` with `failReason` on anything but `"SUCCESS"`), signs with the injected `TxSigner` (`{ address, signTransaction(tx) → 0x… }`), broadcasts through `broadcastTx`, waits for the receipt via the public client, returns `{ txHash, receipt, orderId, timings }`. Adapters: `viemAccountSigner(privateKeyAccount)` (scripts, keeper) and `walletProviderSigner(sdkWallet)` (analyst). |

## 7. Subsystem C — feed (`apps/server`, `apps/web`)

### 7.1 Server (`@pop/server`, Hono on Node, Singapore VPS)

`createApp(deps)` takes injected dependencies (W3W client, public client, logs client, clock, keeper status) so every route is tested with fakes.

| Route | Request | Response |
|---|---|---|
| `GET /api/health` | — | `{ ok: true, chainId: 56, registry, w3w: boolean, keeper: { enabled, address, recorded, lastError } }` |
| `GET /api/tokens` | — | `{ updatedAt, degraded: { code, msg } \| null, tokens: TokenDto[] }` — catalog merged with RWA `tokens` (bStock + Ondo on chain 56): `name`, `tokenToShareRatio`, `priceUsd`, `status { openState, marketStatus, reasonCode, reasonMsg, nextOpenTime, nextCloseTime }`; xStocks get `status: null` ("not covered by RWA Data"). Cached 60 s. When RWA Data is unavailable the 675 catalog entries still come back, with `degraded` set. |
| `GET /api/calls/:id/exit` | — | `{ callId, status, evidence: null \| { kind: "sale" \| "contract" \| "transfer", txHash, amount, timeMs?, priceUsd?, volumeUsd?, dexName?, counterparty?, source: "market-api" \| "rpc-logs" } }`. Market `trades` (wallet filter = caller, newest `sell` at or after `postedAt`) first; else `Transfer(from = caller)` logs over the last 400 blocks from the logs RPC; `to` with code → `"contract"` (likely a sale), EOA → `"transfer"`. |
| `POST /api/dry-run` | `{ from, to, data, value }` | `{ success, status, failReason, balanceChanges }` from Transaction `simulate`. |
| `POST /api/follow/quote` | `{ token, usdtAmount, wallet }` | `{ route: { quoteId, vendorName, toTokenAmount, priceImpactPercent, approveTarget }, toTokenFormatted }`; `409 { error: { code: "NO_SWAP_ROUTE", msg } }` when only RFQ routes exist; W3W errors pass through as `502 { error: { code, msg, hint } }`. |
| `POST /api/follow/build` | `{ token, usdtAmount, wallet }` | Checks USDT allowance for the route's `approveTarget`. Not enough → `{ next: "approve", tx, simulation, spender }`. Enough → `{ next: "swap", tx, simulation, toTokenAmount, minReceiveAmount }`; a failed swap simulation is `409 { error: { code: "SIMULATION_FAILED", msg } }`. Every returned tx was simulated first. |

**Keeper** (enabled when `KEEPER_PK` and the W3W keys are set): ticks every second (a tick still running makes the next one a no-op); each tick reads the calls (`getCalls` pages), and for each open call with live status ≠ HOLDING and `exitBlock == 0` sends `recordExit(callId)` through `tx/pipeline` (simulate → sign → broadcast, MEV off), at most one in flight per call.

### 7.2 Web (`@pop/web`, React 19 + Vite 7 + viem)

- **Routing:** a minimal hash router (`#/`, `#/calls/:id`, `#/post`, `#/how`), no router dependency.
- **Chain reads:** `useLiveCalls()` watches the block number (1 s polling) and re-reads the newest page with one `getCalls` call per new block, rotating across `VITE_RPC_URLS`; a pure `diffCalls(prev, next)` yields flips (`HOLDING → TRIMMED/EXITED`, `exitBlock 0 → n`, `CLOSED`).
- **Call card:** caller (short address; "AGENT #id" badge linking to the ERC-8004 token on BscScan, with its integrity score from `getSummary`), "LONG {company} · {shares} shares · {issuer}", market-status pill with reason (from `/api/tokens`), the live badge (HOLDING green ✓, TRIMMED amber, EXITED red, CLOSED grey with "held through ✓" or "exited while open"), the sticky exit line ("exit recorded on-chain · block N"), exit evidence ("sold 0.02 NVIDIA · tx 0x… · PancakeSwap @ $…"), the thesis, "Verify on BscScan", "Follow with USDT", and "Alert me".
- **Post page:** injected-wallet discovery via EIP-6963 plus `wallet_switchEthereumChain` to `0x38`; token search over the catalog; amount entered in token units with a live shares preview; **Dry-run** calls `/api/dry-run` with the encoded `post` calldata and shows the exact `failReason` (e.g., "No position, no call.") before anything is signed; **Post on-chain** sends with the wallet.
- **Try the gate:** a judge with no wallet dry-runs `post(TSLAB, 0.01e18, …)` from a fixed non-holder address (`0x…c0de`) and sees the real revert reason: through the server's Transaction API `simulate` first, falling back to a plain `eth_call` against public RPC when the server or the Web3 API is unavailable. The Post page's **Dry-run** uses the same fallback, and **Post on-chain** always dry-runs first and never asks the wallet to sign a call that would revert.
- **Follow with USDT:** restricted-persons confirmation first; then quote → build (approve: simulate → wallet sends) → build (swap: simulate → wallet sends) → "You hold {shares} {company} alongside them". Disabled with the reason when the call is not HOLDING, the token is not a bStock, or the asset is paused; `NO_SWAP_ROUTE` and other API errors are shown verbatim.
- **Alerts:** watched call ids in `localStorage`; on a flip: toast + browser `Notification` (when permitted).
- **Disclaimers:** "A badge proves the BSC position, not hedges held elsewhere." · "Not investment advice." · bStocks / Ondo / xStocks are not available to US persons and other restricted persons.

## 8. Subsystem D — agents

### 8.1 Follower agent (`agents/follower`, `@pop/follower`, bin `pop-follower`)

- **`pop-follower check`:** `baw --version` ≥ 1.10.0; `baw wallet status --json` = `CONNECTED`; warns when `baw wallet settings --json` `sessionExpireTime` is under 6 hours away; prints the BSC address (`baw wallet address --json`) and its USDT balance (viem).
- **`pop-follower run --caller <addr> [--caller <addr>…] --budget-usdt <n> [--max-open <n>] [--include-existing]`:** polls the registry every second. The pure `decide(snapshot, state, config) → Action[]` emits:
  - `BUY` when a followed caller has an open HOLDING call on a **bStock** with no recorded exit, no mirror yet, open mirrors < `max-open`, and the call id ≥ the start cursor (unless `--include-existing`);
  - `SELL` when a mirrored call is TRIMMED, EXITED, CLOSED, or has `exitBlock != 0`.
- **Execution:** `BUY` runs `baw market-order swap --fromTokenQty <budget> --fromToken <USDT> --toToken <stock> --binanceChainId 56 --slippage auto --mev true --json`, polls `baw market-order list --orderId <id> --json` every 2 s until `FINISHED`/`FAILED` (90 s cap), and records the quantity from the on-chain balance delta of the AW address. `SELL` swaps exactly the mirrored quantity back to USDT the same way. A `baw wallet tx-lock` LOCKED state waits; an `UNCONNECTED` wallet stops the loop with "sign in again"; `FAILED` orders are logged and retried once.
- **Latency logging:** flip block → order submitted → `FINISHED`, appended to the DevEx telemetry file.
- **State:** JSON at `POP_FOLLOWER_STATE` (default `~/.pop-follower/state.json`): cursor, mirrors (`callId`, token, quantity, buy/sell order ids and tx hashes, timestamps).
- **Policy:** acts only on registry status; never exceeds budgets; sells only what it mirrored; calls nothing but `baw market-order swap/list`, `wallet status/address/settings/tx-lock`. Running `pop-follower run` is the user's standing pre-authorization within the budget; Binance App limits still apply.
- **Wallet Skill (`skills/pop-follower/`):** `SKILL.md` (frontmatter: name, description, required bins `baw` and `pop-follower`) and `references/` (commands, policy, troubleshooting) that teach any skills-capable agent to run the follower. Installable with `npx skills add officialhulk40-coder/proof-of-position/skills/pop-follower` once the repo is public.

### 8.2 Analyst agent (`agents/popanalyst`, Agent Studio)

- **Scaffold (human-gated):** `bag init popanalyst --network bsc-mainnet --destination self --llm-provider pieverse-llm --wallet-kind evm-local --seller-price-usd 0 --storage-provider local --no-onboard`, then `bag wallet new --generate-password`, `bag llm activate`, choose a paid Pieverse model, `bag x402 trust cmc`, `bag budget enable` (daily cap ≤ $1). `.studio/` never enters git.
- **Added code (`app/agent/src/analyst/`):** `config` (env), `research` (W3W `top-liquidity` for the token's main pool, CoinMarketCap `/x402/v4/dex/pairs/quotes/latest?pair_address=…` through `buyWithX402` with `maxUsd 0.02`, RWA status and price), `thesis` (`generateText` with `buildModel()`; ≤ 280 chars; templated fallback on any error), `trade` (Trading `quote` → `pickSwapRoute` → approve if needed → `buildSwap` → `tx/pipeline` with `walletProviderSigner(getWallet())`, MEV on), `registry` (`postAsAgent` and `close` through `tx/pipeline`; reads the `CallPosted` log from the receipt), `cycle` (one cycle), `loop` (interval scheduler), `face` (latest-call summary).
- **One cycle:** (1) close own calls older than `ANALYST_HOLD_HOURS`, then sell those positions (close first, so integrity stays honest); (2) pick the first watchlist bStock (`ANALYST_WATCHLIST`, default `NVDAB,TSLAB,AAPLB,SPYB`) with no open call and an open market (`statusInfo.openState` or a SWAP route available); (3) research; (4) thesis; (5) buy `ANALYST_BUY_USDT` (default 2) of it; (6) `postAsAgent(token, boughtAmount, ANALYST_AGENT_ID, thesis)`. At most one new call per cycle. Every signed leg is simulated first.
- **Hook into the scaffold:** in `app/agent/src/unifiedMain.ts`, the line `const runWork = buildRunWork();` becomes `const runWork = withLatestCallFace(buildRunWork()); startAnalystLoop();`. The FREE x402 route (price 0, so no payment is taken) and A2A therefore answer a prompt starting with `latest` with JSON `{ callId, token, ticker, status, thesis, bscscan, feed }`; other prompts fall through to the scaffold's LLM work.
- **Identity:** `bag erc8004 register --endpoint https://<host>/agent` from the agent wallet (human-gated); the resulting id is `ANALYST_AGENT_ID`. Integrity comes from the registry's feedback (§5.3).
- **Runtime:** the Studio app runs under `tsx` in its own container on the VPS; the keystore and `WALLET_PASSWORD` are mounted from the host's `.studio/` directory (never baked into images or committed).

## 9. Subsystem E — launch, demo and documentation

- **Human-gated manifest tasks** (paused for the user; executors never run them): deploy `CallRegistry` and verify on BscScan; list the 675 tokens; scaffold the Studio workspace; register the analyst on ERC-8004; provision the VPS and `docker compose up`; smoke checks S1–S5; the timed money-shot rehearsal.
- **Campaign gates for the concierge (outside the manifest):** Binance Web3 API key (Trading, Market, Wallet, Transaction) plus the registration form; burner wallets for deployer, caller and keeper funded with a few USDT plus BNB; the analyst wallet funded with USDT, U and BNB; Agentic Wallet sign-in; DNS (an `sslip.io` name works); the repo-public flip and the form submission.
- **Smoke checks:** S1 signed `GET /rwa/tokens?binanceChainId=56` from the VPS returns `code 0`; S2 Market `trades` with `walletAddressFilter` shows a fresh NVDAB swap (record the lag); S3 Address Portfolio `dex-history` / `token/latest-pnl` coverage for that swap; S4 one `baw` buy-and-sell round trip of a few cents of NVDAB (record latency); S5 the analyst posts and closes a test call and `ReputationRegistry.readFeedback(agentId, registry, 1)` returns `100`.
- **Demo scripts (`scripts/demo`, `@pop/demo`):** `pop-demo caller post --token NVDAB --amount 0.02 --note "…"`, `pop-demo caller sell --token NVDAB --all`, `pop-demo caller try-gate --token TSLAB --amount 0.01 [--broadcast]`, `pop-demo status`. They use `CALLER_PK` (env) and the Trading + Transaction APIs (simulate → sign → broadcast with MEV protection). Unit-tested with fakes; run only in gated tasks.
- **Deploy files:** `deploy/docker-compose.yml` (services `caddy`, `server`, `analyst`), `deploy/Caddyfile` (`/` → static web, `/api/*` → server, `/agent/*` → analyst), Dockerfiles for server and web build, env templates listing variable names only.
- **README:** schema `R1-web-app v1` (§2 D11), written late in the DAG; deployed addresses, the live link, the video URL and the public repo URL ride as `TBD-post-build:` lines until the closing pass.
- **`DEVEX_LOG.md`:** created on day 1 with sections mirroring the DX form (onboarding, documentation issues, API pitfalls, latency, rate limits, signing, data trust, AI stack, tokenized-stock specifics, redesign ideas, requested capabilities). Smoke tasks append exact URLs, endpoints, error strings, latencies and slippage. The human writes the final report.
- **Pre-public cleanup:** delete the two pack files named in D8 and mark their entries in the pack `INDEX.md` as removed before publication.
- **Submission draft:** `docs/gates/submission-draft.md` pre-answers every form field.

## 10. Money-shot data flow ("The caller sold. The badge knew first.")

| t | Actor | Action | Visible result |
|---|---|---|---|
| setup | caller (demo script) | `post(NVDAB, 0.02e18, "…")` | Card: "LONG NVIDIA · 0.02 shares · bStocks · HOLDING ✓" |
| setup | follower | sees the HOLDING call, `baw` buys 1 USDT of NVDAB, `FINISHED` | Terminal: "Mirrored call #k: you hold 0.011 NVIDIA alongside them" |
| setup | analyst | own NVDAB call posted earlier, HOLDING | Second card green, "AGENT #id · integrity 100" |
| 0 s | caller | `pop-demo caller sell --token NVDAB --all` (simulate → broadcast, MEV on) | Sell tx mined (BSC block 0.45 s) |
| ≤ 1.5 s | browser | next `getCalls` read shows EXITED | Badge flips red with animation; alert toast |
| ≤ 2 s | keeper | `recordExit(k)` mined | "Exit recorded on-chain · block N" (permanent) |
| ≤ 3 s | server | exit evidence (logs first, Market `trades` when indexed) | "EXITED · sold 0.02 NVIDIA · tx 0x…" |
| ≤ 2 s / ≤ 15 s | follower | `SELL` submitted / `FINISHED` | Terminal: "Caller exited — sold 0.011 NVIDIA in N s" |
| after | caller | `pop-demo caller try-gate --token TSLAB --amount 0.01 --broadcast` | `simulate` → "No position, no call."; BscScan shows the failed tx with that reason |

Timing targets are logged to `DEVEX_LOG.md` during the rehearsal.

## 11. Error handling

| Failure | Behavior |
|---|---|
| W3W `40304` (region/compliance) | Server returns `502 { error: { code: 40304, msg } }`; web shows the exact message; badges unaffected. Day-1 smoke S1 gates the VPS choice. |
| W3W `40102`/`40103` (signature/timestamp) | Logged with the endpoint; signer unit tests pin the format; timestamps are ISO with milliseconds from the injected clock. |
| HTTP 429 | Client retries per `Retry-After` up to 2 times, then surfaces `W3wApiError` with `code 42900`. |
| `40369` (bStock RFQ closed), `40374` (no liquidity), `NO_SWAP_ROUTE` | Follow disabled with the reason; the analyst skips that token this cycle. |
| `simulate` status ≠ `SUCCESS` | Never sign; show `failReason` verbatim (web, scripts, analyst, keeper). |
| RPC failure | viem `fallback` across the configured list; the web shows "chain unreachable, retrying" after 3 failed polls. |
| Agentic Wallet signed out / LOCKED / FAILED | Follower stops / waits / retries once, always logging the CLI's error verbatim. |
| Pieverse or CoinMarketCap failure | Analyst uses the templated thesis / RWA-only research; the call still posts if the buy succeeded. |
| ReputationRegistry revert | `FeedbackFailed` event; `close`/`recordExit` still succeed. |

## 12. Security and safety

- **Keys:** never in files, plans, prompts, logs or commits. Env var names only (`DEPLOYER_PK`, `CALLER_PK`, `KEEPER_PK`, `W3W_API_KEY`, `W3W_API_SECRET`, `WALLET_PASSWORD`, `PIEVERSE_LLM_API_KEY`). All signing wallets are burners funded with a few dollars. `.env*`, `.studio/`, `deployments/*.secret*` are git-ignored.
- **Human gates:** every deploy, key operation and fund movement is a `human_gate: true` manifest task or a concierge gate; executors never broadcast.
- **Contract:** immutable, no custody, owner limited to the token list; external calls are views except the capped, try/caught `giveFeedback` made after state updates.
- **Compliance:** visible disclaimers (no investment advice; badge ≠ net exposure); restricted-persons confirmation before Follow; the API-calling server is hosted outside restricted regions.
- **Agent safety:** follower acts only on registry status within budgets; analyst caps spend per call, per cycle and per day (Studio budget), and signs only simulated transactions.

## 13. Testing strategy

| Layer | Tooling | Gate style |
|---|---|---|
| Contract | Foundry unit, fuzz (256 runs) and invariant (64 runs × depth 32) tests with ABI-faithful mocks | `node contracts/run-forge.mjs test --match-contract <Suite>` → `0 failed` |
| Core / server / follower / demo / analyst modules | Vitest 3.2 with injected fakes (fetch, clock, public client, `baw` runner, signer) and recorded fixtures shaped exactly like §3 | `pnpm --filter <pkg> exec vitest run <file>` → `Test Files  1 passed (1)` |
| Web | Vitest + jsdom + Testing Library for components; pure functions for diffing and formatting | same |
| Typecheck | `tsc --noEmit` per package (strict) | inside the package's typecheck task |
| Mainnet | Human-gated smoke tasks S1–S5 and the rehearsal, with evidence appended to `DEVEX_LOG.md` | checklists run by the user / concierge |

## 14. Configuration (names only)

| Variable | Used by | Purpose |
|---|---|---|
| `W3W_API_KEY`, `W3W_API_SECRET` | server, demo, analyst, smoke | Binance Web3 API credentials |
| `BSC_RPC_URLS` | server, follower, demo, analyst | comma-separated RPC list (default: official dataseed endpoints) |
| `BSC_LOGS_RPC_URL` | server | `eth_getLogs`-capable RPC (default `https://bsc-rpc.publicnode.com`) |
| `REGISTRY_ADDRESS` | all off-chain parts | deployed `CallRegistry` |
| `KEEPER_PK` | server (optional) | burner key for `recordExit` |
| `DEPLOYER_PK`, `BSCSCAN_API_KEY` | contract scripts (gated) | deploy + verify |
| `CALLER_PK` | demo scripts (gated) | caller persona |
| `ANALYST_AGENT_ID`, `ANALYST_WATCHLIST`, `ANALYST_BUY_USDT`, `ANALYST_HOLD_HOURS`, `ANALYST_INTERVAL_MIN`, `ANALYST_ENABLED` | analyst | agent behavior |
| `BNBAGENT_PUBLIC_URL`, `WALLET_PASSWORD`, `PIEVERSE_LLM_API_KEY` | analyst (Studio) | Studio runtime |
| `POP_FOLLOWER_STATE` | follower | state file path |
| `DEVEX_TELEMETRY_FILE` | server, follower, demo, analyst | JSONL telemetry path |
| `PORT`, `CORS_ORIGINS` | server | listen port (default 8787) and allowed origins (default `*`) |
| `VITE_REGISTRY_ADDRESS`, `VITE_RPC_URLS`, `VITE_API_BASE` | web build | build-time config |
| `PUBLIC_HOST` | Caddy | site address (e.g., `<ip-dashed>.sslip.io`) |

## 15. Stack requirements (for the orchestrator's boot probe)

| Tool | Version assumed | Probe | Result on 2026-10-06 | Fix hint |
|---|---|---|---|---|
| Node.js | ≥ 22.12 | `node --version` | v24.19.0 PASS | install Node LTS |
| pnpm | 10.x | `pnpm --version` | 10.34.6 PASS | `npm i -g pnpm@10` |
| Foundry | ≥ 1.8 | `forge --version` | 1.8.5 PASS | `foundryup` |
| git + gh | any recent | `git --version`, `gh auth status` | PASS | — |
| `baw` (Agentic Wallet CLI) | 1.10.0 | `baw --version` | not installed (needed only for follower smoke/rehearsal, gated) | `npm i -g @binance/agentic-wallet@1.10.0` |
| `bag` (Agent Studio CLI) | 0.0.14 | `bag --version` | not installed (needed only for the gated scaffold/registration) | `npm i -g @bnbagent/studio-cli@0.0.14` |
| Bun | — | — | not required (no `bag deploy`) | — |

Note: the desktop app session that ran this architect step started before the toolchain was installed; the build session must start from a fresh app launch so the new PATH is inherited.

## 16. Priorities, timeline and cut-lines

| Priority | Scope | Target (UTC) |
|---|---|---|
| P0 | contracts; core; feed badges + post dry-run; demo scripts; contract deploy + token listing; VPS + S1 | Wed 7 Oct, end of day |
| P1 | follower agent + Wallet Skill; exit evidence; follow modal; keeper; alerts; S2–S4 | Thu 8 Oct |
| P2 | analyst agent (Studio) + ERC-8004 + reputation display + A2A/x402 face; S5; rehearsal | Fri 9 Oct |
| — | README, demo video (demo-studio), DevEx report (human), buffer | Sat 10 Oct |
| — | Submission (concierge closing pass), repo freeze | before Sun 11 Oct 12:00 UTC |

Cut order if time runs short: A2A/x402 face → reputation display → keeper (the badge still flips live; `recordExit` stays callable from the demo script) → follow modal (follower agent still demonstrates following). Never cut: the contract gate, live badges, the follower's exit, the analyst's buy-before-post call.

## 17. Out of scope

Short calls; PnL leaderboards; custody, vaults, escrow or locking of stocks; x402 selling, paying with shares or sweeping revenue into stocks; X/Twitter API, browser extension, mobile app, Telegram bot (stretch only); ZK/private proofs; xStocks and Ondo follow execution (verify-only); strategy engines beyond the one demo analyst; net-exposure claims; any chain but BSC mainnet; creator fees on follows (`feePercent`, stretch only).

## 18. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `40304` from the VPS | Day-1 smoke S1 before any server work depends on it; badges never depend on the API. |
| Agentic Wallet session expiry (~48 h) | `pop-follower check` reports `sessionExpireTime`; sign in again right before the rehearsal; judge path never needs AW. |
| Studio scaffold differs from the 0.0.14 templates | CLI pinned to 0.0.14; the hook edit targets one exact line; a mismatch returns BLOCKED instead of a guess. |
| Pieverse paid model unavailable | Templated thesis fallback; the cycle still buys and posts. |
| bStock RFQ closed outside US hours (`40369`) | Follows and analyst buys use SWAP routes only (LiquidMesh / AMM, 24/7). |
| xStocks `sharesOf` assumption on tokens other than AAPLx | Resolved during planning: the live probe (2026-10-07) shows all 128 rebasing xStocks answer `sharesOf`; the 2 wrapped xStocks do not and are listed as PLAIN. The probe re-runs right before listing. |
| Market `trades` lag | Exit evidence falls back to `Transfer` logs from the logs RPC. |
| Public RPC rate limits (10K / 5 min) | One `getCalls` per new block per client, 1 s polling, fallback list. |

## 19. Facts deferred to build time

`TBD-post-build:` registry address, deploy tx, analyst agent id, live URL, demo video URL, public repo URL, smoke-check measurements. These resolve in the human-gated tasks and the concierge closing pass; nothing else in this spec is deferred.
