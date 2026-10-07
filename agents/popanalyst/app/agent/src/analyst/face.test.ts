import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { latestCall, withLatestCallFace } from "./face.js";
import { scheduleCycles, startAnalystLoop, type Timers } from "./loop.js";
import { AGENT_WALLET, fakeWorld, NVDAB, rawCall, REGISTRY } from "./testing.js";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("latest-call face", () => {
  it("answers prompts starting with 'latest' and passes the rest through", async () => {
    const inner = vi.fn(async (prompt: string) => `LLM: ${prompt}`);
    const work = withLatestCallFace(inner, async () => ({ callId: 3 }));
    expect(await work("latest", { sessionId: "s" })).toBe('{"callId":3}');
    expect(await work("  Latest call please", { sessionId: "s" })).toBe('{"callId":3}');
    expect(await work("analyse NVDA", { sessionId: "s" })).toBe("LLM: analyse NVDA");
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it("summarizes the agent's newest call", async () => {
    const world = fakeWorld({
      calls: [
        { raw: rawCall({ note: "first" }), status: 3 },
        { raw: rawCall({ caller: "0x1111111111111111111111111111111111111111", note: "someone else" }), status: 0 },
        { raw: rawCall({ note: "AI capex" }), status: 2 },
      ],
    });
    expect(await latestCall({ client: world.client, registry: REGISTRY, wallet: AGENT_WALLET, feedUrl: "https://pop.example" })).toEqual({
      callId: 2,
      token: NVDAB,
      ticker: "NVDA",
      status: "EXITED",
      thesis: "AI capex",
      bscscan: `https://bscscan.com/token/${NVDAB}?a=${AGENT_WALLET}`,
      feed: "https://pop.example/#/calls/2",
    });
    expect(await latestCall({ client: fakeWorld().client, registry: REGISTRY, wallet: AGENT_WALLET, feedUrl: null })).toBeNull();
  });
});

describe("analyst loop", () => {
  it("does not start without ANALYST_ENABLED, an agent id and API keys", () => {
    const lines: string[] = [];
    expect(startAnalystLoop({}, (line) => lines.push(line))).toBeNull();
    expect(startAnalystLoop({ ANALYST_ENABLED: "true", REGISTRY_ADDRESS: REGISTRY }, (line) => lines.push(line))).toBeNull();
    expect(lines).toEqual(["loop not started: ANALYST_ENABLED is not true", "loop not started: ANALYST_AGENT_ID is not set (register the agent on ERC-8004 first)"]);
  });

  it("runs cycles on schedule without overlap and survives failures", async () => {
    const scheduled: Array<() => void> = [];
    const timers: Timers = { setTimeout: (fn) => scheduled.push(fn), setInterval: (fn) => scheduled.push(fn), clearTimeout: () => {}, clearInterval: () => {} };
    const lines: string[] = [];
    let release: () => void = () => {};
    let runs = 0;
    scheduleCycles(
      () => {
        runs += 1;
        if (runs === 1) return new Promise<void>((resolve) => (release = resolve));
        return Promise.reject(new Error("RPC down"));
      },
      { intervalMs: 60_000, firstDelayMs: 15_000, log: (line) => lines.push(line), timers },
    );
    const [first, every] = scheduled as [() => void, () => void];
    first();
    every();
    expect(lines).toEqual(["previous cycle still running; skipping this one"]);
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    every();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runs).toBe(2);
    expect(lines[1]).toBe("cycle failed: RPC down");
  });
});

describe("unifiedMain hook", () => {
  it("is applied to the scaffold, idempotently", () => {
    const main = readFileSync(join(appDir, "src", "unifiedMain.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(main).toContain("  const runWork = withLatestCallFace(buildRunWork());\n  startAnalystLoop();");
    expect(main).toContain('import { withLatestCallFace } from "./analyst/face.js";\nimport { startAnalystLoop } from "./analyst/loop.js";');
    expect(main).not.toContain("  const runWork = buildRunWork();");

    const fixture = join(mkdtempSync(join(tmpdir(), "pop-hook-")), "unifiedMain.ts");
    writeFileSync(fixture, 'import { LLM_READ_TOOLS } from "./tools.js";\nasync function main() {\n  const runWork = buildRunWork();\n}\n');
    const script = join(appDir, "scripts", "apply-analyst-hook.mjs");
    expect(spawnSync(process.execPath, [script, fixture], { encoding: "utf8" }).stdout).toMatch(/^analyst hook applied/);
    expect(spawnSync(process.execPath, [script, fixture], { encoding: "utf8" }).stdout).toBe("analyst hook already applied\n");
    expect(readFileSync(fixture, "utf8").split("startAnalystLoop();").length).toBe(2);
  });
});
