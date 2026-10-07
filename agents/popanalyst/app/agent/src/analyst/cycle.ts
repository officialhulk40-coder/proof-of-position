import {
  ADDRESSES,
  ERC20_ABI,
  NoSwapRouteError,
  W3wApiError,
  formatUnits18,
  parseUnits18,
  readCallsFrom,
  requireTokenBySymbol,
  swapWithTradingApi,
  type CallView,
  type RegistryReader,
  type SwapClient,
  type TelemetryEvent,
  type TokenInfo,
  type TxSigner,
  type W3wClient,
} from "@pop/core";
import type { AnalystConfig } from "./config.js";
import { closeCall, postAsAgent } from "./registry.js";
import type { Research } from "./research.js";

/** Trading API codes that mean "not tradable right now": bStock RFQ closed (40369), no liquidity (40374). */
const NOT_TRADABLE_NOW = new Set([40369, 40374]);

export interface CycleDeps {
  config: AnalystConfig & { registry: `0x${string}`; agentId: bigint };
  w3w: W3wClient;
  client: SwapClient & RegistryReader;
  signer: TxSigner;
  research: (token: TokenInfo) => Promise<Research>;
  thesis: (research: Research) => Promise<{ text: string; source: "llm" | "template" }>;
  /** Milliseconds since the epoch. */
  now: () => number;
  log: (line: string) => void;
  record?: (event: TelemetryEvent) => void;
}

export interface CycleResult {
  closed: number[];
  posted: { callId: number; symbol: string; txHash: string } | null;
  skipped: string[];
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * One analyst cycle (spec §8.2): (1) close own calls older than holdHours — close first, so the
 * registry records held-through honestly — then sell those positions; (2) for the first watchlist
 * bStock without an open call that can be bought now: research, thesis, buy, postAsAgent with the
 * amount actually received. At most one new call per cycle; every signature follows a simulation.
 */
export async function runCycle(deps: CycleDeps): Promise<CycleResult> {
  const { config } = deps;
  const me = deps.signer.address.toLowerCase();
  const writer = { w3w: deps.w3w, client: deps.client, signer: deps.signer, registry: config.registry };
  const mine = (await readCallsFrom(deps.client, config.registry, 0)).filter((call) => call.caller.toLowerCase() === me);
  const open = mine.filter((call) => call.closedBlock === 0n);
  const result: CycleResult = { closed: [], posted: null, skipped: [] };

  const holdSeconds = config.holdHours * 3_600;
  for (const call of open.filter((c: CallView) => deps.now() / 1_000 - c.postedAt >= holdSeconds)) {
    const closed = await closeCall(writer, call.id);
    result.closed.push(call.id);
    deps.log(`closed call #${call.id} (${closed.heldThrough === true ? "held through ✓" : "exited while open"}) in ${closed.txHash}`);
    const balance = await deps.client.readContract({ address: call.token, abi: ERC20_ABI, functionName: "balanceOf", args: [deps.signer.address] });
    if (balance > 0n) {
      const sold = await swapWithTradingApi({ w3w: deps.w3w, client: deps.client, signer: deps.signer, fromToken: call.token, toToken: ADDRESSES.usdt, amount: balance, mev: true });
      deps.log(`sold ${formatUnits18(balance, 6)} of ${call.token} for ${formatUnits18(sold.received, 4)} USDT in ${sold.swap.txHash}`);
    }
    deps.record?.({ kind: "analyst.close", callId: call.id, heldThrough: closed.heldThrough, txHash: closed.txHash });
  }

  const stillOpen = new Set(open.filter((call) => !result.closed.includes(call.id)).map((call) => call.token.toLowerCase()));
  for (const symbol of config.watchlist) {
    const token = requireTokenBySymbol(symbol);
    if (stillOpen.has(token.address)) {
      result.skipped.push(`${symbol}: a call is already open`);
      continue;
    }
    const research = await deps.research(token);
    const thesis = await deps.thesis(research);
    let bought;
    try {
      bought = await swapWithTradingApi({ w3w: deps.w3w, client: deps.client, signer: deps.signer, fromToken: ADDRESSES.usdt, toToken: token.address, amount: parseUnits18(config.buyUsdt), mev: true });
    } catch (error) {
      if (error instanceof NoSwapRouteError || (error instanceof W3wApiError && NOT_TRADABLE_NOW.has(error.code))) {
        result.skipped.push(`${symbol}: ${errorText(error)}`);
        continue;
      }
      throw error;
    }
    const posted = await postAsAgent(writer, { token: token.address, amount: bought.received, agentId: config.agentId, note: thesis.text });
    result.posted = { callId: posted.callId, symbol, txHash: posted.txHash };
    deps.log(`posted call #${posted.callId}: LONG ${symbol} ${formatUnits18(bought.received, 6)} (thesis by ${thesis.source}) in ${posted.txHash}`);
    deps.record?.({
      kind: "analyst.post",
      callId: posted.callId,
      symbol,
      amount: bought.received.toString(),
      thesisSource: thesis.source,
      cmcPaidUsd: research.cmc?.paidUsd ?? null,
      buyTxHash: bought.swap.txHash,
      postTxHash: posted.txHash,
    });
    return result;
  }
  return result;
}
