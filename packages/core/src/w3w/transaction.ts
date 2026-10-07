import { z } from "zod";
import { BINANCE_CHAIN_ID } from "../chain/constants";
import type { W3wClient } from "./client";

export interface EvmTx {
  from: string;
  to: string;
  /** Wei, decimal string. */
  value: string;
  data: string;
}

export const simulationSchema = z.object({
  /** "SUCCESS" when the transaction would succeed. */
  status: z.string(),
  failReason: z.string().nullish(),
  balanceChanges: z
    .array(z.object({ contractAddress: z.string(), tokenType: z.string().nullish(), change: z.string(), owner: z.string() }))
    .nullish()
    .transform((value) => value ?? []),
  allowanceChanges: z
    .array(z.object({ tokenAddress: z.string(), owner: z.string(), spender: z.string(), preAmount: z.string(), postAmount: z.string() }))
    .nullish()
    .transform((value) => value ?? []),
});
export type Simulation = z.infer<typeof simulationSchema>;

/** POST /api/v1/dex/pre-transaction/simulate. No state overrides: `from` must already hold the input. */
export function simulateTx(client: W3wClient, tx: EvmTx): Promise<Simulation> {
  return client.post("/api/v1/dex/pre-transaction/simulate", { binanceChainId: BINANCE_CHAIN_ID, evmTx: tx }, simulationSchema);
}

export function isSimulationSuccess(simulation: Simulation): boolean {
  return simulation.status.toUpperCase() === "SUCCESS";
}

/** The revert reason from a failed simulation, e.g. "No position, no call." */
export function simulationFailure(simulation: Simulation): string {
  return simulation.failReason ?? simulation.status;
}

export const broadcastResultSchema = z.object({ orderId: z.string(), txHash: z.string() });
export type BroadcastResult = z.infer<typeof broadcastResultSchema>;

/** POST /api/v1/dex/pre-transaction/broadcast-transaction, optionally through the private (MEV-protected) mempool. */
export function broadcastTx(
  client: W3wClient,
  params: { signedTransaction: string; address: string; enableMevProtection: boolean },
): Promise<BroadcastResult> {
  return client.post(
    "/api/v1/dex/pre-transaction/broadcast-transaction",
    { binanceChainId: BINANCE_CHAIN_ID, ...params },
    broadcastResultSchema,
  );
}

/** GET /api/v1/dex/pre-transaction/gas-price — the legacy "medium" tier in wei. */
export async function getMediumGasPrice(client: W3wClient): Promise<bigint> {
  const data = await client.get(
    "/api/v1/dex/pre-transaction/gas-price",
    { binanceChainId: BINANCE_CHAIN_ID },
    z.object({
      evmLegacyGasPrice: z.object({ lowGasPrice: z.string(), mediumGasPrice: z.string(), highGasPrice: z.string() }).nullish(),
    }),
  );
  if (!data.evmLegacyGasPrice) throw new Error("gas-price returned no legacy EVM tiers");
  return BigInt(data.evmLegacyGasPrice.mediumGasPrice);
}
