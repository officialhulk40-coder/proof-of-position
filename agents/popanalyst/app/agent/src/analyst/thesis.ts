import type { Research } from "./research.js";

/** CallRegistry's note limit (MAX_NOTE_BYTES); longer notes revert NoteTooLong. */
export const MAX_NOTE_BYTES = 280;

/** One LLM completion (the scaffold's buildModel() through the AI SDK's generateText). */
export type GenerateText = (prompt: string) => Promise<string>;

/** Collapses whitespace and trims to at most 280 UTF-8 bytes, ending with "…" when cut. */
export function clampNote(text: string): string {
  const flat = text.replace(/\s+/g, " ").replace(/^["'\s]+|["'\s]+$/g, "");
  const encoder = new TextEncoder();
  if (encoder.encode(flat).length <= MAX_NOTE_BYTES) return flat;
  let cut = "";
  for (const char of flat) {
    if (encoder.encode(`${cut}${char}…`).length > MAX_NOTE_BYTES) break;
    cut += char;
  }
  return `${cut.trimEnd()}…`;
}

function facts(research: Research): string {
  const lines = [`${research.ticker} via ${research.symbol} (bStocks on BSC)`];
  if (research.name) lines.push(`company: ${research.name}`);
  if (research.priceUsd) lines.push(`token price: $${research.priceUsd}`);
  if (research.market) lines.push(`market: ${research.market.openState ? "open" : "closed"} (${research.market.marketStatus}${research.market.reasonMsg ? `, ${research.market.reasonMsg}` : ""})`);
  if (research.pool) lines.push(`deepest pool: ${research.pool.protocol ?? "DEX"} with $${research.pool.liquidityUsd} liquidity`);
  if (research.cmc) lines.push(`CoinMarketCap pair quote: ${research.cmc.summary}`);
  return lines.join("\n");
}

/** The fallback when the LLM is unavailable: facts only, no hype. */
export function templateThesis(research: Research, holdHours: number): string {
  const price = research.priceUsd ? ` at $${research.priceUsd}` : "";
  const pool = research.pool ? `; deepest pool ${research.pool.protocol ?? "DEX"} ($${research.pool.liquidityUsd} liquidity)` : "";
  return clampNote(`Long ${research.ticker} (${research.symbol})${price}${pool}. Holding ~${holdHours}h; if I sell early this badge says so on-chain.`);
}

/** An LLM thesis grounded in the research, or the template on any failure. Never longer than 280 bytes. */
export async function writeThesis(generate: GenerateText | null, research: Research, holdHours: number): Promise<{ text: string; source: "llm" | "template" }> {
  if (generate !== null) {
    try {
      const prompt =
        `Write a one-sentence long thesis (at most 220 characters) for buying ${research.ticker} now, for a public call feed. ` +
        `Use only these facts:\n${facts(research)}\n` +
        `Plain text: no hashtags, no emojis, no price targets, no claims of certainty, and do not call it investment advice.`;
      const text = clampNote(await generate(prompt));
      if (text.length >= 20) return { text, source: "llm" };
    } catch {
      // fall through to the template
    }
  }
  return { text: templateThesis(research, holdHours), source: "template" };
}
