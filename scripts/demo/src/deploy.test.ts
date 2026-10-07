import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8").replace(/\r\n/g, "\n");

/** Top-level keys under `services:` in the compose file (two-space indented names). */
function composeServices(yaml: string): string[] {
  const block = yaml.split("\nservices:\n")[1]?.split(/\n(?=\S)/)[0] ?? "";
  return [...block.matchAll(/^ {2}([a-z][a-z0-9-]*):$/gm)].map((match) => match[1] as string);
}

describe("deploy files", () => {
  it("composes caddy, server and analyst from the repository root", () => {
    const compose = read("deploy/docker-compose.yml");
    expect(composeServices(compose)).toEqual(["caddy", "server", "analyst"]);
    expect(compose).toContain("dockerfile: deploy/caddy.Dockerfile");
    expect(compose).toContain("dockerfile: deploy/server.Dockerfile");
    expect(compose).toContain("dockerfile: deploy/analyst.Dockerfile");
    expect(compose).toContain("- ../agents/popanalyst/.studio:/app/agents/popanalyst/.studio");
    expect(compose).toContain("VITE_REGISTRY_ADDRESS: ${REGISTRY_ADDRESS:?set REGISTRY_ADDRESS in deploy/.env}");
  });

  it("routes /api to the server, /agent to the analyst and everything else to the static feed", () => {
    const caddy = read("deploy/Caddyfile");
    expect(caddy.split("\n")[0]).toBe("{$PUBLIC_HOST} {");
    expect(caddy).toMatch(/handle \/api\/\* \{\n\t\treverse_proxy server:8787\n\t\}/);
    expect(caddy).toMatch(/handle_path \/agent\/\* \{\n\t\treverse_proxy analyst:9000\n\t\}/);
    expect(caddy).toContain("try_files {path} /index.html");
  });

  it("starts each service the way the plans define it", () => {
    expect(read("deploy/server.Dockerfile")).toContain('CMD ["pnpm", "--filter", "@pop/server", "start"]');
    expect(read("deploy/analyst.Dockerfile")).toContain('CMD ["pnpm", "--dir", "agents/popanalyst/app/agent", "start"]');
    expect(read("deploy/caddy.Dockerfile")).toContain("RUN pnpm --filter @pop/web run build");
  });

  it("keeps secrets out of templates and images", () => {
    for (const template of ["deploy/.env.example", "deploy/server.env.example", "deploy/analyst.env.example"]) {
      for (const line of read(template).split("\n")) {
        if (line === "" || line.startsWith("#")) continue;
        expect(line).toMatch(/^[A-Z0-9_]+=$/);
      }
    }
    const dockerignore = read(".dockerignore").split("\n");
    for (const pattern of ["**/.studio", "**/.env", "**/*.env", "**/node_modules"]) expect(dockerignore).toContain(pattern);
    expect(read("deploy/server.env.example")).toContain("KEEPER_PK=\n");
  });
});
