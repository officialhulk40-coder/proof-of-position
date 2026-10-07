import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as browser from "./browser";
import * as node from "./index";

const srcDir = dirname(fileURLToPath(import.meta.url));

/** Follows runtime (non-type) relative imports/re-exports from `entry` and returns every reachable file. */
function runtimeImportGraph(entry: string): Map<string, string> {
  const files = new Map<string, string>();
  const queue = [resolve(srcDir, entry)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    const source = readFileSync(file, "utf8");
    files.set(file, source);
    const pattern = /^(?:import|export)\s+(?!type\b)[^;]*?from\s+"(\.{1,2}\/[^"]+)"/gm;
    for (const match of source.matchAll(pattern)) {
      const target = match[1] as string;
      queue.push(resolve(dirname(file), `${target}.ts`));
    }
  }
  return files;
}

describe("entry points", () => {
  it("the browser entry never reaches a node: builtin at runtime", () => {
    const graph = runtimeImportGraph("browser.ts");
    const offenders = [...graph.entries()].filter(([, source]) => /from\s+"node:/.test(source)).map(([file]) => file);
    expect(offenders).toEqual([]);
    expect([...graph.keys()].some((file) => file.endsWith(join("w3w", "sign.ts")))).toBe(false);
    expect([...graph.keys()].some((file) => file.endsWith(join("devex", "telemetry.ts")))).toBe(false);
  });

  it("the browser entry exposes the chain, catalog, format and registry surface", () => {
    for (const name of ["createBscPublicClient", "getTokenInfo", "findTokens", "toShares", "readLatestCalls", "readAgentIntegrity", "CALL_REGISTRY_ABI", "ADDRESSES", "needsExitRecord"]) {
      expect(name in browser).toBe(true);
    }
    expect("createW3wClient" in browser).toBe(false);
    expect("sendWithTransactionApi" in browser).toBe(false);
  });

  it("the Node entry exposes everything", () => {
    for (const name of ["createW3wClient", "signW3wRequest", "getRwaTokens", "getTokenTrades", "getQuote", "pickSwapRoute", "simulateTx", "broadcastTx", "sendWithTransactionApi", "viemAccountSigner", "walletProviderSigner", "createTelemetryRecorder", "readCallsFrom", "TOKEN_CATALOG", "createFakeW3wClient"]) {
      expect(name in node).toBe(true);
    }
  });
});
