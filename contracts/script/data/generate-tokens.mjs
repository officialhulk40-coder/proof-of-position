#!/usr/bin/env node
// Generates contracts/script/data/tokens.json from the resource pack's BSC tokenized-stock registry.
// bStock and Ondo rows list as PLAIN (raw balanceOf). Rebasing xStocks list as XSTOCK (sharesOf).
// Wrapped xStocks (symbol "w…x", e.g. wPOPMTx, wTCENTx) are non-rebasing ERC-4626 wrappers with no
// sharesOf — verified on BSC mainnet 2026-10-07 — so they list as PLAIN.
// Usage (from the repo root): node contracts/script/data/generate-tokens.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const csvRelative = "docs/resources/2026-10-05-bnb-hack-tokenized-stocks/data/bsc-tokenized-stocks-2026-10-05.csv";
const csvPath = join(here, "..", "..", "..", ...csvRelative.split("/"));
const outPath = join(here, "tokens.json");

const lines = readFileSync(csvPath, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "");
const plain = [];
const xstock = [];
const seen = new Set();

for (const line of lines.slice(1)) {
  const fields = line.split(",");
  const system = fields[0];
  const symbol = fields[2];
  const address = (fields[4] ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    throw new Error(`bad address for ${symbol}: ${fields[4]}`);
  }
  if (seen.has(address)) {
    throw new Error(`duplicate address ${address} (${symbol})`);
  }
  seen.add(address);
  if (system === "bStock" || system === "Ondo") {
    plain.push(address);
  } else if (system === "xStocks" && /^w.+x$/.test(symbol)) {
    plain.push(address);
  } else if (system === "xStocks") {
    xstock.push(address);
  } else {
    throw new Error(`unknown system "${system}" for ${symbol}`);
  }
}

writeFileSync(outPath, `${JSON.stringify({ source: csvRelative, plain, xstock }, null, 2)}\n`);
console.log(`tokens.json written: plain=${plain.length} xstock=${xstock.length}`);
