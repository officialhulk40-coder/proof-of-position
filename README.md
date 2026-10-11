<!-- readme-schema: R1-web-app v1 -->
# Proof of Position

Stock calls you can't post unless you hold the tokenized stock. The badge is read on-chain, flips when the caller sells, and followers' agents exit with them.

## Demo

- Demo video (under 4 minutes): TBD-post-build:demo-video-url
- Live feed: https://proof-of-position.tail5830cd.ts.net
- Screenshot: TBD-post-build:feed-screenshot

No wallet needed: open the live feed and press **Try the gate**. It dry-runs a LONG TESLA call from an address that holds no TSLAB, and you see the contract's real revert reason: "No position, no call."

## What it does

Stock tips are everywhere, and nobody can tell whether the person shouting "buy NVIDIA" owns it or is selling into your buying. Proof of Position makes holding the price of speaking. A call is a transaction to our `CallRegistry` contract on BSC mainnet, and it only goes through if the caller's wallet holds the tokenized stock at that moment. Every call's badge (HOLDING, TRIMMED, EXITED, CLOSED) is the contract's own reading of the caller's live balance, so it flips the moment they sell, and anyone can make that exit permanent on-chain. Followers can buy alongside a caller from their own wallet. They can also run an agent on a Binance Agentic Wallet that buys with the caller and sells the moment the badge flips. An analyst agent built with BNB Agent Studio posts its own calls as an ERC-8004 identity and earns an integrity score that the registry writes itself.

## Quickstart

The feed reads badges straight from BSC mainnet, so the money shot runs locally without keys. You need Node ≥ 22.12 and pnpm 10.

~~~bash
git clone https://github.com/officialhulk40-coder/proof-of-position
cd proof-of-position
pnpm install
~~~

Create `apps/web/.env.local` containing one line, `VITE_REGISTRY_ADDRESS=` followed by the CallRegistry address from [Contract addresses](#contract-addresses). Then:

~~~bash
pnpm --filter @pop/web run dev
~~~

Open http://localhost:5173. Badges update on every BSC block, and **Try the gate** works even without the API server: it falls back to a plain `eth_call` against public RPC.

## Built at BNB Hack: Tokenized Stocks Edition

- **Event:** BNB Hack: Tokenized Stocks Edition (BNB Chain and Binance Web3). Submissions lock Sun 11 Oct 2026, 12:00 UTC.
- **Tracks:** Main track (Tokenized Stocks Products & Agents) · Best Use of Agentic Wallet / Wallet Skills · Best Use of BNB Agent Studio.
- **Team:** one builder plus an AI build pipeline (architect, executor subagents, reviewer).
- **Built during the event** (work started 6 Oct 2026): the `CallRegistry` contract, the shared TypeScript core, the API server and its keeper, the React feed, the follower agent and its Wallet Skill, the Agent Studio analyst, the demo scripts and the deployment.

## How it works

1. **Hold first.** `post(token, amount, note)` checks the caller's balance in the same transaction. If the balance is short, it reverts with "No position, no call.", the contract's only revert string. All 675 BSC tokenized stocks are listed: bStocks and Ondo are measured by `balanceOf`, and rebasing xStocks by non-rebasing `sharesOf`, so a dividend or a split can't flip a badge.
2. **A live badge.** Every browser re-reads the newest calls with one `getCalls` per BSC block (about 0.45 s) from public RPC, with no server in the path. HOLDING means the balance is at or above the declared amount, TRIMMED means below it, EXITED means zero. CLOSED marks a call the caller ended, either "held through" or "exited while open".
3. **Sticky exits.** `recordExit(callId)` is open to anyone. Our keeper sends it within a couple of blocks of a sale, and a buy-back can't erase it.
4. **Exit evidence.** The server finds the transaction where the tokens left: Binance Market API trades for the caller's wallet first, `Transfer` logs otherwise. The card says whether it was a sale.
5. **Agents.** `pop-follower` mirrors chosen callers on a Binance Agentic Wallet within a budget and sells when their badge flips; it ships as a Wallet Skill (`skills/pop-follower`). The analyst (Agent Studio) researches a bStock with RWA Data, the Market API and CoinMarketCap paid over x402, writes a thesis with a Pieverse model, buys, posts as its ERC-8004 identity, and closes after its hold period. The registry scores each of its calls in the ERC-8004 ReputationRegistry: 100 if held through, 50 if trimmed, 0 if exited.
6. **Every signed transaction is simulated first** with the Binance Transaction API, and a failed simulation is never signed.

Binance Web3 API modules used: RWA Data (`rwa/tokens`), Market (`trades`, `token/top-liquidity`), Trading (`quote`, `swap`, `approve-transaction`), Transaction (`simulate`, `broadcast-transaction`), Wallet (`token-balances-by-address`), plus Agentic Wallet (`baw`) and BNB Agent Studio.

## Tech stack

- **Contracts:** Solidity 0.8.28, Foundry 1.8.5, forge-std 1.16.0
- **Off-chain:** TypeScript (strict, ESM) on Node ≥ 22.12, pnpm 10 workspaces, viem 2, zod 3
- **Feed and API:** React 19 + Vite 7; Hono 4 on Node
- **Agents:** Binance Agentic Wallet CLI (`baw` 1.10.0) and a Wallet Skill; BNB Agent Studio 0.0.14 (`@bnbagent/studio-runtime`, BNB Agent SDK 0.6.0), Pieverse LLM, x402 (CoinMarketCap)
- **Standards:** ERC-8004 v2.0.0 Identity and Reputation registries on BSC mainnet
- **Hosting:** Docker Compose and Caddy on a Singapore VPS

## Run locally

~~~bash
pnpm install
pnpm -r test
~~~

| Part | Command |
|---|---|
| Contracts (tests) | `node contracts/run-forge.mjs test` |
| API server and keeper | `pnpm --filter @pop/server start` |
| Feed (proxies `/api` to port 8787) | `pnpm --filter @pop/web run dev` |
| Follower agent | `pnpm --filter @pop/follower run cli check` |
| Demo personas and smoke checks | `pnpm --filter @pop/demo run demo --help` |
| Analyst (after the Studio setup in `agents/popanalyst`) | `pnpm --dir agents/popanalyst/app/agent start` |

Environment variables (names and purposes only; never commit values):

| Variable | Used by | Purpose |
|---|---|---|
| `REGISTRY_ADDRESS` | server, follower, demo, analyst | the deployed CallRegistry |
| `BSC_RPC_URLS` | all off-chain parts | comma-separated BSC RPC list |
| `BSC_LOGS_RPC_URL` | server | an `eth_getLogs`-capable RPC for exit evidence |
| `W3W_API_KEY`, `W3W_API_SECRET` | server, demo, analyst | Binance Web3 API credentials |
| `KEEPER_PK` | server (optional) | burner key for `recordExit` |
| `PORT`, `CORS_ORIGINS` | server | listen port and allowed origins |
| `CALLER_PK` | demo | the caller persona's burner key |
| `DEPLOYER_PK`, `BSCSCAN_API_KEY` | contract scripts | deploy and verify |
| `POP_FOLLOWER_STATE` | follower | state file path |
| `ANALYST_ENABLED`, `ANALYST_AGENT_ID`, `ANALYST_WATCHLIST`, `ANALYST_BUY_USDT`, `ANALYST_HOLD_HOURS`, `ANALYST_INTERVAL_MIN` | analyst | agent behaviour |
| `BNBAGENT_PUBLIC_URL`, `POP_FEED_URL` | analyst, demo | public URLs of the agent and the feed |
| `WALLET_PASSWORD`, `PIEVERSE_LLM_API_KEY` | analyst (Studio) | keystore unlock and LLM key, kept in `agents/popanalyst/.studio/.env.local` |
| `DEVEX_TELEMETRY_FILE` | server, follower, demo, analyst | JSONL timing log |
| `VITE_REGISTRY_ADDRESS`, `VITE_RPC_URLS`, `VITE_API_BASE` | web build | build-time config |

Deployment: `docker compose -f deploy/docker-compose.yml up -d --build` (see `deploy/`).

## Contract addresses

| Network | Contract | Address |
|---|---|---|
| BSC mainnet (56) | ERC-8004 IdentityRegistry | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://bscscan.com/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| BSC mainnet (56) | ERC-8004 ReputationRegistry | [`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`](https://bscscan.com/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) |

Our deployment on BSC mainnet (56):

- CallRegistry: TBD-post-build:call-registry-address
- CallRegistry deploy transaction: TBD-post-build:call-registry-deploy-tx
- Analyst ERC-8004 agent id: TBD-post-build:analyst-erc8004-agent-id

## Roadmap

- **Known limits:** calls are long-only and spot-only. A badge proves the BSC position, not hedges held elsewhere. Follows execute on bStocks only (Ondo trades by RFQ, and xStocks have thin BSC liquidity). The keeper is ours, but `recordExit` is permissionless, so anyone can do its job.
- **Next:** share-card links for X and Telegram, a Telegram alert bot, more analyst strategies with public integrity histories, and follower position sizing proportional to the caller's.

## License

MIT, see [LICENSE](LICENSE). Not investment advice. bStocks, Ondo and xStocks tokenized stocks are not available to US persons or other restricted persons.
