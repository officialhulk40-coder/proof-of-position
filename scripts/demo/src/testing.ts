// Test helpers for @pop/demo (imported by *.test.ts only): a fake BSC + Binance Web3 API.
import { CALL_REGISTRY_ABI, createFakeW3wClient, type LegacyTxRequest, type RawCall, type RecordedCall, type RegistryReader, type SwapClient, type TxSigner } from "@pop/core";
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, parseAbi, type TransactionReceipt } from "viem";

export const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
export const CALLER = "0x1111111111111111111111111111111111111111";
export const ROUTER = "0xb44446b0c8e56988c34f7ff73ae904982b5fdda5";
export const NVDAB = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";
const SWAP_SELECTOR = "0x5ae401dc";
const TRANSFER = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

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

export interface DemoWorld {
  w3w: ReturnType<typeof createFakeW3wClient>["client"];
  apiCalls: RecordedCall[];
  client: SwapClient & RegistryReader;
  signer: TxSigner;
  /** "approve", "swap:<token>", "post:<token>:<amount>", "raw:<to>" (a broadcast without simulation). */
  signed: string[];
  calls: { raw: RawCall; status: number }[];
}

/** A fake world: `simulation` decides every simulate answer; swaps deliver 5.3e15 of the bought token. */
export function demoWorld(options: { simulation?: "SUCCESS" | string; balance?: bigint; calls?: { raw: RawCall; status: number }[] } = {}): DemoWorld {
  const calls = options.calls ?? [];
  const signed: string[] = [];
  let lastTx: LegacyTxRequest | null = null;
  let broadcasts = 0;
  const { client: w3w, calls: apiCalls } = createFakeW3wClient((call) => {
    const query = call.query ?? {};
    switch (call.path) {
      case "/api/v1/dex/aggregator/quote":
        return [{ quoteId: "q", vendorName: "PancakeSwap", fromTokenAmount: String(query.amount), toTokenAmount: "1", executionMode: "SWAP", approveTarget: ROUTER }];
      case "/api/v1/dex/aggregator/approve-transaction":
        return [{ data: "0x095ea7b3", dexContractAddress: ROUTER }];
      case "/api/v1/dex/aggregator/swap":
        return {
          routerResult: { fromTokenAmount: String(query.amount), toTokenAmount: "1" },
          tx: { from: CALLER, to: ROUTER, data: `${SWAP_SELECTOR}${String(query.toTokenAddress).toLowerCase().slice(2)}`, value: "0" },
          executionMode: "SWAP",
        };
      case "/api/v1/dex/pre-transaction/simulate": {
        const status = options.simulation ?? "SUCCESS";
        return status === "SUCCESS" ? { status } : { status: "FAILED", failReason: status };
      }
      case "/api/v1/dex/pre-transaction/broadcast-transaction":
        broadcasts += 1;
        return { orderId: String(broadcasts), txHash: `0x${broadcasts.toString(16).padStart(64, "0")}` };
      default:
        throw new Error(`unexpected ${call.path}`);
    }
  });

  function logsFor(tx: LegacyTxRequest) {
    if (tx.data.startsWith(SWAP_SELECTOR)) {
      const bought = `0x${tx.data.slice(10, 50)}` as `0x${string}`;
      signed.push(`swap:${bought}`);
      return [{ address: bought, topics: encodeEventTopics({ abi: TRANSFER, eventName: "Transfer", args: { from: ROUTER, to: CALLER } }), data: encodeAbiParameters([{ type: "uint256" }], [5_300_000_000_000_000n]) }];
    }
    if (tx.to.toLowerCase() === REGISTRY && tx.gas !== 200_000n) {
      const decoded = decodeFunctionData({ abi: CALL_REGISTRY_ABI, data: tx.data });
      if (decoded.functionName === "post") {
        const [token, amount, note] = decoded.args;
        const callId = BigInt(calls.length);
        calls.push({ raw: rawCall({ token: token.toLowerCase() as `0x${string}`, declaredAmount: amount, note }), status: 0 });
        signed.push(`post:${token.toLowerCase()}:${amount}`);
        return [
          {
            address: REGISTRY,
            topics: encodeEventTopics({ abi: CALL_REGISTRY_ABI, eventName: "CallPosted", args: { callId, caller: CALLER, token } }),
            data: encodeAbiParameters([{ type: "uint256" }, { type: "uint256" }, { type: "bool" }, { type: "string" }], [amount, 0n, false, note]),
          },
        ];
      }
    }
    if (tx.to.toLowerCase() === REGISTRY) {
      signed.push(`raw:${tx.to.toLowerCase()}`);
      return [];
    }
    signed.push("approve");
    return [];
  }

  const client = {
    async readContract(request: { functionName: string; args?: readonly unknown[] }) {
      switch (request.functionName) {
        case "callCount":
          return BigInt(calls.length);
        case "getCalls": {
          const [start, count] = (request.args ?? []) as [bigint, bigint];
          const page = calls.slice(Number(start), Number(start) + Number(count));
          return [page.map((c) => c.raw), page.map((c) => c.status)];
        }
        case "allowance":
          return 0n;
        case "balanceOf":
          return options.balance ?? 0n;
        default:
          throw new Error(`unexpected read ${request.functionName}`);
      }
    },
    getTransactionCount: async () => 3,
    getGasPrice: async () => 100_000_000n,
    estimateGas: async () => 100_000n,
    async waitForTransactionReceipt({ hash }: { hash: `0x${string}` }) {
      if (!lastTx) throw new Error("nothing signed");
      const reverted = lastTx.gas === 200_000n;
      const logs = logsFor(lastTx).map((log, index) => ({ ...log, blockNumber: 300n, logIndex: index, transactionHash: hash }));
      return { status: reverted ? "reverted" : "success", transactionHash: hash, blockNumber: 300n, logs } as unknown as TransactionReceipt;
    },
  } as unknown as SwapClient & RegistryReader;

  const signer: TxSigner = {
    address: CALLER,
    async signTransaction(tx) {
      lastTx = tx;
      return "0xf86c01";
    },
  };
  return { w3w, apiCalls, client, signer, signed, calls };
}
