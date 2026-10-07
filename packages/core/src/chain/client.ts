import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { bsc } from "viem/chains";
import { DEFAULT_BSC_RPC_URLS } from "./constants";

/** A BSC mainnet client that rotates across `rpcUrls` (viem fallback) and polls every second by default. */
export function createBscPublicClient(
  rpcUrls: readonly string[] = DEFAULT_BSC_RPC_URLS,
  options: { pollingIntervalMs?: number } = {},
): PublicClient {
  return createPublicClient({
    chain: bsc,
    pollingInterval: options.pollingIntervalMs ?? 1_000,
    transport: fallback(rpcUrls.map((url) => http(url, { timeout: 10_000, retryCount: 1 }))),
  });
}
