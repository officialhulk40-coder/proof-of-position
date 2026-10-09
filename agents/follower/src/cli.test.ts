import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RegistryReader } from "@pop/core";
import { describe, expect, it } from "vitest";
import { main, type CliDeps } from "./cli";
import { saveState } from "./state";
import { CALLER, manualClock, REGISTRY, scriptedBaw } from "./testing";

const NOW = Date.parse("2026-10-09T10:00:00Z");

function cli(handlers: Parameters<typeof scriptedBaw>[0], env: Record<string, string> = {}, chain?: RegistryReader) {
  const { runner, calls } = scriptedBaw(handlers);
  const out: string[] = [];
  const err: string[] = [];
  const clock = manualClock(NOW);
  const deps: Partial<CliDeps> = {
    env: { POP_FOLLOWER_STATE: join(mkdtempSync(join(tmpdir(), "pop-cli-")), "state.json"), ...env },
    baw: runner,
    chain: chain ?? ({ readContract: async () => 12_340_000_000_000_000_000n } as unknown as RegistryReader),
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    now: clock.now,
    sleep: clock.sleep,
    keepRunning: () => false,
  };
  return { deps, out, err, calls };
}

const healthy = {
  "cli-check": () => ({ currentCliVersion: "1.10.0", needUpdateCli: false }),
  "wallet status": () => ({ status: "CONNECTED" }),
  "wallet settings": () => ({ sessionExpireTime: "2026-10-09T13:00:00Z", quotaLeft: 49000, tradeAllTokens: false }),
  "wallet address": () => ({ addresses: [{ binanceChainId: "56", address: "0x3333333333333333333333333333333333333333" }] }),
};

describe("pop-follower check", () => {
  it("reports version, connection, session, quota, address and USDT", async () => {
    const { deps, out, err } = cli(healthy);
    expect(await main(["check"], deps)).toBe(0);
    expect(out).toEqual(["baw 1.10.0 ✓", "wallet CONNECTED ✓", "daily quota left: $49000", "BSC address 0x3333333333333333333333333333333333333333", "USDT balance 12.34"]);
    expect(err).toEqual([
      "WARNING: session expires 2026-10-09T13:00:00Z (3.0 h left); sign in again before a long run",
      "WARNING: tradeAllTokens is off: the bStocks you follow must be on the wallet's allowed list (Binance App → Agentic Wallet → Settings)",
    ]);
  });

  it("fails on an old CLI or a signed-out wallet", async () => {
    const old = cli({ ...healthy, "cli-check": () => ({ currentCliVersion: "1.8.0", needUpdateCli: true }) });
    expect(await main(["check"], old.deps)).toBe(1);
    expect(old.err[0]).toBe("baw 1.8.0 is older than 1.10.0: npm install -g @binance/agentic-wallet@1.10.0");
    const out = cli({ ...healthy, "wallet status": () => ({ status: "UNCONNECTED" }) });
    expect(await main(["check"], out.deps)).toBe(1);
    expect(out.err[0]).toBe("Agentic Wallet is UNCONNECTED: run `baw auth signin` and approve it in the Binance App");
  });
});

describe("pop-follower run", () => {
  it("validates its arguments", async () => {
    const { deps, err } = cli(healthy, { REGISTRY_ADDRESS: REGISTRY });
    expect(await main(["run", "--budget-usdt", "1"], deps)).toBe(1);
    expect(err[0]).toBe("error: --caller <0x address> is required (repeatable)");
    const noRegistry = cli(healthy);
    expect(await main(["run", "--caller", CALLER, "--budget-usdt", "1"], noRegistry.deps)).toBe(1);
    expect(noRegistry.err[0]).toBe("error: set REGISTRY_ADDRESS to the deployed CallRegistry");
  });

  it("starts at the current call count and runs one tick with --once", async () => {
    const chain = { readContract: async ({ functionName }: { functionName: string }) => (functionName === "callCount" ? 3n : [[], []]) } as unknown as RegistryReader;
    const { deps, out } = cli(healthy, { REGISTRY_ADDRESS: REGISTRY }, chain);
    expect(await main(["run", "--caller", CALLER, "--budget-usdt", "1", "--once"], deps)).toBe(0);
    expect(out[0]).toMatch(/^pop-follower: new state at .*state\.json; mirroring calls from #3$/);
    expect(out[1]).toBe(`following ${CALLER} with 1 USDT per call (max 1 open) from 0x3333333333333333333333333333333333333333`);
  });

  it("refuses to start with a signed-out wallet", async () => {
    const { deps, err } = cli({ ...healthy, "wallet status": () => ({ status: "UNCONNECTED" }) }, { REGISTRY_ADDRESS: REGISTRY });
    expect(await main(["run", "--caller", CALLER, "--budget-usdt", "1"], deps)).toBe(2);
    expect(err[0]).toBe("Agentic Wallet is UNCONNECTED: run `baw auth signin` first");
  });
});

describe("pop-follower status and smoke", () => {
  it("prints the mirrors", async () => {
    const { deps, out } = cli(healthy);
    saveState(deps.env?.POP_FOLLOWER_STATE as string, {
      version: 1,
      cursor: 4,
      mirrors: {
        "4": { callId: 4, caller: CALLER, token: "0x02fca66c1d1afb4e2a7884261eb00f63598a7436", status: "closed", quantity: "5300000000000000", buyOrderId: "o1", buyTxHash: null, sellOrderId: "o2", sellTxHash: null, openedAt: null, closedAt: null, exitReason: "EXITED", error: null },
      },
    });
    expect(await main(["status"], deps)).toBe(0);
    expect(out[1]).toBe("#4 0x02fca66c1d1afb4e2a7884261eb00f63598a7436 0.0053 · closed · sold on EXITED (order o2)");
  });

  it("smoke only describes the round trip without --yes", async () => {
    const { deps, out, calls } = cli(healthy);
    expect(await main(["smoke", "--token", "NVDAB", "--usdt", "0.5"], deps)).toBe(0);
    expect(out[0]).toMatch(/^would buy 0\.5 USDT of NVDAB \(0x02fca66c1d1afb4e2a7884261eb00f63598a7436\) with the Agentic Wallet/);
    expect(calls).toEqual([]);
  });

  it("prints usage for unknown commands", async () => {
    const { deps, err } = cli(healthy);
    expect(await main(["dance"], deps)).toBe(1);
    expect(err[0]).toBe("error: unknown command dance");
  });
});

describe("bin/pop-follower.mjs", () => {
  // A cold tsx start takes 3–22 s on Windows, past vitest's 5 s default; the child is killed at 55 s.
  it("runs the TypeScript CLI through tsx", () => {
    const bin = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "pop-follower.mjs");
    const result = spawnSync(process.execPath, [bin, "--help"], { encoding: "utf8", timeout: 55_000 });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^pop-follower — mirror Proof of Position callers/);
  }, 60_000);
});
