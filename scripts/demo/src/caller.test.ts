import { requireTokenBySymbol, SimulationFailedError } from "@pop/core";
import { describe, expect, it } from "vitest";
import { callerBuy, callerPost, callerSell, callerTryGate } from "./caller";
import { loadDemoEnv } from "./env";
import { demoWorld, NVDAB, REGISTRY } from "./testing";

const NVDA = requireTokenBySymbol("NVDAB");
const TSLA = requireTokenBySymbol("TSLAB");
const USDT = "0x55d398326f99059ff775485246999027b3197955";

describe("loadDemoEnv", () => {
  it("validates without echoing secrets", () => {
    const secret = `0x${"ab".repeat(31)}zz`;
    expect(() => loadDemoEnv({ CALLER_PK: secret })).toThrow("CALLER_PK must be a 0x-prefixed 32-byte hex key");
    try {
      loadDemoEnv({ CALLER_PK: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
    expect(() => loadDemoEnv({ W3W_API_KEY: "k" })).toThrow("set both W3W_API_KEY and W3W_API_SECRET, or neither");
    expect(loadDemoEnv({ REGISTRY_ADDRESS: REGISTRY, POP_FEED_URL: "https://pop.example/", ANALYST_AGENT_ID: "7" })).toMatchObject({ registry: REGISTRY, feedUrl: "https://pop.example", analystAgentId: 7n, callerKey: null, w3w: null });
  });
});

describe("caller persona", () => {
  it("buys, posts what it holds, and sells everything", async () => {
    const world = demoWorld({ balance: 20_000_000_000_000_000n });
    const deps = { ...world, registry: REGISTRY as `0x${string}` };
    expect((await callerBuy(deps, NVDA, "3")).received).toBe(5_300_000_000_000_000n);
    expect(await callerPost(deps, NVDA, "0.02", "AI capex keeps compounding")).toMatchObject({ callId: 0 });
    expect(await callerSell(deps, NVDA)).toMatchObject({ sold: 20_000_000_000_000_000n, received: 5_300_000_000_000_000n });
    expect(world.signed).toEqual(["approve", `swap:${NVDAB}`, `post:${NVDAB}:20000000000000000`, "approve", `swap:${USDT}`]);
  });

  it("sells nothing when the caller holds nothing", async () => {
    const world = demoWorld({ balance: 0n });
    expect(await callerSell({ ...world, registry: REGISTRY }, NVDA)).toBeNull();
    expect(world.signed).toEqual([]);
  });

  it("never signs a post the simulation rejects", async () => {
    const world = demoWorld({ simulation: "execution reverted: No position, no call." });
    const error = await callerPost({ ...world, registry: REGISTRY }, TSLA, "0.01", "").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SimulationFailedError);
    expect(world.signed).toEqual([]);
  });
});

describe("try-gate", () => {
  it("reports the revert reason without signing", async () => {
    const world = demoWorld({ simulation: "execution reverted: No position, no call." });
    expect(await callerTryGate({ ...world, registry: REGISTRY }, TSLA, "0.01", false)).toEqual({ wouldSucceed: false, failReason: "execution reverted: No position, no call.", txHash: null });
    expect(world.signed).toEqual([]);
  });

  it("with --broadcast sends the reverting post on purpose, with a fixed gas limit", async () => {
    const world = demoWorld({ simulation: "execution reverted: No position, no call." });
    const result = await callerTryGate({ ...world, registry: REGISTRY }, TSLA, "0.01", true);
    expect(result.txHash).toMatch(/^0x0+1$/);
    expect(world.signed).toEqual([`raw:${REGISTRY}`]);
    const broadcast = world.apiCalls.find((call) => call.path === "/api/v1/dex/pre-transaction/broadcast-transaction");
    expect(broadcast?.body).toMatchObject({ enableMevProtection: false });
  });

  it("says so when the caller does hold the token", async () => {
    const world = demoWorld();
    expect((await callerTryGate({ ...world, registry: REGISTRY }, TSLA, "0.01", true)).wouldSucceed).toBe(true);
    expect(world.signed).toEqual([]);
  });
});
