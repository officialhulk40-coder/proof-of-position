// Test helpers for @pop/web (imported by *.test.tsx only).
import { toCallView, type CallView, type RawCall } from "@pop/core/browser";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { createApiClient, type TokenDto } from "./api/client";
import { ServicesProvider, type ChainServices, type Services } from "./services";

export const TEST_REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
export const CALLER = "0x1111111111111111111111111111111111111111";
export const NVDAB = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";

export const NVDAB_DTO: TokenDto = {
  address: NVDAB,
  symbol: "NVDAB",
  ticker: "NVDA",
  issuer: "bStocks",
  model: "PLAIN",
  assetType: 1,
  name: "NVIDIA Corporation",
  tokenToShareRatio: "1",
  priceUsd: "187.43",
  status: { openState: true, marketStatus: "regular", reasonCode: "TRADING", reasonMsg: null },
};

export function rawCall(overrides: Partial<RawCall> = {}): RawCall {
  return {
    caller: CALLER,
    token: NVDAB,
    model: 1,
    hasAgent: false,
    heldThrough: false,
    exitStatus: 0,
    postedBlock: 100n,
    postedAt: 1_791_000_000n,
    closedBlock: 0n,
    exitBlock: 0n,
    agentId: 0n,
    declaredAmount: 20_000_000_000_000_000n,
    declaredBase: 20_000_000_000_000_000n,
    note: "",
    ...overrides,
  };
}

/** A CallView with live status (0 HOLDING, 1 TRIMMED, 2 EXITED, 3 CLOSED). */
export function callView(id: number, overrides: Partial<RawCall> = {}, status = 0): CallView {
  return toCallView(id, rawCall(overrides), status);
}

/** Routes fetch by "METHOD /path" to a status + JSON body; unknown routes answer 404. */
export function fakeFetch(routes: Record<string, (body: unknown) => { status?: number; body: unknown }>): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), "http://web.test");
    const key = `${init?.method ?? "GET"} ${url.pathname}`;
    const handler = routes[key];
    if (!handler) return new Response(JSON.stringify({ error: { code: "NOT_FOUND", msg: key } }), { status: 404 });
    const result = handler(init?.body ? JSON.parse(String(init.body)) : null);
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

/** A chain fake: watchBlockNumber emits once; reads go to `readContract`; other calls throw unless overridden. */
export function fakeChain(overrides: Partial<Record<keyof ChainServices, unknown>> = {}): ChainServices {
  return {
    readContract: async () => {
      throw new Error("readContract not faked");
    },
    watchBlockNumber: (options: { onBlockNumber: (n: bigint) => void }) => {
      options.onBlockNumber(100n);
      return () => {};
    },
    simulateContract: async () => {
      throw new Error("simulateContract not faked");
    },
    waitForTransactionReceipt: async () => {
      throw new Error("waitForTransactionReceipt not faked");
    },
    ...overrides,
  } as unknown as ChainServices;
}

export function testServices(overrides: Partial<Services> = {}): Services {
  return { api: createApiClient("", fakeFetch({})), chain: fakeChain(), registry: TEST_REGISTRY, ...overrides };
}

export function renderWithServices(ui: ReactElement, services: Services = testServices()): RenderResult {
  return render(<ServicesProvider value={services}>{ui}</ServicesProvider>);
}
