<!-- demo-script-schema: v1 -->
# Proof of Position — demo script

## 0 — Production card

| field | value |
|---|---|
| Project | Proof of Position |
| Event | BNB Hack: Tokenized Stocks Edition (submissions lock Sun 11 Oct 2026, 12:00 UTC) |
| Target length | 3:30 (hard cap 4:00, `event.md` §3.1) |
| Resolution / fps | 1920×1080 @ 30 |
| Voice | the user's own voice, read live from §4 during the take (or a voice-over added afterwards) |
| Music | off |
| Wallet on camera | none. The caller and follower sign from the CLI (burner key in env / Agentic Wallet); no browser extension on screen |
| Upload target | manual / n/a — the user uploads to an account of their choice (name only, never a credential) |
| Schema | v1 |

**Recording mode: manual, single continuous take.** The video *is* the gate-g rehearsal (launch:8 Steps 2–3), so the scene order and
commands below are the real rehearsal order. Each retake of S4–S6 costs a sell plus a re-buy. Pause the recorder only at the
marked **HOLD** points: at each HOLD no transaction is in flight and nothing has to be redone. The `driver` column says
`N/A (manual)`: the user's own screen recorder replaces the kit's capture drivers.

## 1 — Story & time budget

Prove: on BSC mainnet, a stock call can only be posted by a wallet that holds the tokenized stock, and the call's live badge,
the permanent on-chain exit record, the exit evidence and a follower agent on Binance Agentic Wallet all react within seconds
of the caller selling.
Money shot: scene S6.

Weights are quoted from `event.md` §4. The Developer Experience Report (25%) is judged from its own form, not from the video,
so its seconds are 0 and the 210 s target is split across the three criteria a video can show, in proportion 30 : 25 : 20.

| criterion | weight | seconds |
|---|---|---|
| Technical implementation ("Does it run, and how deep does the integration go?") | 30% | 84 |
| Creativity & originality ("Were the APIs used in ways nobody expected?") | 25% | 70 |
| Product quality & UX ("Is it usable by the people it is for?") | 20% | 56 |
| Developer Experience Report (separate form; not shown in the video) | 25% | 0 |

Scene mapping, which sums to 210 s:
- Technical 84 s: S3 18 s, S4 22 s, S7 25 s, plus 19 s of S6.
- Creativity 70 s: S6 26 s, S5 21 s, S8 23 s.
- Product 56 s: S1 12 s, S2 20 s, S5 9 s, S9 15 s.

## 2 — Pre-flight — set up before recording

| # | item | how to verify | ✓ |
|---|---|---|---|
| 1 | App running — local server `:8787`, feed `:5173` and analyst `:9000` (`D:\bnb-tokenized-hackathon\local-run\run-*.ps1`), plus the two detached Cloudflare quick tunnels (at recording time; since 2026-10-11 the app is hosted on the Mac mini behind Tailscale Funnel). Feed: https://anujs-mac-mini.tail5830cd.ts.net | Terminal A: `$env:POP_FEED_URL='https://anujs-mac-mini.tail5830cd.ts.net'; pnpm --filter @pop/demo run demo health` → five `PASS` lines, then `PASS` (the keeper must say `recordExit keeper on`) | |
| 2 | Demo data — CallRegistry `0x7eCB8700D7cc4d3CddD3fe74217228F24845a901` (675 tokens listed). Analyst call **#2 LONG NVDAB is HOLDING** with "AGENT #370830 · integrity 100". The caller has **no** open NVDAB call | The feed shows card #2 `HOLDING ✓` and `AGENT #370830 · integrity 100`; `pnpm --filter @pop/demo run demo status` lists no open call for `0x0773…09A9` | |
| 3 | Wallet state — caller `0x0773c6d1cB7b906CbB69BAe81D7ea836bdb109A9` (BSC mainnet) holds ≥ 0.012 NVDAB (now 0.012999) and ≥ 0.0015 BNB. Agentic Wallet `0x859fc4055d1a9879878c63f1012ec5fcafc00cf2` holds ≥ 1 USDT and ≥ 0.0004 BNB, session valid. Keeper `0xcaC988d8964fbedCfE0f325f877043e07F6F1a5D` holds ≥ 0.0003 BNB. Gas ≈ 0.05 gwei | Terminal A: `pnpm --filter @pop/demo run demo balances --wallet 0x0773c6d1cB7b906CbB69BAe81D7ea836bdb109A9`. Terminal B: `pnpm --filter @pop/follower run cli check` (`wallet CONNECTED ✓`, session hours left, USDT ≥ 1). `cast gas-price --rpc-url https://bsc-dataseed.bnbchain.org` ≈ 50000000 | |
| 4 | Browser hygiene — one window: the feed at 1920×1080, 100% zoom, no bookmarks bar. Pre-opened tabs: BscScan for the registry (`/address/0x7eCB8700D7cc4d3CddD3fe74217228F24845a901`) and for the caller (`/address/0x0773c6d1cB7b906CbB69BAe81D7ea836bdb109A9`) | Visual check; the feed tab is active at the top of the page | |
| 5 | Desktop hygiene — notifications / Focus Assist off. Layout: feed on the left ~60%; Terminal A (caller) top-right, Terminal B (follower) bottom-right. Run each terminal's env line, then `cls`. Env lines name variables only: Terminal A `cd D:\bnb-tokenized-hackathon\proof-of-position; foreach ($n in 'CALLER_PK','W3W_API_KEY','W3W_API_SECRET') { Set-Item "env:$n" ([Environment]::GetEnvironmentVariable($n,'User')) }; $env:REGISTRY_ADDRESS='0x7ecb8700d7cc4d3cddd3fe74217228f24845a901'`; Terminal B `cd D:\bnb-tokenized-hackathon\proof-of-position; $env:REGISTRY_ADDRESS='0x7ecb8700d7cc4d3cddd3fe74217228f24845a901'`. Timestamped prompt in both: `function prompt { "[$((Get-Date).ToUniversalTime().ToString('HH:mm:ss'))Z] PS> " }` | No `.env` / `.studio` file open; terminals cleared after the env line; the taskbar clock is visible; no key value appears anywhere | |
| 6 | Capture toolchain — N/A (manual): the user's own screen recorder. The kit capture rows of `docs/tollgate/2026-10-07-tollgate.md` (ffmpeg/gfxcapture) are not used | Recorder test: 5 s of the desktop at 1920×1080 plays back with audio | |
| 7 | Assets — no title card or music (cut straight to the feed). Outro text: repo URL `https://github.com/officialhulk40-coder/proof-of-position` (public after the flip, gate k) and the feed URL | Outro text ready to show in the browser or the S9 narration | |

## 3 — Shot list

| id | seconds | visual (route/action/window) | narration cue | driver | wallet verbs | gate assertion | retakes | take |
|---|---|---|---|---|---|---|---|---|
| S1 | 12 | Feed `/` full screen, top of page: hero line "Stock calls you can't post unless you hold the stock." and "Live from BSC · block N" ticking | S1 "Stock calls you…" | N/A (manual) | — | The hero line is readable and the block number visibly increments | 3 | |
| S2 | 20 | Feed `/`: scroll to card #2 and hover "AGENT #370830 · integrity 100", "HOLDING ✓", "verified on-chain", "Market open"; point at the block counter | S2 "Every badge here…" | N/A (manual) | — | Card #2 shows `HOLDING ✓` and `AGENT #370830 · integrity 100` in frame | 3 | |
| S3 | 18 | Feed `/` "Try the gate" panel: click **Try to post without holding** (no wallet). **HOLD** after the result | S3 "No wallet needed…" | N/A (manual) | — | Panel shows `Reverted: "No position, no call."` | 3 | |
| S4 | 22 | Terminal A: `pnpm --filter @pop/demo run demo caller post --token NVDAB --amount 0.012 --note "AI capex keeps compounding"`; then the feed shows the new card. **HOLD** after the card appears | S4 "Now a real…" | N/A (manual) | signTx (CLI, caller burner) | Terminal prints the post tx; the feed shows a new top card `LONG NVIDIA · 0.012 shares` `HOLDING ✓` (call #3 or #4) | 1 (a retake needs the call closed first) | |
| S5 | 30 | Terminal B: `pnpm --filter @pop/follower run cli run --caller 0x0773c6d1cB7b906CbB69BAe81D7ea836bdb109A9 --budget-usdt 1 --include-existing`; wait for `Mirrored call #k: you hold … NVDAB alongside them (order …, … s)`; then click **Alert me** on the caller's card. **HOLD** after the click (the follower keeps running) | S5 "A follower runs…" | N/A (manual) | marketOrder (Agentic Wallet, CLI) | Terminal B shows `Mirrored call #k`; the card's Alert me is toggled on | 1 | |
| S6 | 45 | **MONEY SHOT, no pause.** Layout: feed card on the left, both terminals with timestamped prompts on the right, clock in frame. Terminal A: `pnpm --filter @pop/demo run demo caller sell --token NVDAB --all`. Watch the card: badge **EXITED** plus alert toast (target ≤ 1.5 s after the sell is mined); `Exit recorded on-chain · block N` (≤ 2 s); exit evidence `EXITED · sold … NVIDIA · tx 0x…` (≤ 3 s); Terminal B: `Caller exited — sold … NVDAB in N s` (SELL submitted ≤ 2 s, FINISHED ≤ 15 s; spec §10). **HOLD** after the follower line | S6 "Here's the moment…" | N/A (manual) | signTx (CLI, caller); marketOrder (AW, automatic) | All four visible in one frame sequence: EXITED + toast, "Exit recorded on-chain · block N", the sold-evidence line, and the follower's "Caller exited — sold … in N s" | 1 (a retake = re-buy 3 USDT + re-post + re-follow) | |
| S7 | 25 | Terminal A: `pnpm --filter @pop/demo run demo caller try-gate --token TSLAB --amount 0.01 --broadcast`; copy the tx hash, open it on BscScan (pre-opened tab → paste the hash) | S7 "And if someone…" | N/A (manual) | signTx (CLI, deliberately reverting) | BscScan shows Status **Fail** with the revert reason `No position, no call.` | 3 (gas only) | |
| S8 | 23 | Feed `/`: closed analyst cards #0 and #1 `CLOSED · held through ✓`, card #2 `HOLDING`; then BscScan ERC-8004 IdentityRegistry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (agent 370830) or the agent card `https://anujs-mac-mini.tail5830cd.ts.net/agent/.well-known/agent-card.json` | S8 "The analyst is…" | N/A (manual) | — | `held through ✓` on #0/#1 and `integrity 100` visible | 3 | |
| S9 | 15 | Feed `/` top, then the README / repo page (or a text slide) listing the modules | S9 "Built on the…" | N/A (manual) | — | Module list and the no-keys judge line on screen | 3 | |

Sum: 12 + 20 + 18 + 22 + 30 + 45 + 25 + 23 + 15 = **210 s** (3:30; cap 240 s).

## 4 — Narration script

**S1** — Stock calls you can't post unless you hold the stock. This is Proof of Position, live on BNB Smart Chain mainnet, built on tokenized stocks.
words: 25 · planned: 10s @ ~2.4 w/s · tone: calm, confident hook · gloss: BNB → "B-N-B"

**S2** — Every badge on this feed is read straight from the chain, every BSC block, with no indexer and no server in the path. This card is our analyst agent, ERC-8004 agent three-seven-zero-eight-three-zero. It holds NVIDIA right now, and its integrity score is one hundred, written by the registry itself.
words: 49 · planned: 20s · tone: explanatory · gloss: ERC-8004 → "E-R-C eighty-oh-four"; BSC → "B-S-C"

**S3** — No wallet needed to test the rule. Try the gate dry-runs a long Tesla call from an address that holds no TSLAB, through the Binance Transaction API simulate. The contract answers: no position, no call.
words: 35 · planned: 15s · tone: matter-of-fact, land on the last four words · gloss: TSLAB → "Tesla-B"

**S4** — Now a real caller. This wallet bought NVIDIA bStock earlier and holds about point-oh-one-three shares. It posts: long NVIDIA, point-oh-one-two shares, "AI capex keeps compounding." The contract checks the balance in the same transaction, and the card lands as holding.
words: 40 · planned: 17s · tone: steady · gloss: bStock → "B-stock"; NVDAB → "N-V-D-A-B"

**S5** — A follower runs pop-follower, our Wallet Skill on Binance Agentic Wallet, with a one-dollar budget. It sees the verified call and buys the same bStock with a market order through the Agentic Wallet. Mirrored: it now holds NVIDIA alongside the caller. And I switch on Alert me for this call.
words: 50 · planned: 21s · tone: brisk · gloss: pop-follower → "pop follower"

**S6** — Here's the moment that matters. The caller sells everything. Watch the badge: it flips to EXITED on the next block, with an alert. Our keeper makes the exit permanent on-chain: exit recorded, with the block number. The server finds the sale itself: sold NVIDIA, with the transaction. And the follower's agent has already sold too. The caller sold. The badge knew first.
words: 62 · planned: 26s (the rest of the 45 s is deliberate silence while the four events land on screen) · tone: slow, let each event land before speaking · gloss: EXITED → "exited"

**S7** — And if someone tries to call a stock they don't own, this isn't a UI rule. It's the contract. This post was signed and broadcast on purpose from a wallet with no TSLAB. On BscScan it failed, with the reason: no position, no call.
words: 44 · planned: 18s · tone: firm · gloss: BscScan → "B-S-C scan"

**S8** — The analyst is built with BNB Agent Studio. It has its own ERC-8004 identity, buys the bStock before it posts, and holds. When it closes a call it held through, the registry itself writes integrity feedback to the ERC-8004 Reputation Registry: two calls, both held, integrity one hundred.
words: 48 · planned: 20s · tone: proud but plain · gloss: Agent Studio → "agent studio"
*Add-on (verified 2026-10-11: Pieverse auto-topup tx 0x3537a74e…b280cd):* "It even pays for its own AI: when its LLM credit runs low, it tops up Pieverse over x402 from its own wallet." (21 words, +9 s; trim one S2 clause to keep ≤ 240 s.) Do NOT claim CoinMarketCap x402 on screen: its payment has not settled on chain.

**S9** — Built on the Binance Web3 API: RWA Data, Market, Trading, Transaction and Wallet, plus Agentic Wallet and Agent Studio. Main track, and both special tracks. Judges need no keys: open the feed and try the gate.
words: 36 · planned: 15s · tone: crisp close · gloss: RWA → "R-W-A"

Total 389 words ≈ 162 s of speech inside 210 s of picture. The gap is the S6 silence and the transaction waits in S4, S5 and S7.

## 5 — Assembly plan

Manual / n/a. The video is one continuous single take recorded by the user with their own recorder, with no kit assembly.
The only edits are optional: cutting the paused stretches at the **HOLD** points (hard cuts) and adding a voice-over if not
read live. Captions: optional, made by the user's editor. Music: off. Loudness target if a voice-over is added: −14 LUFS.
Export: 1080p h264. Mechanics reference: `build-system-main/references/demo-stack.md` (not used in this mode).

## 6 — QC record

Manual / n/a. The user checks the take themselves before uploading. The rows are kept per the schema, and the user can tick
them during that check.

| check | scene(s) | pass/fail | note |
|---|---|---|---|
| money shot visible | S6 | | manual: EXITED + toast, exit recorded, evidence and follower line all in frame |
| text legible at 1080p | all | | manual |
| captions present + synced | all | | manual / n/a: captions optional |
| no capture yellow border | all | | manual / n/a: user recorder, no gfxcapture |
| no secret / no address that shouldn't be on screen | all | | manual, hard fail: only burner public addresses and env-var names may appear |
| per-scene duration within budget | all | | manual |
| total duration within ±10% | all | | manual: hard cap 4:00 |
| audio present, loudness sane | all | | manual |

## 7 — Publish block

Manual / n/a. The user uploads and sets visibility themselves. The concierge only verifies afterwards that the URL plays
logged-out and is ≤ 4:00 (gate h), then resolves the submission draft's demo video URL.

| field | value |
|---|---|
| Upload target + account | manual / n/a: the user's choice (account name only) |
| Title | manual / n/a: the user's choice |
| Description | manual / n/a: the user's choice; music attribution: none (music off) |
| Tags | manual / n/a |
| Visibility | unlisted or public: must play for a logged-out viewer |
| URL | TBD |
| Verified logged-out | TBD |
| Resolves | submission-draft demo video URL |

## 8 — Status ledger

| date | event | by |
|---|---|---|
| 2026-10-11 | scripted | demo-studio (Stage 1 only, run by the gate concierge) |
| 2026-10-11 | approved | the user ("approve script", 06:5xZ) |
| 2026-10-11 | superseded-edit (S5 command gains `--include-existing`: the follower otherwise starts at the current call count and would skip the caller's just-posted call; follower.ts:38) | gate concierge |
| 2026-10-11 | superseded-edit (S8 add-on now claims the verified Pieverse self-funding tx 0x3537a74e…; the CMC claim is dropped as unsettled) | gate concierge |
