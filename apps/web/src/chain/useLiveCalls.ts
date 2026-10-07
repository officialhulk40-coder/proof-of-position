import { readCallsPage, readLatestCalls, type CallView } from "@pop/core/browser";
import { useEffect, useRef, useState } from "react";
import type { PublicClient } from "viem";
import { diffCalls, type Flip } from "./diff";

export type LiveCallsClient = Pick<PublicClient, "readContract" | "watchBlockNumber">;

export interface BlockPollState<T> {
  value: T | null;
  blockNumber: bigint | null;
  loading: boolean;
  /** Set after three failed reads in a row; the last good value stays on screen meanwhile. */
  error: string | null;
}

/**
 * Runs `read` on every new BSC block (1 s polling; blocks are ~0.45 s) and skips a block while a read
 * is still in flight. `key` identifies what is read: null disables polling, a new key restarts it.
 */
export function useBlockPoll<T>(
  client: Pick<PublicClient, "watchBlockNumber">,
  key: string | null,
  read: () => Promise<T>,
  onValue?: (value: T, previous: T | null) => void,
): BlockPollState<T> {
  const [state, setState] = useState<BlockPollState<T>>({ value: null, blockNumber: null, loading: key !== null, error: null });
  const readRef = useRef(read);
  readRef.current = read;
  const onValueRef = useRef(onValue);
  onValueRef.current = onValue;

  useEffect(() => {
    if (key === null) return;
    setState({ value: null, blockNumber: null, loading: true, error: null });
    let previous: T | null = null;
    let inFlight = false;
    let failures = 0;
    let cancelled = false;

    const refresh = async (blockNumber: bigint) => {
      if (inFlight) return;
      inFlight = true;
      try {
        const value = await readRef.current();
        if (cancelled) return;
        failures = 0;
        const before = previous;
        previous = value;
        setState({ value, blockNumber, loading: false, error: null });
        onValueRef.current?.(value, before);
      } catch (error) {
        failures += 1;
        if (!cancelled && failures >= 3) {
          setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) }));
        }
      } finally {
        inFlight = false;
      }
    };

    const unwatch = client.watchBlockNumber({
      emitOnBegin: true,
      pollingInterval: 1_000,
      onBlockNumber: (blockNumber) => void refresh(blockNumber),
      onError: (error) => setState((current) => ({ ...current, error: error.message })),
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, [client, key]);

  return state;
}

export interface LiveCallsState {
  calls: CallView[];
  total: number;
  blockNumber: bigint | null;
  loading: boolean;
  error: string | null;
}

const NO_CALLS: CallView[] = [];

/** The newest `limit` calls (one getCalls eth_call per block, straight from public RPC) plus their flips. */
export function useLiveCalls(
  client: LiveCallsClient,
  registry: `0x${string}` | null,
  options: { limit?: number; onFlips?: (flips: Flip[], calls: CallView[]) => void } = {},
): LiveCallsState {
  const limit = options.limit ?? 50;
  const onFlips = useRef(options.onFlips);
  onFlips.current = options.onFlips;
  const poll = useBlockPoll(
    client,
    registry === null ? null : `${registry}:latest:${limit}`,
    () => readLatestCalls(client, registry as `0x${string}`, limit),
    (next, previous) => {
      if (previous === null) return;
      const flips = diffCalls(previous.calls, next.calls);
      if (flips.length > 0) onFlips.current?.(flips, next.calls);
    },
  );
  return {
    calls: poll.value?.calls ?? NO_CALLS,
    total: poll.value?.total ?? 0,
    blockNumber: poll.blockNumber,
    loading: poll.loading,
    error: poll.error,
  };
}

/** One call by id, re-read every block (for #/calls/:id when it is not among the newest page). */
export function useLiveCall(
  client: LiveCallsClient,
  registry: `0x${string}` | null,
  id: number,
): { call: CallView | null; loading: boolean; error: string | null } {
  const poll = useBlockPoll(client, registry === null ? null : `${registry}:call:${id}`, async () => {
    const [call] = await readCallsPage(client, registry as `0x${string}`, id, 1);
    return call ?? null;
  });
  return { call: poll.value ?? null, loading: poll.loading, error: poll.error };
}
