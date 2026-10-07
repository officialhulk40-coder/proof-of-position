import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, getAddress, type TransactionReceipt } from "viem";
import { describe, expect, it } from "vitest";
import { ADDRESSES } from "../chain/constants";
import { ERC20_ABI } from "../registry/abis";
import { createFakeW3wClient, type RecordedCall } from "../w3w/testing";
import type { LegacyTxRequest, TxSigner } from "./pipeline";
import { NoSwapRouteError, swapWithTradingApi, type SwapClient } from "./swap";

const ME = "0x1111111111111111111111111111111111111111";
const NVDAB = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";
const ROUTER = "0xb44446b0c8e56988c34f7ff73ae904982b5fdda5";
const OTHER_SPENDER = "0x2222222222222222222222222222222222222222";

function route(quoteId: string, overrides: Record<string, unknown> = {}) {
  return { quoteId, vendorName: "PancakeSwap", fromTokenAmount: "1000000000000000000", toTokenAmount: "5300000000000000", executionMode: "SWAP", approveTarget: ROUTER, ...overrides };
}

function transferLog(token: string, to: string, value: bigint) {
  return {
    address: token,
    topics: encodeEventTopics({ abi: ERC20_ABI, eventName: "Transfer", args: { from: ROUTER as `0x${string}`, to: to as `0x${string}` } }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
    blockNumber: 1n,
    logIndex: 0,
    transactionHash: "0xaa",
  };
}

function api(options: { routes?: unknown[]; approveDex?: string } = {}) {
  let quotes = 0;
  return createFakeW3wClient((call: RecordedCall) => {
    switch (call.path) {
      case "/api/v1/dex/aggregator/quote":
        quotes += 1;
        return options.routes ?? [route(`q${quotes}`)];
      case "/api/v1/dex/aggregator/approve-transaction":
        return [{ data: "0x095ea7b3feed", dexContractAddress: options.approveDex ?? ROUTER, gasLimit: "60000", gasPrice: "100000000" }];
      case "/api/v1/dex/aggregator/swap":
        return {
          routerResult: { vendorName: "PancakeSwap", fromTokenAmount: "1000000000000000000", toTokenAmount: "5300000000000000" },
          tx: { from: ME, to: ROUTER, data: "0x5ae401dc", value: "0", gas: "300000", gasPrice: "100000000", minReceiveAmount: "5247000000000000" },
          executionMode: "SWAP",
        };
      case "/api/v1/dex/pre-transaction/simulate":
        return { status: "SUCCESS", failReason: null, balanceChanges: [], allowanceChanges: [] };
      case "/api/v1/dex/pre-transaction/broadcast-transaction":
        return { orderId: "1", txHash: "0x1f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a7988" };
      default:
        throw new Error(`unexpected ${call.path}`);
    }
  });
}

function chain(allowance: bigint, toToken: string) {
  const client = {
    readContract: async () => allowance,
    getTransactionCount: async () => 7,
    getGasPrice: async () => 100_000_000n,
    estimateGas: async () => 100_000n,
    waitForTransactionReceipt: async ({ hash }: { hash: `0x${string}` }) =>
      ({ status: "success", transactionHash: hash, blockNumber: 1n, logs: [transferLog(toToken, ME, 5_300_000_000_000_000n), transferLog(toToken, OTHER_SPENDER, 9n)] }) as unknown as TransactionReceipt,
  } as unknown as SwapClient;
  return client;
}

function signer(): { signer: TxSigner; signed: LegacyTxRequest[] } {
  const signed: LegacyTxRequest[] = [];
  return {
    signed,
    signer: {
      address: ME,
      async signTransaction(tx) {
        signed.push(tx);
        return "0xf86c0a";
      },
    },
  };
}

describe("swapWithTradingApi", () => {
  it("swaps straight away when the allowance covers the amount", async () => {
    const { client: w3w, calls } = api();
    const { signer: me, signed } = signer();
    const result = await swapWithTradingApi({ w3w, client: chain(10n ** 30n, NVDAB), signer: me, fromToken: ADDRESSES.usdt, toToken: NVDAB, amount: 10n ** 18n, mev: true });
    expect(result.approval).toBeNull();
    expect(result.route.quoteId).toBe("q1");
    expect(result.received).toBe(5_300_000_000_000_000n);
    expect(signed.map((tx) => tx.to)).toEqual([ROUTER]);
    const swapCall = calls.find((call) => call.path === "/api/v1/dex/aggregator/swap");
    expect(swapCall?.query).toMatchObject({ quoteId: "q1", slippagePercent: "1", userWalletAddress: ME, amount: "1000000000000000000" });
  });

  it("approves an equity token with the route's vendor, then re-quotes and swaps", async () => {
    const { client: w3w, calls } = api();
    const { signer: me, signed } = signer();
    const result = await swapWithTradingApi({ w3w, client: chain(0n, ADDRESSES.usdt), signer: me, fromToken: NVDAB, toToken: ADDRESSES.usdt, amount: 10n ** 18n, mev: false });
    const approveCall = calls.find((call) => call.path === "/api/v1/dex/aggregator/approve-transaction");
    expect(approveCall?.query).toMatchObject({ tokenContractAddress: NVDAB, approveAmount: "1000000000000000000", vendor: "PancakeSwap" });
    expect(signed.map((tx) => [tx.to, tx.data])).toEqual([
      [NVDAB, "0x095ea7b3feed"],
      [ROUTER, "0x5ae401dc"],
    ]);
    expect(result.approval).not.toBeNull();
    expect(result.route.quoteId).toBe("q2");
    expect(calls.filter((call) => call.path === "/api/v1/dex/aggregator/quote")).toHaveLength(2);
  });

  it("encodes approve(spender) itself when the API's approval targets another contract", async () => {
    const { client: w3w } = api({ approveDex: OTHER_SPENDER });
    const { signer: me, signed } = signer();
    await swapWithTradingApi({ w3w, client: chain(0n, NVDAB), signer: me, fromToken: ADDRESSES.usdt, toToken: NVDAB, amount: 10n ** 18n, mev: true });
    const approval = decodeFunctionData({ abi: ERC20_ABI, data: signed[0]?.data ?? "0x" });
    expect(approval).toEqual({ functionName: "approve", args: [getAddress(ROUTER), 10n ** 18n] });
  });

  it("refuses RFQ-only quotes without signing anything", async () => {
    const { client: w3w } = api({ routes: [route("rfq", { executionMode: "RFQ" })] });
    const { signer: me, signed } = signer();
    const error = await swapWithTradingApi({ w3w, client: chain(0n, NVDAB), signer: me, fromToken: ADDRESSES.usdt, toToken: NVDAB, amount: 10n ** 18n, mev: true }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NoSwapRouteError);
    expect(signed).toEqual([]);
  });
});
