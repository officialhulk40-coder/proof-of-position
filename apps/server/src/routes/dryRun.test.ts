import { createFakeW3wClient } from "@pop/core";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { CALLER, TEST_REGISTRY, makeDeps } from "../testing";
import { dryRunRoutes } from "./dryRun";

function post(app: ReturnType<typeof createApp>, body: unknown) {
  return app.request("/api/dry-run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/dry-run", () => {
  it("returns the revert reason of a post the caller cannot back", async () => {
    const { client, calls } = createFakeW3wClient(() => ({ status: "FAILED", failReason: "execution reverted: No position, no call.", balanceChanges: [], allowanceChanges: [] }));
    const app = createApp(makeDeps({ w3w: client }), [dryRunRoutes]);
    const res = await post(app, { from: CALLER, to: TEST_REGISTRY, data: "0xcfcf5eb9" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: false, status: "FAILED", failReason: "execution reverted: No position, no call.", balanceChanges: [] });
    expect(calls[0]?.body).toEqual({ binanceChainId: "56", evmTx: { from: CALLER, to: TEST_REGISTRY, data: "0xcfcf5eb9", value: "0" } });
  });

  it("reports success with balance changes", async () => {
    const { client } = createFakeW3wClient(() => ({
      status: "SUCCESS",
      failReason: null,
      balanceChanges: [{ contractAddress: "0x55d398326f99059fF775485246999027B3197955", tokenType: "ERC20", change: "-5000000000000000000", owner: CALLER }],
      allowanceChanges: [],
    }));
    const res = await post(createApp(makeDeps({ w3w: client }), [dryRunRoutes]), { from: CALLER, to: TEST_REGISTRY, data: "0x", value: "0" });
    const body = (await res.json()) as { success: boolean; balanceChanges: unknown[] };
    expect(body.success).toBe(true);
    expect(body.balanceChanges).toHaveLength(1);
  });

  it("rejects malformed input and answers 503 without API keys", async () => {
    const { client } = createFakeW3wClient(() => null);
    const bad = await post(createApp(makeDeps({ w3w: client }), [dryRunRoutes]), { from: "0x1", to: TEST_REGISTRY, data: "0x" });
    expect(bad.status).toBe(400);
    const off = await post(createApp(makeDeps({ w3w: null }), [dryRunRoutes]), { from: CALLER, to: TEST_REGISTRY, data: "0x" });
    expect(off.status).toBe(503);
  });
});
