import { describe, expect, it } from "vitest";
import { formatUnits18, parseUnits18, toShares, toUsd } from "./amounts";

describe("amounts", () => {
  it("parses decimals into 18-decimal integers", () => {
    expect(parseUnits18("0.02")).toBe(20_000_000_000_000_000n);
    expect(parseUnits18("1")).toBe(10n ** 18n);
    expect(parseUnits18(".5")).toBe(5n * 10n ** 17n);
    expect(parseUnits18("0.000000000000000001")).toBe(1n);
    expect(parseUnits18(" 3.25 ")).toBe(3_250_000_000_000_000_000n);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "-1", "1e18", "0.0000000000000000001", "1.2.3", "abc"]) {
      expect(() => parseUnits18(bad)).toThrow("not a non-negative decimal");
    }
  });

  it("formats with rounding down and trimmed zeros", () => {
    expect(formatUnits18(20_000_000_000_000_000n)).toBe("0.02");
    expect(formatUnits18(10n ** 18n)).toBe("1");
    expect(formatUnits18(1_234_567_890_000_000_000n, 4)).toBe("1.2345");
    expect(formatUnits18(1n)).toBe("0");
    expect(formatUnits18(-5n * 10n ** 17n)).toBe("-0.5");
  });

  it("converts tokens to underlying shares with the RWA ratio", () => {
    expect(toShares(20_000_000_000_000_000n, "1.000778")).toBe("0.02");
    expect(toShares(10n ** 18n, "1.000778", 6)).toBe("1.000778");
    expect(toShares(11_000_000_000_000_000n, "1")).toBe("0.011");
  });

  it("values a position in USD with two decimals", () => {
    expect(toUsd(20_000_000_000_000_000n, "187.43")).toBe("3.74");
    expect(toUsd(10n ** 18n, "0.5")).toBe("0.50");
  });
});
