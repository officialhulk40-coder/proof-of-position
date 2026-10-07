import { requireTokenBySymbol, type TelemetryEvent, type TokenInfo } from "@pop/core";
import { describe, expect, it } from "vitest";
import { runCycle, type CycleDeps } from "./cycle.js";
import type { Research } from "./research.js";
import { fakeWorld, NVDAB, rawCall, testConfig, USDT } from "./testing.js";

const TSLAB = requireTokenBySymbol("TSLAB").address;
const NOW_MS = 1_791_200_000_000;

function deps(world: ReturnType<typeof fakeWorld>, overrides: Partial<CycleDeps> = {}) {
  const lines: string[] = [];
  const events: TelemetryEvent[] = [];
  const researched: string[] = [];
  const cycleDeps: CycleDeps = {
    config: testConfig(),
    w3w: world.w3w,
    client: world.client,
    signer: world.signer,
    research: async (token: TokenInfo): Promise<Research> => {
      researched.push(token.symbol);
      return { symbol: token.symbol, ticker: token.ticker, token: token.address, name: null, priceUsd: null, market: null, pool: null, cmc: { summary: "price 1", paidUsd: 0.01 }, notes: [] };
    },
    thesis: async (research) => ({ text: `Long ${research.ticker}`, source: "llm" }),
    now: () => NOW_MS,
    log: (line) => lines.push(line),
    record: (event) => events.push(event),
    ...overrides,
  };
  return { cycleDeps, lines, events, researched };
}

describe("runCycle", () => {
  it("buys the first watchlist bStock and posts exactly what it received", async () => {
    const world = fakeWorld({ delivered: 5_300_000_000_000_000n });
    const { cycleDeps, events, researched } = deps(world);
    const result = await runCycle(cycleDeps);
    expect(result).toEqual({ closed: [], posted: { callId: 0, symbol: "NVDAB", txHash: expect.any(String) }, skipped: [] });
    expect(world.signed).toEqual(["approve", `swap:${NVDAB}`, `postAsAgent:${NVDAB}:5300000000000000:Long NVDA`]);
    expect(researched).toEqual(["NVDAB"]);
    const quote = world.apiCalls.find((call) => call.path === "/api/v1/dex/aggregator/quote");
    expect(quote?.query).toMatchObject({ fromTokenAddress: "0x55d398326f99059fF775485246999027B3197955", toTokenAddress: NVDAB, amount: "2000000000000000000" });
    expect(events[0]).toMatchObject({ kind: "analyst.post", callId: 0, symbol: "NVDAB", amount: "5300000000000000", thesisSource: "llm", cmcPaidUsd: 0.01 });
  });

  it("closes calls held past holdHours before selling, then opens the next one", async () => {
    const old = rawCall({ postedAt: BigInt(NOW_MS / 1000 - 25 * 3600) });
    const world = fakeWorld({ calls: [{ raw: old, status: 0 }], balances: { [NVDAB]: 10_000_000_000_000_000n } });
    const { cycleDeps, lines } = deps(world);
    const result = await runCycle(cycleDeps);
    expect(result.closed).toEqual([0]);
    expect(world.signed).toEqual(["close:0", "approve", `swap:${USDT}`, "approve", `swap:${NVDAB}`, `postAsAgent:${NVDAB}:5300000000000000:Long NVDA`]);
    expect(lines[0]).toMatch(/^closed call #0 \(held through ✓\)/);
    expect(result.posted?.callId).toBe(1);
  });

  it("skips tokens with no SWAP route and calls already open", async () => {
    const recent = BigInt(NOW_MS / 1000 - 3600);
    const world = fakeWorld({ calls: [{ raw: rawCall({ token: TSLAB, postedAt: recent }), status: 0 }], noRoute: [NVDAB] });
    const { cycleDeps } = deps(world, { config: testConfig({ watchlist: ["TSLAB", "NVDAB"] }) });
    const result = await runCycle(cycleDeps);
    expect(result.closed).toEqual([]);
    expect(result.posted).toBeNull();
    expect(result.skipped).toEqual(["TSLAB: a call is already open", `NVDAB: no SWAP route from 0x55d398326f99059fF775485246999027B3197955 to ${NVDAB} right now (RFQ-only routes are not used)`]);
    expect(world.signed).toEqual([]);
  });
});
