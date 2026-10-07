// Wires the analyst into the Agent Studio 0.0.14 scaffold's src/unifiedMain.ts. Idempotent.
// Usage: node scripts/apply-analyst-hook.mjs [path-to-unifiedMain.ts]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "src", "unifiedMain.ts");
const HOOK_FROM = "  const runWork = buildRunWork();";
const HOOK_TO = "  const runWork = withLatestCallFace(buildRunWork());\n  startAnalystLoop();";
const IMPORT_ANCHOR = 'import { LLM_READ_TOOLS } from "./tools.js";';
const IMPORTS = 'import { withLatestCallFace } from "./analyst/face.js";\nimport { startAnalystLoop } from "./analyst/loop.js";';

const original = readFileSync(file, "utf8");
const eol = original.includes("\r\n") ? "\r\n" : "\n";
let source = original.replace(/\r\n/g, "\n");
if (source.includes(HOOK_TO)) {
  console.log("analyst hook already applied");
  process.exit(0);
}
const occurrences = (needle) => source.split(needle).length - 1;
if (occurrences(HOOK_FROM) !== 1 || occurrences(IMPORT_ANCHOR) !== 1) {
  console.error(`${file} does not match the Agent Studio 0.0.14 scaffold; apply the hook by hand (spec §8.2)`);
  process.exit(1);
}
source = source.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\n${IMPORTS}`).replace(HOOK_FROM, HOOK_TO);
writeFileSync(file, source.replace(/\n/g, eol));
console.log(`analyst hook applied to ${file}`);
