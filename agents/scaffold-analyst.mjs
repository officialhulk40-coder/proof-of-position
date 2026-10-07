// Scaffolds the analyst with BNB Agent Studio 0.0.14 into agents/popanalyst (spec §8.2).
// No keys, no funds: --no-onboard skips wallet creation and Pieverse activation (a human does those later).
// Usage (from the repository root): node agents/scaffold-analyst.mjs
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const agentsDir = dirname(fileURLToPath(import.meta.url));
if (existsSync(join(agentsDir, "popanalyst"))) {
  console.log("agents/popanalyst already exists; nothing to do");
  process.exit(0);
}
const args = [
  "--yes",
  "@bnbagent/studio-cli@0.0.14",
  "init",
  "popanalyst",
  "--network",
  "bsc-mainnet",
  "--destination",
  "self",
  "--llm-provider",
  "pieverse-llm",
  "--wallet-kind",
  "evm-local",
  "--seller-price-usd",
  "0",
  "--storage-provider",
  "local",
  "--no-onboard",
  "--no-install",
  "--ide",
  "claude-code",
];
// npx is a .cmd shim on Windows, which only starts through a shell; every argument above is a constant.
const result = spawnSync("npx", args, { cwd: agentsDir, stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
