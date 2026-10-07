import { createFakeW3wClient, toCallView } from "@pop/core";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { findExitEvidence } from "../exit/evidence";
import { CALLER, NVDAB, fakeChain, fakeLogs, makeDeps, rawCall } from "../testing";
import { exitRoutes, type ExitResponse } from "./exit";

const POOL = "0x8fb4243b553ac29ba088acf00b9b7da24bd6690c";
const sellTrade = {
  txHash: "0xdump",
  userAddress: CALLER,
  dexName: "PancakeSwap V3",
  type: "sell",
  price: "187.40",
  volume: "3.75",
  time: 1_791_000_100_000,
  changedTokenInfo: [
    { amount: "0.02", tokenSymbol: "NVDAB", tokenContractAddress: NVDAB },
    { amount: "3.74", tokenSymbol: "USDT", tokenContractAddress: "0x55d398326f99059ff775485246999027b3197955" },
  ],
};

describe("findExitEvidence", () => {
  it("prefers a Market API sell after the post", async () => {
    const { client, calls } = createFakeW3wClient(() => ({ cursor: "", trades: [{ ...sellTrade, time: 1_790_000_000_000, txHash: "0xolder" }, sellTrade].reverse() }));
    const evidence = await findExitEvidence({ w3w: client, logs: fakeLogs([]) }, toCallView(0, rawCall(), 2));
    expect(calls[0]?.query).toMatchObject({ tokenContractAddress: NVDAB, walletAddressFilter: CALLER, limit: 20 });
    expect(evidence).toEqual({
      kind: "sale",
      txHash: "0xdump",
      amount: "0.02",
      timeMs: 1_791_000_100_000,
      priceUsd: "187.40",
      volumeUsd: "3.75",
      dexName: "PancakeSwap V3",
      counterparty: null,
      source: "market-api",
    });
  });

  it("falls back to Transfer logs and labels a contract counterparty", async () => {
    const { client } = createFakeW3wClient(() => ({ cursor: "", trades: [] }));
    const logs = fakeLogs([{ args: { from: CALLER, to: POOL, value: 20_000_000_000_000_000n }, transactionHash: "0xlog", blockNumber: 990n }], { [POOL]: "0x6080" }, 1_000n);
    const evidence = await findExitEvidence({ w3w: client, logs }, toCallView(0, rawCall({ postedBlock: 950n }), 2));
    expect(evidence).toMatchObject({ kind: "contract", txHash: "0xlog", amount: "0.02", counterparty: POOL, source: "rpc-logs" });
    expect(logs.requests[0]).toMatchObject({ address: NVDAB, args: { from: CALLER }, fromBlock: 950n, toBlock: 1_000n });
  });

  it("labels a wallet counterparty as a transfer and bounds the lookback", async () => {
    const wallet = "0x4444444444444444444444444444444444444444";
    const logs = fakeLogs([{ args: { from: CALLER, to: wallet, value: 10n ** 16n }, transactionHash: "0xsent", blockNumber: 1_900n }], {}, 2_000n);
    const evidence = await findExitEvidence({ w3w: null, logs }, toCallView(0, rawCall({ postedBlock: 100n }), 1));
    expect(evidence).toMatchObject({ kind: "transfer", counterparty: wallet, amount: "0.01" });
    expect(logs.requests[0]).toMatchObject({ fromBlock: 1_600n });
  });

  it("returns null when nothing moved yet", async () => {
    await expect(findExitEvidence({ w3w: null, logs: fakeLogs([]) }, toCallView(0, rawCall(), 2))).resolves.toBeNull();
  });
});

describe("GET /api/calls/:id/exit", () => {
  it("returns evidence for a flipped call and nothing for a holding one", async () => {
    const { client } = createFakeW3wClient(() => ({ cursor: "", trades: [sellTrade] }));
    const chain = fakeChain({ calls: [rawCall(), rawCall({ note: "holding" })], statuses: [2, 0], allowance: 0n, blockNumber: 1_000n });
    const app = createApp(makeDeps({ w3w: client, chain }), [exitRoutes]);
    const flipped = (await (await app.request("/api/calls/0/exit")).json()) as ExitResponse;
    expect(flipped.status).toBe("EXITED");
    expect(flipped.evidence?.txHash).toBe("0xdump");
    const holding = (await (await app.request("/api/calls/1/exit")).json()) as ExitResponse;
    expect(holding).toEqual({ callId: 1, status: "HOLDING", evidence: null });
  });

  it("validates the id and 404s unknown calls", async () => {
    const app = createApp(makeDeps(), [exitRoutes]);
    expect((await app.request("/api/calls/abc/exit")).status).toBe(400);
    expect((await app.request("/api/calls/7/exit")).status).toBe(404);
  });
});
