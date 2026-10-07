---
name: pop-follower
description: |
  Use when the user wants to follow Proof of Position stock calls with their Binance Agentic Wallet:
  mirror a caller's tokenized-stock (bStock) calls on BSC, exit automatically when the caller's
  on-chain badge flips (they trimmed, sold or closed), check the follower's readiness or its
  mirrored positions, or run a small buy-and-sell smoke test.
metadata:
  author: proof-of-position
  version: '0.1.0'
  openclaw:
    requires:
      bins:
        - baw
        - pop-follower
---

# Proof of Position follower

Proof of Position is a feed of stock calls that can only be posted by someone who holds the
tokenized stock on BSC. Each call's badge (HOLDING, TRIMMED, EXITED, CLOSED) is read on-chain from
the caller's live balance by the CallRegistry contract. `pop-follower` turns that badge into
orders on the user's Binance Agentic Wallet:

- when a followed caller posts a HOLDING call on a **bStock**, it buys `--budget-usdt` USDT of it;
- when that call's badge flips (TRIMMED, EXITED, CLOSED, or an exit recorded on-chain), it sells
  exactly the quantity it bought, back to USDT.

It drives the `baw` CLI (Agentic Wallet 1.10.0+) and reads the registry from public BSC RPC.

## Before anything

1. Run `pop-follower check`. It verifies the `baw` version, that the wallet is CONNECTED, how long
   the session has left, the daily quota, the BSC address and its USDT balance.
2. `baw` missing or older than 1.10.0: `npm install -g @binance/agentic-wallet@1.10.0`.
3. Wallet not CONNECTED: run `baw auth signin` and approve it in the Binance App.

Getting `pop-follower` itself (from a clone of `officialhulk40-coder/proof-of-position`):

~~~bash
pnpm install
cd agents/follower
pnpm link --global
~~~

Without linking, every command also runs from the repository root as
`pnpm --filter @pop/follower run cli <command> [options]`.

## Command routing

| User intent | Command | Reference |
|---|---|---|
| Is everything ready? | `pop-follower check` | [commands.md](references/commands.md) |
| Follow one or more callers | `pop-follower run --caller <0x…> --budget-usdt <n>` | [commands.md](references/commands.md), [policy.md](references/policy.md) |
| What is it holding? | `pop-follower status` | [commands.md](references/commands.md) |
| Prove the wallet can trade | `pop-follower smoke --token NVDAB --usdt 0.5 --yes` | [commands.md](references/commands.md) |
| Something failed | — | [troubleshooting.md](references/troubleshooting.md) |

## Rules for the agent

- **Confirm before anything that moves funds.** `run` and `smoke --yes` trade real tokens on BSC
  mainnet. Before starting either, state the caller address(es) in full, the USDT budget per call,
  the maximum open mirrors, and that the Agentic Wallet's own limits still apply. Proceed only on a
  clear yes. Starting `run` is the user's standing authorization within that budget.
- **Read the policy first** ([policy.md](references/policy.md)): the follower acts only on registry
  status, never exceeds the budget, and sells only what it bought.
- **Report errors verbatim.** Relay `pop-follower` and `baw` error text exactly; do not guess causes.
- **No advice.** A badge proves the caller's BSC position, not hedges held elsewhere. Following a call
  is not investment advice. bStocks, Ondo and xStocks are not available to US persons or other
  restricted persons; the user confirms eligibility.
- **Never ask for secrets.** The follower needs no keys: signing happens inside the Agentic Wallet.
