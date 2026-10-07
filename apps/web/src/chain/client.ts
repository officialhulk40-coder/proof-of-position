import { createBscPublicClient } from "@pop/core/browser";
import type { PublicClient } from "viem";
import { config } from "../config";

let client: PublicClient | null = null;

/** One shared BSC client for the page (public RPCs, CORS-enabled, rotating fallback). */
export function getChainClient(): PublicClient {
  client ??= createBscPublicClient(config.rpcUrls, { pollingIntervalMs: 1_000 });
  return client;
}
