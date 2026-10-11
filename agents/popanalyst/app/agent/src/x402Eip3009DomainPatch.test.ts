/**
 * Guards the second hunk of the local pnpm patch of
 * `@bnbagent/studio-runtime@0.0.14` (patches/@bnbagent__studio-runtime@0.0.14.patch).
 *
 * Upstream `eip3009DomainMatchesCatalog(route, token)` requires
 * `extra.assetTransferMethod === "eip3009"`. Pieverse's live topup 402
 * (`POST https://llm.pieverse.io/v1/topup/x402`) advertises
 * `extra = { name: "United Stables", version: "1" }` with no method, so the
 * budget auto-topup failed with
 * "x402 EIP-3009 domain metadata does not match catalog asset U".
 * The patch accepts an ABSENT method only when name AND version still match
 * the catalog domain exactly; a present method must still be "eip3009".
 *
 * Exercised two ways, fakes only:
 *   1. every dist copy (ESM chunk + both CJS bundles) is extracted from source
 *      and called directly;
 *   2. the public `payChallenge` (ESM and CJS) is driven end to end with a
 *      throwaway in-memory key and a fake balance reader (no network).
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as esmX402 from "@bnbagent/studio-runtime/x402";

type Token = { symbol: string; eip3009Domain: { name: string; version: string } | null };
type DomainMatches = (route: Record<string, unknown>, token: Token) => boolean;
type X402Module = typeof esmX402;

const require = createRequire(import.meta.url);
const cjsX402 = require("@bnbagent/studio-runtime/x402") as X402Module;
const distDir = dirname(dirname(require.resolve("@bnbagent/studio-runtime/x402")));

function listDistFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listDistFiles(full));
    else if (/\.(c?js)$/u.test(entry.name)) out.push(full);
  }
  return out;
}

const copies = listDistFiles(distDir).filter((file) =>
  readFileSync(file, "utf8").includes("function eip3009DomainMatchesCatalog("),
);

function loadDomainMatches(file: string): DomainMatches {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf("function eip3009DomainMatchesCatalog(");
  const end = source.indexOf("async function doRequest(", start);
  if (start < 0 || end < 0) {
    throw new Error(`cannot locate eip3009DomainMatchesCatalog in ${file}`);
  }
  const block = source.slice(start, end);
  return new Function(`${block}\nreturn eip3009DomainMatchesCatalog;`)() as DomainMatches;
}

const U_TOKEN: Token = { symbol: "U", eip3009Domain: { name: "United Stables", version: "1" } };

describe("patched studio-runtime eip3009DomainMatchesCatalog (every dist copy)", () => {
  it("finds the ESM chunk and both CJS bundles", () => {
    expect(copies.some((f) => f.endsWith(".cjs"))).toBe(true);
    expect(copies.some((f) => f.endsWith(".js"))).toBe(true);
    expect(copies.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of copies) {
    const label = file.slice(distDir.length + 1);
    describe(label, () => {
      const matches = loadDomainMatches(file);

      it("accepts the Pieverse shape: no assetTransferMethod, matching name/version", () => {
        expect(matches({ extra: { name: "United Stables", version: "1" } }, U_TOKEN)).toBe(true);
      });

      it("accepts the CMC shape: assetTransferMethod eip3009, matching name/version", () => {
        expect(
          matches({ extra: { assetTransferMethod: "eip3009", name: "United Stables", version: "1" } }, U_TOKEN),
        ).toBe(true);
      });

      it("rejects a missing method with a wrong name or wrong version", () => {
        expect(matches({ extra: { name: "USD Coin", version: "1" } }, U_TOKEN)).toBe(false);
        expect(matches({ extra: { name: "United Stables", version: "2" } }, U_TOKEN)).toBe(false);
        expect(matches({ extra: { name: "United Stables" } }, U_TOKEN)).toBe(false);
        expect(matches({ extra: {} }, U_TOKEN)).toBe(false);
      });

      it("rejects any present method other than eip3009", () => {
        for (const method of ["permit2", "permit2-exact", "EIP3009", "", null]) {
          expect(
            matches({ extra: { assetTransferMethod: method, name: "United Stables", version: "1" } }, U_TOKEN),
          ).toBe(false);
        }
      });

      it("rejects a missing extra or a token without a catalog domain", () => {
        expect(matches({}, U_TOKEN)).toBe(false);
        expect(matches({ extra: null }, U_TOKEN)).toBe(false);
        expect(matches({ extra: ["United Stables", "1"] }, U_TOKEN)).toBe(false);
        expect(
          matches({ extra: { name: "United Stables", version: "1" } }, { symbol: "X", eip3009Domain: null }),
        ).toBe(false);
      });
    });
  }
});

const U_ADDRESS = "0xcE24439F2D9C6a2289F741120FE202248B666666";
const PAY_TO = "0x1111111111111111111111111111111111111111";
const PIEVERSE = "https://llm.pieverse.io/v1/topup/x402";

function challengeWith(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    x402Version: 2,
    resource: { url: "/v1/topup/x402", description: "topup" },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:56",
        asset: U_ADDRESS,
        amount: "1000000000000000000",
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra,
      },
    ],
  };
}

type SignArgs = Parameters<ReturnType<typeof privateKeyToAccount>["signTypedData"]>[0];

/** Studio wallet surface: `signTypedData(domain, types, message)`; throwaway in-memory key. */
function fakeWallet(): {
  address: `0x${string}`;
  signTypedData: (domain: unknown, types: unknown, message: unknown) => Promise<`0x${string}`>;
} {
  const account = privateKeyToAccount(generatePrivateKey());
  return {
    address: account.address,
    signTypedData: (domain, types, message) =>
      account.signTypedData({
        domain,
        types,
        primaryType: "TransferWithAuthorization",
        message,
      } as unknown as SignArgs),
  };
}

const fakeAssetReader = { balanceOf: async () => 10n ** 30n };

for (const [label, mod] of [
  ["ESM", esmX402],
  ["CJS", cjsX402],
] as const) {
  describe(`payChallenge (${label}) with the Pieverse EIP-3009 extra`, () => {
    afterEach(() => {
      mod._setConfigLoader(null);
    });

    async function pay(extra: Record<string, unknown>, expectedTo: string = PAY_TO): Promise<string> {
      mod._setConfigLoader(() => ({}));
      const result = await mod.payChallenge(challengeWith(extra) as never, {
        wallet: fakeWallet(),
        resourceUrl: PIEVERSE,
        expectedTo,
        maxUsd: 2,
        assetReader: fakeAssetReader,
      } as never);
      return result.header;
    }

    it("pays when assetTransferMethod is absent and name/version match", async () => {
      const header = await pay({ name: "United Stables", version: "1" });
      const envelope = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as {
        accepted: { payTo: string };
      };
      expect(envelope.accepted.payTo).toBe(PAY_TO);
    });

    it("still refuses a method-less extra whose name does not match", async () => {
      await expect(pay({ name: "USD Coin", version: "1" })).rejects.toThrow();
    });

    it("still refuses a non-eip3009 method", async () => {
      await expect(pay({ assetTransferMethod: "permit2", name: "United Stables", version: "1" })).rejects.toThrow();
    });

    it("still enforces the payTo pin", async () => {
      await expect(
        pay({ name: "United Stables", version: "1" }, "0x2222222222222222222222222222222222222222"),
      ).rejects.toThrow();
    });
  });
}
