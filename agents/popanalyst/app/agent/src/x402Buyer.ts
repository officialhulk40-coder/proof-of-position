/**
 * x402 micropay buyer tools — emitted by `bag recipe code x402-buyer`.
 *
 * The agent's LLM can buy from any x402-protected URL whose host is on the
 * effective allowlist: `[payments.x402].allowed_hosts` plus every merchant
 * trusted via `bag x402 trust` (`[payments.x402.merchants.*]` — e.g. the
 * Binance Bazaar shelf: CMC market data).
 *
 * Wire into the agent (main.ts / mcpMain.ts on agentcore; foundryMain.ts on
 * azure-foundry — each carries this hint on its `tools:` line) — signing
 * stays fixed code, these tools only *fetch with payment* inside the config
 * fences:
 *
 *     import { X402_BUYER_TOOLS } from "./x402Buyer.js";
 *     ...
 *     tools: { ...LLM_READ_TOOLS, ...X402_BUYER_TOOLS },
 *
 * (This file sits NEXT TO tools.ts on purpose so the emitted agent package
 * stays a flat module set.)
 *
 * Security spine (all enforced in @bnbagent/studio-runtime, not here):
 *   - recipient: the pinned merchant `pay_to` (or `expected_recipient`) is
 *     byte-compared against the 402's payTo — a tampered 402 can never
 *     redirect funds;
 *   - per-call cap: `merchants.<name>.per_call_cap_usd` clamps every payment
 *     regardless of the `max_usd` argument below (the LLM can tighten it,
 *     never widen);
 *   - daily cap: `[budget].max_per_day_usd` across all paid calls.
 *
 * You own this file; edit freely.
 */

import { loadStudioToml } from "@bnbagent/studio-runtime/config";
import { getWallet } from "@bnbagent/studio-runtime/wallet";
import {
  fetchWithPayment,
  quoteUrl,
  X402BuyerPolicy,
  X402Error,
} from "@bnbagent/studio-runtime/x402";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

function policy(): X402BuyerPolicy {
  return X402BuyerPolicy.fromToml(loadStudioToml());
}

/**
 * Pay an x402-protected endpoint and return its response.
 *
 * NO API KEY IS REQUIRED. x402 merchants (CoinMarketCap x402 endpoints,
 * Binance Bazaar merchants, etc.) authenticate the caller by the on-chain
 * EIP-3009 payment signed with the agent's own wallet — there is NO
 * `Authorization` / `X-API-KEY` header. If a task needs data from a URL on
 * the allowlist (CMC prices, etc.), ALWAYS use this tool; never ask the user
 * for an API key and never answer that the task can't be done for lack of
 * one. Payment is fenced by studio.toml (merchant.per_call_cap_usd +
 * [budget].max_per_day_usd), so calling it is always safe.
 *
 * URL host must be on the effective allowlist (allowed_hosts + trusted
 * merchants). `maxUsd` is only a refusal threshold — the actual price comes
 * from the endpoint's 402 challenge, and the config's per-call / daily caps
 * still apply on top. Query-style endpoints (e.g. CMC) take GET with params
 * in the URL; RPC-style ones take POST.
 */
export async function buyWithX402(
  url: string,
  maxUsd: number,
  method = "GET",
): Promise<Record<string, unknown>> {
  const pol = policy();
  try {
    const result = await fetchWithPayment(url, {
      maxUsd: Math.min(maxUsd, pol.maxPerRequestUsd),
      wallet: getWallet(),
      method,
      allowedHosts: [...pol.effectiveAllowedHosts],
    });
    return {
      ok: true,
      status: result.statusCode,
      json: result.json,
      paid_usd: result.paidUsd,
    };
  } catch (exc) {
    if (exc instanceof X402Error) {
      return { ok: false, error: exc.constructor.name, message: exc.message };
    }
    throw exc;
  }
}

/** Probe an x402 endpoint without paying — returns its 402 body for inspection. */
export async function quoteX402(
  url: string,
  method = "GET",
): Promise<Record<string, unknown>> {
  try {
    return {
      ok: true,
      accepts: await quoteUrl(url, {
        method,
        allowedHosts: [...policy().effectiveAllowedHosts],
      }),
    };
  } catch (exc) {
    if (exc instanceof X402Error) {
      return { ok: false, error: exc.constructor.name, message: exc.message };
    }
    throw exc;
  }
}

/** The AI SDK tool set — spread into the agent's `tools:` map. */
export const X402_BUYER_TOOLS: ToolSet = {
  buy_with_x402: tool({
    description:
      "Pay an x402-protected endpoint with the agent's own wallet (EIP-3009; " +
      "NO API key) and return its JSON response. Use it whenever a task needs " +
      "data from an allowlisted paid endpoint (e.g. CoinMarketCap market " +
      "data). max_usd is a refusal threshold; studio.toml per-call/daily caps " +
      "always apply on top.",
    inputSchema: z.object({
      url: z.string().describe("the full x402-protected URL (query params inline)"),
      max_usd: z.number().describe("refuse if the 402 price exceeds this (USD)"),
      method: z.string().optional().describe("HTTP verb; default GET"),
    }),
    execute: async ({ url, max_usd, method }) =>
      buyWithX402(url, max_usd, method ?? "GET"),
  }),
  quote_x402: tool({
    description:
      "Probe an x402 endpoint WITHOUT paying — returns the 402 challenge body " +
      "(price, payTo, asset) for inspection.",
    inputSchema: z.object({
      url: z.string(),
      method: z.string().optional().describe("HTTP verb; default GET"),
    }),
    execute: async ({ url, method }) => quoteX402(url, method ?? "GET"),
  }),
};

// ── Deterministic pre-fetch (recommended for a purpose-built seller) ──────────
// The tools above let the LLM *decide* to buy — fine for an agent that buys
// ad hoc from many sources. But if your seller ALWAYS needs the same paid
// data (e.g. it exists to report CMC prices), do NOT lean on the LLM to
// choose to call `buy_with_x402`: small models (gpt-4o-mini, haiku)
// routinely skip it and either excuse themselves ("missing API key") or
// answer from stale training priors — no amount of prompt wording reliably
// fixes this. Fetch in FIXED code, then hand the LLM the data to write up.
// This mirrors commitment #3: the money action is deterministic; the LLM
// only produces text.
//
// In `sellerCore.ts` `doWorkAndSubmit` (you own that file) — or the
// azure-foundry equivalent, `foundryMain.ts` `buildRunWork` — replace the
// generic prompt with a pre-fetch:
//
//     import { buyWithX402 } from "./x402Buyer.js";
//
//     const paid = await buyWithX402(
//       "https://pro-api.coinmarketcap.com/x402/v3/cryptocurrency/quotes/latest" +
//         "?symbol=BNB&convert=USD",
//       0.02,
//     );
//     if (!paid.ok) {
//       throw new Error(`x402 fetch failed: ${paid.message}`);
//     }
//     const prompt =
//       "You accepted and were paid for this job. The live data below was " +
//       "already fetched and paid for on your behalf — use it verbatim; do " +
//       "NOT claim you need an API key.\n\n" +
//       `JOB CONTEXT:\n${task}\n\nFETCHED DATA (x402, paid $${paid.paid_usd}):\n` +
//       JSON.stringify(paid.json);
//     const work = await this.runWork(prompt, { sessionId: String(jobId) });
//
// Keep `buy_with_x402` in the LLM toolset too if some jobs need ad-hoc buys
// the LLM must decide — the deterministic pre-fetch and the tool compose.
