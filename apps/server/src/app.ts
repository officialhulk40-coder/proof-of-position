import { BSC_CHAIN_ID, W3W_ERROR_HINTS, W3wApiError } from "@pop/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import { W3wNotConfiguredError, type ServerDeps } from "./deps";
import { HttpError } from "./errors";

/** A route module: returns a Hono sub-app mounted under /api. */
export type RouteModule = (deps: ServerDeps) => Hono;

/**
 * The API: GET /api/health plus every route module under /api, behind CORS, with one error mapper:
 * HttpError → its status · no API keys → 503 · Binance API failure → 502 with the verbatim code/msg ·
 * bad input → 400 · anything else → 500 (logged, never echoed).
 */
export function createApp(deps: ServerDeps, routes: readonly RouteModule[] = []): Hono {
  const app = new Hono();
  app.use("/api/*", cors({ origin: deps.config.corsOrigins.includes("*") ? "*" : deps.config.corsOrigins }));
  app.get("/api/health", (c) =>
    c.json({ ok: true, chainId: BSC_CHAIN_ID, registry: deps.config.registry, w3w: deps.w3w !== null, keeper: deps.keeperStatus() }),
  );
  for (const route of routes) app.route("/api", route(deps));
  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", msg: "no such route" } }, 404));
  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: { code: error.code, msg: error.message } }, error.status);
    if (error instanceof W3wNotConfiguredError) return c.json({ error: { code: "W3W_NOT_CONFIGURED", msg: error.message } }, 503);
    if (error instanceof W3wApiError) {
      return c.json({ error: { code: error.code, msg: error.msg, hint: W3W_ERROR_HINTS[error.code] ?? null } }, 502);
    }
    if (error instanceof ZodError) {
      const msg = error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
      return c.json({ error: { code: "BAD_REQUEST", msg } }, 400);
    }
    if (error instanceof SyntaxError) return c.json({ error: { code: "BAD_REQUEST", msg: "request body is not valid JSON" } }, 400);
    console.error("[server] unexpected error", error);
    return c.json({ error: { code: "INTERNAL", msg: "internal error" } }, 500);
  });
  return app;
}
