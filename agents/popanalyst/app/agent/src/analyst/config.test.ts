import { describe, expect, it } from "vitest";
import { loadAnalystConfig, loopBlocker } from "./config.js";

const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

describe("loadAnalystConfig", () => {
  it("applies the spec defaults", () => {
    const config = loadAnalystConfig({});
    expect(config).toMatchObject({
      enabled: false,
      registry: null,
      agentId: null,
      watchlist: ["NVDAB", "TSLAB", "AAPLB", "SPYB"],
      buyUsdt: "2",
      holdHours: 24,
      intervalMinutes: 30,
      w3w: null,
      feedUrl: null,
      telemetryFile: null,
    });
    expect(config.rpcUrls.length).toBeGreaterThan(0);
  });

  it("reads every variable", () => {
    const config = loadAnalystConfig({
      ANALYST_ENABLED: "TRUE",
      REGISTRY_ADDRESS: REGISTRY,
      ANALYST_AGENT_ID: "42",
      ANALYST_WATCHLIST: "TSLAB, NVDAB",
      ANALYST_BUY_USDT: "1.5",
      ANALYST_HOLD_HOURS: "0.5",
      ANALYST_INTERVAL_MIN: "10",
      W3W_API_KEY: "key",
      W3W_API_SECRET: "secret",
      POP_FEED_URL: "https://pop.example/",
      BSC_RPC_URLS: "https://a.example,https://b.example",
    });
    expect(config).toMatchObject({ enabled: true, registry: REGISTRY, agentId: 42n, watchlist: ["TSLAB", "NVDAB"], buyUsdt: "1.5", holdHours: 0.5, intervalMinutes: 10, feedUrl: "https://pop.example" });
    expect(config.rpcUrls).toEqual(["https://a.example", "https://b.example"]);
    expect(loopBlocker(config)).toBeNull();
  });

  it("rejects unsafe or malformed values", () => {
    expect(() => loadAnalystConfig({ ANALYST_BUY_USDT: "50" })).toThrow("ANALYST_BUY_USDT must be a positive amount of at most 5");
    expect(() => loadAnalystConfig({ ANALYST_WATCHLIST: "NVDAon" })).toThrow("ANALYST_WATCHLIST: NVDAon is not a bStock in the catalog");
    expect(() => loadAnalystConfig({ ANALYST_AGENT_ID: "seven" })).toThrow("ANALYST_AGENT_ID must be the numeric ERC-8004 agent id");
    expect(() => loadAnalystConfig({ W3W_API_KEY: "only-key" })).toThrow("set both W3W_API_KEY and W3W_API_SECRET, or neither");
    expect(() => loadAnalystConfig({ ANALYST_INTERVAL_MIN: "0" })).toThrow("ANALYST_INTERVAL_MIN must be a number ≥ 1");
  });

  it("explains why the loop cannot start", () => {
    expect(loopBlocker(loadAnalystConfig({}))).toBe("ANALYST_ENABLED is not true");
    expect(loopBlocker(loadAnalystConfig({ ANALYST_ENABLED: "true" }))).toBe("REGISTRY_ADDRESS is not set");
    expect(loopBlocker(loadAnalystConfig({ ANALYST_ENABLED: "true", REGISTRY_ADDRESS: REGISTRY }))).toBe("ANALYST_AGENT_ID is not set (register the agent on ERC-8004 first)");
    expect(loopBlocker(loadAnalystConfig({ ANALYST_ENABLED: "true", REGISTRY_ADDRESS: REGISTRY, ANALYST_AGENT_ID: "1" }))).toBe("W3W_API_KEY / W3W_API_SECRET are not set");
  });
});
