# pop-follower troubleshooting

Relay errors verbatim; the fixes below match the exact messages.

| Message | Meaning | Fix |
|---|---|---|
| `could not start baw: …` | the Agentic Wallet CLI is not installed or not on PATH | `npm install -g @binance/agentic-wallet@1.10.0` |
| `baw 1.8.0 is older than 1.10.0: …` | the CLI is too old | run the printed `npm install -g` command |
| `Agentic Wallet is UNCONNECTED: …` | signed out (sessions expire, and sign out after inactivity) | `baw auth signin`, approve in the Binance App, restart the follower |
| `WARNING: session expires … (N h left)` | the session ends within 6 hours | sign in again before a long run |
| `WARNING: tradeAllTokens is off: …` | the wallet trades only allow-listed tokens | allow the bStocks in the Binance App → Agentic Wallet → Settings |
| `wallet LOCKED (…); waiting` | a transaction is pending, or a double-confirm waits in the Binance App | approve or reject it in the Binance App (5-minute timeout) |
| `the wallet stayed LOCKED … for 90 s` | the lock did not clear | resolve the pending confirmation, then the next pass continues |
| `BUY: order … FAILED twice` | the swap failed on-chain twice (slippage, liquidity, routing) | check `baw market-order list --orderId <id> --json`; the call is not retried |
| `order … is still PENDING after 90 s` | the order is slow | check it later with `baw market-order list --orderId <id> --json` |
| `SELL for call #… failed: … — sell … manually` | the exit sell failed twice | sell the quantity shown by `pop-follower status` with `baw market-order swap` |
| `BUY order … finished but the token balance did not increase` | the fill did not show on the RPC read | retry with another `BSC_RPC_URLS` entry; check BscScan |
| `error: set REGISTRY_ADDRESS to the deployed CallRegistry` | the registry address is missing | export `REGISTRY_ADDRESS` (from the project's README) |
| a zod error while loading state | the state file is corrupt | move the file named by `POP_FOLLOWER_STATE` aside and restart |
