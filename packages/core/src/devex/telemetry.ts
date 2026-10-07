import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { W3wTiming } from "../w3w/client";

export interface TelemetryOptions {
  /** JSONL file, e.g. devex/telemetry.jsonl (git-ignored; copy figures into DEVEX_LOG.md by hand). */
  filePath: string;
  /** Which process wrote the line: "server", "follower", "analyst", "demo". */
  service: string;
  now?: () => Date;
}

export interface TelemetryEvent {
  kind: string;
  [field: string]: string | number | boolean | null;
}

/** Appends one JSON line per event: { ts, service, ...event }. */
export function createEventRecorder(options: TelemetryOptions): (event: TelemetryEvent) => void {
  mkdirSync(dirname(options.filePath), { recursive: true });
  const now = options.now ?? (() => new Date());
  return (event) => {
    appendFileSync(options.filePath, `${JSON.stringify({ ts: now().toISOString(), service: options.service, ...event })}\n`);
  };
}

/** An onTiming callback for createW3wClient: one "w3w" line per API call (endpoint, status, code, msg, ms). */
export function createTelemetryRecorder(options: TelemetryOptions): (timing: W3wTiming) => void {
  const record = createEventRecorder(options);
  return (timing) => record({ kind: "w3w", ...timing });
}
