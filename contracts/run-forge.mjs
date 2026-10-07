#!/usr/bin/env node
// Runs `forge <args>` inside contracts/, first restoring soldeer dependencies
// from soldeer.lock when they are missing (dependencies/ is git-ignored).
// Usage (from the repo root): node contracts/run-forge.mjs test --match-contract CallRegistryPostTest
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// realpathSync.native expands Windows 8.3 short names (e.g. ASUSTU~1); soldeer panics with
// "path should be a child of root" when the working directory is a short-name path.
const contractsDir = realpathSync.native(dirname(fileURLToPath(import.meta.url)));
const forgeStdDir = join(contractsDir, "dependencies", "forge-std-1.16.0");

function run(args) {
  const result = spawnSync("forge", args, { cwd: contractsDir, stdio: "inherit" });
  if (result.error) {
    console.error(`run-forge: could not start forge: ${result.error.message}`);
    process.exit(1);
  }
  return result.status ?? 1;
}

if (!existsSync(forgeStdDir)) {
  const status = run(["soldeer", "install"]);
  if (status !== 0) process.exit(status);
}

process.exit(run(process.argv.slice(2)));
