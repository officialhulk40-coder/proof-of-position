# pop-follower commands

Every command prints plain text. Exit codes: `0` success, `1` error or bad arguments, `2` the
Agentic Wallet is signed out.

Environment variables (names only, never values in chat):

| Variable | Used by | Purpose |
|---|---|---|
| `REGISTRY_ADDRESS` | `run` | the deployed CallRegistry on BSC mainnet |
| `BSC_RPC_URLS` | all | comma-separated BSC RPC list (default: the official dataseed endpoints) |
| `POP_FOLLOWER_STATE` | `run`, `status` | state file (default `~/.pop-follower/state.json`) |
| `DEVEX_TELEMETRY_FILE` | `run` | optional JSONL file for latency events |

## `pop-follower check`

Preflight. Runs `baw cli-check --required-version 1.10.0`, `baw wallet status`,
`baw wallet settings` and `baw wallet address`, then reads the address's USDT balance on BSC.

~~~text
baw 1.10.0 ✓
wallet CONNECTED ✓
session expires 2026-10-10T06:32:05+08:00 (19.5 h left)
daily quota left: $49000
BSC address 0x…
USDT balance 12.34
~~~

Warnings go to stderr: a session with less than 6 hours left, and `tradeAllTokens` off (the stocks
being followed must then be on the wallet's allowed list in the Binance App).

## `pop-follower run`

~~~bash
pop-follower run --caller <0x…> [--caller <0x…>] --budget-usdt <n> [--max-open <n>] [--include-existing] [--once]
~~~

| Option | Meaning |
|---|---|
| `--caller` | a caller to follow (repeat for several) |
| `--budget-usdt` | USDT spent on each mirrored call |
| `--max-open` | most mirrors held at once (default 1) |
| `--include-existing` | on first start, also mirror calls that were already open |
| `--once` | run a single pass and exit |

Every second it reads the registry, then:

- BUY: a followed caller's HOLDING call on a bStock, newer than the start (unless
  `--include-existing`), with no exit recorded, while fewer than `--max-open` mirrors are open;
- SELL: a mirrored call that is now TRIMMED, EXITED or CLOSED, or has an exit recorded.

Each order is `baw market-order swap … --slippage auto --mev true`, polled with
`baw market-order list --orderId <id>` every 2 s until FINISHED or FAILED (90 s cap). Typical output:

~~~text
Call #7: 0x… is HOLDING NVDAB — buying 1 USDT of it
Mirrored call #7: you hold 0.0053 NVDAB alongside them (order 1812…, 6.1 s)
Call #7 is EXITED — selling the mirrored 0.0053 NVDAB
Caller exited — sold 0.0053 NVDAB in 8.4 s (order 1812…, tx 0x…)
~~~

## `pop-follower status`

Prints the state file: the start cursor and each mirror (call id, token, quantity, open / closed /
failed, the order ids, and the error of a failed mirror).

## `pop-follower smoke`

~~~bash
pop-follower smoke --token NVDAB --usdt 0.5 [--yes]
~~~

Without `--yes` it only describes the round trip. With `--yes` it buys `--usdt` USDT of the bStock
and immediately sells exactly what arrived, printing each order id, tx hash and the
submit-to-FINISHED latency. It moves real funds: confirm with the user first.
