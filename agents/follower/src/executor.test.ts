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

describe("order id mismatch (live: the swap's id is unknown to list --orderId)", () => {
  const SWAP_ID = "26101100001956594351";
  const REAL_ID = "26101100001956594394";

  it("adopts the newest list order with the same pair and amount when the id lookup misses", async () => {
    const { executor, calls, lines } = deps(
      {
        "wallet tx-lock": () => ({ status: "UNLOCKED" }),
        "market-order swap": () => ({ code: 0, stdout: `{"success":true,"data":{"orderId":${SWAP_ID}}}`, stderr: "" }),
        "market-order list": (args) =>
          args[2] === "--orderId"
            ? { total: 0, list: [] }
            : {
                total: 3,
                list: [
                  { orderId: "1", fromToken: USDT, toToken: NVDAB, fromTokenQty: "0.700000000000000000", status: "FINISHED", bookTime: "2026-10-11T11:13:55+05:30" },
                  { orderId: REAL_ID, fromToken: USDT, toToken: "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436", fromTokenQty: "0.500000000000000000", status: "FINISHED", txHash: "0x7e56", bookTime: "2026-10-11T11:13:51+05:30" },
                  { orderId: "2", fromToken: USDT, toToken: NVDAB, fromTokenQty: "0.5", status: "FAILED", bookTime: "2026-10-11T11:10:00+05:30" },
                ],
              },
      },
      [0n, 2_169_936_093_013_576n],
    );
    const result = await executeBuy(executor, { token: NVDAB, budgetUsdt: "0.5" });
    expect(result).toMatchObject({ orderId: REAL_ID, txHash: "0x7e56", quantity: 2_169_936_093_013_576n });
    expect(calls[2]).toEqual(["market-order", "list", "--orderId", SWAP_ID, "--json"]);
    expect(calls[3]).toEqual(["market-order", "list", "--binanceChainId", "56", "--fromToken", USDT, "--toToken", NVDAB, "--startTime", "940000", "--pageSize", "20", "--json"]);
    expect(lines).toContain(`order ${SWAP_ID} is not found by id; tracking order ${REAL_ID} (same pair and amount)`);
  });

  it("keeps the unknown-order timeout when nothing in the list matches", async () => {
    const { executor } = deps(
      {
        "wallet tx-lock": () => ({ status: "UNLOCKED" }),
        "market-order swap": () => ({ orderId: SWAP_ID }),
        "market-order list": (args) =>
          args[2] === "--orderId" ? { list: [] } : { list: [{ orderId: REAL_ID, fromToken: USDT, toToken: NVDAB, fromTokenQty: "0.7", status: "FINISHED" }] },
      },
      [0n],
    );
    await expect(executeBuy(executor, { token: NVDAB, budgetUsdt: "0.5" })).rejects.toThrow(`order ${SWAP_ID} is still unknown after 90 s`);
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
