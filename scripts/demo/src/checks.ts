import {
  ADDRESSES,
  IDENTITY_REGISTRY_ABI,
  W3wApiError,
  DEFAULT_WATCHLIST,
  formatUnits18,
  getTokenBalances,
  getTokenInfo,
  getTokenTrades,
  readAgentIntegrity,
  requireTokenBySymbol,
  readLatestCalls,
  type RegistryReader,
  type W3wClient,
} from "@pop/core";
import { z } from "zod";

/** `pop-demo status`: the newest calls as one line each, straight from the registry. */
export async function statusLines(deps: { client: RegistryReader; registry: `0x${string}` }, limit = 10): Promise<string[]> {
  const { total, calls } = await readLatestCalls(deps.client, deps.registry, limit);
  const lines = [`${total} calls on ${deps.registry}`];
  for (const call of calls) {
    const symbol = getTokenInfo(call.token)?.symbol ?? call.token;
    const who = call.hasAgent ? `agent #${call.agentId}` : call.caller;
    const exit = call.exitBlock > 0n ? ` · exit recorded at block ${call.exitBlock}` : "";
    lines.push(`#${call.id} ${symbol} ${formatUnits18(call.declaredAmount, 6)} · ${who} · ${call.status}${call.status === "CLOSED" ? (call.heldThrough ? " (held through)" : " (exited while open)") : ""}${exit}`);
  }
  return lines;
}

/** `pop-demo agent`: the ERC-8004 agent's wallet and its integrity score from this registry's feedback. */
export async function agentCheck(deps: { client: RegistryReader; registry: `0x${string}`; agentId: bigint; expectedWallet: `0x${string}` | null }): Promise<{ ok: boolean; lines: string[] }> {
  const wallet = await deps.client.readContract({ address: ADDRESSES.identityRegistry, abi: IDENTITY_REGISTRY_ABI, functionName: "getAgentWallet", args: [deps.agentId] });
  const integrity = await readAgentIntegrity(deps.client, { reputationRegistry: ADDRESSES.reputationRegistry, registry: deps.registry, agentId: deps.agentId });
  const walletOk = wallet !== "0x0000000000000000000000000000000000000000" && (deps.expectedWallet === null || wallet.toLowerCase() === deps.expectedWallet.toLowerCase());
  return {
    ok: walletOk,
    lines: [
      `agent #${deps.agentId} wallet ${wallet}${walletOk ? " ✓" : deps.expectedWallet ? ` ✗ (expected ${deps.expectedWallet})` : " ✗ (unknown agent id)"}`,
      `integrity ${integrity.score === null ? "no feedback yet" : `${integrity.score} over ${integrity.count} call(s)`}`,
    ],
  };
}

/** `pop-demo health`: the deployed feed answers, the server reaches the Web3 API (S1) and the keeper is on. */
export async function healthCheck(feedUrl: string, fetchImpl: typeof fetch = (input, init) => fetch(input, init)): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = [];
  let ok = true;
  const check = (passed: boolean, label: string) => {
    lines.push(`${passed ? "PASS" : "FAIL"} ${label}`);
    ok &&= passed;
  };
  const health = z
    .object({ ok: z.boolean(), chainId: z.number(), registry: z.string(), w3w: z.boolean(), keeper: z.object({ enabled: z.boolean(), address: z.string().nullable() }) })
    .parse(await (await fetchImpl(`${feedUrl}/api/health`)).json());
  check(health.ok && health.chainId === 56, `/api/health ok on chain 56 (registry ${health.registry})`);
  check(health.w3w, "server has Binance Web3 API keys");
  check(health.keeper.enabled, `recordExit keeper on (${health.keeper.address ?? "no address"})`);
  const tokens = z.object({ degraded: z.object({ code: z.number(), msg: z.string() }).nullable(), tokens: z.array(z.unknown()) }).parse(await (await fetchImpl(`${feedUrl}/api/tokens`)).json());
  check(tokens.degraded === null && tokens.tokens.length === 675, tokens.degraded ? `/api/tokens degraded: ${tokens.degraded.code} ${tokens.degraded.msg}` : "S1: signed RWA Data call from the server succeeded (675 tokens enriched)");
  const page = await fetchImpl(`${feedUrl}/`);
  check(page.ok && (await page.text()).includes("<title>Proof of Position</title>"), "feed page served");
  return { ok, lines };
}

/** `pop-demo api get <path> k=v …`: one signed GET, its outcome and latency (DevEx evidence for S1/S3). */
export async function apiGet(w3w: W3wClient, path: string, query: Record<string, string>, clock: () => number = () => performance.now()): Promise<string[]> {
  const started = clock();
  try {
    const data = await w3w.get(path, query, z.unknown());
    const ms = Math.round(clock() - started);
    return [`GET ${path} → code 0 in ${ms} ms`, JSON.stringify(data).slice(0, 600)];
  } catch (error) {
    const ms = Math.round(clock() - started);
    if (error instanceof W3wApiError) return [`GET ${path} → code ${error.code} (HTTP ${error.httpStatus}) in ${ms} ms: ${error.msg}`];
    throw error;
  }
}

/** `pop-demo balances`: a wallet's USDT and watchlist bStocks through the Wallet API (shown before a post in the demo). */
export async function balanceLines(w3w: W3wClient, wallet: `0x${string}`): Promise<string[]> {
  const tokens = [ADDRESSES.usdt, ...DEFAULT_WATCHLIST.map((symbol) => requireTokenBySymbol(symbol).address)];
  const assets = await getTokenBalances(w3w, { address: wallet, tokens });
  if (assets.length === 0) return [`${wallet} holds none of USDT, ${DEFAULT_WATCHLIST.join(", ")}`];
  return assets.map((asset) => `${asset.symbol ?? getTokenInfo(asset.tokenContractAddress)?.symbol ?? asset.tokenContractAddress} ${asset.balance}${asset.tokenPrice ? ` (@ $${asset.tokenPrice})` : ""}`);
}

/** `pop-demo trades`: the Market API's view of one wallet's trades of a token (S2 indexing lag). */
export async function tradesLines(w3w: W3wClient, token: `0x${string}`, wallet: `0x${string}`, nowMs: number): Promise<string[]> {
  const page = await getTokenTrades(w3w, { token, wallets: [wallet], limit: 5 });
  if (page.trades.length === 0) return [`no trades indexed yet for ${wallet} on ${token}`];
  return page.trades.map((trade) => `${trade.type} ${trade.changedTokenInfo[0]?.amount ?? "?"} · ${trade.dexName ?? "DEX"} · tx ${trade.txHash} · ${new Date(trade.time).toISOString()} (${Math.round((nowMs - trade.time) / 1000)} s ago)`);
}
