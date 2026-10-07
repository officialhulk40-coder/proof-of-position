import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { ROUTES, buildServer } from "./main";

const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

describe("buildServer", () => {
  it("serves health with the API and keeper off when no secrets are set", async () => {
    const { app, keeper, config } = buildServer({ REGISTRY_ADDRESS: REGISTRY });
    expect(keeper).toBeNull();
    expect(config.w3w).toBeNull();
    const body = (await (await app.request("/api/health")).json()) as { w3w: boolean; keeper: { enabled: boolean } };
    expect(body.w3w).toBe(false);
    expect(body.keeper.enabled).toBe(false);
  });

  it("enables the keeper with the address of KEEPER_PK when API keys are present", async () => {
    const key = generatePrivateKey();
    const { app, keeper } = buildServer({ REGISTRY_ADDRESS: REGISTRY, W3W_API_KEY: "k", W3W_API_SECRET: "s", KEEPER_PK: key });
    expect(keeper).not.toBeNull();
    const body = (await (await app.request("/api/health")).json()) as { keeper: { enabled: boolean; address: string } };
    expect(body.keeper).toEqual({ enabled: true, address: privateKeyToAccount(key).address, recorded: 0, lastError: null });
  });

  it("mounts every route module", async () => {
    expect(ROUTES).toHaveLength(4);
    const { app } = buildServer({ REGISTRY_ADDRESS: REGISTRY });
    const res = await app.request("/api/dry-run", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(400);
    expect((await app.request("/api/tokens")).status).toBe(200);
  });
});
