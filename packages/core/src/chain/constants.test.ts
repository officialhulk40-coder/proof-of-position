import { describe, expect, it } from "vitest";
import { ADDRESSES, BINANCE_CHAIN_ID, BSC_CHAIN_ID, DEFAULT_BSC_RPC_URLS, parseRpcUrls } from "./constants";

describe("chain constants", () => {
  it("pins BSC mainnet", () => {
    expect(BSC_CHAIN_ID).toBe(56);
    expect(BINANCE_CHAIN_ID).toBe("56");
  });

  it("carries the verified mainnet addresses", () => {
    expect(ADDRESSES.identityRegistry).toBe("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432");
    expect(ADDRESSES.reputationRegistry).toBe("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63");
    expect(ADDRESSES.usdt).toBe("0x55d398326f99059fF775485246999027B3197955");
  });

  it("parses RPC lists and falls back to the official endpoints", () => {
    expect(parseRpcUrls(" https://a.example , https://b.example,")).toEqual(["https://a.example", "https://b.example"]);
    expect(parseRpcUrls(undefined)).toEqual([...DEFAULT_BSC_RPC_URLS]);
    expect(parseRpcUrls("")).toEqual([...DEFAULT_BSC_RPC_URLS]);
  });
});
