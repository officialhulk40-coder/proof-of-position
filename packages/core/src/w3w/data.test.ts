import { describe, expect, it } from "vitest";
import { getTokenTrades, getTopLiquidityPools } from "./market";
import { getRwaPrices, getRwaTokens } from "./rwa";
import { createFakeW3wClient } from "./testing";
import { getTokenBalances } from "./wallet";

const NVDAB = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";

// Field sets mirror the official OpenAPI 3.1.1 schema (asset SHA-256 prefix 4ae094ae23e96a96).
const rwaTokenFixture = {
  binanceChainId: "56",
  tokenContractAddress: NVDAB,
  platformId: "bstock",
  assetType: 1,
  tokenName: "NVIDIA bStock",
  tokenSymbol: "NVDAB",
  tokenLogoUrl: "https://static.example/nvdab.png",
  decimals: 18,
  underlyingTicker: "NVDA",
  underlyingName: "NVIDIA Corporation",
  underlyingNameZh: "英伟达",
  tokenToShareRatio: "1.000778",
  tags: null,
  statusInfo: {
    openState: false,
    marketStatus: "closed",
    reasonCode: "MARKET_CLOSED",
    reasonMsg: "Weekend or Holiday",
    nextOpenTime: 1791113400000,
    nextCloseTime: null,
  },
  tokenPrice: "187.43",
  referencePrice: "187.28",
  volume24H: "8250000.00",
  marketCap: "500000000",
  peRatioTTM: null,
};

describe("RWA Data", () => {
  it("lists BSC RWA tokens with share ratio and market status", async () => {
    const { client, calls } = createFakeW3wClient(() => [rwaTokenFixture, { ...rwaTokenFixture, decimals: "18", statusInfo: { openState: true, marketStatus: "offhours" } }]);
    const tokens = await getRwaTokens(client, { platformId: "bstock" });
    expect(calls[0]).toEqual({ method: "GET", path: "/api/v1/dex/market/rwa/tokens", query: { binanceChainId: "56", platformId: "bstock" } });
    expect(tokens[0]?.decimals).toBe(18);
    expect(tokens[0]?.tokenToShareRatio).toBe("1.000778");
    expect(tokens[0]?.statusInfo?.reasonMsg).toBe("Weekend or Holiday");
    expect(tokens[1]?.decimals).toBe(18);
    expect(tokens[1]?.statusInfo?.marketStatus).toBe("offhours");
  });

  it("batches prices 100 addresses per request", async () => {
    const addresses = Array.from({ length: 150 }, (_, i) => `0x${i.toString(16).padStart(40, "0")}`);
    const { client, calls } = createFakeW3wClient((call) =>
      String(call.query?.tokenContractAddresses)
        .split(",")
        .map((address) => ({ tokenContractAddress: address, platformId: "ondo", tokenPrice: "1.0", referencePrice: "1.0", tokenPriceUpdatedAt: 1 })),
    );
    const prices = await getRwaPrices(client, addresses);
    expect(calls).toHaveLength(2);
    expect(String(calls[0]?.query?.tokenContractAddresses).split(",")).toHaveLength(100);
    expect(String(calls[1]?.query?.tokenContractAddresses).split(",")).toHaveLength(50);
    expect(prices).toHaveLength(150);
  });
});

describe("Market", () => {
  it("reads a wallet's trades for a token", async () => {
    const { client, calls } = createFakeW3wClient(() => ({
      cursor: "",
      trades: [
        {
          binanceChainId: "56",
          tokenContractAddress: NVDAB,
          txHash: "0xdump",
          userAddress: "0xcaller",
          dexName: "PancakeSwap V3",
          type: "sell",
          price: "187.40",
          volume: "3.75",
          time: 1791113400000,
          changedTokenInfo: [
            { amount: "0.02", tokenSymbol: "NVDAB", tokenContractAddress: NVDAB },
            { amount: "3.74", tokenSymbol: "USDT", tokenContractAddress: "0x55d398326f99059ff775485246999027b3197955" },
          ],
        },
      ],
    }));
    const page = await getTokenTrades(client, { token: NVDAB, wallets: ["0xcaller"], limit: 20 });
    expect(calls[0]?.query).toEqual({ binanceChainId: "56", tokenContractAddress: NVDAB, walletAddressFilter: "0xcaller", limit: 20, cursor: undefined });
    expect(page.trades[0]?.type).toBe("sell");
    expect(page.trades[0]?.changedTokenInfo[0]?.amount).toBe("0.02");
  });

  it("rejects more than two wallet filters", () => {
    const { client } = createFakeW3wClient(() => ({ cursor: "", trades: [] }));
    expect(() => getTokenTrades(client, { token: NVDAB, wallets: ["0x1", "0x2", "0x3"] })).toThrow("at most two addresses");
  });

  it("reads the deepest pools", async () => {
    const { client } = createFakeW3wClient(() => [
      {
        pool: "NVDAB/USDT",
        protocolName: "PancakeSwap V3",
        protocolLogoUrl: null,
        liquidityUsd: "4380000.00",
        poolAddress: "0x8fb4243b553ac29ba088acf00b9b7da24bd6690c",
        liquidityAmount: [],
      },
    ]);
    const pools = await getTopLiquidityPools(client, NVDAB);
    expect(pools[0]?.poolAddress).toBe("0x8fb4243b553ac29ba088acf00b9b7da24bd6690c");
    expect(pools[0]?.liquidityUsd).toBe("4380000.00");
  });
});

describe("Wallet", () => {
  it("posts the token list with binanceChainId and flattens tokenAssets", async () => {
    const { client, calls } = createFakeW3wClient(() => [
      {
        tokenAssets: [
          { binanceChainId: "56", tokenContractAddress: NVDAB, address: "0xme", symbol: "NVDAB", balance: "0.02", rawBalance: "20000000000000000", tokenPrice: "187.4", isRiskToken: false },
        ],
      },
    ]);
    const assets = await getTokenBalances(client, { address: "0xme", tokens: [NVDAB] });
    expect(calls[0]).toEqual({
      method: "POST",
      path: "/api/v1/dex/balance/token-balances-by-address",
      body: { address: "0xme", tokenContractAddresses: [{ binanceChainId: "56", tokenContractAddress: NVDAB }], excludeRiskToken: "1" },
    });
    expect(assets[0]?.balance).toBe("0.02");
  });

  it("rejects an empty or oversized token list", async () => {
    const { client } = createFakeW3wClient(() => []);
    await expect(getTokenBalances(client, { address: "0xme", tokens: [] })).rejects.toThrow("1 to 20 tokens");
  });
});
