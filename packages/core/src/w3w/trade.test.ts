import { describe, expect, it } from "vitest";
import { createFakeW3wClient } from "./testing";
import { buildSwap, getApproveTransaction, getQuote, pickSwapRoute, type QuoteRoute } from "./trading";
import { broadcastTx, getMediumGasPrice, isSimulationSuccess, simulateTx, simulationFailure } from "./transaction";

const USDT = "0x55d398326f99059fF775485246999027B3197955";
const NVDAB = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";
const ME = "0x1111111111111111111111111111111111111111";

function route(overrides: Partial<QuoteRoute>): QuoteRoute {
  return {
    quoteId: "q",
    vendorName: "LiquidMesh",
    fromTokenAmount: "1000000000000000000",
    toTokenAmount: "5000000000000000",
    executionMode: "SWAP",
    approveTarget: "0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5",
    ...overrides,
  };
}

describe("Trading", () => {
  it("quotes with userWalletAddress and amount in smallest units", async () => {
    const { client, calls } = createFakeW3wClient(() => [route({ quoteId: "a1" })]);
    const routes = await getQuote(client, { fromToken: USDT, toToken: NVDAB, amount: 10n ** 18n, userWalletAddress: ME });
    expect(calls[0]?.query).toEqual({
      binanceChainId: "56",
      amount: "1000000000000000000",
      fromTokenAddress: USDT,
      toTokenAddress: NVDAB,
      userWalletAddress: ME,
    });
    expect(routes[0]?.quoteId).toBe("a1");
  });

  it("picks the best SWAP route and ignores RFQ", () => {
    expect(
      pickSwapRoute([
        route({ quoteId: "rfq", executionMode: "RFQ", toTokenAmount: "9000000000000000" }),
        route({ quoteId: "swap-low", toTokenAmount: "4000000000000000" }),
        route({ quoteId: "swap-high", toTokenAmount: "5300000000000000" }),
      ])?.quoteId,
    ).toBe("swap-high");
    expect(pickSwapRoute([route({ executionMode: "RFQ" })])).toBeNull();
    expect(pickSwapRoute([])).toBeNull();
  });

  it("builds swap calldata with default 1% slippage", async () => {
    const { client, calls } = createFakeW3wClient(() => ({
      routerResult: { vendorName: "LiquidMesh", fromTokenAmount: "1000000000000000000", toTokenAmount: "5300000000000000", priceImpactPercent: "0.05" },
      tx: { from: ME, to: "0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5", data: "0xdeadbeef", value: "0", gas: "250000", gasPrice: "100000000", minReceiveAmount: "5247000000000000", slippagePercent: "1" },
      executionMode: "SWAP",
      rfq: null,
    }));
    const swap = await buildSwap(client, { fromToken: USDT, toToken: NVDAB, amount: 10n ** 18n, userWalletAddress: ME, quoteId: "swap-high" });
    expect(calls[0]?.query?.slippagePercent).toBe("1");
    expect(calls[0]?.query?.autoSlippage).toBeUndefined();
    expect(swap.tx.data).toBe("0xdeadbeef");
    expect(swap.tx.minReceiveAmount).toBe("5247000000000000");
  });

  it("uses autoSlippage when asked", async () => {
    const { client, calls } = createFakeW3wClient(() => ({
      routerResult: { fromTokenAmount: "1", toTokenAmount: "1" },
      tx: { from: ME, to: ME, data: "0x", value: "0" },
      executionMode: "SWAP",
    }));
    await buildSwap(client, { fromToken: USDT, toToken: NVDAB, amount: 1n, userWalletAddress: ME, quoteId: "q", autoSlippage: true });
    expect(calls[0]?.query?.slippagePercent).toBeUndefined();
    expect(calls[0]?.query?.autoSlippage).toBe("true");
  });

  it("returns the first approve transaction", async () => {
    const { client, calls } = createFakeW3wClient(() => [
      { data: "0x095ea7b3", dexContractAddress: "0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5", gasLimit: "60000", gasPrice: "100000000" },
    ]);
    const approve = await getApproveTransaction(client, { token: USDT, amount: 10n ** 18n });
    expect(calls[0]?.query).toEqual({ binanceChainId: "56", tokenContractAddress: USDT, approveAmount: "1000000000000000000", vendor: undefined });
    expect(approve.dexContractAddress).toBe("0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5");
  });
});

describe("Transaction", () => {
  it("simulates and surfaces the revert reason", async () => {
    const { client, calls } = createFakeW3wClient(() => ({
      status: "FAILED",
      failReason: "execution reverted: No position, no call.",
      balanceChanges: [],
      allowanceChanges: [],
    }));
    const simulation = await simulateTx(client, { from: ME, to: NVDAB, value: "0", data: "0x" });
    expect(calls[0]).toEqual({ method: "POST", path: "/api/v1/dex/pre-transaction/simulate", body: { binanceChainId: "56", evmTx: { from: ME, to: NVDAB, value: "0", data: "0x" } } });
    expect(isSimulationSuccess(simulation)).toBe(false);
    expect(simulationFailure(simulation)).toBe("execution reverted: No position, no call.");
  });

  it("treats status SUCCESS as success and defaults missing change lists", async () => {
    const { client } = createFakeW3wClient(() => ({ status: "SUCCESS", failReason: null }));
    const simulation = await simulateTx(client, { from: ME, to: NVDAB, value: "0", data: "0x" });
    expect(isSimulationSuccess(simulation)).toBe(true);
    expect(simulation.balanceChanges).toEqual([]);
  });

  it("broadcasts with MEV protection", async () => {
    const { client, calls } = createFakeW3wClient(() => ({ orderId: "1812345678901234567", txHash: "0xabc" }));
    const result = await broadcastTx(client, { signedTransaction: "0xf86c", address: ME, enableMevProtection: true });
    expect(calls[0]?.body).toEqual({ binanceChainId: "56", signedTransaction: "0xf86c", address: ME, enableMevProtection: true });
    expect(result.txHash).toBe("0xabc");
  });

  it("reads the medium legacy gas price", async () => {
    const { client } = createFakeW3wClient(() => ({
      evmLegacyGasPrice: { lowGasPrice: "50000000", mediumGasPrice: "100000000", highGasPrice: "150000000" },
      eip1559GasPrice: null,
      solanaGasPrice: null,
    }));
    await expect(getMediumGasPrice(client)).resolves.toBe(100000000n);
  });
});
