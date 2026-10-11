import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEVEX_SECTIONS, devexProblems, sectionBullets, SMOKE_SECTIONS } from "./devex";

const log = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "DEVEX_LOG.md"), "utf8").replace(/\r\n/g, "\n");

describe("DEVEX_LOG.md", () => {
  it("states that the final report is written by a human", () => {
    expect(log.startsWith("# DevEx log (raw notes)\n")).toBe(true);
    expect(log).toContain("must be written by a human");
  });

  it("has every DX form section, then every smoke check, in order", () => {
    const headings = log.split("\n").filter((line) => /^#{2,3} /.test(line)).map((line) => line.replace(/^#{2,3} /, ""));
    expect(headings).toEqual([...DEVEX_SECTIONS, ...SMOKE_SECTIONS]);
  });

  it("starts with pending placeholders only", () => {
    const pending = `## Smoke evidence\n\n### S1\n\n- (pending) x\n\n### S5\n\n- (pending) y\n`;
    expect(devexProblems(pending, ["S1", "S5"])).toEqual(["S1: no evidence yet", "S5: no evidence yet"]);
  });

  it("passes once S1 and S5 carry evidence", () => {
    const evidence = `## Smoke evidence\n\n### S1\n\n- (pending) x\n- 2026-10-09 call: code 0 in 412 ms\n\n### S5\n\n- 2026-10-10 ok\n`;
    expect(devexProblems(evidence, ["S1", "S5"])).toEqual([]);
  });
});

describe("devexProblems", () => {
  it("accepts real evidence and reports missing headings", () => {
    const filled = `## Smoke evidence\n\n### S1\n\n- (pending) x\n- 2026-10-09 GET /api/v1/dex/market/rwa/tokens from SG VPS: code 0 in 412 ms\n\n### S2\n\n- (pending) y\n`;
    expect(sectionBullets(filled, "S1")).toHaveLength(2);
    expect(devexProblems(filled, ["S1", "S2", "S9"])).toEqual(["S2: no evidence yet", "S9: heading missing"]);
  });
});
