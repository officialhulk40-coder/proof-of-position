import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "check-studio-setup.mjs");

function run(toml: string, env: string) {
  const dir = mkdtempSync(join(tmpdir(), "pop-studio-"));
  writeFileSync(join(dir, "studio.toml"), toml);
  writeFileSync(join(dir, ".env.local"), env);
  return spawnSync(process.execPath, [script, join(dir, "studio.toml"), join(dir, ".env.local")], { encoding: "utf8" });
}

const READY_TOML = `[wallet]
kind = "evm-local"
address = "0x7777777777777777777777777777777777777777"

[llm]
provider = "pieverse-llm"
model = "auto/paid"

[llm.pieverse]
network = "bsc-mainnet"
key_hash = "abc123"

[payments.x402.merchants.cmc]
domain = "pro-api.coinmarketcap.com"
pay_to = "0x3C5f3a6cE224BB89D72f5EB4232ecC27F67B3eeA"  # pinned
per_call_cap_usd = 0.02

[budget]
enabled = true
acknowledged_at = "2026-10-09T10:00:00Z"
max_per_day_usd = 1.0
`;

const SECRET = "never-print-this-value";

describe("check-studio-setup.mjs", () => {
  it("passes a finished setup without printing any secret", () => {
    const result = run(READY_TOML, `WALLET_PASSWORD=${SECRET}\nPIEVERSE_LLM_API_KEY=${SECRET}\nB402_CLIENT_ID=\n`);
    expect(result.status).toBe(0);
    expect(result.stdout.trim().split("\n").at(-1)).toBe("PASS");
    expect(result.stdout).not.toContain(SECRET);
  });

  it("names every missing step of a fresh scaffold", () => {
    const fresh = `[wallet]\nkind = "evm-local"\n# address = "0x..."\n\n[llm]\nprovider = "pieverse-llm"\nmodel = "auto/free"\n\n[llm.pieverse]\nnetwork = "bsc-mainnet"\n`;
    const result = run(fresh, "WALLET_PASSWORD=\nPIEVERSE_LLM_API_KEY=\n");
    expect(result.status).toBe(1);
    expect(result.stdout.trim().split("\n")).toEqual([
      "FAIL agent wallet created (bag wallet new): no [wallet].address",
      "FAIL wallet password stored (.studio/.env.local WALLET_PASSWORD): WALLET_PASSWORD is empty",
      "FAIL Pieverse key activated (bag llm activate): no [llm.pieverse].key_hash or PIEVERSE_LLM_API_KEY",
      "FAIL paid model selected (bag config set llm.model …): model = auto/free",
      "FAIL CoinMarketCap trusted (bag x402 trust cmc): no [payments.x402.merchants.cmc] with a pinned pay_to",
      "FAIL budget enabled with a daily cap ≤ $1 (bag budget enable --max-per-day-usd 1): enabled = unset, max_per_day_usd = unset",
      "FAIL",
    ]);
  });

  it("rejects a daily cap above $1", () => {
    const result = run(READY_TOML.replace("max_per_day_usd = 1.0", "max_per_day_usd = 3.0"), `WALLET_PASSWORD=x\nPIEVERSE_LLM_API_KEY=y\n`);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("max_per_day_usd = 3.0");
  });
});
