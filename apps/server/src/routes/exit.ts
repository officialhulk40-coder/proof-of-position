import { readCallsPage, type CallStatus } from "@pop/core";
import { Hono } from "hono";
import { createKeyedCache } from "../cache";
import type { ServerDeps } from "../deps";
import { HttpError } from "../errors";
import { findExitEvidence, type ExitEvidence } from "../exit/evidence";

export interface ExitResponse {
  callId: number;
  status: CallStatus;
  evidence: ExitEvidence | null;
}

/** GET /calls/:id/exit — exit evidence for a flipped call; found evidence is cached for an hour, "not yet" for 5 s. */
export function exitRoutes(deps: ServerDeps): Hono {
  const app = new Hono();
  const cache = createKeyedCache<number, ExitResponse>(deps.now);
  app.get("/calls/:id/exit", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id < 0) throw new HttpError(400, "BAD_CALL_ID", "call id must be a non-negative integer");
    const response = await cache.get(
      id,
      async () => {
        const [call] = await readCallsPage(deps.chain, deps.config.registry, id, 1);
        if (!call) throw new HttpError(404, "UNKNOWN_CALL", `no call ${id}`);
        const flipped =
          call.exitBlock > 0n || call.status === "TRIMMED" || call.status === "EXITED" || (call.status === "CLOSED" && !call.heldThrough);
        return { callId: id, status: call.status, evidence: flipped ? await findExitEvidence(deps, call) : null };
      },
      (result) => (result.evidence !== null ? 3_600_000 : 5_000),
    );
    return c.json(response);
  });
  return app;
}
