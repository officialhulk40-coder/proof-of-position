import { createBscPublicClient, getTokenInfo, readCallsFrom, type RegistryReader } from "@pop/core";
import type { RunWork } from "../sellerCore.js";
import { loadAnalystConfig } from "./config.js";

/** What the agent answers to a prompt that starts with "latest". */
export interface LatestCall {
  callId: number;
  token: string;
  ticker: string;
  status: string;
  thesis: string;
  bscscan: string;
  feed: string | null;
}

export const LATEST_PROMPT = /^\s*latest\b/i;

/** The newest call posted by `wallet`, or null before its first call. */
export async function latestCall(deps: { client: RegistryReader; registry: `0x${string}`; wallet: string; feedUrl: string | null }): Promise<LatestCall | null> {
  const mine = (await readCallsFrom(deps.client, deps.registry, 0)).filter((call) => call.caller.toLowerCase() === deps.wallet.toLowerCase());
  const last = mine[mine.length - 1];
  if (!last) return null;
  return {
    callId: last.id,
    token: last.token,
    ticker: getTokenInfo(last.token)?.ticker ?? last.token,
    status: last.status,
    thesis: last.note,
    bscscan: `https://bscscan.com/token/${last.token}?a=${last.caller}`,
    feed: deps.feedUrl ? `${deps.feedUrl}/#/calls/${last.id}` : null,
  };
}

/** The production summarizer: this agent's own wallet, the env's registry and RPCs. Never throws. */
async function studioLatestCall(): Promise<unknown> {
  try {
    const config = loadAnalystConfig(process.env);
    if (config.registry === null) return { error: "REGISTRY_ADDRESS is not set" };
    const { getWallet } = await import("@bnbagent/studio-runtime/wallet");
    const wallet = getWallet().address;
    if (!wallet) return { error: "the agent wallet has no address yet" };
    const latest = await latestCall({ client: createBscPublicClient(config.rpcUrls), registry: config.registry, wallet, feedUrl: config.feedUrl });
    return latest ?? { message: "no calls yet" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Wraps the scaffold's runWork (A2A and the FREE x402 route): a prompt starting with "latest" gets the
 * agent's latest call as JSON without touching the LLM; every other prompt falls through unchanged.
 */
export function withLatestCallFace(inner: RunWork, summarize: () => Promise<unknown> = studioLatestCall): RunWork {
  return async (prompt, opts) => (LATEST_PROMPT.test(prompt) ? JSON.stringify(await summarize()) : inner(prompt, opts));
}
