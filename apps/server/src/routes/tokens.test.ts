import { W3wApiError, createFakeW3wClient } from "@pop/core";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { NVDAB, makeDeps } from "../testing";
import { tokensRoutes, type TokensResponse } from "./tokens";

const nvdabRwa = {
  binanceChainId: "56",
  tokenContractAddress: "0x02FCA66C1D1AFB4E2A7884261EB00F63598A7436",
  platformId: "bstock",
  assetType: 1,
  tokenName: "NVIDIA bStock",
  tokenSymbol: "NVDAB",
  decimals: "18",
  underlyingTicker: "NVDA",
  underlyingName: "NVIDIA Corporation",
  tokenToShareRatio: "1.000778",
  statusInfo: { openState: true, marketStatus: "regular", reasonCode: "TRADING", reasonMsg: null, nextOpenTime: null, nextCloseTime: 1791140400000 },
  tokenPrice: "187.43",
  referencePrice: "187.28",
};

describe("GET /api/tokens", () => {
  it("merges the catalog with RWA Data", async () => {
    const { client, calls } = createFakeW3wClient(() => [nvdabRwa]);
    const app = createApp(makeDeps({ w3w: client }), [tokensRoutes]);
    const body = (await (await app.request("/api/tokens")).json()) as TokensResponse;
    expect(calls[0]?.path).toBe("/api/v1/dex/market/rwa/tokens");
    expect(body.degraded).toBeNull();
    expect(body.tokens).toHaveLength(675);
    const nvdab = body.tokens.find((token) => token.address === NVDAB);
    expect(nvdab).toMatchObject({
      symbol: "NVDAB",
      issuer: "bStocks",
      name: "NVIDIA Corporation",
      tokenToShareRatio: "1.000778",
      priceUsd: "187.43",
      status: { openState: true, marketStatus: "regular" },
    });
    const nvdax = body.tokens.find((token) => token.symbol === "NVDAx");
    expect(nvdax?.status).toBeNull();
  });

  it("caches for 60 s", async () => {
    let now = 0;
    const { client, calls } = createFakeW3wClient(() => [nvdabRwa]);
    const app = createApp(makeDeps({ w3w: client, now: () => now }), [tokensRoutes]);
    await app.request("/api/tokens");
    now = 59_000;
    await app.request("/api/tokens");
    expect(calls).toHaveLength(1);
    now = 61_000;
    await app.request("/api/tokens");
    expect(calls).toHaveLength(2);
  });

  it("accepts null marketStatus / underlyingName and degrades on an unparseable payload", async () => {
    const { client } = createFakeW3wClient(() => [{ ...nvdabRwa, underlyingName: null, statusInfo: { openState: false, marketStatus: null } }]);
    const ok = (await (await createApp(makeDeps({ w3w: client }), [tokensRoutes]).request("/api/tokens")).json()) as TokensResponse;
    expect(ok.degraded).toBeNull();
    const { client: bad } = createFakeW3wClient(() => [{ ...nvdabRwa, tokenSymbol: 5 }]);
    const res = await createApp(makeDeps({ w3w: bad }), [tokensRoutes]).request("/api/tokens");
    expect(res.status).toBe(200);
    const body = (await res.json()) as TokensResponse;
    expect(body.degraded?.code).toBe(-2);
    expect(body.tokens).toHaveLength(675);
  });

  it("degrades to the bare catalog when the API refuses (40304) or is not configured", async () => {
    const { client } = createFakeW3wClient(() => {
      throw new W3wApiError({ code: 40304, msg: "Service not available due to compliance restriction", httpStatus: 200, endpoint: "/api/v1/dex/market/rwa/tokens" });
    });
    const refused = (await (await createApp(makeDeps({ w3w: client }), [tokensRoutes]).request("/api/tokens")).json()) as TokensResponse;
    expect(refused.degraded).toEqual({ code: 40304, msg: "Service not available due to compliance restriction" });
    expect(refused.tokens).toHaveLength(675);
    expect(refused.tokens[0]?.status).toBeNull();
    const off = (await (await createApp(makeDeps({ w3w: null }), [tokensRoutes]).request("/api/tokens")).json()) as TokensResponse;
    expect(off.degraded?.code).toBe(-1);
  });
});
