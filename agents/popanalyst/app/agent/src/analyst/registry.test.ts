import { requireTokenBySymbol, SimulationFailedError } from "@pop/core";
import { describe, expect, it } from "vitest";
import { closeCall, postAsAgent } from "./registry.js";
import { fakeWorld, NVDAB, rawCall, REGISTRY } from "./testing.js";

describe("registry writes", () => {
  it("posts as the agent and returns the new call id from CallPosted", async () => {
    const world = fakeWorld({ calls: [{ raw: rawCall(), status: 0 }] });
    const result = await postAsAgent({ ...world, registry: REGISTRY }, { token: NVDAB, amount: 5n, agentId: 7n, note: "AI capex" });
    expect(result.callId).toBe(1);
    expect(world.signed).toEqual([`postAsAgent:${NVDAB}:5:AI capex`]);
    const simulate = world.apiCalls.find((call) => call.path === "/api/v1/dex/pre-transaction/simulate");
    expect(simulate?.body).toMatchObject({ evmTx: { to: REGISTRY } });
  });

  it("closes a call and reports whether it was held through", async () => {
    const world = fakeWorld({ calls: [{ raw: rawCall(), status: 0 }] });
    expect((await closeCall({ ...world, registry: REGISTRY }, 0)).heldThrough).toBe(true);
    expect(world.signed).toEqual(["close:0"]);
  });

  it("never signs when the simulation reverts", async () => {
    const world = fakeWorld({ failSimulation: "execution reverted: No position, no call." });
    const error = await postAsAgent({ ...world, registry: REGISTRY }, { token: requireTokenBySymbol("TSLAB").address, amount: 1n, agentId: 7n, note: "" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SimulationFailedError);
    expect(world.signed).toEqual([]);
  });
});
