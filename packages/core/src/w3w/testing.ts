import type { z } from "zod";
import type { QueryValue, W3wClient } from "./client";

export interface RecordedCall {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

/**
 * In-memory W3wClient for unit tests: answers each call from `handler` (which receives the call and
 * returns the envelope's `data`), parses it with the caller's schema like the real client, and records calls.
 */
export function createFakeW3wClient(handler: (call: RecordedCall) => unknown): { client: W3wClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client: W3wClient = {
    async get<T>(path: string, query: Record<string, QueryValue>, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
      const call: RecordedCall = { method: "GET", path, query };
      calls.push(call);
      return schema.parse(await handler(call));
    },
    async post<T>(path: string, body: unknown, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
      const call: RecordedCall = { method: "POST", path, body };
      calls.push(call);
      return schema.parse(await handler(call));
    },
  };
  return { client, calls };
}
