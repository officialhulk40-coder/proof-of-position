import type { PublicClient } from "viem";
import { CALL_REGISTRY_ABI } from "./abi.generated";
import { REPUTATION_REGISTRY_ABI } from "./abis";
import { toCallView, type CallView } from "./types";

/** The only client capability the readers need (real viem PublicClient or a test fake). */
export type RegistryReader = Pick<PublicClient, "readContract">;

export async function readCallCount(client: RegistryReader, registry: `0x${string}`): Promise<number> {
  const count = await client.readContract({ address: registry, abi: CALL_REGISTRY_ABI, functionName: "callCount" });
  return Number(count);
}

/** One getCalls page (oldest first), ids start at `start`. */
export async function readCallsPage(
  client: RegistryReader,
  registry: `0x${string}`,
  start: number,
  count: number,
): Promise<CallView[]> {
  const [calls, statuses] = await client.readContract({
    address: registry,
    abi: CALL_REGISTRY_ABI,
    functionName: "getCalls",
    args: [BigInt(start), BigInt(count)],
  });
  return calls.map((raw, index) => toCallView(start + index, raw, statuses[index] ?? 0));
}

/** The newest `limit` calls, newest first, plus the total count. */
export async function readLatestCalls(
  client: RegistryReader,
  registry: `0x${string}`,
  limit: number,
): Promise<{ total: number; calls: CallView[] }> {
  const total = await readCallCount(client, registry);
  if (total === 0) return { total, calls: [] };
  const start = Math.max(0, total - limit);
  const page = await readCallsPage(client, registry, start, total - start);
  return { total, calls: page.reverse() };
}

/** Every call from `fromId` on, oldest first, in pages of `pageSize`. */
export async function readCallsFrom(
  client: RegistryReader,
  registry: `0x${string}`,
  fromId: number,
  pageSize = 100,
): Promise<CallView[]> {
  const total = await readCallCount(client, registry);
  const calls: CallView[] = [];
  for (let start = fromId; start < total; start += pageSize) {
    calls.push(...(await readCallsPage(client, registry, start, Math.min(pageSize, total - start))));
  }
  return calls;
}

export interface AgentIntegrity {
  /** Number of integrity feedback entries the registry wrote for this agent. */
  count: number;
  /** Average score 0–100, or null before the first entry. */
  score: number | null;
}

/** getSummary(agentId, [registry], "integrity", "") on the ERC-8004 ReputationRegistry. */
export async function readAgentIntegrity(
  client: RegistryReader,
  params: { reputationRegistry: `0x${string}`; registry: `0x${string}`; agentId: bigint },
): Promise<AgentIntegrity> {
  const [count, value, decimals] = await client.readContract({
    address: params.reputationRegistry,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "getSummary",
    args: [params.agentId, [params.registry], "integrity", ""],
  });
  if (count === 0n) return { count: 0, score: null };
  return { count: Number(count), score: Number(value) / 10 ** decimals };
}
