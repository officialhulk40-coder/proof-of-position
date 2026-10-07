import { DEFAULT_BSC_RPC_URLS, DEFAULT_LOGS_RPC_URL } from "@pop/core";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";

const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

describe("loadConfig", () => {
  it("applies defaults with only the registry set", () => {
    expect(loadConfig({ REGISTRY_ADDRESS: REGISTRY })).toEqual({
      port: 8787,
      registry: REGISTRY,
      rpcUrls: [...DEFAULT_BSC_RPC_URLS],
      logsRpcUrl: DEFAULT_LOGS_RPC_URL,
      w3w: null,
      keeperKey: null,
      telemetryFile: null,
      corsOrigins: ["*"],
    });
  });

  it("reads every variable", () => {
    const config = loadConfig({
      REGISTRY_ADDRESS: REGISTRY,
      PORT: "9999",
      BSC_RPC_URLS: "https://a.test,https://b.test",
      BSC_LOGS_RPC_URL: "https://logs.test",
      W3W_API_KEY: "key",
      W3W_API_SECRET: "secret",
      KEEPER_PK: `0x${"ab".repeat(32)}`,
      DEVEX_TELEMETRY_FILE: "devex/telemetry.jsonl",
      CORS_ORIGINS: "https://pop.test, https://other.test",
    });
    expect(config.port).toBe(9999);
    expect(config.rpcUrls).toEqual(["https://a.test", "https://b.test"]);
    expect(config.w3w).toEqual({ apiKey: "key", apiSecret: "secret" });
    expect(config.keeperKey).toBe(`0x${"ab".repeat(32)}`);
    expect(config.corsOrigins).toEqual(["https://pop.test", "https://other.test"]);
  });

  it("rejects a missing or malformed registry", () => {
    expect(() => loadConfig({})).toThrow("REGISTRY_ADDRESS is required");
    expect(() => loadConfig({ REGISTRY_ADDRESS: "0x123" })).toThrow("REGISTRY_ADDRESS must be a 0x-prefixed 20-byte address");
  });

  it("requires both API credentials or neither", () => {
    expect(() => loadConfig({ REGISTRY_ADDRESS: REGISTRY, W3W_API_KEY: "key" })).toThrow("set both W3W_API_KEY and W3W_API_SECRET");
  });

  it("rejects a malformed keeper key without echoing it", () => {
    let message = "";
    try {
      loadConfig({ REGISTRY_ADDRESS: REGISTRY, KEEPER_PK: "not-a-key-value-123" });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("KEEPER_PK must be a 0x-prefixed 32-byte hex key");
    expect(message).not.toContain("not-a-key-value-123");
  });

  it("rejects a bad port", () => {
    expect(() => loadConfig({ REGISTRY_ADDRESS: REGISTRY, PORT: "abc" })).toThrow("PORT must be an integer");
  });
});
