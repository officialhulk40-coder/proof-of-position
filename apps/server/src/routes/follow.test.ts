import { ADDRESSES } from "@pop/core";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { CALLER, NVDAB, fakeChain, makeDeps, w3wByPath } from "../testing";
import { followRoutes, type FollowBuildResponse } from "./follow";

const ROUTER = ADDRESSES.binanceAggregatorRouter;
const route = (overrides: Record<string, unknown> = {}) => ({
  quoteId: "q-swap",
  vendorName: "LiquidMesh",
  fromTokenAmount: "5000000000000000000",
  toTokenAmount: "26600000000000000",
  priceImpactPercent: "0.04",
  executionMode: "SWAP",
  approveTarget: ROUTER,
  ...overrides,
});
const simulationOk = { status: "SUCCESS", failReason: null, balanceChanges: [], allowanceChanges: [] };

function request(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  return app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/follow/quote", () => {
  it("quotes USDT → bStock and returns the best SWAP route", async () => {
    const { client, calls } = w3wByPath({ "/api/v1/dex/aggregator/quote": () => [route({ quoteId: "rfq", executionMode: "RFQ", toTokenAmount: "99" }), route()] });
    const res = await request(createApp(makeDeps({ w3w: client }), [followRoutes]), "/api/follow/quote", { token: NVDAB, usdtAmount: "5", wallet: CALLER });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      route: { quoteId: "q-swap", vendorName: "LiquidMesh", toTokenAmount: "26600000000000000", priceImpactPercent: "0.04", approveTarget: ROUTER },
      toTokenFormatted: "0.0266",
    });
    expect(calls[0]?.query).toMatchObject({ amount: "5000000000000000000", fromTokenAddress: ADDRESSES.usdt, toTokenAddress: NVDAB, userWalletAddress: CALLER });
  });

  it("refuses tokens that are not followable and answers 409 when only RFQ routes exist", async () => {
    const { client } = w3wByPath({ "/api/v1/dex/aggregator/quote": () => [route({ executionMode: "RFQ" })] });
    const app = createApp(makeDeps({ w3w: client }), [followRoutes]);
    const ondo = await request(app, "/api/follow/quote", { token: "0xa9ee28c80f960b889dfbd1902055218cba016f75", usdtAmount: "5", wallet: CALLER });
    expect(ondo.status).toBe(400);
    expect(((await ondo.json()) as { error: { code: string } }).error.code).toBe("NOT_FOLLOWABLE");
    const rfqOnly = await request(app, "/api/follow/quote", { token: NVDAB, usdtAmount: "5", wallet: CALLER });
    expect(rfqOnly.status).toBe(409);
    expect(((await rfqOnly.json()) as { error: { code: string } }).error.code).toBe("NO_SWAP_ROUTE");
  });
});

describe("POST /api/follow/build", () => {
  it("returns a simulated approve when the USDT allowance is short", async () => {
    const { client, calls } = w3wByPath({
      "/api/v1/dex/aggregator/quote": () => [route()],
      "/api/v1/dex/aggregator/approve-transaction": () => [{ data: "0x095ea7b3aa", dexContractAddress: ROUTER, gasLimit: "60000", gasPrice: "100000000" }],
      "/api/v1/dex/pre-transaction/simulate": () => simulationOk,
    });
    const chain = fakeChain({ calls: [], statuses: [], allowance: 0n, blockNumber: 1n });
    const res = await request(createApp(makeDeps({ w3w: client, chain }), [followRoutes]), "/api/follow/build", { token: NVDAB, usdtAmount: "5", wallet: CALLER });
    const body = (await res.json()) as FollowBuildResponse;
    expect(body.next).toBe("approve");
    expect(body.tx).toEqual({ from: CALLER, to: ADDRESSES.usdt, data: "0x095ea7b3aa", value: "0", gas: "60000", gasPrice: "100000000" });
    expect(calls.map((call) => call.path)).toEqual([
      "/api/v1/dex/aggregator/quote",
      "/api/v1/dex/aggregator/approve-transaction",
      "/api/v1/dex/pre-transaction/simulate",
    ]);
  });

  it("encodes approve(approveTarget) itself when the API's spender differs", async () => {
    const { client } = w3wByPath({
      "/api/v1/dex/aggregator/quote": () => [route({ approveTarget: "0x3333333333333333333333333333333333333333" })],
      "/api/v1/dex/aggregator/approve-transaction": () => [{ data: "0x095ea7b3bb", dexContractAddress: ROUTER }],
      "/api/v1/dex/pre-transaction/simulate": () => simulationOk,
    });
    const chain = fakeChain({ calls: [], statuses: [], allowance: 0n, blockNumber: 1n });
    const body = (await (await request(createApp(makeDeps({ w3w: client, chain }), [followRoutes]), "/api/follow/build", { token: NVDAB, usdtAmount: "5", wallet: CALLER })).json()) as FollowBuildResponse;
    expect(body.next).toBe("approve");
    expect(body.tx.data.startsWith("0x095ea7b30000000000000000000000003333333333333333333333333333333333333333")).toBe(true);
  });

  it("returns a simulated swap once the allowance covers the amount", async () => {
    const { client } = w3wByPath({
      "/api/v1/dex/aggregator/quote": () => [route()],
      "/api/v1/dex/aggregator/swap": () => ({
        routerResult: { vendorName: "LiquidMesh", fromTokenAmount: "5000000000000000000", toTokenAmount: "26600000000000000" },
        tx: { from: CALLER, to: ROUTER, data: "0xswap", value: "0", gas: "260000", gasPrice: "100000000", minReceiveAmount: "26334000000000000" },
        executionMode: "SWAP",
        rfq: null,
      }),
      "/api/v1/dex/pre-transaction/simulate": () => simulationOk,
    });
    const chain = fakeChain({ calls: [], statuses: [], allowance: 10n ** 30n, blockNumber: 1n });
    const body = (await (await request(createApp(makeDeps({ w3w: client, chain }), [followRoutes]), "/api/follow/build", { token: NVDAB, usdtAmount: "5", wallet: CALLER })).json()) as FollowBuildResponse;
    expect(body).toMatchObject({ next: "swap", toTokenAmount: "26600000000000000", minReceiveAmount: "26334000000000000" });
    expect(body.tx).toEqual({ from: CALLER, to: ROUTER, data: "0xswap", value: "0", gas: "260000", gasPrice: "100000000" });
  });

  it("answers 409 when the swap simulation fails", async () => {
    const { client } = w3wByPath({
      "/api/v1/dex/aggregator/quote": () => [route()],
      "/api/v1/dex/aggregator/swap": () => ({ routerResult: { fromTokenAmount: "1", toTokenAmount: "1" }, tx: { from: CALLER, to: ROUTER, data: "0x", value: "0" }, executionMode: "SWAP" }),
      "/api/v1/dex/pre-transaction/simulate": () => ({ status: "FAILED", failReason: "execution reverted: insufficient output" }),
    });
    const chain = fakeChain({ calls: [], statuses: [], allowance: 10n ** 30n, blockNumber: 1n });
    const res = await request(createApp(makeDeps({ w3w: client, chain }), [followRoutes]), "/api/follow/build", { token: NVDAB, usdtAmount: "5", wallet: CALLER });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { msg: string } }).error.msg).toBe("execution reverted: insufficient output");
  });
});
