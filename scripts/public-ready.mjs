// Pre-public cleanup (spec D8) and a safety check before the repository goes public.
//   node scripts/public-ready.mjs          check only: prints PASS or FAIL lines, then PASS or FAIL
//   node scripts/public-ready.mjs --apply  first deletes the two pack files that must not be published and
//                                          turns every Markdown link to them into plain text, then checks
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACK = join(root, "docs", "resources", "2026-10-05-bnb-hack-tokenized-stocks");
const REMOVED = ["2026-10-05-sharepay-brief.md", "telegram-intel-2026-10-06.md"];
const NOTE = "(removed before publication)";
const LINK = new RegExp(`\\[([^\\]]+)\\]\\((?:\\./)?(${REMOVED.map((name) => name.replace(/[.-]/g, "\\$&")).join("|")})(#[^)]*)?\\)`, "g");

/** Markdown files to scan for links: the pack (with sponsors/) and the idea-forge briefs. */
function markdownFiles() {
  const dirs = [PACK, join(PACK, "sponsors"), join(root, "docs", "idea-forge")];
  return dirs.filter((dir) => existsSync(dir)).flatMap((dir) => readdirSync(dir).filter((name) => name.endsWith(".md")).map((name) => join(dir, name)));
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

if (process.argv.includes("--apply")) {
  for (const name of REMOVED) {
    const path = join(PACK, name);
    if (existsSync(path)) {
      rmSync(path);
      console.log(`deleted ${relative(root, path)}`);
    }
  }
  for (const file of markdownFiles()) {
    const text = readFileSync(file, "utf8");
    const next = text.replace(LINK, (_match, label) => `${label} ${NOTE}`);
    if (next !== text) {
      writeFileSync(file, next);
      console.log(`unlinked removed files in ${relative(root, file)}`);
    }
  }
}

let ok = true;
const report = (passed, label) => {
  console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
  ok &&= passed;
};

for (const name of REMOVED) report(!existsSync(join(PACK, name)), `${name} is not in the working tree`);
const dangling = markdownFiles().filter((file) => new RegExp(LINK.source).test(readFileSync(file, "utf8")));
report(dangling.length === 0, dangling.length === 0 ? "no Markdown link points at a removed file" : `links to removed files remain in ${dangling.map((f) => relative(root, f)).join(", ")}`);

const tracked = git(["ls-files"]);
if (tracked === null) {
  console.log("WARN not a git repository: tracked-file checks skipped");
} else {
  const risky = tracked
    .split("\n")
    .filter((path) => path !== "")
    .filter((path) => /(^|\/)\.studio\//.test(path) || /\.(pem|key)$/.test(path) || /keystore/i.test(path) || (/(^|\/)(\.env(\..+)?|[^/]+\.env)$/.test(path) && !path.endsWith(".example")));
  report(risky.length === 0, risky.length === 0 ? "no env files, keystores or keys are tracked" : `tracked secret-bearing files: ${risky.join(", ")}`);
  for (const name of REMOVED) {
    const history = git(["log", "--all", "--format=%h", "--", `docs/resources/2026-10-05-bnb-hack-tokenized-stocks/${name}`]);
    if (history && history.trim() !== "") console.log(`WARN ${name} remains in git history: publish a squashed snapshot or rewrite history before the public flip (the owner's call)`);
  }
}
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
