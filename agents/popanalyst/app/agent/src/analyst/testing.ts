// Test helpers for the analyst (imported by *.test.ts only): a fake BSC + Binance Web3 API world.
import { CALL_REGISTRY_ABI, createFakeW3wClient, type LegacyTxRequest, type RawCall, type RecordedCall, type RegistryReader, type SwapClient, type TxSigner } from "@pop/core";
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, parseAbi, type TransactionReceipt } from "viem";
import type { AnalystConfig } from "./config.js";

export const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
export const AGENT_WALLET = "0x7777777777777777777777777777777777777777";
export const ROUTER = "0xb44446b0c8e56988c34f7ff73ae904982b5fdda5";
export const USDT = "0x55d398326f99059ff775485246999027b3197955";
export const NVDAB = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";
/** Fake swap calldata: this selector + the token bought, so the fake receipt knows what arrived. */
const SWAP_SELECTOR = "0x5ae401dc";
const TRANSFER = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

export function rawCall(overrides: Partial<RawCall> = {}): RawCall {
  return {
    caller: AGENT_WALLET,
    token: NVDAB,
    model: 1,
    hasAgent: true,
    heldThrough: false,
    exitStatus: 0,
    postedBlock: 100n,
    postedAt: 1_791_000_000n,
    closedBlock: 0n,
    exitBlock: 0n,
    agentId: 7n,
    declaredAmount: 10_000_000_000_000_000n,
    declaredBase: 10_000_000_000_000_000n,
    note: "",
    ...overrides,
  };
}

export function testConfig(overrides: Partial<AnalystConfig> = {}): AnalystConfig & { registry: `0x${string}`; agentId: bigint } {
  return {
    enabled: true,
    registry: REGISTRY,
    agentId: 7n,
    watchlist: ["NVDAB", "TSLAB"],
    buyUsdt: "2",
    holdHours: 24,
    intervalMinutes: 30,
    rpcUrls: ["https://bsc-dataseed.bnbchain.org"],
    w3w: { apiKey: "k", apiSecret: "s" },
    feedUrl: "https://pop.example",
    telemetryFile: null,
    ...overrides,
  } as AnalystConfig & { registry: `0x${string}`; agentId: bigint };
}

export interface FakeWorld {
  w3w: ReturnType<typeof createFakeW3wClient>["client"];
  apiCalls: RecordedCall[];
  client: SwapClient & RegistryReader;
  signer: TxSigner;
  /** What was signed, decoded: "approve", "swap:<token>", "postAsAgent:<token>:<amount>:<note>", "close:<id>". */
  signed: string[];
  calls: { raw: RawCall; status: number }[];
}

/**
 * Registry calls live in `calls`; tokens in `noRoute` only quote RFQ; every swap delivers `delivered`
 * of the bought token; `balances` answers balanceOf; allowances are always 0 (so approvals happen).
 */
export function fakeWorld(options: { calls?: { raw: RawCall; status: number }[]; noRoute?: string[]; delivered?: bigint; balances?: Record<string, bigint>; failSimulation?: string } = {}): FakeWorld {
  const calls = options.calls ?? [];
  const noRoute = new Set((options.noRoute ?? []).map((address) => address.toLowerCase()));
  const signed: string[] = [];
  let lastTx: LegacyTxRequest | null = null;
  let broadcasts = 0;

  const { client: w3w, calls: apiCalls } = createFakeW3wClient((call) => {
    const query = call.query ?? {};
    switch (call.path) {
      case "/api/v1/dex/aggregator/quote": {
        const to = String(query.toTokenAddress).toLowerCase();
        const from = String(query.fromTokenAddress).toLowerCase();
        const mode = noRoute.has(to) || noRoute.has(from) ? "RFQ" : "SWAP";
        return [{ quoteId: `q-${to}`, vendorName: "PancakeSwap", fromTokenAmount: String(query.amount), toTokenAmount: "1", executionMode: mode, approveTarget: ROUTER }];
      }
      case "/api/v1/dex/aggregator/approve-transaction":
        return [{ data: "0x095ea7b3", dexContractAddress: ROUTER }];
      case "/api/v1/dex/aggregator/swap":
        return {
          routerResult: { fromTokenAmount: String(query.amount), toTokenAmount: "1" },
          tx: { from: AGENT_WALLET, to: ROUTER, data: `${SWAP_SELECTOR}${String(query.toTokenAddress).toLowerCase().slice(2)}`, value: "0" },
          executionMode: "SWAP",
        };
      case "/api/v1/dex/pre-transaction/simulate":
        return options.failSimulation ? { status: "FAILED", failReason: options.failSimulation } : { status: "SUCCESS", balanceChanges: [], allowanceChanges: [] };
      case "/api/v1/dex/pre-transaction/broadcast-transaction":
        broadcasts += 1;
        return { orderId: String(broadcasts), txHash: `0x${broadcasts.toString(16).padStart(64, "0")}` };
      default:
        throw new Error(`unexpected ${call.path}`);
    }
  });

  function receiptLogs(tx: LegacyTxRequest) {
    if (tx.to.toLowerCase() === REGISTRY) {
      const decoded = decodeFunctionData({ abi: CALL_REGISTRY_ABI, data: tx.data });
      if (decoded.functionName === "postAsAgent") {
        const [token, amount, agentId, note] = decoded.args;
        const callId = BigInt(calls.length);
        calls.push({ raw: rawCall({ token: token.toLowerCase() as `0x${string}`, declaredAmount: amount, declaredBase: amount, agentId, note, postedAt: 1_791_100_000n }), status: 0 });
        signed.push(`postAsAgent:${token.toLowerCase()}:${amount}:${note}`);
        return [
          {
            address: REGISTRY,
            topics: encodeEventTopics({ abi: CALL_REGISTRY_ABI, eventName: "CallPosted", args: { callId, caller: AGENT_WALLET, token } }),
            data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }, { type: "bool" }, { type: "string" }], [amount, agentId, true, note]),
          },
        ];
      }
      if (decoded.functionName === "close") {
        const [callId] = decoded.args;
        const entry = calls[Number(callId)];
        if (entry) entry.raw = { ...entry.raw, closedBlock: 200n, heldThrough: true };
        signed.push(`close:${callId}`);
        return [{ address: REGISTRY, topics: encodeEventTopics({ abi: CALL_REGISTRY_ABI, eventName: "CallClosed", args: { callId } }), data: encodeAbiParameters([{ type: "bool" }], [true]) }];
      }
    }
    if (tx.data.startsWith(SWAP_SELECTOR)) {
      const bought = `0x${tx.data.slice(SWAP_SELECTOR.length, SWAP_SELECTOR.length + 40)}` as `0x${string}`;
      signed.push(`swap:${bought}`);
      return [
        {
          address: bought,
          topics: encodeEventTopics({ abi: TRANSFER, eventName: "Transfer", args: { from: ROUTER, to: AGENT_WALLET } }),
          data: encodeAbiParameters([{ type: "uint256" }], [options.delivered ?? 5_300_000_000_000_000n]),
        },
      ];
    }
    signed.push("approve");
    return [];
  }

  const client = {
    async readContract(request: { functionName: string; address: string; args?: readonly unknown[] }) {
      switch (request.functionName) {
        case "callCount":
          return BigInt(calls.length);
        case "getCalls": {
          const [start, count] = (request.args ?? []) as [bigint, bigint];
          const page = calls.slice(Number(start), Number(start) + Number(count));
          return [page.map((c) => c.raw), page.map((c) => (c.raw.closedBlock > 0n ? 3 : c.status))];
        }
        case "allowance":
          return 0n;
        case "balanceOf":
          return options.balances?.[request.address.toLowerCase()] ?? 0n;
        default:
          throw new Error(`unexpected read ${request.functionName}`);
      }
    },
    getTransactionCount: async () => 1,
    getGasPrice: async () => 100_000_000n,
    estimateGas: async () => 100_000n,
    async waitForTransactionReceipt({ hash }: { hash: `0x${string}` }) {
      const tx = lastTx;
      if (!tx) throw new Error("no transaction was signed");
      const logs = receiptLogs(tx).map((log, index) => ({ ...log, blockNumber: 300n, logIndex: index, transactionHash: hash }));
      return { status: "success", transactionHash: hash, blockNumber: 300n, logs } as unknown as TransactionReceipt;
    },
  } as unknown as SwapClient & RegistryReader;

  const signer: TxSigner = {
    address: AGENT_WALLET,
    async signTransaction(tx) {
      lastTx = tx;
      return "0xf86c01";
    },
  };
  return { w3w, apiCalls, client, signer, signed, calls };
}
