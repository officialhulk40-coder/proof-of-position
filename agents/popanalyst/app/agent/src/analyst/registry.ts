import { CALL_REGISTRY_ABI, sendWithTransactionApi, type PipelineClient, type TxSigner, type W3wClient } from "@pop/core";
import { encodeFunctionData, parseEventLogs } from "viem";

export interface RegistryWriteDeps {
  w3w: W3wClient;
  client: PipelineClient;
  signer: TxSigner;
  registry: `0x${string}`;
}

/**
 * postAsAgent(token, amount, agentId, note) through the Transaction API pipeline (simulate first: a
 * revert such as "No position, no call." or NotAgentWallet signs nothing). Returns the new call id.
 */
export async function postAsAgent(
  deps: RegistryWriteDeps,
  params: { token: `0x${string}`; amount: bigint; agentId: bigint; note: string },
): Promise<{ callId: number; txHash: `0x${string}` }> {
  const data = encodeFunctionData({ abi: CALL_REGISTRY_ABI, functionName: "postAsAgent", args: [params.token, params.amount, params.agentId, params.note] });
  const result = await sendWithTransactionApi({ w3w: deps.w3w, client: deps.client, signer: deps.signer, tx: { to: deps.registry, data }, mev: false });
  const [event] = parseEventLogs({ abi: CALL_REGISTRY_ABI, eventName: "CallPosted", logs: result.receipt.logs });
  if (!event) throw new Error(`postAsAgent mined in ${result.txHash} but emitted no CallPosted`);
  return { callId: Number(event.args.callId), txHash: result.txHash };
}

/** close(callId): records any pending exit first, then writes the integrity feedback (100 when held through). */
export async function closeCall(deps: RegistryWriteDeps, callId: number): Promise<{ txHash: `0x${string}`; heldThrough: boolean | null }> {
  const data = encodeFunctionData({ abi: CALL_REGISTRY_ABI, functionName: "close", args: [BigInt(callId)] });
  const result = await sendWithTransactionApi({ w3w: deps.w3w, client: deps.client, signer: deps.signer, tx: { to: deps.registry, data }, mev: false });
  const [event] = parseEventLogs({ abi: CALL_REGISTRY_ABI, eventName: "CallClosed", logs: result.receipt.logs });
  return { txHash: result.txHash, heldThrough: event ? event.args.heldThrough : null };
}
