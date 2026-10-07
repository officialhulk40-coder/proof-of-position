import { parseRpcUrls } from "@pop/core/browser";

export interface WebConfig {
  /** Null until CallRegistry is deployed and VITE_REGISTRY_ADDRESS is set at build time. */
  registry: `0x${string}` | null;
  /** API origin; "" means same origin (Caddy serves /api on the same host). */
  apiBase: string;
  rpcUrls: string[];
  explorer: string;
}

export function readConfig(env: Record<string, string | boolean | undefined>): WebConfig {
  const raw = typeof env.VITE_REGISTRY_ADDRESS === "string" ? env.VITE_REGISTRY_ADDRESS.trim() : "";
  const apiBase = typeof env.VITE_API_BASE === "string" ? env.VITE_API_BASE.trim().replace(/\/$/, "") : "";
  return {
    registry: /^0x[0-9a-fA-F]{40}$/.test(raw) ? (raw as `0x${string}`) : null,
    apiBase,
    rpcUrls: parseRpcUrls(typeof env.VITE_RPC_URLS === "string" ? env.VITE_RPC_URLS : undefined),
    explorer: "https://bscscan.com",
  };
}

export const config: WebConfig = readConfig(import.meta.env);
