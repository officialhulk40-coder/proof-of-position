# pop-follower policy

What the follower does, and what it never does.

## It acts only on the registry

- Its only signal is the CallRegistry's status for each call, read from BSC: HOLDING, TRIMMED,
  EXITED, CLOSED, and whether an exit was recorded. No prices, no sentiment, no other feeds.
- It follows only the callers named with `--caller`, and only calls on **bStocks** (Ondo trades only
  by RFQ, and xStocks have too little BSC liquidity).
- On first start it mirrors only calls posted from then on, unless `--include-existing` is given.

## It never exceeds the budget

- Each mirrored call spends exactly `--budget-usdt` USDT.
- At most `--max-open` mirrors are open at once.
- A buy that fails twice is marked failed and never retried for that call.
- The Agentic Wallet's own limits (daily quota, allowed tokens, abnormal-transaction handling) still
  apply on top, and the follower cannot change them.

## It sells only what it bought

- The quantity of a mirror is the wallet's on-chain balance increase from that buy.
- On a flip it sells exactly that quantity, never the rest of the wallet's holding.
- A sell that fails twice is marked failed and reported: the user sells by hand.

## The only commands it runs

`baw cli-check`, `baw wallet status`, `baw wallet address`, `baw wallet settings`,
`baw wallet tx-lock`, `baw market-order swap` and `baw market-order list`. Every order is a BSC
market order with `--slippage auto` and MEV protection on.

## Authorization

Starting `pop-follower run` is the user's standing authorization to trade within the stated budget
until they stop it (Ctrl+C). A signed-out wallet stops the loop with "sign in again". State lives in
`POP_FOLLOWER_STATE` (default `~/.pop-follower/state.json`), so a restart resumes the same mirrors.
