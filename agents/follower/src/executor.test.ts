import { describe, expect, it } from "vitest";
import { executeBuy, executeSell, OrderFailedError, requireConnected, WalletSignedOutError, type ExecutorDeps } from "./executor";
import { manualClock, NVDAB, scriptedBaw, WALLET } from "./testing";

const USDT = "0x55d398326f99059fF775485246999027B3197955";

function deps(handlers: Parameters<typeof scriptedBaw>[0], balances: bigint[]) {
  const { runner, calls } = scriptedBaw(handlers);
  const clock = manualClock();
  const lines: string[] = [];
  const reads = [...balances];
  const executor: ExecutorDeps = {
    baw: runner,
    balanceOf: async () => (reads.length > 1 ? (reads.shift() as bigint) : (reads[0] as bigint)),
    wallet: WALLET,
    now: clock.now,
    sleep: clock.sleep,
    log: (line) => lines.push(line),
  };
  return { executor, calls, lines, clock };
}

function orders(...statuses: string[]) {
  let index = 0;
  let submitted = 0;
  return {
    "market-order swap": () => ({ orderId: `o${++submitted}` }),
    "market-order list": (args: readonly string[]) => {
      const status = statuses[Math.min(index, statuses.length - 1)];
      index += 1;
      return { list: [{ orderId: args[3], status, txHash: status === "FINISHED" ? "0xfeed" : null }] };
    },
  };
}

describe("executeBuy", () => {
  it("submits, polls to FINISHED and measures the balance increase", async () => {
    const { executor, calls } = deps({ "wallet tx-lock": () => ({ status: "UNLOCKED" }), ...orders("PENDING", "FINISHED") }, [100n, 100n, 5_300_000_000_000_100n]);
    const result = await executeBuy(executor, { token: NVDAB, budgetUsdt: "1" });
    expect(result).toMatchObject({ orderId: "o1", txHash: "0xfeed", quantity: 5_300_000_000_000_000n });
    expect(result.finishedAt - result.submittedAt).toBe(4_000);
    expect(calls[1]).toEqual(["market-order", "swap", "--fromTokenQty", "1", "--fromToken", USDT, "--toToken", NVDAB, "--binanceChainId", "56", "--slippage", "auto", "--mev", "true", "--json"]);
  });

  it("waits while the wallet is LOCKED", async () => {
    let locks = 2;
    const { executor, lines } = deps({ "wallet tx-lock": () => ({ status: locks-- > 0 ? "LOCKED" : "UNLOCKED" }), ...orders("FINISHED") }, [0n, 7n]);
    expect((await executeBuy(executor, { token: NVDAB, budgetUsdt: "1" })).quantity).toBe(7n);
    expect(lines.filter((line) => line.startsWith("wallet LOCKED"))).toHaveLength(2);
  });

  it("retries a FAILED order once, then gives up", async () => {
    const retried = deps({ "wallet tx-lock": () => ({ status: "UNLOCKED" }), ...orders("FAILED", "FINISHED") }, [0n, 7n]);
    expect((await executeBuy(retried.executor, { token: NVDAB, budgetUsdt: "1" })).orderId).toBe("o2");
    expect(retried.lines).toContain("BUY: order o1 FAILED; retrying once");
    const failing = deps({ "wallet tx-lock": () => ({ status: "UNLOCKED" }), ...orders("FAILED") }, [0n]);
    await expect(executeBuy(failing.executor, { token: NVDAB, budgetUsdt: "1" })).rejects.toThrow(new OrderFailedError("BUY: order o2 FAILED twice"));
  });

  it("times out an order that never finishes", async () => {
    const { executor } = deps({ "wallet tx-lock": () => ({ status: "UNLOCKED" }), ...orders("PENDING") }, [0n]);
    await expect(executeBuy(executor, { token: NVDAB, budgetUsdt: "1" })).rejects.toThrow("order o1 is still PENDING after 90 s");
  });
});

describe("executeSell", () => {
  it("sells exactly the mirrored quantity back to USDT", async () => {
    const { executor, calls } = deps({ "wallet tx-lock": () => ({ status: "UNLOCKED" }), ...orders("FINISHED") }, [0n]);
    await executeSell(executor, { token: NVDAB, quantity: 5_300_000_000_000_001n });
    expect(calls[1]?.slice(0, 8)).toEqual(["market-order", "swap", "--fromTokenQty", "0.005300000000000001", "--fromToken", NVDAB, "--toToken", USDT]);
  });
});

describe("requireConnected", () => {
  it("stops on a signed-out wallet", async () => {
    const { runner } = scriptedBaw({ "wallet status": () => ({ status: "UNCONNECTED" }) });
    await expect(requireConnected(runner)).rejects.toBeInstanceOf(WalletSignedOutError);
    const ok = scriptedBaw({ "wallet status": () => ({ status: "CONNECTED" }) });
    await expect(requireConnected(ok.runner)).resolves.toBeUndefined();
  });
});
