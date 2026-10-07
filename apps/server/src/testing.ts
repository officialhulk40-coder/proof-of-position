import { createFakeW3wClient, type RawCall, type RecordedCall, type W3wClient } from "@pop/core";
import type { ServerConfig } from "./config";
import type { ChainClient, KeeperStatus, LogsClient, ServerDeps } from "./deps";

export const TEST_REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
export const CALLER = "0x1111111111111111111111111111111111111111";
export const NVDAB = "0x02fca66c1d1afb4e2a7884261eb00f63598a7436";

export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 8787,
    registry: TEST_REGISTRY,
    rpcUrls: ["https://rpc.test"],
    logsRpcUrl: "https://logs.test",
    w3w: { apiKey: "k", apiSecret: "s" },
    keeperKey: null,
    telemetryFile: null,
    corsOrigins: ["*"],
    ...overrides,
  };
}

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
    note: "AI capex cycle intact",
    ...overrides,
  };
}

export interface FakeChainState {
  calls: RawCall[];
  statuses: number[];
  allowance: bigint;
  blockNumber: bigint;
}

/** Answers readContract for callCount / getCalls (CallRegistry) and allowance (ERC-20) from `state`. */
export function fakeChain(state: FakeChainState): ChainClient {
  return {
    async readContract(request: { functionName: string; args?: readonly unknown[] }) {
      if (request.functionName === "callCount") return BigInt(state.calls.length);
      if (request.functionName === "getCalls") {
        const start = Number(request.args?.[0]);
        const count = Number(request.args?.[1]);
        return [state.calls.slice(start, start + count), state.statuses.slice(start, start + count)];
      }
      if (request.functionName === "allowance") return state.allowance;
      throw new Error(`fakeChain: unexpected ${request.functionName}`);
    },
    async getBlockNumber() {
      return state.blockNumber;
    },
  } as unknown as ChainClient;
}

export interface FakeLog {
  args: { from: string; to: string; value: bigint };
  transactionHash: string;
  blockNumber: bigint;
}

export function fakeLogs(logs: FakeLog[], codeByAddress: Record<string, string> = {}, latest = 1_000n): LogsClient & { requests: unknown[] } {
  const requests: unknown[] = [];
  return {
    requests,
    async getBlockNumber() {
      return latest;
    },
    async getLogs(request: unknown) {
      requests.push(request);
      return logs;
    },
    async getCode({ address }: { address: string }) {
      return codeByAddress[address.toLowerCase()] ?? undefined;
    },
  } as unknown as LogsClient & { requests: unknown[] };
}

export function makeDeps(
  overrides: {
    config?: Partial<ServerConfig>;
    w3w?: W3wClient | null;
    chain?: ChainClient;
    logs?: LogsClient;
    now?: () => number;
    keeper?: KeeperStatus;
  } = {},
): ServerDeps {
  return {
    config: testConfig(overrides.config),
    w3w: overrides.w3w === undefined ? createFakeW3wClient(() => null).client : overrides.w3w,
    chain: overrides.chain ?? fakeChain({ calls: [], statuses: [], allowance: 0n, blockNumber: 1_000n }),
    logs: overrides.logs ?? fakeLogs([]),
    now: overrides.now ?? (() => 1_791_000_000_000),
    keeperStatus: () => overrides.keeper ?? { enabled: false, address: null, recorded: 0, lastError: null },
  };
}

/** A fake W3W client answering by request path; unknown paths throw so tests notice unexpected calls. */
export function w3wByPath(answers: Record<string, (call: RecordedCall) => unknown>) {
  return createFakeW3wClient((call) => {
    const answer = answers[call.path];
    if (!answer) throw new Error(`unexpected W3W call ${call.method} ${call.path}`);
    return answer(call);
  });
}
