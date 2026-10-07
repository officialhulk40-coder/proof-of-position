import { formatUnits18, getTokenInfo, readCallCount, readCallsFrom, type CallView, type RegistryReader, type TelemetryEvent } from "@pop/core";
import { decide, type Action, type FollowerConfig, type FollowerState, type Mirror } from "./decide";
import { executeBuy, executeSell, requireConnected, WalletSignedOutError, type ExecutorDeps } from "./executor";
import { loadState, saveState } from "./state";

export interface FollowerDeps {
  chain: RegistryReader;
  registry: `0x${string}`;
  executor: ExecutorDeps;
  config: FollowerConfig;
  statePath: string;
  log: (line: string) => void;
  /** DevEx telemetry (JSONL); optional. */
  record?: (event: TelemetryEvent) => void;
}

export interface Follower {
  readonly state: FollowerState;
  /** One pass: read the registry, decide, execute sequentially, persist. Returns what it did. */
  tick(): Promise<Action[]>;
}

function symbolOf(token: string): string {
  return getTokenInfo(token)?.symbol ?? token;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Loads (or starts) the state. On first start the cursor is the current call count, so only calls
 * posted from now on are mirrored; `includeExisting` starts it at 0 instead.
 */
export async function createFollower(deps: FollowerDeps, options: { includeExisting?: boolean } = {}): Promise<Follower> {
  let state = loadState(deps.statePath);
  if (state === null) {
    const cursor = options.includeExisting ? 0 : await readCallCount(deps.chain, deps.registry);
    state = { version: 1, cursor, mirrors: {} };
    saveState(deps.statePath, state);
    deps.log(`pop-follower: new state at ${deps.statePath}; mirroring calls from #${cursor}`);
  }
  const current: FollowerState = state;
  let running = false;

  async function buy(call: CallView, detectedAt: number): Promise<void> {
    const symbol = symbolOf(call.token);
    deps.log(`Call #${call.id}: ${call.caller} is HOLDING ${symbol} — buying ${deps.config.budgetUsdt} USDT of it`);
    const base: Mirror = {
      callId: call.id,
      caller: call.caller,
      token: call.token,
      status: "failed",
      quantity: "0",
      buyOrderId: null,
      buyTxHash: null,
      sellOrderId: null,
      sellTxHash: null,
      openedAt: null,
      closedAt: null,
      exitReason: null,
      error: null,
    };
    try {
      const result = await executeBuy(deps.executor, { token: call.token, budgetUsdt: deps.config.budgetUsdt });
      current.mirrors[String(call.id)] = {
        ...base,
        status: "open",
        quantity: result.quantity.toString(),
        buyOrderId: result.orderId,
        buyTxHash: result.txHash,
        openedAt: new Date(result.finishedAt).toISOString(),
      };
      deps.log(`Mirrored call #${call.id}: you hold ${formatUnits18(result.quantity, 6)} ${symbol} alongside them (order ${result.orderId}, ${((result.finishedAt - detectedAt) / 1000).toFixed(1)} s)`);
      deps.record?.({
        kind: "follower.buy",
        callId: call.id,
        token: call.token,
        orderId: result.orderId,
        txHash: result.txHash,
        detectToSubmitMs: result.submittedAt - detectedAt,
        submitToFinishMs: result.finishedAt - result.submittedAt,
      });
    } catch (error) {
      if (error instanceof WalletSignedOutError) throw error;
      current.mirrors[String(call.id)] = { ...base, error: errorText(error) };
      deps.log(`BUY for call #${call.id} failed: ${errorText(error)}`);
    }
  }

  async function sell(call: CallView, mirror: Mirror, reason: string, detectedAt: number): Promise<void> {
    const symbol = symbolOf(mirror.token);
    const quantity = BigInt(mirror.quantity);
    deps.log(`Call #${call.id} is ${reason} — selling the mirrored ${formatUnits18(quantity, 6)} ${symbol}`);
    try {
      const result = await executeSell(deps.executor, { token: mirror.token as `0x${string}`, quantity });
      Object.assign(mirror, {
        status: "closed",
        sellOrderId: result.orderId,
        sellTxHash: result.txHash,
        closedAt: new Date(result.finishedAt).toISOString(),
        exitReason: reason,
        error: null,
      } satisfies Partial<Mirror>);
      deps.log(`Caller exited — sold ${formatUnits18(quantity, 6)} ${symbol} in ${((result.finishedAt - detectedAt) / 1000).toFixed(1)} s (order ${result.orderId}, tx ${result.txHash ?? "n/a"})`);
      deps.record?.({
        kind: "follower.sell",
        callId: call.id,
        reason,
        exitBlock: call.exitBlock.toString(),
        orderId: result.orderId,
        txHash: result.txHash,
        detectToSubmitMs: result.submittedAt - detectedAt,
        submitToFinishMs: result.finishedAt - result.submittedAt,
      });
    } catch (error) {
      if (error instanceof WalletSignedOutError) throw error;
      Object.assign(mirror, { status: "failed", error: errorText(error) } satisfies Partial<Mirror>);
      deps.log(`SELL for call #${call.id} failed: ${errorText(error)} — sell ${symbol} manually`);
    }
  }

  return {
    get state() {
      return current;
    },
    async tick() {
      if (running) return [];
      running = true;
      try {
        const openIds = Object.values(current.mirrors)
          .filter((mirror) => mirror.status === "open")
          .map((mirror) => mirror.callId);
        const calls = await readCallsFrom(deps.chain, deps.registry, Math.min(current.cursor, ...openIds));
        const actions = decide(calls, current, deps.config);
        if (actions.length === 0) return [];
        await requireConnected(deps.executor.baw);
        for (const action of actions) {
          const detectedAt = deps.executor.now();
          if (action.kind === "SELL") await sell(action.call, action.mirror, action.reason, detectedAt);
          else await buy(action.call, detectedAt);
          saveState(deps.statePath, current);
        }
        return actions;
      } finally {
        running = false;
      }
    },
  };
}
