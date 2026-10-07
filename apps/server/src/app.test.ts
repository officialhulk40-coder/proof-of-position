import { W3wApiError } from "@pop/core";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "./app";
import { requireW3w } from "./deps";
import { HttpError } from "./errors";
import { TEST_REGISTRY, makeDeps } from "./testing";

/** A route module that throws whatever the query asks for, to exercise the error mapper. */
function throwingRoutes(deps: ReturnType<typeof makeDeps>) {
  const app = new Hono();
  app.get("/boom/:kind", (c) => {
    const kind = c.req.param("kind");
    if (kind === "http") throw new HttpError(409, "NO_SWAP_ROUTE", "no SWAP route right now");
    if (kind === "w3w") throw new W3wApiError({ code: 40304, msg: "Service not available due to compliance restriction", httpStatus: 200, endpoint: "/api/v1/x" });
    if (kind === "unconfigured") requireW3w(deps);
    if (kind === "zod") z.object({ wallet: z.string().regex(/^0x/, "wallet must be a 0x address") }).parse({ wallet: "nope" });
    throw new Error("secret internals");
  });
  return app;
}

describe("createApp", () => {
  it("reports health with the registry, API and keeper state", async () => {
    const app = createApp(makeDeps({ keeper: { enabled: true, address: "0x2222222222222222222222222222222222222222", recorded: 3, lastError: null } }));
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      chainId: 56,
      registry: TEST_REGISTRY,
      w3w: true,
      keeper: { enabled: true, address: "0x2222222222222222222222222222222222222222", recorded: 3, lastError: null },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("answers unknown routes with a JSON 404", async () => {
    const res = await createApp(makeDeps()).request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "NOT_FOUND", msg: "no such route" } });
  });

  it("maps every error class to a stable JSON shape", async () => {
    const deps = makeDeps({ w3w: null });
    const app = createApp(deps, [() => throwingRoutes(deps)]);
    const http = await app.request("/api/boom/http");
    expect(http.status).toBe(409);
    expect(await http.json()).toEqual({ error: { code: "NO_SWAP_ROUTE", msg: "no SWAP route right now" } });
    const w3w = await app.request("/api/boom/w3w");
    expect(w3w.status).toBe(502);
    expect(await w3w.json()).toEqual({
      error: { code: 40304, msg: "Service not available due to compliance restriction", hint: "service not available due to compliance restriction (region / datacenter IP)" },
    });
    const unconfigured = await app.request("/api/boom/unconfigured");
    expect(unconfigured.status).toBe(503);
    expect(((await unconfigured.json()) as { error: { code: string } }).error.code).toBe("W3W_NOT_CONFIGURED");
    const bad = await app.request("/api/boom/zod");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: { code: "BAD_REQUEST", msg: "wallet: wallet must be a 0x address" } });
    const internal = await app.request("/api/boom/other");
    expect(internal.status).toBe(500);
    expect(JSON.stringify(await internal.json())).not.toContain("secret internals");
  });

  it("limits CORS to configured origins", async () => {
    const app = createApp(makeDeps({ config: { corsOrigins: ["https://pop.test"] } }));
    const res = await app.request("/api/health", { headers: { Origin: "https://pop.test" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://pop.test");
  });
});
