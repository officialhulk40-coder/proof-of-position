import { toCallView, type RawCall } from "@pop/core/browser";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { companyName, declaredShares, links, marketStatusLabel, shortAddress, timeAgo } from "../format";
import { ApiError, createApiClient, type TokenDto } from "./client";
import { catalogOnly, useTokens } from "./useTokens";

function jsonFetch(status: number, body: unknown, seen: Array<{ url: string; init?: RequestInit }> = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(input), init });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const nvdab: TokenDto = {
  address: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436",
  symbol: "NVDAB",
  ticker: "NVDA",
  issuer: "bStocks",
  model: "PLAIN",
  assetType: 1,
  name: "NVIDIA Corporation",
  tokenToShareRatio: "1.000778",
  priceUsd: "187.43",
  status: { openState: true, marketStatus: "regular", reasonCode: "TRADING", reasonMsg: null },
};

describe("createApiClient", () => {
  it("calls the server routes with JSON bodies", async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const api = createApiClient("https://pop.test", jsonFetch(200, { success: false, status: "FAILED", failReason: "No position, no call.", balanceChanges: [] }, seen));
    const result = await api.dryRun({ from: "0x1", to: "0x2", data: "0x" });
    expect(result.failReason).toBe("No position, no call.");
    expect(seen[0]?.url).toBe("https://pop.test/api/dry-run");
    expect(seen[0]?.init?.method).toBe("POST");
    expect(seen[0]?.init?.body).toBe(JSON.stringify({ from: "0x1", to: "0x2", data: "0x" }));
  });

  it("raises ApiError with the server's code, message and hint", async () => {
    const api = createApiClient("", jsonFetch(502, { error: { code: 40304, msg: "Service not available due to compliance restriction", hint: "region" } }));
    const error = await api.tokens().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 40304, message: "Service not available due to compliance restriction", hint: "region" });
  });
});

describe("useTokens", () => {
  it("starts from the bundled catalog and swaps in the enriched list", async () => {
    const api = createApiClient("", jsonFetch(200, { updatedAt: 1, degraded: null, tokens: [nvdab] }));
    const { result } = renderHook(() => useTokens(api));
    expect(result.current.byAddress.size).toBe(675);
    await waitFor(() => expect(result.current.byAddress.get(nvdab.address)?.name).toBe("NVIDIA Corporation"));
    expect(result.current.degraded).toBeNull();
  });

  it("keeps the catalog and reports why when the server fails", async () => {
    const api = createApiClient("", jsonFetch(503, { error: { code: "W3W_NOT_CONFIGURED", msg: "the Binance Web3 API is not configured on this server" } }));
    const { result } = renderHook(() => useTokens(api));
    await waitFor(() => expect(result.current.degraded).toBe("the Binance Web3 API is not configured on this server"));
    expect(result.current.byAddress.size).toBe(675);
    expect(catalogOnly().get(nvdab.address)?.symbol).toBe("NVDAB");
  });
});

describe("format", () => {
  const raw: RawCall = {
    caller: "0x1111111111111111111111111111111111111111",
    token: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436",
    model: 1,
    hasAgent: false,
    heldThrough: false,
    exitStatus: 0,
    postedBlock: 1n,
    postedAt: 1_791_000_000n,
    closedBlock: 0n,
    exitBlock: 0n,
    agentId: 7n,
    declaredAmount: 20_000_000_000_000_000n,
    declaredBase: 20_000_000_000_000_000n,
    note: "",
  };

  it("formats names, shares and addresses", () => {
    expect(companyName(nvdab)).toBe("NVIDIA");
    expect(companyName({ ...nvdab, name: null })).toBe("NVDA");
    expect(companyName(undefined)).toBe("UNKNOWN");
    expect(declaredShares(toCallView(0, raw, 0), nvdab)).toBe("0.02");
    expect(shortAddress("0x1111111111111111111111111111111111111111")).toBe("0x1111…1111");
  });

  it("labels market status", () => {
    expect(marketStatusLabel(nvdab.status, "bStocks")).toEqual({ text: "Market open", tone: "open" });
    expect(marketStatusLabel({ openState: false, marketStatus: "closed", reasonCode: "MARKET_CLOSED", reasonMsg: "Weekend or Holiday" }, "bStocks")).toEqual({
      text: "Closed — Weekend or Holiday",
      tone: "closed",
    });
    expect(marketStatusLabel({ openState: false, marketStatus: "pause", reasonCode: "ASSET_PAUSED", reasonMsg: "cash_dividend" }, "Ondo")).toEqual({
      text: "Paused — cash_dividend",
      tone: "paused",
    });
    expect(marketStatusLabel({ openState: true, marketStatus: "offhours" }, "Ondo")).toEqual({ text: "Trading (offhours)", tone: "open" });
    expect(marketStatusLabel(null, "xStocks").tone).toBe("unknown");
  });

  it("prints relative times and explorer links", () => {
    expect(timeAgo(1_000, 1_030_000)).toBe("30s ago");
    expect(timeAgo(1_000, 1_000_000 + 7_200_000)).toBe("2h ago");
    expect(links.holding("0xtoken", "0xholder")).toBe("https://bscscan.com/token/0xtoken?a=0xholder");
    expect(links.agent(7n)).toBe("https://bscscan.com/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=7");
  });
});
