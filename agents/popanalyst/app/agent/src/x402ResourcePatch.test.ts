/**
 * Guards the local pnpm patch of `@bnbagent/studio-runtime@0.0.14`
 * (patches/@bnbagent__studio-runtime@0.0.14.patch).
 *
 * Upstream `exactResource(rawResource, requestedUrl)` only accepts an x402
 * challenge whose `resource.url` equals the caller-requested URL byte for
 * byte. Live merchants break that:
 *   - Pieverse `POST https://llm.pieverse.io/v1/topup/x402` answers with the
 *     relative `resource.url = "/v1/topup/x402"`;
 *   - CoinMarketCap answers `…/quotes/latest?pair_address=0x…` with the
 *     query-less `resource.url = "…/quotes/latest"`.
 * The patch additionally accepts exactly those two shapes (same origin + same
 * pathname, no query/hash of their own) and normalises `url` to the absolute
 * requested origin + pathname. Everything else is still rejected.
 *
 * `exactResource` is module-private, so it is exercised two ways:
 *   1. every copy in the installed dist (ESM chunk + both CJS bundles) is
 *      extracted from source and called directly;
 *   2. the public `payChallenge` (ESM and CJS) is driven end to end with fakes
 *      only (throwaway in-memory key, fake balance reader, no network) to show
 *      the signed X-PAYMENT envelope binds the normalised absolute URL.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as esmX402 from "@bnbagent/studio-runtime/x402";

type ResourceRecord = Readonly<Record<string, unknown>>;
type ExactResource = (rawResource: unknown, requestedUrl: string) => ResourceRecord | null;
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
  readFileSync(file, "utf8").includes("function exactResource("),
);

function loadExactResource(file: string): ExactResource {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf("function cloneResourceValue(");
  const end = source.indexOf("function requireCallerResourceUrl(");
  if (start < 0 || end < 0 || end < start) {
    throw new Error(`cannot locate exactResource block in ${file}`);
  }
  const block = source.slice(start, end);
  return new Function(`${block}\nreturn exactResource;`)() as ExactResource;
}

const PIEVERSE = "https://llm.pieverse.io/v1/topup/x402";
const CMC_PATH = "https://pro-api.coinmarketcap.com/x402/v4/dex/pairs/quotes/latest";
const CMC_REQUESTED = `${CMC_PATH}?pair_address=0xabc`;

describe("patched studio-runtime exactResource (every dist copy)", () => {
  it("finds the ESM chunk and both CJS bundles", () => {
    expect(copies.some((f) => f.endsWith(".cjs"))).toBe(true);
    expect(copies.some((f) => f.endsWith(".js"))).toBe(true);
    expect(copies.length).toBeGreaterThanOrEqual(3);
  });

  for (const file of copies) {
    const label = file.slice(distDir.length + 1);
    describe(label, () => {
      const exactResource = loadExactResource(file);

      it("still accepts an exact match unchanged", () => {
        const url = `${CMC_PATH}?pair_address=0xabc`;
        const got = exactResource({ url, description: "quotes", mimeType: "application/json" }, url);
        expect(got).not.toBeNull();
        expect(got?.url).toBe(url);
        expect(got?.description).toBe("quotes");
        expect(got?.mimeType).toBe("application/json");
      });

      it("accepts the Pieverse relative shape and normalises it to an absolute URL", () => {
        const got = exactResource({ url: "/v1/topup/x402", description: "topup" }, PIEVERSE);
        expect(got).not.toBeNull();
        expect(got?.url).toBe(PIEVERSE);
        expect(got?.description).toBe("topup");
        expect(Object.isFrozen(got)).toBe(true);
      });

      it("accepts the CMC no-query shape for a request with a query", () => {
        const got = exactResource({ url: CMC_PATH }, CMC_REQUESTED);
        expect(got).not.toBeNull();
        expect(got?.url).toBe(CMC_PATH);
      });

      it("rejects a different host", () => {
        expect(
          exactResource({ url: "https://evil.example/x402/v4/dex/pairs/quotes/latest" }, CMC_REQUESTED),
        ).toBeNull();
      });

      it("rejects a different path", () => {
        expect(
          exactResource({ url: "https://pro-api.coinmarketcap.com/x402/v4/dex/pairs/other" }, CMC_REQUESTED),
        ).toBeNull();
      });

      it("rejects a relative path on a different path", () => {
        expect(exactResource({ url: "/v1/other" }, PIEVERSE)).toBeNull();
      });

      it("rejects a different scheme, a protocol-relative host and a differing own query", () => {
        expect(exactResource({ url: "http://llm.pieverse.io/v1/topup/x402" }, PIEVERSE)).toBeNull();
        expect(exactResource({ url: "//evil.example/v1/topup/x402" }, PIEVERSE)).toBeNull();
        expect(exactResource({ url: `${CMC_PATH}?pair_address=0xdef` }, CMC_REQUESTED)).toBeNull();
        expect(exactResource({ url: "/v1/topup/x402?x=1" }, PIEVERSE)).toBeNull();
      });

      it("keeps the description/mimeType type checks", () => {
        expect(exactResource({ url: "/v1/topup/x402", description: 7 }, PIEVERSE)).toBeNull();
        expect(exactResource({ url: CMC_PATH, mimeType: false }, CMC_REQUESTED)).toBeNull();
      });
    });
  }
});

const U_ADDRESS = "0xcE24439F2D9C6a2289F741120FE202248B666666";
const PAY_TO = "0x1111111111111111111111111111111111111111";

function challengeFor(resourceUrl: string): Record<string, unknown> {
  return {
    x402Version: 2,
    resource: { url: resourceUrl, description: "paid resource" },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:56",
        asset: U_ADDRESS,
        amount: "10000000000000000",
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: { assetTransferMethod: "eip3009", name: "United Stables", version: "1" },
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

function decodeHeader(header: string): { resource: { url: string }; accepted: { payTo: string } } {
  return JSON.parse(Buffer.from(header, "base64").toString("utf8")) as {
    resource: { url: string };
    accepted: { payTo: string };
  };
}

for (const [label, mod] of [
  ["ESM", esmX402],
  ["CJS", cjsX402],
] as const) {
  describe(`payChallenge (${label}) binds the normalised resource URL`, () => {
    afterEach(() => {
      mod._setConfigLoader(null);
    });

    async function pay(resourceUrl: string, requestedUrl: string): Promise<string> {
      mod._setConfigLoader(() => ({}));
      const result = await mod.payChallenge(challengeFor(resourceUrl) as never, {
        wallet: fakeWallet(),
        resourceUrl: requestedUrl,
        expectedTo: PAY_TO,
        maxUsd: 1,
        assetReader: fakeAssetReader,
      } as never);
      return result.header;
    }

    it("pays the Pieverse relative shape with an absolute resource URL", async () => {
      const envelope = decodeHeader(await pay("/v1/topup/x402", PIEVERSE));
      expect(envelope.resource.url).toBe(PIEVERSE);
      expect(envelope.accepted.payTo).toBe(PAY_TO);
    });

    it("pays the CMC no-query shape with the query-less absolute URL", async () => {
      const envelope = decodeHeader(await pay(CMC_PATH, CMC_REQUESTED));
      expect(envelope.resource.url).toBe(CMC_PATH);
    });

    it("still refuses a resource on another host", async () => {
      await expect(
        pay("https://evil.example/x402/v4/dex/pairs/quotes/latest", CMC_REQUESTED),
      ).rejects.toThrow("x402 challenge resource does not exactly match the caller-requested URL");
    });
  });
}
