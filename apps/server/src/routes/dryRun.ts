import { isSimulationSuccess, simulateTx } from "@pop/core";
import { Hono } from "hono";
import { z } from "zod";
import { requireW3w, type ServerDeps } from "../deps";

const hexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");

export const dryRunBodySchema = z.object({
  from: hexAddress,
  to: hexAddress,
  data: z.string().regex(/^0x[0-9a-fA-F]*$/, "data must be 0x-prefixed hex"),
  value: z
    .string()
    .regex(/^\d+$/, "value must be a decimal wei string")
    .default("0"),
});

/** POST /dry-run — Transaction API simulate for any tx; the web uses it to show "No position, no call." before signing. */
export function dryRunRoutes(deps: ServerDeps): Hono {
  const app = new Hono();
  app.post("/dry-run", async (c) => {
    const body = dryRunBodySchema.parse(await c.req.json());
    const simulation = await simulateTx(requireW3w(deps), body);
    return c.json({
      success: isSimulationSuccess(simulation),
      status: simulation.status,
      failReason: simulation.failReason ?? null,
      balanceChanges: simulation.balanceChanges,
    });
  });
  return app;
}
