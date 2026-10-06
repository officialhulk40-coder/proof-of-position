# Event essentials: BNB Hack: Tokenized Stocks Edition

All facts were fetched on 2026-10-05. Quoted text is verbatim from the tagged source. Anything derived or
inferred is labelled. Source tags (full provenance in [INDEX.md](INDEX.md)):

- **[EP]** Event page CMS record (`__NEXT_DATA__` → `cms.activeHackathonProgram`, id `20021`, `date_updated` 2026-09-16T12:35:15Z). https://www.bnbchain.org/en/hackathons/tokenized-stocks. It holds all four tabs: Overview, Prizes & Bounties, Tracks, Resources.
- **[BLOG]** Official announcement, "BNB Hack: Tokenized Stocks Edition, with Binance Web3 Wallet", published 2026-09-16T12:37:54Z. https://www.bnbchain.org/en/blog/bnb-hack-tokenized-stocks-edition-with-binance-web3-wallet
- **[SUB]** Project submission Google Form. https://forms.gle/yToDUzaDMwWnq6R6A
- **[DX]** Developer Experience Report Google Form (linked as the "template"). https://forms.gle/EUQ39xf54GHjC2ys5
- **[REG]** Registration ("Apply as Hacker") Google Form. https://forms.gle/NEmy3FxYc4f5Dua47
- **[RR]** Binance Web3 API "Service-Restricted Countries & Regions" doc. https://web3.binance.com/en/dev-docs/web3-api-prohibited-regions

> **Bottom line for planning:** submissions lock **Sun 11 Oct 2026, 12:00 UTC** (17:30 IST). The fetch
> was at about 2026-10-05 16:45 UTC, which leaves **about 5 days 19 hours**. Treat the demo video as
> required (see Conflicts §8). The DevEx Report is mandatory, worth 25%, and must be human-written.
> The build must be **BSC mainnet, spot only**, with at least one of **bStocks / Ondo / xStocks**
> central.

---

## 1. Deadline and timeline

| Milestone | [EP] Key Dates (UTC) | [BLOG] Key Dates |
|---|---|---|
| Registration opens, building starts | "Wed 16 Sep, 12:00" | "September 16, 12pm UTC - Registration opens, building starts." |
| Build phase | n/a | "September 16 to October 11 - Build phase. Weekly office hours, mid-point check-in in week two, Telegram open for Q&A with technical contacts from both partners in it." |
| **Submissions lock** | **"Sun 11 Oct, 12:00"** | **"October 11, 12pm UTC - Submissions lock. Repos frozen. Videos, links and DevEx reports due."** |
| Screening | n/a | "October 12 to 14 - Screening." |
| Judging | "12 - 23 Oct" | "October 15 to 23 - Judging." |
| Winners announced | "Week of 26 Oct" | "Week of October 26 - Winners announced." |

- [EP] CMS fields: `submit_project_end_time: "2026-10-11T12:00:00"`, `apply_as_hacker_end_time: "2026-10-11T12:00:00"`, `start: "2026-09-16T12:00:00"`, `timezone: "UTC +0"`, `status: "Ongoing"`.
- [SUB] "One submission per team. Deadline: Sunday 11 October, 12:00 UTC."
- [DX] "Deadline: Sunday 11 October, 12:00 UTC."
- **Derived:** 12:00 UTC = **17:30 IST** (UTC+5:30, this machine's timezone).
- The workshop is "Workshop: to be announced" [EP Resources]. No date or recording was found as of 2026-10-05 (gap; see INDEX).

## 2. Eligibility

[EP] Overview → Eligibility:

> - Open to teams and solo builders.
> - One entry per team.
> - Your repo, demo and deployed link must stay accessible through judging.
>
> This hackathon and the Binance Wallet developer product referenced herein are not open to residents
> of, or persons located in, the United States, Canada, the Netherlands, Iran, Cuba, North Korea,
> Crimea, Donetsk People's Republic, Luhansk People's Republic, the United Kingdom, and Japan. By
> registering, you confirm you are not located in, a resident of, or a citizen of any of these
> jurisdictions, and that you are not subject to any sanctions list. Participants remain responsible
> for ensuring their participation complies with the laws applicable to them.

- [BLOG] "Open to teams and solo builders worldwide. Participants in the US and the UK aren't eligible for this edition, alongside the standard restricted locations."
- [REG] has a required checkbox: "No team member is a resident of, located in, or a citizen of a restricted jurisdiction".
- **[RR] Architecture-relevant:** "IP checks are enforced on both the Developer Portal and the API server side." It also says "All other prohibited regions have no exemption — both client IP and server location are checked against the list above." The list includes US territories (GU, MP, PR, VI, AS, UM), CA, NL, IR, CU, KP, the Crimea/DPR/LPR regions, GB, and JP (conditional). Japan's restriction lifts only when the user is "authenticated via Binance account login", has a KYC country outside the list, **and** the "Server IP is located in Japan".
  - **INFERENCE:** host any server that calls the Binance Web3 API outside the listed regions. For example, avoid US-default serverless regions and London. A browser calling the API directly is IP-checked against the judge's location, so proxying through an allowed-region server is safer.

## 3. What to submit

### 3.1 Project ([EP] Tracks → "What to Submit")

> #### 1. Your Project
> A working project built on one or more Binance Web3 API modules, and optionally Agentic Wallet or Wallet Skills.
> - A public repository.
> - A demo video, four minutes or less (strongly recommended but optional)
> - A deployed link, or instructions a judge can follow.

[BLOG] "What to Submit":

> Both are mandatory. Miss either one and you don't get scored.
>
> **Your project:** A public repo, a demo video of four minutes or less, and a deployed link or
> instructions someone can follow. Judges need to run it. If they can't, you're scored on the video
> alone. Already have a product? You can enter a new integration into it, with a before and after.

"Both" means the project and the Developer Experience Report.

[BLOG] "Everything you submit has to be built inside that window."

**[SUB] fields, verbatim.** The form header says: "The Developer Experience Report is mandatory and worth 25% of your score. Fill it in before you submit here: [DX link]".

| Field | Required | Form guidance (verbatim, abridged) |
|---|---|---|
| Team or project name | yes | none |
| Contact email | yes | "Use the same address you used to register and on your Developer Experience Report." |
| Wallet address (ERC-20) | yes | "So we can send you your prize if you win, make sure you can receive tokens on BNB Smart Chain and never share your private key! Alternatively, you can also give us your Binance UID" |
| Telegram handle | no | "Include the @." |
| What did you build? | yes | "What it does, who it is for, which parts of the Binance Web3 API you used, and which tokenized stocks it touches." |
| Which tracks are you applying for? | yes (checkboxes) | Options: "Main track: Tokenized Stocks Products & Agents" · "Best Use of Agentic Wallet / Wallet Skills ($2,000)" · "Best Use of BNB Agent Studio ($2,000)". Guidance: "Special prizes need no separate entry and you can win a main placement as well." |
| Public repository URL | yes | "It has to be public at submission time and stay public through judging." |
| **Demo video URL** | **yes** | "Four minutes or less. Check the sharing settings: if a judge cannot open it, it does not count." |
| Deployed link, or instructions a judge can run | yes | "A live URL is best. Add anything a judge needs to test it, but never share private keys or seed phrases." |
| Developer Experience Report | yes (checkbox "Yes, I have submitted it") | "Mandatory … A submission without it is not scored." |

### 3.2 Developer Experience Report: mandatory, 25% of the score

[EP] Tracks → "2. A Developer Experience Report": "Most hackathons do not ask for one. This one does, and it is worth a quarter of your score."

| What we want to know | |
| --- | --- |
| **Onboarding** | How long from opening the docs to your first successful API call, and where you got stuck. |
| **Documentation issues** | Which page had the error, and where on it. Vague feedback does not count. |
| **API pitfalls** | Error messages that made no sense, edge cases that bit you, latency. Be specific. |
| **AI stack feedback** | Did you use Wallet Skills, Agentic Wallet or the CLI? What worked, what did not, what is missing. |
| **Tokenized-stock specifics** | Liquidity depth, slippage, behaviour outside traditional market hours, the gap between on-chain and reference price, and how the bStocks, Ondo and xStocks versions of the same thing differ in practice. |
| **Redesign suggestions** | If you were the engineer behind the developer platform, how would you rebuild it so someone can make a call the moment they land? |
| **Requested capabilities** | Endpoints, SDK support, features or tooling you want added. |

> Perfunctory or AI-generated reports are not accepted, the goal is for us to see what worked or not so we won't be able to do anything if you generate this. AI-assisted code is completely fine.

**[DX] form structure.** The report is submitted through this form, not as a file. Header: "Be specific and honest. Vague feedback does not count, and perfunctory or AI-generated reports are not accepted. Where a question asks for a page, an endpoint or an error message, paste the exact URL, endpoint name or message text."

| Section | Questions (* = required) |
|---|---|
| 1. Submission details | Team or project name*. Contact email*. Public repository URL*. "Which Binance Web3 API modules or tools (inc. BNB) did you use?"* (options: RWA Data API, Market API, Trading API, Transaction API, Wallet API, DeFi API, b402 Payments, Agentic Wallet / Wallet Skills, BNB Agent Studio). Team size*. Most experienced member's Web3 tenure*. Prior Binance Web3 API use* |
| 2. Onboarding | Docs→first successful call time* (Under 15 min … "We never got a fully successful call"). Time to a working API key from the developer portal*. Onboarding rating 1–5*. "Where exactly did you get stuck during onboarding?"*. "Which step took longer than you expected, and why?"*. "Did you use the llms.txt or llms-full.txt files to feed the docs to an AI coding agent?"*. What the AI coding agent got wrong |
| 3. Documentation issues | Docs rating 1–5*. "List the documentation errors you found (if any)"* (format: page URL, section, what is wrong, what it should say). Missing or under-documented topics*. "Were the code examples runnable as written?"*. Which examples failed. Most useful page URL |
| 4. API pitfalls | Reliability rating 1–5*. Edge cases / unexpected behaviour* (endpoint, request, response). Unclear error messages* (quote exact message and endpoint). Latency per endpoint. "Did you hit rate limits during the event?"*. Rate-limit details. Auth/request-signing problems. Data you could not trust or reconcile (stale prices, decimals, token addresses, balances) |
| 5. AI stack feedback | Which parts used* (Agentic Wallet, Wallet Skills, Wallet Skills CLI, BNB Agent Studio, none). AI execution layer rating*. What worked. What did not. What is missing. BNB Agent Studio experience (one-prompt deploy, wallet provisioning, ERC-8004, ERC-8183, managed runtime, x402 self-funding, MCP registration) |
| 6. Tokenized-stock specifics | "Which tokenized stock platforms did you work with?"* (bStocks, Ondo, xStock, "None, my project did not execute trades"). Liquidity depth*. Slippage on your trade sizes*. Behaviour outside market hours*. On-chain vs underlying reference price gaps. Differences between the bStocks / Ondo / xStock representations of the same ticker |
| 7. Redesign suggestions and requested capabilities ("The section we care about most.") | Platform redesign so a developer can call immediately after landing*. Wanted endpoints/SDK/features/tooling* (one per line, with what you'd build). "What one change would have saved you the most time during this hackathon?"*. Will you keep building?*. Why. Anything else |

**INFERENCE (pipeline action):** the DX form asks for exact URLs, endpoints, error strings, latencies,
slippage figures and times-to-first-call. Log these **during** the build (a running `DEVEX_LOG.md`).
A human must write the final answers, because AI-generated reports are rejected.

### 3.3 Registration ([REG]: separate from submission)

Header (verbatim): "Register at the start of the hackathon so we can raise your Binance Web3 API rate
limits for the build window. One per team, takes a minute. Get your API key first at
https://web3.binance.com/en/dev-portal , then come back here with the account details. This is not
your project submission."

The required fields are:
- Team or project name
- Contact email ("Use the same address on your project submission and on your Developer Experience Report, it is how we match the three.")
- "Binance UID, or the email of the Binance account used to create your Web3 API key"
- Team size
- Eligibility checkbox

The optional fields are Telegram handle and "What are you thinking of building?".

[BLOG] "Simply register for the API service using a Binance account or an external wallet address to
get free API access for the whole hackathon, and winners keep elevated rate limits afterwards."

## 4. Judging criteria and weights

[EP] Tracks → "How You're Judged" (verbatim):

> Scores are pooled after each judge has worked through every project on their own.

| Criterion | Weight | What we look at |
| --- | --- | --- |
| **Technical implementation** | 30% | Does it run, and how deep does the integration go? Modules used, error handling, how it holds up. |
| **Creativity & originality** | 25% | Were the APIs used in ways nobody expected? Does this already exist five times over? |
| **Developer Experience Report** | 25% | Specific, actionable, honest, no fluff. Includes the AI stack section. |
| **Product quality & UX** | 20% | Is it usable by the people it is for? Would it bring non-crypto-native users on-chain? |

The weights sum to 100%. [BLOG] lists the identical weights. It names the second criterion "Creativity and
originality" and adds:

> There's no live PnL scoring. Doing it fairly over one week would need a slippage model,
> standardised capital, held-out snapshots and wash-trading review, which is more ops than the
> signal's worth.
>
> Screening comes first, on completeness and eligibility. Tie-breaks go on depth of W3W API usage
> first, then the quality of your feedback report.

[EP] Tracks (main track intro): "Agents are welcome and expected, and are scored on how well they are
built rather than on the PnL they could print, we don't track it for this edition."

[EP] Tracks → The Stack: Agentic Wallet / Wallet Skills is "Optional, heavily weighted in scoring and
tied to a special prize."

## 5. Prize structure

[EP] Prizes & Bounties (verbatim):

> **$20,000 total**, funded by BNB Chain and Binance Web3 Wallet.

| Placement | Prize |
| --- | --- |
| 🥇 1st place | $6,000 |
| 🥈 2nd place | $4,000 |
| 🥉 3rd place | $3,000 |
| 4th place | $2,000 |
| 5th place | $1,000 |

> Two stack specials at $2,000 each, awarded across every submission with no separate entry needed. You can win a main placement and a special.

| Special prize | Amount | Criteria |
| --- | --- | --- |
| **Best Use of Agentic Wallet / Wallet Skills** | $2,000 | Deepest, most credible use of the AI execution layer. Funded by Binance Web3 Wallet. |
| **Best Use of BNB Agent Studio** | $2,000 | Deepest use of Agent Studio: agent identity, autonomous runtime, self-funding via x402. Funded by BNB Chain. |

> #### Beyond the Cash
> - Free API access during the event, with elevated rate limits if you need.
> - A mentor for every finalist team, from across both partners.
> - Kickstart Package eligibility if you place near the top.
> - Agent Studio runtime credits for the event window, so you are not paying to keep an agent alive while you build (depending the hosting you choose, between 72 and 24h, only on testnet).
> - Winner spotlights on X and bnbchain.org.

Arithmetic check (lead): $6,000 + $4,000 + $3,000 + $2,000 + $1,000 = $16,000 main, plus $2,000 × 2 specials =
$20,000. This matches the CMS `prize_pool: 20000`. Prizes are paid to the ERC-20 wallet on BNB Smart Chain or the
Binance UID given in [SUB]. The payout token is not stated (gap).

## 6. Network rule (testnet vs mainnet)

[EP] Tracks → "The Rules of the Track" (verbatim):

> - At least one of **bStocks**, **Ondo** or **xStocks** has to be central to what you submit.
> - Cross-asset products are in scope, including pairing a tokenized equity leg with crypto or stablecoins.
> - Spot only. Perps are out.
> - **BSC mainnet only.** Dry-run with the Transaction API while you build, then demo with small live amounts. Teams fund their own wallets, and a few dollars is enough to prove the flow works.

- The [BLOG] repeats the same four rules ("BSC mainnet only. Dry-run with the Transaction API while you build, then demo with small live amounts. Teams fund their own wallets.").
- Tension: Agent Studio runtime credits are "only on testnet" [EP Prizes] (see §8 and `sponsors/bnb-chain.md`).

## 7. Other binding statements

- "The deliverable is a working project, not a deck." [EP Tracks]
- "Your repo, demo and deployed link must stay accessible through judging." [EP Overview]
- "Repos frozen." at submission lock [BLOG Key Dates]. **INFERENCE:** don't push to the submitted branch after 2026-10-11 12:00 UTC.
- "Everything you submit has to be built inside that window." / "Already have a product? You can enter a new integration into it, with a before and after." [BLOG]
- "Combining API modules in a way that looks like it should not work but does is exactly what we are hoping to see." [EP Tracks]

## 8. Conflicts and ambiguities (record both, then decide)

| # | Topic | Source A | Source B | Lead's reading |
|---|---|---|---|---|
| C1 | Demo video | [EP] "(strongly recommended but optional)" | [SUB] "Demo video URL" is a **required** field. [BLOG] lists the video under the mandatory project, and unrunnable projects are "scored on the video alone" | **Treat as required.** ≤ 4:00, publicly viewable. |
| C2 | Judging window | [EP] "Judging 12 - 23 Oct" | [BLOG] "October 12 to 14 - Screening." / "October 15 to 23 - Judging." | Compatible: screening is the first phase. Keep the deployment alive at least until the week of 26 Oct. |
| C3 | Build length | [EP] "Four and a half weeks" | [BLOG] "three and a half weeks" | Dates rule: 16 Sep → 11 Oct (25 days). |
| C4 | Restricted regions | [EP] lists 11 jurisdictions incl. Japan | [BLOG] "US and the UK … alongside the standard restricted locations". [RR] Japan is conditional | Use the [EP] list for eligibility and the [RR] list for API reachability (IP checks). |
| C5 | Agent Studio credits | [EP] "between 72 and 24h, only on testnet" | Agent Studio page: "Run free for 48 hours on BNB Chain's managed testnet sandbox. Testnet-only, and the clock starts on your first successful deploy." | Unresolved. Ask in the builder Telegram. Plan for 48h. |
| C6 | xStocks coverage | [EP] Track: "At least one of **bStocks**, **Ondo** or **xStocks**". [BLOG] "the Binance Web3 API is your single point of aggregation across bStocks, Ondo or xStocks" | RWA Data API OpenAPI: `platformId` enum is `["ondo", "bstock"]` only. Agentic Wallet "Tokenized Securities" use case covers "bStock and Ondo" | xStocks exist on BSC (130 tokens in Binance's public list) and are swappable by contract address, but they are **not** in the RWA Data API platform filter. See `sponsors/tokenized-stock-issuers.md`. |
| C7 | "Reference price" meaning | [EP] Stack: "on-chain price against the underlying reference price". Idea "The RWA Data API returns both prices. Track the spread and act on it." | OpenAPI `referencePrice`: "A per-share converted price derived from the on-chain token price, not an official quote from the traditional stock market." | The spread between the two RWA fields is a token-to-share **conversion**, not an independent market gap. A real gap signal needs an independent quote source. See the sponsor file. |
| C8 | API access path | [BLOG] "register for the API service using a Binance account or an external wallet address" | [REG] asks for "Binance UID, or the email of the Binance account used to create your Web3 API key" | Gap: confirm in the Developer Portal (user sign-in required). |
| C9 | "DevEx Report template" | [EP Resources] "Developer Experience Report template: https://forms.gle/EUQ39xf54GHjC2ys5" | That link is the report **submission form** itself ([DX]) | Submit the report through the form. A `DEVEX_REPORT.md` in the repo is optional. |

## 9. Not published (as of 2026-10-05)

- The [EP] CMS fields `rules`, `faq`, `judges`, `timeline`, `winners`, `sponsor_track` and `bountySponsors` are all empty. No Rules, FAQ, Judges or Timeline tab exists. The page shows only Overview, Prizes & Bounties, Tracks and Resources.
- No DoraHacks or other platform listing was found. Submission and registration are Google Forms only.
- The workshop is "to be announced". Office hours and Q&A run in the builder Telegram (gated; not read).
- The prize payout token or currency for the USD amounts is not stated.
