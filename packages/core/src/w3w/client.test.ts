import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildQueryString, createW3wClient, type W3wTiming } from "./client";
import { W3wApiError, describeW3wError } from "./errors";
import { signW3wRequest } from "./sign";

interface Captured {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

function fakeFetch(responses: Array<{ status: number; body: string; headers?: Record<string, string> }>) {
  const captured: Captured[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    captured.push({
      url: String(input),
      method: String(init?.method),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body === undefined ? undefined : String(init.body),
    });
    const next = responses.shift();
    if (!next) throw new Error("no more fake responses");
    return new Response(next.body, { status: next.status, headers: next.headers });
  }) as typeof fetch;
  return { fetchImpl, captured };
}

const fixedNow = () => new Date("2026-05-11T10:08:57.715Z");

describe("buildQueryString", () => {
  it("keeps order, drops undefined and percent-encodes", () => {
    expect(buildQueryString({ binanceChainId: "56", platformId: undefined, keyword: "ETH USDT", list: "0xa,0xb" })).toBe(
      "binanceChainId=56&keyword=ETH%20USDT&list=0xa%2C0xb",
    );
  });
});

describe("createW3wClient", () => {
  it("signs a GET on the /build path and returns parsed data", async () => {
    const { fetchImpl, captured } = fakeFetch([{ status: 200, body: JSON.stringify({ code: 0, msg: "success", data: [{ a: 1 }] }) }]);
    const timings: W3wTiming[] = [];
    let tick = 0;
    const client = createW3wClient({
      apiKey: "key",
      apiSecret: "test-secret",
      fetchImpl,
      now: fixedNow,
      clock: () => (tick += 40),
      onTiming: (t) => timings.push(t),
    });
    const data = await client.get("/api/v1/dex/market/rwa/tokens", { binanceChainId: "56" }, z.array(z.object({ a: z.number() })));
    expect(data).toEqual([{ a: 1 }]);
    expect(captured[0]?.url).toBe("https://web3.binance.com/build/api/v1/dex/market/rwa/tokens?binanceChainId=56");
    expect(captured[0]?.method).toBe("GET");
    expect(captured[0]?.headers["X-OC-APIKEY"]).toBe("key");
    expect(captured[0]?.headers["X-OC-TIMESTAMP"]).toBe("2026-05-11T10:08:57.715Z");
    expect(captured[0]?.headers["X-OC-SIGN"]).toBe("qi1JDOb/5OKUF6/NYwQ5LwfEpg8dSqgKFIODFA/Srfs=");
    expect(captured[0]?.headers["X-OC-RECV-WINDOW"]).toBe("10000");
    expect(timings).toEqual([{ method: "GET", endpoint: "/api/v1/dex/market/rwa/tokens", httpStatus: 200, code: 0, msg: "success", ms: 40 }]);
  });

  it("signs a POST over the exact JSON body it sends", async () => {
    const { fetchImpl, captured } = fakeFetch([{ status: 200, body: JSON.stringify({ code: "0", msg: "success", data: { ok: true } }) }]);
    const client = createW3wClient({ apiKey: "key", apiSecret: "test-secret", fetchImpl, now: fixedNow });
    const body = {
      binanceChainId: "56",
      evmTx: {
        from: "0x1111111111111111111111111111111111111111",
        to: "0x2222222222222222222222222222222222222222",
        value: "0",
        data: "0x",
      },
    };
    await client.post("/api/v1/dex/pre-transaction/simulate", body, z.object({ ok: z.boolean() }));
    expect(captured[0]?.body).toBe(JSON.stringify(body));
    expect(captured[0]?.headers["Content-Type"]).toBe("application/json");
    expect(captured[0]?.headers["X-OC-SIGN"]).toBe("iiDq0trXXDm5rwYnguM5xz5SUVqVeBC0Kvy4A/4yGM0=");
    expect(captured[0]?.headers["X-OC-SIGN"]).toBe(
      signW3wRequest({
        secret: "test-secret",
        timestamp: "2026-05-11T10:08:57.715Z",
        method: "POST",
        requestPath: "/build/api/v1/dex/pre-transaction/simulate",
        body: JSON.stringify(body),
      }),
    );
  });

  it("throws W3wApiError with the verbatim code and msg", async () => {
    const { fetchImpl } = fakeFetch([
      { status: 200, body: JSON.stringify({ code: 40304, msg: "Service not available due to compliance restriction", data: null }) },
    ]);
    const client = createW3wClient({ apiKey: "k", apiSecret: "s", fetchImpl, now: fixedNow });
    const error = await client.get("/api/v1/dex/market/rwa/tokens", {}, z.unknown()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(W3wApiError);
    const apiError = error as W3wApiError;
    expect(apiError.code).toBe(40304);
    expect(apiError.msg).toBe("Service not available due to compliance restriction");
    expect(apiError.endpoint).toBe("/api/v1/dex/market/rwa/tokens");
    expect(describeW3wError(apiError)).toContain("compliance restriction (region / datacenter IP)");
  });

  it("retries HTTP 429 after Retry-After, then succeeds", async () => {
    const { fetchImpl, captured } = fakeFetch([
      { status: 429, body: JSON.stringify({ code: 42900, msg: "rate limit", data: null }), headers: { "Retry-After": "2" } },
      { status: 200, body: JSON.stringify({ code: 0, msg: "success", data: 7 }) },
    ]);
    const slept: number[] = [];
    const client = createW3wClient({
      apiKey: "k",
      apiSecret: "s",
      fetchImpl,
      now: fixedNow,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    await expect(client.get("/api/v1/x", {}, z.number())).resolves.toBe(7);
    expect(slept).toEqual([2000]);
    expect(captured).toHaveLength(2);
  });

  it("gives up after maxRetries with code 42900", async () => {
    const limited = { status: 429, body: "Too Many Requests" };
    const { fetchImpl } = fakeFetch([limited, limited, limited]);
    const client = createW3wClient({ apiKey: "k", apiSecret: "s", fetchImpl, now: fixedNow, sleep: async () => {} });
    await expect(client.get("/api/v1/x", {}, z.unknown())).rejects.toMatchObject({ code: 42900, httpStatus: 429 });
  });

  it("reports a non-JSON body", async () => {
    const { fetchImpl } = fakeFetch([{ status: 502, body: "<html>bad gateway</html>" }]);
    const client = createW3wClient({ apiKey: "k", apiSecret: "s", fetchImpl, now: fixedNow });
    await expect(client.get("/api/v1/x", {}, z.unknown())).rejects.toMatchObject({ code: -1, httpStatus: 502 });
  });
});
