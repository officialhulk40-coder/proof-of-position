import { parseTransaction, recoverTransactionAddress, type TransactionReceipt } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { createFakeW3wClient, type RecordedCall } from "../w3w/testing";
import {
  SimulationFailedError,
  sendWithTransactionApi,
  viemAccountSigner,
  walletProviderSigner,
  type LegacyTxRequest,
  type PipelineClient,
  type TxSigner,
} from "./pipeline";

const REGISTRY = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const ME = "0x1111111111111111111111111111111111111111";
const TX_HASH = "0x1f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a79881f2e3d4c5b6a7988";

function fakeChain(status: "success" | "reverted" = "success") {
  const seen: string[] = [];
  const client = {
    async getTransactionCount() {
      seen.push("nonce");
      return 7;
    },
    async getGasPrice() {
      seen.push("gasPrice");
      return 100_000_000n;
    },
    async estimateGas() {
      seen.push("estimateGas");
      return 100_000n;
    },
    async waitForTransactionReceipt({ hash }: { hash: `0x${string}` }) {
      seen.push("receipt");
      return { status, transactionHash: hash, blockNumber: 126_200_000n } as unknown as TransactionReceipt;
    },
  } as unknown as PipelineClient;
  return { client, seen };
}

function recordingSigner(): { signer: TxSigner; requests: LegacyTxRequest[] } {
  const requests: LegacyTxRequest[] = [];
  return {
    requests,
    signer: {
      address: ME,
      async signTransaction(tx) {
        requests.push(tx);
        return "0xf86c0a";
      },
    },
  };
}

function apiAnswering(simulationStatus: string, failReason: string | null = null) {
  return createFakeW3wClient((call: RecordedCall) => {
    if (call.path === "/api/v1/dex/pre-transaction/simulate") return { status: simulationStatus, failReason, balanceChanges: [], allowanceChanges: [] };
    if (call.path === "/api/v1/dex/pre-transaction/broadcast-transaction") return { orderId: "1812345678901234567", txHash: TX_HASH };
    throw new Error(`unexpected ${call.path}`);
  });
}

describe("sendWithTransactionApi", () => {
  it("simulates, signs a legacy chain-56 tx, broadcasts with MEV and waits for the receipt", async () => {
    const { client: w3w, calls } = apiAnswering("SUCCESS");
    const { client, seen } = fakeChain();
    const { signer, requests } = recordingSigner();
    let tick = 0;
    const result = await sendWithTransactionApi({
      w3w,
      client,
      signer,
      tx: { to: REGISTRY, data: "0xcfcf5eb9" },
      mev: true,
      clock: () => (tick += 100),
    });
    expect(calls[0]).toEqual({
      method: "POST",
      path: "/api/v1/dex/pre-transaction/simulate",
      body: { binanceChainId: "56", evmTx: { from: ME, to: REGISTRY, value: "0", data: "0xcfcf5eb9" } },
    });
    expect(requests).toEqual([{ chainId: 56, nonce: 7, to: REGISTRY, data: "0xcfcf5eb9", value: 0n, gas: 120_000n, gasPrice: 100_000_000n }]);
    expect(calls[1]?.body).toEqual({ binanceChainId: "56", signedTransaction: "0xf86c0a", address: ME, enableMevProtection: true });
    expect(seen).toEqual(["nonce", "gasPrice", "estimateGas", "receipt"]);
    expect(result.txHash).toBe(TX_HASH);
    expect(result.orderId).toBe("1812345678901234567");
    expect(result.timings).toEqual({ simulateMs: 100, broadcastMs: 100, confirmMs: 100 });
  });

  it("uses explicit gas and gasPrice without asking the chain", async () => {
    const { client: w3w } = apiAnswering("SUCCESS");
    const { client, seen } = fakeChain();
    const { signer, requests } = recordingSigner();
    await sendWithTransactionApi({ w3w, client, signer, tx: { to: REGISTRY, data: "0x", value: 5n, gas: 250_000n, gasPrice: 50_000_000n }, mev: false });
    expect(requests[0]).toMatchObject({ gas: 250_000n, gasPrice: 50_000_000n, value: 5n });
    expect(seen).toEqual(["nonce", "receipt"]);
  });

  it("never signs when the simulation fails, and reports the revert reason", async () => {
    const { client: w3w, calls } = apiAnswering("FAILED", "execution reverted: No position, no call.");
    const { client } = fakeChain();
    const { signer, requests } = recordingSigner();
    const error = await sendWithTransactionApi({ w3w, client, signer, tx: { to: REGISTRY, data: "0xcfcf5eb9" }, mev: true }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SimulationFailedError);
    expect((error as SimulationFailedError).reason).toBe("execution reverted: No position, no call.");
    expect(requests).toHaveLength(0);
    expect(calls).toHaveLength(1);
  });

  it("fails loudly when the mined transaction reverted", async () => {
    const { client: w3w } = apiAnswering("SUCCESS");
    const { client } = fakeChain("reverted");
    const { signer } = recordingSigner();
    await expect(sendWithTransactionApi({ w3w, client, signer, tx: { to: REGISTRY, data: "0x" }, mev: false })).rejects.toThrow("reverted on chain");
  });
});

describe("signers", () => {
  it("viemAccountSigner produces a valid legacy chain-56 transaction from the account", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const signer = viemAccountSigner(account);
    const raw = await signer.signTransaction({ chainId: 56, nonce: 3, to: REGISTRY, data: "0xcfcf5eb9", value: 0n, gas: 120_000n, gasPrice: 100_000_000n });
    const parsed = parseTransaction(raw);
    expect(parsed.type).toBe("legacy");
    expect(parsed.chainId).toBe(56);
    expect(parsed.nonce).toBe(3);
    expect(await recoverTransactionAddress({ serializedTransaction: raw as Parameters<typeof recoverTransactionAddress>[0]["serializedTransaction"] })).toBe(account.address);
  });

  it("walletProviderSigner returns the SDK wallet's rawTransaction", async () => {
    const seen: LegacyTxRequest[] = [];
    const signer = walletProviderSigner({
      address: ME,
      async signTransaction(tx) {
        seen.push(tx);
        return { rawTransaction: "0xf86b01" };
      },
    });
    const tx = { chainId: 56, nonce: 1, to: REGISTRY as `0x${string}`, data: "0x" as `0x${string}`, value: 0n, gas: 21_000n, gasPrice: 1n };
    await expect(signer.signTransaction(tx)).resolves.toBe("0xf86b01");
    expect(seen).toEqual([tx]);
    expect(signer.address).toBe(ME);
  });
});
