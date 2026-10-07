import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeW3wClient, type RegistryReader, type SwapClient } from "@pop/core";
import { describe, expect, it } from "vitest";
import { main, type CliDeps } from "./cli";
import { demoWorld, rawCall, REGISTRY } from "./testing";

const AGENT_WALLET = "0x7777777777777777777777777777777777777777";
const FEED = "https://pop.example";

function run(argv: string[], overrides: Partial<CliDeps> = {}, env: Record<string, string> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const world = demoWorld({ calls: [{ raw: rawCall({ note: "x" }), status: 2 }, { raw: rawCall({ hasAgent: true, agentId: 7n, closedBlock: 9n, heldThrough: true }), status: 3 }] });
  const deps: Partial<CliDeps> = {
    env: { REGISTRY_ADDRESS: REGISTRY, ...env },
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    chain: () => world.client,
    w3w: () => world.w3w,
    signer: () => world.signer,
    now: () => 1_791_000_100_000,
    ...overrides,
  };
  return { promise: main(argv, deps), out, err, world };
}

function jsonFetch(routes: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const body = routes[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return typeof body === "string" ? new Response(body, { status: 200 }) : new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

describe("pop-demo", () => {
  it("prints the registry status", async () => {
    const { promise, out } = run(["status"]);
    expect(await promise).toBe(0);
    expect(out).toEqual([
      `2 calls on ${REGISTRY}`,
      "#1 NVDAB 0.02 · agent #7 · CLOSED (held through)",
      "#0 NVDAB 0.02 · 0x1111111111111111111111111111111111111111 · EXITED",
    ]);
  });

  it("runs the caller persona", async () => {
    const { promise, out } = run(["caller", "post", "--token", "NVDAB", "--amount", "0.02", "--note", "AI capex"]);
    expect(await promise).toBe(0);
    expect(out[1]).toMatch(/^posted call #2 on NVDAB in 0x/);
    const sell = run(["caller", "sell", "--token", "NVDAB"]);
    expect(await sell.promise).toBe(1);
    expect(sell.err[0]).toBe("caller sell needs --all (it sells the caller's whole balance)");
  });

  it("checks the deployed feed (S1 included)", async () => {
    const healthy = jsonFetch({
      [`${FEED}/api/health`]: { ok: true, chainId: 56, registry: REGISTRY, w3w: true, keeper: { enabled: true, address: "0x9999999999999999999999999999999999999999" } },
      [`${FEED}/api/tokens`]: { updatedAt: 1, degraded: null, tokens: Array.from({ length: 675 }, () => ({})) },
      [`${FEED}/`]: "<!doctype html><title>Proof of Position</title>",
    });
    const { promise, out } = run(["health"], { fetchImpl: healthy }, { POP_FEED_URL: FEED });
    expect(await promise).toBe(0);
    expect(out.at(-1)).toBe("PASS");
    const degraded = jsonFetch({
      [`${FEED}/api/health`]: { ok: true, chainId: 56, registry: REGISTRY, w3w: true, keeper: { enabled: false, address: null } },
      [`${FEED}/api/tokens`]: { updatedAt: 1, degraded: { code: 40304, msg: "Service not available due to compliance restriction" }, tokens: [] },
      [`${FEED}/`]: "<title>Proof of Position</title>",
    });
    const bad = run(["health"], { fetchImpl: degraded }, { POP_FEED_URL: FEED });
    expect(await bad.promise).toBe(1);
    expect(bad.out).toContain("FAIL /api/tokens degraded: 40304 Service not available due to compliance restriction");
    expect(bad.out).toContain("FAIL recordExit keeper on (no address)");
  });

  it("checks the analyst's ERC-8004 identity", async () => {
    const client = {
      readContract: async (request: { functionName: string }) => (request.functionName === "getAgentWallet" ? AGENT_WALLET : [1n, 100n, 0]),
    } as unknown as RegistryReader;
    const { promise, out } = run(["agent"], { chain: () => client as unknown as SwapClient & RegistryReader }, { ANALYST_AGENT_ID: "7", ANALYST_WALLET: AGENT_WALLET });
    expect(await promise).toBe(0);
    expect(out).toEqual([`agent #7 wallet ${AGENT_WALLET} ✓`, "integrity 100 over 1 call(s)", "PASS"]);
  });

  it("makes one signed GET and reports its code", async () => {
    const { client } = createFakeW3wClient(() => [{ tokenContractAddress: "0x1" }]);
    const { promise, out } = run(["api", "get", "/api/v1/dex/market/rwa/tokens", "binanceChainId=56"], { w3w: () => client });
    expect(await promise).toBe(0);
    expect(out[0]).toMatch(/^GET \/api\/v1\/dex\/market\/rwa\/tokens → code 0 in \d+ ms$/);
  });

  it("checks DEVEX_LOG.md evidence", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "pop-devex-")), "DEVEX_LOG.md");
    writeFileSync(path, "### S1\n\n- 2026-10-09 GET rwa/tokens from the VPS: code 0 in 412 ms\n\n### S2\n\n- (pending) x\n");
    const { promise, out } = run(["devex-check", "--sections", "S1,S2"], { devexLogPath: path });
    expect(await promise).toBe(1);
    expect(out).toEqual(["FAIL S2: no evidence yet", "FAIL"]);
  });

  it("lists a wallet's USDT and watchlist balances through the Wallet API", async () => {
    const { client, calls } = createFakeW3wClient(() => [
      { tokenAssets: [{ binanceChainId: "56", tokenContractAddress: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436", symbol: "NVDAB", balance: "0.02", tokenPrice: "187.43" }] },
    ]);
    const { promise, out } = run(["balances", "--wallet", "0x1111111111111111111111111111111111111111"], { w3w: () => client });
    expect(await promise).toBe(0);
    expect(out).toEqual(["NVDAB 0.02 (@ $187.43)"]);
    expect(calls[0]?.path).toBe("/api/v1/dex/balance/token-balances-by-address");
    expect((calls[0]?.body as { tokenContractAddresses: unknown[] }).tokenContractAddresses).toHaveLength(5);
  });

  it("explains usage problems", async () => {
    const { promise, err } = run(["dance"]);
    expect(await promise).toBe(1);
    expect(err[0]).toBe("error: unknown command dance");
  });
});
