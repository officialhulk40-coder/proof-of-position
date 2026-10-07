import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { USAGE } from "./cli";

const skillDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "skills", "pop-follower");
const read = (relative: string) => readFileSync(join(skillDir, relative), "utf8").replace(/\r\n/g, "\n");

/** The YAML frontmatter block between the first two `---` lines. */
function frontmatter(text: string): string {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match?.[1]) throw new Error("SKILL.md has no frontmatter");
  return match[1];
}

describe("Wallet Skill skills/pop-follower", () => {
  const skill = read("SKILL.md");

  it("declares its name, description and required binaries", () => {
    const yaml = frontmatter(skill);
    expect(yaml).toMatch(/^name: pop-follower$/m);
    expect(yaml).toMatch(/^description: \|\n {2}Use when the user wants to follow Proof of Position/m);
    expect(yaml).toMatch(/ {6}bins:\n {8}- baw\n {8}- pop-follower$/m);
  });

  it("links only reference files that exist", () => {
    const links = [...skill.matchAll(/\]\((references\/[^)]+)\)/g)].map((m) => m[1] as string);
    expect(new Set(links)).toEqual(new Set(["references/commands.md", "references/policy.md", "references/troubleshooting.md"]));
    for (const link of links) expect(existsSync(join(skillDir, link))).toBe(true);
  });

  it("documents every CLI command and the funds-moving confirmations", () => {
    const commands = read("references/commands.md");
    for (const command of ["check", "run", "status", "smoke"]) {
      expect(USAGE).toContain(`pop-follower ${command}`);
      expect(commands).toContain(`## \`pop-follower ${command}\``);
    }
    expect(skill).toContain("Confirm before anything that moves funds.");
    expect(read("references/policy.md")).toContain("It sells only what it bought");
  });
});
