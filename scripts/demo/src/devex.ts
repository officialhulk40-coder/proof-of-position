/** The DX form's sections (event.md §3.2) plus our smoke checks; DEVEX_LOG.md keeps them in this order. */
export const DEVEX_SECTIONS = [
  "Onboarding",
  "Documentation issues",
  "API pitfalls",
  "Latency",
  "Rate limits",
  "Signing",
  "Data trust",
  "AI stack",
  "Tokenized-stock specifics",
  "Redesign ideas",
  "Requested capabilities",
  "Smoke evidence",
] as const;

export const SMOKE_SECTIONS = ["S1", "S2", "S3", "S4", "S5", "Rehearsal"] as const;

/** The bullet lines under one `##`/`###` heading, up to the next heading of any level. */
export function sectionBullets(text: string, heading: string): string[] | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => /^#{2,3} /.test(line) && line.replace(/^#{2,3} /, "") === heading);
  if (start === -1) return null;
  const bullets: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,3} /.test(line)) break;
    if (line.startsWith("- ")) bullets.push(line.slice(2));
  }
  return bullets;
}

/**
 * Problems with the log for the named sections: a missing heading, or no evidence yet (only the
 * template's "(pending)" bullet). An empty list means every named section has real evidence.
 */
export function devexProblems(text: string, sections: readonly string[]): string[] {
  const problems: string[] = [];
  for (const section of sections) {
    const bullets = sectionBullets(text, section);
    if (bullets === null) problems.push(`${section}: heading missing`);
    else if (!bullets.some((bullet) => !bullet.startsWith("(pending)") && bullet.trim().length > 10)) problems.push(`${section}: no evidence yet`);
  }
  return problems;
}
