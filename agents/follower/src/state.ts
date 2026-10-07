import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { FollowerState } from "./decide";

const mirrorSchema = z.object({
  callId: z.number().int().nonnegative(),
  caller: z.string(),
  token: z.string(),
  status: z.enum(["open", "closed", "failed"]),
  quantity: z.string().regex(/^\d+$/),
  buyOrderId: z.string().nullable(),
  buyTxHash: z.string().nullable(),
  sellOrderId: z.string().nullable(),
  sellTxHash: z.string().nullable(),
  openedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  exitReason: z.string().nullable(),
  error: z.string().nullable(),
});

const stateSchema = z.object({
  version: z.literal(1),
  cursor: z.number().int().nonnegative(),
  mirrors: z.record(mirrorSchema),
});

/** POP_FOLLOWER_STATE, else ~/.pop-follower/state.json. */
export function defaultStatePath(env: Record<string, string | undefined> = process.env): string {
  return env.POP_FOLLOWER_STATE?.trim() || join(homedir(), ".pop-follower", "state.json");
}

/** The saved state, or null on first run. A corrupt file is an error, never silently reset. */
export function loadState(path: string): FollowerState | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  return stateSchema.parse(JSON.parse(text));
}

/** Writes atomically (temp file + rename) so a crash never leaves half a state file. */
export function saveState(path: string, state: FollowerState): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temp, path);
}
