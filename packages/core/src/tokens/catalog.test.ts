import { describe, expect, it } from "vitest";
import {
  DEFAULT_WATCHLIST,
  TOKEN_CATALOG,
  findTokens,
  getTokenBySymbol,
  getTokenInfo,
  isFollowable,
  requireTokenBySymbol,
  tokensByIssuer,
} from "./catalog";

describe("token catalog", () => {
  it("holds the 675-row pack registry split by issuer and model", () => {
    expect(TOKEN_CATALOG).toHaveLength(675);
    expect(tokensByIssuer("bStocks")).toHaveLength(87);
    expect(tokensByIssuer("Ondo")).toHaveLength(458);
    expect(tokensByIssuer("xStocks")).toHaveLength(130);
    expect(TOKEN_CATALOG.filter((token) => token.model === "XSTOCK")).toHaveLength(128);
    expect(TOKEN_CATALOG.filter((token) => token.model === "PLAIN")).toHaveLength(547);
  });

  it("looks tokens up by address (any case) and symbol", () => {
    const nvdab = getTokenInfo("0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436");
    expect(nvdab).toEqual({
      address: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436",
      symbol: "NVDAB",
      ticker: "NVDA",
      issuer: "bStocks",
      model: "PLAIN",
      assetType: 1,
    });
    expect(getTokenBySymbol("nvdax")?.model).toBe("XSTOCK");
    expect(getTokenBySymbol("wPOPMTx")?.model).toBe("PLAIN");
    expect(getTokenBySymbol("SPYB")?.assetType).toBe(3);
    expect(() => requireTokenBySymbol("NOPE")).toThrow("unknown token symbol NOPE");
  });

  it("finds tokens by symbol or ticker prefix, exact symbol and bStocks first", () => {
    const results = findTokens("nvda");
    expect(results.map((token) => token.symbol).slice(0, 3)).toEqual(["NVDAB", "NVDAon", "NVDAx"]);
    expect(findTokens("tslab")[0]?.symbol).toBe("TSLAB");
    expect(findTokens("  ")).toEqual([]);
  });

  it("follows only bStocks and watches four of them by default", () => {
    expect(DEFAULT_WATCHLIST).toEqual(["NVDAB", "TSLAB", "AAPLB", "SPYB"]);
    for (const symbol of DEFAULT_WATCHLIST) expect(isFollowable(requireTokenBySymbol(symbol))).toBe(true);
    expect(isFollowable(requireTokenBySymbol("NVDAon"))).toBe(false);
    expect(isFollowable(requireTokenBySymbol("NVDAx"))).toBe(false);
  });
});
