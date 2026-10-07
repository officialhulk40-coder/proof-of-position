import { W3wApiError, formatUnits18, getTokenTrades, type CallView } from "@pop/core";
import { parseAbiItem } from "viem";
import type { ServerDeps } from "../deps";

export interface ExitEvidence {
  /** sale: Market API saw a sell · contract: tokens moved into a contract (likely a swap) · transfer: moved to a wallet. */
  kind: "sale" | "contract" | "transfer";
  txHash: string;
  /** Token amount, decimal string. */
  amount: string | null;
  timeMs: number | null;
  priceUsd: string | null;
  volumeUsd: string | null;
  dexName: string | null;
  counterparty: string | null;
  source: "market-api" | "rpc-logs";
}

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

/** How far back the logs fallback looks: 400 blocks ≈ 3 minutes at 0.45 s blocks. */
export const LOG_LOOKBACK_BLOCKS = 400n;

/**
 * Where did the caller's tokens go? First the Market API (`trades` with `walletAddressFilter`, newest
 * sell at or after the post), then `Transfer(from = caller)` logs on the getLogs-capable RPC.
 */
export async function findExitEvidence(deps: Pick<ServerDeps, "w3w" | "logs">, call: CallView): Promise<ExitEvidence | null> {
  if (deps.w3w !== null) {
    try {
      const page = await getTokenTrades(deps.w3w, { token: call.token, wallets: [call.caller], limit: 20 });
      const sale = page.trades.find((trade) => trade.type.toLowerCase() === "sell" && trade.time >= call.postedAt * 1000);
      if (sale) {
        return {
          kind: "sale",
          txHash: sale.txHash,
          amount: sale.changedTokenInfo[0]?.amount ?? null,
          timeMs: sale.time,
          priceUsd: sale.price ?? null,
          volumeUsd: sale.volume ?? null,
          dexName: sale.dexName ?? null,
          counterparty: null,
          source: "market-api",
        };
      }
    } catch (error) {
      if (!(error instanceof W3wApiError)) throw error;
    }
  }

  const latest = await deps.logs.getBlockNumber();
  const floor = latest > LOG_LOOKBACK_BLOCKS ? latest - LOG_LOOKBACK_BLOCKS : 0n;
  const fromBlock = call.postedBlock > floor ? call.postedBlock : floor;
  const logs = await deps.logs.getLogs({ address: call.token, event: TRANSFER_EVENT, args: { from: call.caller }, fromBlock, toBlock: latest });
  const last = logs[logs.length - 1];
  if (!last || last.args.to === undefined || last.transactionHash === null) return null;
  const code = await deps.logs.getCode({ address: last.args.to });
  return {
    kind: code !== undefined && code !== "0x" ? "contract" : "transfer",
    txHash: last.transactionHash,
    amount: last.args.value === undefined ? null : formatUnits18(last.args.value, 6),
    timeMs: null,
    priceUsd: null,
    volumeUsd: null,
    dexName: null,
    counterparty: last.args.to,
    source: "rpc-logs",
  };
}
