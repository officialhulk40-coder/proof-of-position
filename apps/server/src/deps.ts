import type { W3wClient } from "@pop/core";
import type { PublicClient } from "viem";
import type { ServerConfig } from "./config";

/** Chain reads the server needs (a viem PublicClient or a test fake). */
export type ChainClient = Pick<PublicClient, "readContract" | "getBlockNumber">;

/** The getLogs-capable RPC (publicnode by default; the official dataseed refuses eth_getLogs). */
export type LogsClient = Pick<PublicClient, "getLogs" | "getBlockNumber" | "getCode">;

export interface KeeperStatus {
  enabled: boolean;
  address: `0x${string}` | null;
  recorded: number;
  lastError: string | null;
}

export interface ServerDeps {
  config: ServerConfig;
  w3w: W3wClient | null;
  chain: ChainClient;
  logs: LogsClient;
  now: () => number;
  keeperStatus: () => KeeperStatus;
}

/** Thrown by W3W-backed routes when the server runs without API keys → HTTP 503. */
export class W3wNotConfiguredError extends Error {
  constructor() {
    super("the Binance Web3 API is not configured on this server");
    this.name = "W3wNotConfiguredError";
  }
}

export function requireW3w(deps: ServerDeps): W3wClient {
  if (!deps.w3w) throw new W3wNotConfiguredError();
  return deps.w3w;
}
