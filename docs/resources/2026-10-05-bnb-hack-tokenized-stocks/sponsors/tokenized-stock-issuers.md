# Tokenized-stock systems on BSC: bStocks · Ondo · xStocks

The main track requires "At least one of **bStocks**, **Ondo** or **xStocks**" to be central [EP]. This file
is the integration ground truth for all three. Fetched 2026-10-05.

**Provenance tags:**
- **[RPC]** the lead's own read-only on-chain checks on BSC mainnet (`cast` / `eth_call` via `bsc-dataseed.bnbchain.org`).
- **[BAPI]** Binance's public stock lists (see `binance-web3-wallet.md` §7).
- **[ONDO]** docs.ondo.finance.
- **[XS]** docs.xstocks.fi / api.xstocks.fi.
- **[BST]** bstocks.finance.
- **[W3D]** Binance Web3 docs.
- *(sub-agent)* marks issuer facts captured by a sub-agent that the lead did not re-read. All addresses and getters below are lead-verified.

## 1. How to tell them apart on BSC

| | bStocks | Ondo (Ondo Global Markets / "Ondo Stocks") | xStocks |
|---|---|---|---|
| Symbol suffix | `…B` (e.g. `AAPLB`) | `…on` (e.g. `AAPLon`) | `…x` (e.g. `AAPLx`) |
| Binance list `type` | `3` | `1` | `2` |
| RWA Data API `platformId` | `bstock` | `ondo` | **not covered** |
| Binance Trading API route | LiquidMesh **SWAP** + PcsXRfq **RFQ** (mixed) | **RFQ only** (InchFusion + CowSwap + PcsXRfq) | **AMM SWAP only** |
| Count on BSC: Binance list [BAPI] | 87 | 458 | 130 |
| Count on BSC: issuer registry | 68 in the (Aug) eligible list [W3D] | 459 in Ondo's `tokens.md` [ONDO] | **1,171** deployments in the xStocks API [XS] |
| Quote token | USDT pairs (Binance bStock whitelist, error 40370) | **USDT on BSC** (error 40368) | USDC (xStocks API lists USDC for all BSC deployments) |
| On-chain multiplier getter [RPC] | `uiMultiplier()` (1e18 = 1.0×) | separate `SyntheticSharesOracle` (token has no getter) | `getCurrentMultiplier()` (rebasing `balanceOf`) |
| Code size of token (proxy) [RPC] | 283 B | 824 B | 2,138 B |

"Ondo, xStock, and BStock token sets are mutually exclusive. A given token belongs to one type only." [W3D:introduction-4]

**Cross-source verification (lead):**
- **Ondo:** 457 of the 459 BSC addresses in Ondo's own registry match Binance's list exactly (symbol and system). Ondo's docs also list `SHVon` and `USDon`; Binance's list also has `USDY`.
- **xStocks:** all 128 xStocks the xStocks API and Binance share match. Binance's `wPOPMTx` and `wTCENTx` are not in the issuer API. The other ~1,043 issuer deployments are not in Binance's list (INFERENCE: no Binance Wallet routing or liquidity).
- **bStocks:** all 68 eligible-list addresses match Binance's live list, and `symbol()` matches on-chain for every one.

**38 tickers exist on all three systems on BSC:** `AAPL`, `ADBE`, `AMD`, `AMZN`, `ASML`, `ASTS`, `AVGO`, `BMNR`, `COIN`, `CRCL`, `CRM`, `CRWD`, `EWY`, `GME`, `GOOGL`, `GS`, `HIMS`, `HOOD`, `IBM`, `INTC`, `IREN`, `META`, `MRVL`, `MSFT`, `MSTR`, `MU`, `NFLX`, `NVDA`, `ORCL`, `PLTR`, `PYPL`, `QQQ`, `SOXL`, `SPCX`, `SPY`, `TQQQ`, `TSLA`, `TSM`

Full registry (675 rows: system, symbol, ticker, address, asset type, multiplier at fetch, verification flag):
[../data/bsc-tokenized-stocks-2026-10-05.csv](../data/bsc-tokenized-stocks-2026-10-05.csv).

## 2. Core tickers: BSC addresses verified on-chain

Every row: address from Binance's public list [BAPI], cross-checked against the issuer registry
([ONDO] `tokens.md` / [XS] API / [W3D] eligible list), and `symbol()`/`decimals()` read on-chain [RPC].
All tokens have **18 decimals**. "mult" = the list's `multiplier` at fetch (shares per token).

| Ticker | bStock (`…B`) | mult | Ondo (`…on`) | mult | xStocks (`…x`) | mult |
|---|---|---|---|---|---|---|
| AAPL | `AAPLB` `0x431a3bee82e2ca41e49895cbece5bb0f76a89b7a` | 1.000604 | `AAPLon` `0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4` | 1.003376 | `AAPLx` `0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a` | 1 |
| MSFT | `MSFTB` `0x80106cb3ead06659a5ad19df39d9b4733863b9b0` | 1.001314 | `MSFTon` `0x6bfe75d1ad432050ea973c3a3dcd88f02e2444c3` | 1.005731 | `MSFTx` `0x5621737f42dae558b81269fcb9e9e70c19aa6b35` | 1 |
| NVDA | `NVDAB` `0x02fca66c1d1afb4e2a7884261eb00f63598a7436` | 1.000778 | `NVDAon` `0xa9ee28c80f960b889dfbd1902055218cba016f75` | 1.001715 | `NVDAx` `0xc845b2894dbddd03858fd2d643b4ef725fe0849d` | 1 |
| GOOGL | `GOOGLB` `0x3f53de71c126bdabae20f9cd64848d317f6c3238` | 1.000478 | `GOOGLon` `0x091fc7778e6932d4009b087b191d1ee3bac5729a` | 1.00246 | `GOOGLx` `0xe92f673ca36c5e2efd2de7628f815f84807e803f` | 1 |
| AMZN | `AMZNB` `0x1a4b499833a79a09ad7cf1d42d7dacf71e92eb00` | 1 | `AMZNon` `0x4553cfe1c09f37f38b12dc509f676964e392f8fc` | 1 | `AMZNx` `0x3557ba345b01efa20a1bddc61f573bfd87195081` | 1 |
| META | `METAB` `0x7425889fe94f9d693e8daefe88bcced6acfef4c0` | 1.000548 | `METAon` `0xd7df5863a3e742f0c767768cdfcb63f09e0422f6` | 1.002827 | `METAx` `0x96702be57cd9777f835117a809c7124fe4ec989a` | 1 |
| TSLA | `TSLAB` `0x5b1910eaad6450e50f816082aa078c41f10c292f` | 1 | `TSLAon` `0x2494b603319d4d9f9715c9f4496d9e0364b59d93` | 1 | `TSLAx` `0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0` | 1 |
| SPY | `SPYB` `0x7138b48df7d98d7e3cc221bfe7192d0a178182d8` | 1.00173 | `SPYon` `0x6a708ead771238919d85930b5a0f10454e1c331a` | 1.009473 | `SPYx` `0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48` | 1 |
| QQQ | `QQQB` `0x205812cdbed920aff76c6580abd681a46d11efc7` | 1.000725 | `QQQon` `0x0cde6936d305d5b34667fc46425e852efd73559a` | 1.004082 | `QQQx` `0xa753a7395cae905cd615da0b82a53e0560f250af` | 1 |
| COIN | `COINB` `0x585bde7c54abb5ccd7791f923d6c2187635f3952` | 1 | `COINon` `0xf8589b526fdd65f7f301c605a6e04f0f1b4b3620` | 1 | `COINx` `0x364f210f430ec2448fc68a49203040f6124096f0` | 1 |
| MSTR | `MSTRB` `0xe87afb3076aeb0f9b14e368de8145ae6a2826a14` | 1 | `MSTRon` `0x7313ea16493b2f55054df0131a3a14b043ec8992` | 1 | `MSTRx` `0xae2f842ef90c0d5213259ab82639d5bbf649b08e` | 1 |
| CRCL | `CRCLB` `0x80f3d493ebce97e343c53d29a137942416b4ffc0` | 1 | `CRCLon` `0x992879cd8ce0c312d98648875b5a8d6d042cbf34` | 1 | `CRCLx` `0xfebded1b0986a8ee107f5ab1a1c5a813491deceb` | 1 |
| HOOD | `HOODB` `0xa394dcea3fd3847fd793afbfd163e2e3858b7c65` | 1 | `HOODon` `0x19601179a60f55ff6636f5d1a8b6671053bd60a8` | 1 | `HOODx` `0xe1385fdd5ffb10081cd52c56584f25efa9084015` | 1 |

Note on the xStocks `mult` column: Binance's list reports `1` for every xStocks token, but on-chain
`getCurrentMultiplier()` for AAPLx is 1.00327 [RPC]. **INFERENCE:** xStocks `balanceOf` is already
share-adjusted (rebasing), so a held balance maps 1:1 to shares, while raw/wrapped amounts need the
multiplier. Verify against [XS] multipliers.md before doing per-share math.

## 3. bStocks

- **Issuer:** "bStocks Tokenized Securities are issued by BTECH Holdings Ltd, a Binance group affiliate". They are classified as certificates and give no direct share ownership. They are offered under an FSRA-approved **ADGM** prospectus [BST] *(sub-agent)*.
  - **Backing:** 1:1 shares in a ring-fenced, bankruptcy-remote SPV at a regulated US broker-custodian, with daily Proof of Collateral [BST] *(sub-agent)*.
- **Access:**
  - **Not permissionless.** Addresses "may be added to the smart contract blacklist at the Issuer's discretion". bStocks "must not be made available to Restricted Persons, including US Persons (Reg S)". Integrators must geo-block. Integration contact: operations@bstocks.finance [BST /en/integration] *(sub-agent)*.
  - On-chain, NVDAB exposes `compliance()` → `0x53dBa7AaBDe774787A1F57236B235567dA8e14F4` and `pauseManager()` → `0x9fc74Be63f3589485B2423984a7a0557e0CF700a` [RPC]. `identifier()` → `"AE000A4AVAZ9"` [RPC].
  - The bStocks FAQ and prospectus sit behind an ADGM attestation gate. **Gap: not clicked.**
- **Pricing and hours:**
  - 24/7 on Binance Spot and on-chain, quoted against USDT. On-chain price is market-set, with no issuer oracle [BST, BNB Chain blog] *(sub-agent)*.
  - **But** the Binance Trading API returns `40369 BSTOCK_INVALID_TRADING_TIME` outside exchange hours for bStock routes [W3D]. INFERENCE: the RFQ leg closes, while AMM pools keep trading.
  - "47% of bStocks trading happened outside US market hours" (FXStreet, 2026-10-04) *(sub-agent; secondary)*.
- **Corporate actions:** a "built-in rebase mechanism handles dividends and splits automatically… via the Multiplier". Dividends are reinvested, net of a 30% US withholding per a Zelcore citation of Binance Academy *(sub-agent; secondary)*. [RPC]: NVDAB `uiMultiplier()` = `1000778223752807865` (≈1.00078×).
- **Technicals:**
  - The implementation `SecuritiesToken` exposes `uiMultiplier()`, `newUIMultiplier()`, `effectiveAt()`, `toUIAmount(uint256)`, `fromUIAmount(uint256)`, `balanceOfUI(address)`, `totalSupplyUI()` and the event `UIMultiplierUpdated` (Sourcify ABI) *(sub-agent)*.
  - The standard is described as BEP-677 / "Scaled UI Amount" (third-party) *(sub-agent)*.
- **Liquidity:** real AMM depth on majors. NVDAB/USDT PancakeSwap v3 0.25% pool `0x8fb4243b553ac29ba088acf00b9b7da24bd6690c` had ≈ **$4.38M** reserve and ≈ **$8.25M** 24h volume (GeckoTerminal, lead re-check, 2026-10-05).
- **News** *(sub-agent; secondary where noted)*:
  - Launched about 2026-06-11/12 with 5 tickers (CRCLB, MUB, NVDAB, SNDKB, TSLAB). There were 15 by 2 July.
  - Outstanding value: $334M (Jul 16) → $678M (Sep 6), with >$30B cumulative volume (Hackernoon).
  - Binance Margin collateral expanded to all eligible users. Ethena said it would use bStocks as collateral (Sep 25).

## 4. Ondo Global Markets ("Ondo Stocks")

- **Issuer:** "Ondo Global Markets (BVI) Limited (the Issuer)", an SPV. Tokens are fully backed by the underlying (plus cash in transit) and overcollateralized at US broker-dealers. Ankura Trust is Security/Verification Agent. Daily attestations. Tokens are "total return trackers": "One token does not necessarily represent the value of one share." [ONDO] *(sub-agent)*
- **Access:**
  - Mint/redeem requires Ondo KYC. "Currently, onboarding is only open to institutional participants."
  - Secondary is "transferable outside the US" on Ethereum, BNB Chain, Solana and HyperEVM. Secondary buyers are "deemed" to represent they are not Prohibited Persons [ONDO] *(sub-agent)*.
  - Prohibited includes the **United States** and U.S. persons (Rule 902) [ONDO eligibility, lead-verified]. Also Afghanistan, Belarus, Canada, Cuba, DPRK, Iran, Libya, Myanmar, Russia, Somalia, South Sudan, Sudan, Syria, and the occupied/annexed Ukraine regions *(sub-agent)*.
  - [RPC] AAPLon: `compliance()` → `0x76be569C94C39a2E2492DE2F4D1C253F348250D0`, `tokenPauseManager()` → `0x6334924c787Ebd21C881740Ef6237Ef51962638F`.
- **Hours** [ONDO, lead-verified]:
  - "generally available for trading from 8:05:00pm ET (New York time) Sunday evening through 7:59:00pm ET Friday evening".
  - Sessions: Pre-Market 4:01–9:29am, Core 9:31am–3:59pm, Post-Market 4:01–7:59pm, Overnight 8:05pm–3:55am ET.
  - **Off-Hours** session: "Off-Hours trading is available on the **Ethereum**, **BNB Chain**, and **Solana** networks". It runs "principally over the weekend" for select assets with separate, conservative per-asset limits. Status: `status.ondo.finance/market`. The API has an `offhours` object.
  - Binance Trading API: `40367 ONDO_MARKET_STATE_NOT_TRADABLE` when the underlying is closed or halted [W3D].
- **Pricing:** proprietary indicative price. Mint/redeem quotes are good for about 30 s. "We do not recommend using the price feeds as an oracle" (display-only) [ONDO] *(sub-agent)*.
- **Corporate actions:** dividends auto-reinvested net of withholding, raising shares-per-token. On BNB Chain, wallets apply a "display multiplier". Trading may pause around ex-dates (7:50–8:10pm ET the day before) [ONDO corporate-actions] *(sub-agent)*.
- **BSC infrastructure** [ONDO addresses.md; the lead confirmed bytecode for the ✓ rows, RPC]:
  - `GMTokenManager` `0x91f8Aff3738825e8eB16FC6f6b1A7A4647bDB299` ✓ (mint/redeem entry point)
  - `SyntheticSharesOracle` `0xF4Fd8a1B412633e10527454137A29Db7Aa35F15e` ✓ (shares-per-token multiplier)
  - `GMTokenLimitOrder` `0x96b525B1a93f31E65F4aAf18C53842eD28525D48` ✓
  - `GMIssuerManager` `0x341f9e6463161F0C90037Cbc0150DC54e6d1e06e`
  - `USDon` `0x1f8955E640Cbd9abc3C3Bb408c9E2E1f5F20DfE6`
- **Liquidity:** AMM pools are negligible (NVDAon ≈ $0.1M BTCB / $14K USDT pools on "dnax", **0** 24h volume, lead re-check). Execution is RFQ through Binance's Trading API vendors, or direct mint/redeem for KYC'd institutions.
- **Developer resources:** docs index `https://docs.ondo.finance/llms.txt`. API covers attestation quotes, prices, metadata, multiplier history. There are on-chain limit-order contracts. The Alpaca ITN integration includes BNB Chain [ONDO] *(sub-agent)*.
- **News:** launched on BNB Chain **2025-10-29** with 100+ stocks/ETFs (CoinDesk). Outstanding ≈ $947M (Sep 6, 2026, Hackernoon). Renamed "Ondo Stocks" (Jul 2026) *(sub-agent; secondary)*.

## 5. xStocks

- **Issuer:** "Backed Assets (JE) Limited" (Jersey). Tracker certificates are collateralized 1:1 in segregated custody under a Liechtenstein FMA base prospectus. Kraken is a distributor [XS legal overview] *(sub-agent)*.
- **Access:** primary issuance/redemption needs KYC/AML (minimum $5,000). Secondary is described as "permissionless". [RPC] AAPLx: `isPaused()` → `false`, `sanctionsList()` → `0x40C57923924B5c5c5455c48D93317139ADDaC8fb` (INFERENCE: transfers may be sanctions-checked or pausable).
- **Hours:** secondary 24/7 with market-set price: "The issuer does not control pricing on secondary markets". Primary is 24/5 (`tradingHoursMode: "TwentyFourFive"`). The API exposes per-period order limits and halt status [XS] *(sub-agent)*. [XS API, lead fetch] shows `isTradingHalted` per asset (5 BSC assets were halted at fetch).
- **Rebasing (lead-verified [XS] multipliers.md):** on EVM, "The `balanceOf()` function automatically returns the adjusted balance (equivalent to underlying shares)". "The multiplier is stored in the contract and retrieved via `getCurrentMultiplier()`". [RPC] AAPLx `getCurrentMultiplier()` → (`1003269012539818700`, `0`, `5`).
- **Wrapped xStocks (lead-verified [XS] wrapped-xstocks.md):**
  - "As rebasing tokens, xStocks cannot integrate natively with DeFi protocols."
  - Wrapped xStocks are "standard ERC-20 tokens with the ERC-4626 extension".
  - "**Warning — do not integrate v1 wrappers.**"
  - AAPLx `wrapperAddressV2` on BSC is `0x943bf64d566c32a2bcd41ac92fb63c111cc9de8f` (✓ code) [XS API].
- **Oracle (only independent price feed found for any of the three on BSC):** Chainlink **Data Streams** (pull-based, schema v10). BSC verifier `0xF276a4BC8Da323EA3E8c3c195a4E2E7615a898d1` (✓ code). Per-asset `feedId`s come from `https://api.xstocks.fi/api/v2/public/oracles/{SYMBOL}` (e.g. AAPLx `0x000a7a12270b5a30236bf410679df0c6bb1bba2b40e5d86847748ff1c8f8452b`) *(sub-agent; verifier code lead-verified)*.
- **Liquidity on BSC:** negligible. NVDAx's only pool is ≈ **$474** (Uniswap v4, GeckoTerminal, lead re-check). The Binance Trading API routes xStocks through AMMs only, so expect `40374 RWA_INSUFFICIENT_LIQUIDITY` or extreme slippage.
- **Developer resources:** public REST `https://api.xstocks.fi/api/v2`. It covers assets, multiplier and history, price-data, proof-of-reserves, oracles, system/status, corporate actions and bridges (Chainlink CCIP incl. BSC). There are also xChange atomic-RFQ and CoW solver guides [XS] *(sub-agent)*.
- **News:** xStocks expanded to BNB Chain on **2026-04-30** with 50+ assets (Crypto Times). Outstanding ≈ $693M (Sep 6, 2026, Hackernoon) *(sub-agent; secondary)*.

## 6. Builder gotchas (cross-system)

1. **Multipliers differ per system.** A token ≠ a share:
   - bStock: `uiMultiplier()`.
   - Ondo: oracle-published shares-per-token.
   - xStocks: rebasing `balanceOf` plus `getCurrentMultiplier()`.
   - Binance's RWA API exposes `tokenToShareRatio`. Normalize per share before comparing prices across systems.
2. **Liquidity is wildly uneven.** bStocks have deep PancakeSwap v3 pools. Ondo is RFQ-only. xStocks on BSC are effectively illiquid. A product that must "centrally" use one should prefer **bStocks or Ondo** for live demos. **INFERENCE:** an xStocks-centric demo risks failed swaps.
3. **Hours:**
   - bStocks AMM pools trade 24/7, while their RFQ route closes (40369).
   - Ondo RFQ closes (40367) except for Off-Hours assets on weekends.
   - xStocks secondary is 24/7 but illiquid.
4. **Compliance hooks exist on all three** (blacklist / compliance / sanctions / pause contracts). Transfers to restricted addresses may revert, and assets can be paused for corporate actions. Read `statusInfo` (RWA API) or the market-status endpoints before trading.
5. **Quote tokens:**
   - Ondo on BSC: USDT only (40368).
   - bStock: whitelist enforced (40370).
   - xStocks issuer: USDC.
   - b402 / Agent Studio payments favor U / USD1 (EIP-3009).
6. **Regulatory:** all three exclude US persons. bStocks are ADGM-offered and require integrator geo-blocking. This is consistent with the hackathon's own eligibility list.
