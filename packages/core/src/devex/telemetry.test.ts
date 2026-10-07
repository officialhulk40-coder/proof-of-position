import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEventRecorder, createTelemetryRecorder } from "./telemetry";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "pop-telemetry-"));
  dirs.push(dir);
  return join(dir, "nested", "telemetry.jsonl");
}

describe("telemetry", () => {
  it("appends one JSON line per W3W timing, creating the directory", () => {
    const filePath = tempFile();
    const record = createTelemetryRecorder({ filePath, service: "server", now: () => new Date("2026-10-07T00:00:00.000Z") });
    record({ method: "GET", endpoint: "/api/v1/dex/market/rwa/tokens", httpStatus: 200, code: 0, msg: "success", ms: 182 });
    record({ method: "POST", endpoint: "/api/v1/dex/pre-transaction/simulate", httpStatus: 200, code: 40304, msg: "blocked", ms: 95 });
    const lines = readFileSync(filePath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines).toEqual([
      { ts: "2026-10-07T00:00:00.000Z", service: "server", kind: "w3w", method: "GET", endpoint: "/api/v1/dex/market/rwa/tokens", httpStatus: 200, code: 0, msg: "success", ms: 182 },
      { ts: "2026-10-07T00:00:00.000Z", service: "server", kind: "w3w", method: "POST", endpoint: "/api/v1/dex/pre-transaction/simulate", httpStatus: 200, code: 40304, msg: "blocked", ms: 95 },
    ]);
  });

  it("records arbitrary events such as follower exit latency", () => {
    const filePath = tempFile();
    const record = createEventRecorder({ filePath, service: "follower", now: () => new Date("2026-10-07T01:02:03.000Z") });
    record({ kind: "exit", callId: 4, flipToFinishedMs: 6400, txHash: "0xabc" });
    expect(JSON.parse(readFileSync(filePath, "utf8").trim())).toEqual({
      ts: "2026-10-07T01:02:03.000Z",
      service: "follower",
      kind: "exit",
      callId: 4,
      flipToFinishedMs: 6400,
      txHash: "0xabc",
    });
  });
});
