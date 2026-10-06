# Sponsor: BNB Chain

BNB Chain is the organizer and co-funder of the main track, and funds the **Best Use of BNB Agent
Studio** special. The execution venue is BSC mainnet: PancakeSwap and tokenized-equity liquidity.
Fetched 2026-10-05.

**Provenance tags:**
- **[AS]** https://www.bnbchain.org/en/bnb-agent-studio. The lead fetched it and verified the quoted strings.
- **[DOCS]** docs.bnbchain.org Agent Studio / BNB Agent SDK pages. The sub-agent read them via the `bnb-chain/bnb-chain.github.io` repo.
- **[GH]** GitHub repos named inline.
- **[RPC]** on-chain checks by the lead.
- **[NPM]** the npm registry, checked by the lead.
- *(sub-agent)* marks facts the lead did not re-read.

## 1. What they reward

- Special (verbatim [EP]): "**Best Use of BNB Agent Studio** | $2,000 | Deepest use of Agent Studio: agent identity, autonomous runtime, self-funding via x402. Funded by BNB Chain."
- [BLOG] "BNB Agent Studio gives your agent an identity, an autonomous runtime and self-funding via x402, which is what turns a script into something that stays alive without you babysitting it."
- The [DX] form asks how Agent Studio held up across "One-prompt deployment, wallet provisioning, ERC-8004 identity, ERC-8183 task interface, managed runtime, x402 self-funding, MCP registration into Cursor or Claude Code".
- Main-track venue (verbatim [EP] Stack): "**BNB Chain** | Execution venue: PancakeSwap and BSC tokenized-equity liquidity."

## 2. BNB Agent Studio

| Item | Fact | Source |
|---|---|---|
| What | "BNB Agent Studio is a developer tool from BNB Chain that brings a wallet, an LLM, on-chain agent identity (ERC-8004), a task interface (ERC-8183), and a cloud runtime together in one toolkit." | [AS] (lead-verified) |
| MCP claim | The CLI "auto-registers Studio's MCP server into your vibe coding tools (Cursor, Claude Code, or any MCP-compatible client), so you can create and deploy an on-chain agent using natural language right inside the editor." | [AS] (lead-verified) |
| Install | `npm install -g @bnbagent/studio-cli`, then `bag skills install` (scripted: `bag skills install --target both --scope user`) | [AS] (lead-verified first two), [DOCS] *(sub-agent)* |
| Package | `@bnbagent/studio-cli` **0.0.14**, Apache-2.0, modified 2026-09-20 | [NPM] |
| Requirements | Node.js ≥22, Corepack + pnpm 10, Bun 1.3+ (deploys), Docker only for container paths | [DOCS] *(sub-agent)* |
| Build prompt example | `/bnbagent-studio Create a BNB Chain seller agent named weatheragent. Start on BSC testnet, explain the available choices, then build and run it.` | [DOCS] *(sub-agent)* |
| Local run | `bag doctor` → `bag dev`. A2A on `:9000`, MCP at `http://localhost:8000/mcp`, x402 at `/x402` | [DOCS] *(sub-agent)* |
| Deploy | `bag deploy prepare` → `bag deploy --provider bnb|aws|azure|nodeops` → `bag deploy verify --provider …`. Verify "registers or updates the ERC-8004 endpoint". Manual: `bag erc8004 register --endpoint <url>` | [DOCS] *(sub-agent)* |
| Managed trial | **"Run free for 48 hours on BNB Chain's managed testnet sandbox. Testnet-only, and the clock starts on your first successful deploy."** | [AS] (lead-verified) |
| Prize-page perk | "Agent Studio runtime credits for the event window … (depending the hosting you choose, between 72 and 24h, only on testnet)" | [EP] |
| Mainnet | `[network].default` can be `bsc-mainnet`. "The managed BNB trial is always testnet." The self-paid hosts (`aws`, `azure`, `nodeops`) are not described as testnet-only. The `envvars` secrets mode is "testnet only — refused on mainnet". | [DOCS] *(sub-agent)* |
| MCP server | `bag mcp serve` exposes about 15 **read-only** tools (wallet info/balance, tx status, contract view, `agent_info`, `job_status`/`job_list`/`job_count`, …). It "never signs" and needs `WALLET_PASSWORD` in env | [DOCS] *(sub-agent)* |
| Claude Code plugin | `/plugin marketplace add bnb-chain/bnbchain-skills` then `/plugin install bnbagent-studio@bnbchain-skills`. Alt: `npx skills add bnb-chain/bnbchain-skills --skill bnbagent-studio` | [GH bnb-chain/bnbchain-skills] *(sub-agent)* |
| Wallets | `evm-local` (default; encrypted keystore in `.studio/wallets/`, `WALLET_PASSWORD` in `.studio/.env.local`), `twak` (Trust Wallet Agent Kit, Docker), `altana` (bounded session), Turnkey (SDK/blog). On the managed `bnb` trial "signing material leaves your control". Use a throwaway wallet | [DOCS] *(sub-agent)* |
| Signing policy | Fixed code (`app/agent/src/signing.ts`), never an LLM tool. The default policy allows EIP-3009 and denies ERC-2612 Permit / Permit2 by default | [DOCS] *(sub-agent)* |
| Self-funding | `bag budget enable` auto-refills (threshold, refill amount, daily cap). Security docs: needs a "Funded mainnet wallet balance for auto-renew flows" | [DOCS] *(sub-agent)* |
| x402 selling | A positive `price_usd` returns a payment challenge and settles through **B402 (Binance Pay as facilitator)** before work. "Payment settles before work, so a later work failure has no automatic refund." | [DOCS] *(sub-agent)* |
| Maturity | The docs say "Under active development". Studio "may introduce breaking changes. Start on BSC testnet". Roadmap: MVP live 08 Jun 2026; next milestone "Late Oct, 2026" | [DOCS], [AS] *(sub-agent)* |

**Repos and packages** *(sub-agent; dates are last push)*:
- `bnb-chain/bnbagent-sdk` (MIT, 2026-09-24). npm `@bnbagent/sdk` 0.6.0. PyPI `bnbagent`.
- `bnb-chain/bnbchain-skills` (MIT, 2026-09-20).
- `bnb-chain/apex-contracts` (MIT, 2026-09-17).
- `bnb-chain/erc-8004-contracts` (2026-03-17).
- `bnb-chain/stockanalyst-agent-demo` (2026-09-14): an x402 seller on BSC mainnet plus ERC-8183, relevant prior art.
- `bnb-chain/bnbagent-studio` → **404** (studio source not public).

## 3. ERC-8004 identity and ERC-8183 (APEX) on BSC: addresses verified

Every address below is copied from the repo README named. The lead confirmed each has bytecode
via `eth_getCode` [RPC]: mainnet via `bsc-dataseed.bnbchain.org`, testnet via
`data-seed-prebsc-1-s1.bnbchain.org:8545`.

| Contract | BSC mainnet (56) | BSC testnet (97) | Source |
|---|---|---|---|
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `bnb-chain/erc-8004-contracts` README ("BSC Mainnet" / "BSC Testnet") |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | same |
| ERC-8004 ValidationRegistry | NOT FOUND | NOT FOUND | none |
| APEX `AgenticCommerceUpgradeable` (ERC-8183) | `0xEa4DAa3100A767e86FDed867729ae7446476EBA6` | `0xa206c0517B6371C6638CD9e4a42Cc9f02A33B0DE` | `bnb-chain/apex-contracts` README |
| APEX `EvaluatorRouterUpgradeable` | `0x51895229E12F9876011789B04f8698af06cCD6DA` | `0xd7d36d66d2f1b608a0f943f722d27e3744f66f25` | same |
| APEX `OptimisticPolicy` | `0x9C01845705b3078Aa2e8cfF7520a6376FD766dE5` | README `0x4f4678d4439fec812ac7674bb3efb4c8f5fb78a6` **vs** SDK `addresses.py` `0xd6a4217588f6b1f5657a92a3e94e6422ad771cea`. **Both have code: unresolved** | README vs `bnbagent-sdk` *(sub-agent for SDK)* |
| APEX payment token | U `0xcE24439F2D9C6a2289F741120FE202248B666666` | testnet USDC per README `0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565` | README. [RPC]: mainnet `paymentToken()` returns U |

**Live interface checks [RPC]:** IdentityRegistry `name()` → `"AgentIdentity"`, `symbol()` →
`"AGENT"`, `getAgentWallet(1)` → `0x89E9E1ab11dD1B138b1dcE6d6A4a0926aaFD5029` (an EOA, so it has no code).

**Signatures** *(sub-agent, from the EIP texts and the SDK ABIs). Diff against the deployed ABI before coding:*
- ERC-8004 Identity:
  - `register(string agentURI)`
  - `register(string agentURI, MetadataEntry[] metadata)`
  - `setAgentURI(uint256 agentId, string newURI)`
  - `setMetadata(uint256 agentId, string metadataKey, bytes metadataValue)`
  - `getMetadata(uint256,string) returns (bytes)`
  - `setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)`
  - `getAgentWallet(uint256)`
  - Event `Registered(uint256 agentId, string agentURI, address owner)`
- ERC-8004 Reputation:
  - `giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)`
  - `getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)`
- ERC-8183 (deployed ABI):
  - `createJob(address provider, address evaluator, uint256 expiredAt, string description, address hook) returns (uint256)`
  - `setBudget(uint256 jobId, uint256 amount, bytes optParams)`
  - `fund(uint256 jobId, uint256 expectedBudget, bytes optParams)`
  - `submit(uint256 jobId, bytes32 deliverable, bytes optParams)`
  - `complete(uint256 jobId, bytes32 reason, bytes optParams)`
  - `reject(uint256 jobId, bytes32 reason, bytes optParams)`
  - `claimRefund(uint256 jobId)`
- Both EIPs are **Draft**. ERC-8183 was created 2026-02-25.
- Registration is gas-sponsored via the MegaFuel paymaster: testnet `https://bsc-megafuel-testnet.nodereal.io`, mainnet `https://bsc-megafuel.nodereal.io/` *(sub-agent)*.

## 4. BSC developer basics

| Item | Value | Source |
|---|---|---|
| Chain IDs | mainnet **56** (`0x38`), testnet **97** (`0x61`). The lead confirmed both via `eth_chainId` | [RPC] |
| Public RPC (official) | `https://bsc-dataseed.bnbchain.org` (used for every lead check). Docs: "10K/5min" rate limit; `eth_getLogs` disabled on official mainnet endpoints | [RPC], [DOCS] *(sub-agent)* |
| Explorers | BscScan `https://bscscan.com` (403 to curl), BscTrace `https://bsctrace.com` (linked from [EP]) | [EP], *(sub-agent)* |
| Gas | BNB. Swaps need BNB for gas. b402/x402 payments are gasless (EIP-3009 / Permit2 signatures) | [W3D], [DOCS] |
| BNB Chain MCP | `npx -y @bnb-chain/mcp@latest`, npm **1.5.1** (modified 2026-04-17). Optional env `PRIVATE_KEY`. Covers ERC-8004 register/resolve | [NPM], [GH bnb-chain/bnbchain-mcp] *(sub-agent)* |
| Dev tools | https://www.bnbchain.org/en/dev-tools · docs https://docs.bnbchain.org | [EP Resources] |

## 5. PancakeSwap: the named execution venue (BSC mainnet)

Addresses are from PancakeSwap's developer docs and its official `infinity-*` repo configs *(sub-agent)*.
The lead confirmed bytecode for every address marked ✓ [RPC].

| Contract | Address | ✓ |
|---|---|---|
| Smart Router (v2 + v3 + stable) | `0x13f4EA83D0bd40E75C8222255bc855a974568Dd4` | ✓ 24,316 B |
| V3 SwapRouter | `0x1b81D678ffb9C0263b24A97847620C99d213eB14` | ✓ 12,154 B |
| V3 QuoterV2 | `0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997` | ✓ 8,331 B |
| V2 Router | `0x10ED43C718714eb63d5aA57B78B54704E256024E` | ✓ 21,936 B |
| v3 Universal Router | `0x1A0A18AC4BECDDbd6389559687d1A73d8927E416` | ✓ 16,684 B |
| Infinity Universal Router | `0xd9C500DfF816a1Da21A48A732d3498Bf09dc9AEB` | ✓ 24,350 B |
| **PancakeSwap Permit2** | `0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768` (≠ Uniswap canonical `0x0000…8BA3`) | ✓ 7,020 B |
| V3 Factory / V2 Factory / WBNB | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` / `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` / `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` | not checked |
| Infinity CLPoolManager / BinPoolManager / Vault | `0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b` / `0xC697d2898e0D09264376196696c51D7aBbbAA4a9` / `0x238a358808379702088667322f80aC48bAd5e6c4` | not checked |

- Tokenized stocks on PancakeSwap: a "Tokenized Stocks Terminal" at `https://pancakeswap.finance/stocks`. Blog posts: `blog.pancakeswap.finance/articles/bstocks-on-pancakeswap` and `/mid-year-recap-2026` *(sub-agent)*.
- The PancakeSwap Aggregator API does not list BSC (Ethereum, Base, Arc only) *(sub-agent)*. Use the Binance Trading API for aggregation on BSC.
- **Liquidity snapshot (lead re-check, GeckoTerminal API, 2026-10-05):**
  - NVDAB/USDT 0.25% PancakeSwap v3 `0x8fb4243b553ac29ba088acf00b9b7da24bd6690c` reserve ≈ **$4.38M**, 24h vol ≈ **$8.25M**.
  - NVDAon AMM pools ≈ $0.1M / $14K with 0 volume (Ondo trades via RFQ).
  - NVDAx: one Uniswap v4 pool ≈ **$474**.
  - See `tokenized-stock-issuers.md`.

## 6. Other BNB Chain programs running now (context)

- **The Smart Money Era: Set and Earn**: `smart-money-era-set-and-earn`, 2026-10-01 → 2026-11-05, prize pool 10000, status Ongoing. It counts ERC-8004 agents on chain 56/97 *(sub-agent)*. **INFERENCE:** an Agent Studio agent built here may also be eligible there. Check the rules before relying on it.
- The **bStock AI PnL Trading Competition** (Aug 17 – Sep 1, 2026) used the Agent Studio x402 service `https://stock-agent.bnbchain.org` (`GET /x402/price`, `POST /x402/analyze/async`, `GET /x402/jobs/{jobId}`) *(sub-agent)*. It is prior art for paid agent-to-agent analysis.

## 7. Gotchas

1. **Testnet credits vs mainnet track.** The free managed runtime is testnet-only: 48h per [AS], "72 and 24h" per [EP]. The main track is "BSC mainnet only". Plan mainnet hosting on `aws`/`azure`/`nodeops`, or keep the Studio agent as the special-prize component and run trading elsewhere. Ask in Telegram (event.md C5).
2. On the managed trial, "signing material leaves your control". Never reuse that wallet on mainnet *(sub-agent)*.
3. x402 sellers settle **before** work, with no automatic refund on failure *(sub-agent)*.
4. The default signing policy **denies Permit2**, and USDC/USDT b402 payments need Permit2. U and USD1 (EIP-3009) avoid this *(sub-agent; consistent with [W3D] b402 methods)*.
5. Two Permit2 contracts exist on BSC: Uniswap canonical (used by b402) and PancakeSwap's own. Don't mix their allowances.
6. The APEX testnet `OptimisticPolicy` address conflicts between README and SDK (both deployed).
7. Studio and the EIPs are pre-1.0 / Draft. Pin versions (`@bnbagent/studio-cli@0.0.14`).
