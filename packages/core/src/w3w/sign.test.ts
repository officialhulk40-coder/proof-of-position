import { describe, expect, it } from "vitest";
import { signW3wRequest } from "./sign";

// Vectors computed independently with Node crypto and `openssl dgst -sha256 -hmac test-secret -binary | base64`.
describe("signW3wRequest", () => {
  it("signs a GET with the /build path and raw query", () => {
    expect(
      signW3wRequest({
        secret: "test-secret",
        timestamp: "2026-05-11T10:08:57.715Z",
        method: "GET",
        requestPath: "/build/api/v1/dex/market/rwa/tokens?binanceChainId=56",
        body: "",
      }),
    ).toBe("qi1JDOb/5OKUF6/NYwQ5LwfEpg8dSqgKFIODFA/Srfs=");
  });

  it("signs a POST over the exact body string", () => {
    const body =
      '{"binanceChainId":"56","evmTx":{"from":"0x1111111111111111111111111111111111111111","to":"0x2222222222222222222222222222222222222222","value":"0","data":"0x"}}';
    expect(
      signW3wRequest({
        secret: "test-secret",
        timestamp: "2026-05-11T10:08:57.715Z",
        method: "POST",
        requestPath: "/build/api/v1/dex/pre-transaction/simulate",
        body,
      }),
    ).toBe("iiDq0trXXDm5rwYnguM5xz5SUVqVeBC0Kvy4A/4yGM0=");
  });

  it("uppercases the method", () => {
    const base = { secret: "s", timestamp: "2026-01-01T00:00:00.000Z", requestPath: "/build/api/v1/x", body: "" };
    expect(signW3wRequest({ ...base, method: "get" })).toBe(signW3wRequest({ ...base, method: "GET" }));
  });

  it("rejects a path without the /build prefix", () => {
    expect(() =>
      signW3wRequest({ secret: "s", timestamp: "t", method: "GET", requestPath: "/api/v1/dex/market/rwa/tokens", body: "" }),
    ).toThrow("requestPath must start with /build/");
  });
});
