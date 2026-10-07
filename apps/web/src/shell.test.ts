import { DEFAULT_BSC_RPC_URLS } from "@pop/core/browser";
import { describe, expect, it } from "vitest";
import { readConfig } from "./config";
import { hrefFor, parseHash } from "./router";

describe("router", () => {
  it("parses every hash route", () => {
    expect(parseHash("")).toEqual({ name: "feed" });
    expect(parseHash("#/")).toEqual({ name: "feed" });
    expect(parseHash("#/calls/12")).toEqual({ name: "call", id: 12 });
    expect(parseHash("#/post")).toEqual({ name: "post" });
    expect(parseHash("#/how")).toEqual({ name: "how" });
    expect(parseHash("#/calls/abc")).toEqual({ name: "not-found" });
  });

  it("round-trips hrefs", () => {
    for (const hash of ["#/", "#/calls/3", "#/post", "#/how"]) expect(hrefFor(parseHash(hash))).toBe(hash);
  });
});

describe("readConfig", () => {
  it("reads build-time env", () => {
    expect(
      readConfig({
        VITE_REGISTRY_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        VITE_API_BASE: "https://pop.test/",
        VITE_RPC_URLS: "https://a.test,https://b.test",
      }),
    ).toEqual({
      registry: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      apiBase: "https://pop.test",
      rpcUrls: ["https://a.test", "https://b.test"],
      explorer: "https://bscscan.com",
    });
  });

  it("defaults to same-origin API, official RPCs and no registry", () => {
    expect(readConfig({ VITE_REGISTRY_ADDRESS: "not-an-address" })).toEqual({
      registry: null,
      apiBase: "",
      rpcUrls: [...DEFAULT_BSC_RPC_URLS],
      explorer: "https://bscscan.com",
    });
  });
});
