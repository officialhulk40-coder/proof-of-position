const SCALE = 10n ** 18n;

/** "0.02" → 20000000000000000n. Accepts up to 18 decimals; rejects signs, exponents and empty input. */
export function parseUnits18(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed) && !/^\.\d{1,18}$/.test(trimmed)) {
    throw new Error(`not a non-negative decimal with at most 18 places: "${value}"`);
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  return BigInt(whole === "" ? "0" : whole) * SCALE + BigInt(fraction.padEnd(18, "0") || "0");
}

/** 20000000000000000n → "0.02"; rounds down to maxFractionDigits and trims trailing zeros. */
export function formatUnits18(raw: bigint, maxFractionDigits = 6): string {
  if (raw < 0n) return `-${formatUnits18(-raw, maxFractionDigits)}`;
  const whole = raw / SCALE;
  const fraction = (raw % SCALE).toString().padStart(18, "0").slice(0, maxFractionDigits).replace(/0+$/, "");
  return fraction === "" ? whole.toString() : `${whole}.${fraction}`;
}

/** Token amount (18 decimals) × tokenToShareRatio ("1.000778") → underlying shares, formatted. */
export function toShares(raw: bigint, tokenToShareRatio: string, maxFractionDigits = 4): string {
  return formatUnits18((raw * parseUnits18(tokenToShareRatio)) / SCALE, maxFractionDigits);
}

/** "187.43" USD price × 18-decimal token amount → USD value with 2 decimals. */
export function toUsd(raw: bigint, priceUsd: string): string {
  const cents = (raw * parseUnits18(priceUsd)) / SCALE / 10n ** 16n;
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}
