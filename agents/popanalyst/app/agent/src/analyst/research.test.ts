import { createFakeW3wClient, requireTokenBySymbol, W3wApiError } from "@pop/core";
import { describe, expect, it } from "vitest";
import { CMC_PAIR_QUOTES_URL, pickNumbers, researchToken } from "./research.js";
import { clampNote, MAX_NOTE_BYTES, templateThesis, writeThesis } from "./thesis.js";

const NVDAB = requireTokenBySymbol("NVDAB");
const POOL = "0x9999999999999999999999999999999999999999";

function api(fail: { rwa?: boolean; pools?: boolean } = {}) {
  return createFakeW3wClient((call) => {
    if (call.path === "/api/v1/dex/market/rwa/tokens") {
      if (fail.rwa) throw new W3wApiError({ code: 40304, msg: "Service not available due to compliance restriction", httpStatus: 200, endpoint: call.path });
      return [
        {
          binanceChainId: "56",
          tokenContractAddress: NVDAB.address,
          platformId: "bstock",
          tokenName: "NVIDIA bStock",
          tokenSymbol: "NVDAB",
          decimals: 18,
          underlyingTicker: "NVDA",
          underlyingName: "NVIDIA Corporation",
          tokenToShareRatio: "1.000778",
          statusInfo: { openState: true, marketStatus: "regular", reasonCode: "TRADING", reasonMsg: null },
          tokenPrice: "187.43",
        },
      ];
    }
    if (call.path === "/api/v1/dex/market/token/top-liquidity") {
      if (fail.pools) throw new Error("socket hang up");
      return [{ pool: "NVDAB/USDT", protocolName: "PancakeSwap V3", liquidityUsd: "812345.6", poolAddress: POOL }];
    }
    throw new Error(`unexpected ${call.path}`);
  });
}

describe("researchToken", () => {
  it("combines RWA Data, the deepest pool and a paid CMC pair quote", async () => {
    const paid: Array<[string, number]> = [];
    const buy = async (url: string, maxUsd: number) => {
      paid.push([url, maxUsd]);
      return { ok: true, status: 200, paid_usd: 0.01, json: { data: [{ quote: [{ price: "187.2", volume_24h: 51234.5, liquidity: 812000, percent_change_price_24h: -1.2 }] }] } };
    };
    const research = await researchToken({ w3w: api().client, buyWithX402: buy }, NVDAB);
    expect(paid).toEqual([[`${CMC_PAIR_QUOTES_URL}?pair_address=${POOL}`, 0.02]]);
    expect(research).toMatchObject({
      symbol: "NVDAB",
      ticker: "NVDA",
      name: "NVIDIA Corporation",
      priceUsd: "187.43",
      market: { openState: true, marketStatus: "regular", reasonMsg: null },
      pool: { address: POOL, protocol: "PancakeSwap V3", liquidityUsd: "812345.6" },
      cmc: { summary: "price 187.2, volume_24h 51234.5, liquidity 812000, percent_change_price_24h -1.2", paidUsd: 0.01 },
      notes: [],
    });
  });

  it("degrades instead of failing", async () => {
    const research = await researchToken({ w3w: api({ rwa: true, pools: true }).client, buyWithX402: async () => ({ ok: false }) }, NVDAB);
    expect(research.name).toBeNull();
    expect(research.cmc).toBeNull();
    expect(research.notes).toEqual(["RWA Data unavailable: 40304 Service not available due to compliance restriction", "Market API top-liquidity unavailable: socket hang up"]);
    const refused = await researchToken({ w3w: api().client, buyWithX402: async () => ({ ok: false, error: "X402BudgetExhaustedError", message: "daily budget reached" }) }, NVDAB);
    expect(refused.notes).toEqual(["CMC x402 refused: daily budget reached"]);
  });

  it("finds numbers anywhere in a JSON document", () => {
    expect(pickNumbers({ a: [{ b: { price: "1.5" } }], price: 9, volume_24h: "x" }, ["price", "volume_24h"])).toEqual({ price: 9 });
  });
});

describe("thesis", () => {
  const research = { symbol: "NVDAB", ticker: "NVDA", token: NVDAB.address, name: "NVIDIA Corporation", priceUsd: "187.43", market: null, pool: { address: POOL, protocol: "PancakeSwap V3", liquidityUsd: "812345.6" }, cmc: null, notes: [] };

  it("keeps notes within 280 bytes, cutting on a character boundary", () => {
    expect(clampNote('  "Long   NVDA."  ')).toBe("Long NVDA.");
    const long = clampNote("€".repeat(200));
    expect(new TextEncoder().encode(long).length).toBeLessThanOrEqual(MAX_NOTE_BYTES);
    expect(long.endsWith("…")).toBe(true);
  });

  it("uses the LLM when it answers and the template otherwise", async () => {
    let prompt = "";
    const llm = await writeThesis(async (p) => {
      prompt = p;
      return "AI capex keeps compounding and the bStock pool is deep enough to exit cleanly.";
    }, research, 24);
    expect(llm).toEqual({ text: "AI capex keeps compounding and the bStock pool is deep enough to exit cleanly.", source: "llm" });
    expect(prompt).toContain("deepest pool: PancakeSwap V3 with $812345.6 liquidity");
    const fallback = await writeThesis(async () => {
      throw new Error("402 Payment Required");
    }, research, 24);
    expect(fallback).toEqual({ text: templateThesis(research, 24), source: "template" });
    expect(fallback.text).toBe("Long NVDA (NVDAB) at $187.43; deepest pool PancakeSwap V3 ($812345.6 liquidity). Holding ~24h; if I sell early this badge says so on-chain.");
    expect((await writeThesis(null, research, 6)).source).toBe("template");
  });
});
