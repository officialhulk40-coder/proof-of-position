import { describe, expect, it } from "vitest";
import { BawError, bawJson, bscAddress, cliCheck, createBawRunner, getMarketOrder, marketSwap, txLock, walletSettings, walletStatus } from "./baw";
import { NVDAB, scriptedBaw } from "./testing";
import { z } from "zod";

const USDT = "0x55d398326f99059fF775485246999027B3197955";

describe("bawJson", () => {
  it("appends --json and returns data", async () => {
    const { runner, calls } = scriptedBaw({ "wallet status": () => ({ status: "CONNECTED" }) });
    expect(await bawJson(runner, ["wallet", "status"], z.object({ status: z.string() }))).toEqual({ status: "CONNECTED" });
    expect(calls).toEqual([["wallet", "status", "--json"]]);
  });

  it("reports the CLI's own error text", async () => {
    const { runner } = scriptedBaw({
      "wallet status": () => ({ code: 1, stdout: JSON.stringify({ success: false, error: { message: "Session expired, please sign in again" } }), stderr: "" }),
    });
    await expect(walletStatus(runner)).rejects.toThrow("baw wallet status failed: Session expired, please sign in again");
  });

  it("explains output that is not JSON", async () => {
    const { runner } = scriptedBaw({ "wallet status": () => ({ code: 127, stdout: "", stderr: "baw: command not found" }) });
    const error = await walletStatus(runner).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BawError);
    expect((error as Error).message).toBe("baw wallet status printed no JSON (exit 127): baw: command not found");
  });
});

describe("baw commands", () => {
  it("builds the documented command lines", async () => {
    const { runner, calls } = scriptedBaw({
      "cli-check": () => ({ currentCliVersion: "1.10.0", needUpdateCli: false }),
      "wallet address": () => ({ addresses: [{ binanceChainId: "CT_501", address: "Sol1" }, { binanceChainId: "56", address: "0xAbCd000000000000000000000000000000000001" }] }),
      "wallet settings": () => ({ sessionExpireTime: "2026-10-08T06:32:05+08:00", quotaLeft: 49000, tradeAllTokens: false }),
      "wallet tx-lock": () => ({ status: "UNLOCKED" }),
      "market-order swap": () => ({ orderId: 1234567890 }),
      "market-order list": () => ({ total: 1, page: 1, pageSize: 20, list: [{ orderType: "market", orderId: "1234567890", status: "FINISHED", txHash: "0xabc" }] }),
    });
    expect(await cliCheck(runner)).toEqual({ currentCliVersion: "1.10.0", needUpdateCli: false });
    expect(await bscAddress(runner)).toBe("0xabcd000000000000000000000000000000000001");
    expect((await walletSettings(runner)).tradeAllTokens).toBe(false);
    expect(await txLock(runner)).toBe("UNLOCKED");
    expect(await marketSwap(runner, { fromTokenQty: "1", fromToken: USDT, toToken: NVDAB })).toBe("1234567890");
    expect(await getMarketOrder(runner, "1234567890")).toMatchObject({ orderId: "1234567890", status: "FINISHED", txHash: "0xabc" });
    expect(calls).toEqual([
      ["cli-check", "--required-version", "1.10.0", "--json"],
      ["wallet", "address", "--json"],
      ["wallet", "settings", "--json"],
      ["wallet", "tx-lock", "--binanceChainId", "56", "--json"],
      ["market-order", "swap", "--fromTokenQty", "1", "--fromToken", USDT, "--toToken", NVDAB, "--binanceChainId", "56", "--slippage", "auto", "--mev", "true", "--json"],
      ["market-order", "list", "--orderId", "1234567890", "--json"],
    ]);
  });

  it("fails when the wallet has no BSC address", async () => {
    const { runner } = scriptedBaw({ "wallet address": () => ({ addresses: [{ binanceChainId: "CT_501", address: "Sol1" }] }) });
    await expect(bscAddress(runner)).rejects.toThrow("no BSC (56) address");
  });

  it("refuses unsafe arguments before starting a process", async () => {
    const runner = createBawRunner({ bin: "baw-is-not-started-in-this-test" });
    await expect(runner(["wallet", "status;", "whoami"])).rejects.toThrow("refusing to pass an unsafe argument to baw: status;");
  });
});
