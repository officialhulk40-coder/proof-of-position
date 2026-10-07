// Checks the analyst's one-time Agent Studio setup (wallet, Pieverse key, paid model, CMC x402 trust,
// budget cap) without ever printing a secret. Prints PASS/FAIL per item, then PASS or FAIL.
// Usage: node scripts/check-studio-setup.mjs [path/to/studio.toml] [path/to/.studio/.env.local]
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tomlPath = process.argv[2] ?? join(appDir, "studio.toml");
const envPath = process.argv[3] ?? join(appDir, "..", "..", ".studio", ".env.local");

/** The key = value lines of one [section] (comments and other sections ignored). */
function section(text, name) {
  const values = {};
  let inside = false;
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      inside = header[1] === name;
      continue;
    }
    const pair = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/.exec(line);
    if (inside && pair) values[pair[1]] = pair[2].replace(/^"(.*)"$/, "$1");
  }
  return values;
}

/** Names of .env.local variables that have a non-empty value (values are never read out). */
function filledEnvNames(text) {
  return new Set(
    text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => /^([A-Z0-9_]+)=(.+)$/.exec(line.trim()))
      .filter((match) => match !== null && match[2].trim() !== "")
      .map((match) => match[1]),
  );
}

const toml = readFileSync(tomlPath, "utf8");
const env = existsSync(envPath) ? filledEnvNames(readFileSync(envPath, "utf8")) : new Set();
const wallet = section(toml, "wallet");
const llm = section(toml, "llm");
const pieverse = section(toml, "llm.pieverse");
const cmc = section(toml, "payments.x402.merchants.cmc");
const budget = section(toml, "budget");

const checks = [
  ["agent wallet created (bag wallet new)", /^0x[0-9a-fA-F]{40}$/.test(wallet.address ?? ""), wallet.address ?? "no [wallet].address"],
  ["wallet password stored (.studio/.env.local WALLET_PASSWORD)", env.has("WALLET_PASSWORD"), "WALLET_PASSWORD is empty"],
  ["Pieverse key activated (bag llm activate)", Boolean(pieverse.key_hash) && env.has("PIEVERSE_LLM_API_KEY"), "no [llm.pieverse].key_hash or PIEVERSE_LLM_API_KEY"],
  ["paid model selected (bag config set llm.model …)", Boolean(llm.model) && llm.model !== "auto/free", `model = ${llm.model ?? "unset"}`],
  ["CoinMarketCap trusted (bag x402 trust cmc)", cmc.domain === "pro-api.coinmarketcap.com" && /^0x[0-9a-fA-F]{40}$/.test(cmc.pay_to ?? ""), "no [payments.x402.merchants.cmc] with a pinned pay_to"],
  ["budget enabled with a daily cap ≤ $1 (bag budget enable --max-per-day-usd 1)", budget.enabled === "true" && Boolean(budget.acknowledged_at) && Number(budget.max_per_day_usd) <= 1, `enabled = ${budget.enabled ?? "unset"}, max_per_day_usd = ${budget.max_per_day_usd ?? "unset"}`],
];

let ok = true;
for (const [label, passed, detail] of checks) {
  console.log(passed ? `PASS ${label}` : `FAIL ${label}: ${detail}`);
  ok &&= passed;
}
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
