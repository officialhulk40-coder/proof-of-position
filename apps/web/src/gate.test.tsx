import { CALL_REGISTRY_ABI, requireTokenBySymbol } from "@pop/core/browser";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { encodeAbiParameters, encodeErrorResult, encodeEventTopics, ContractFunctionRevertedError, parseAbi } from "viem";
import { describe, expect, it } from "vitest";
import { createApiClient } from "./api/client";
import { catalogOnly } from "./api/useTokens";
import { TryTheGate } from "./components/TryTheGate";
import { dryRunPost, encodePost, GATE_PROBE_ADDRESS, revertReason } from "./gate";
import { PostPage } from "./pages/PostPage";
import { CALLER, fakeChain, fakeFetch, NVDAB, renderWithServices, TEST_REGISTRY, testServices } from "./testing";
import type { Eip1193Provider, ProviderDetail } from "./wallet/eip6963";
import { WalletProvider } from "./wallet/useWallet";

const ERROR_STRING = parseAbi(["error Error(string)"]);

function gateRevert(): ContractFunctionRevertedError {
  const data = encodeErrorResult({ abi: ERROR_STRING, errorName: "Error", args: ["No position, no call."] });
  return new ContractFunctionRevertedError({ abi: CALL_REGISTRY_ABI, data, functionName: "post" });
}

const unavailable = createApiClient("", fakeFetch({ "POST /api/dry-run": () => ({ status: 503, body: { error: { code: "W3W_NOT_CONFIGURED", msg: "not configured" } } }) }));

describe("dryRunPost", () => {
  const args = { registry: TEST_REGISTRY, from: GATE_PROBE_ADDRESS, token: NVDAB, amount: 10n ** 16n, note: "x" } as const;

  it("uses the Transaction API simulate through the server", async () => {
    let sent: unknown = null;
    const api = createApiClient(
      "",
      fakeFetch({
        "POST /api/dry-run": (body) => {
          sent = body;
          return { body: { success: false, status: "FAILED", failReason: "No position, no call.", balanceChanges: [] } };
        },
      }),
    );
    const result = await dryRunPost(api, fakeChain(), args);
    expect(result).toEqual({ ok: false, reason: "No position, no call.", via: "Binance Transaction API simulate" });
    expect(sent).toEqual({ from: GATE_PROBE_ADDRESS, to: TEST_REGISTRY, data: encodePost(NVDAB, 10n ** 16n, "x") });
  });

  it("falls back to an RPC eth_call when the server cannot simulate", async () => {
    const chain = fakeChain({
      simulateContract: async () => {
        throw gateRevert();
      },
    });
    expect(await dryRunPost(unavailable, chain, args)).toEqual({ ok: false, reason: "No position, no call.", via: "BSC eth_call" });
    const ok = fakeChain({ simulateContract: async () => ({ result: 0n }) });
    expect(await dryRunPost(unavailable, ok, args)).toEqual({ ok: true, reason: null, via: "BSC eth_call" });
  });

  it("names custom errors with their arguments", () => {
    const data = encodeErrorResult({ abi: CALL_REGISTRY_ABI, errorName: "NoteTooLong", args: [300n] });
    expect(revertReason(new ContractFunctionRevertedError({ abi: CALL_REGISTRY_ABI, data, functionName: "post" }))).toBe("NoteTooLong(300)");
    expect(revertReason(new Error("socket hang up"))).toBe("socket hang up");
  });
});

describe("TryTheGate", () => {
  it("shows the contract's revert reason without a wallet", async () => {
    const chain = fakeChain({
      simulateContract: async (request: { account: string; args: readonly unknown[] }) => {
        expect(request.account).toBe(GATE_PROBE_ADDRESS);
        expect(request.args[0]).toBe(requireTokenBySymbol("TSLAB").address);
        throw gateRevert();
      },
    });
    renderWithServices(<TryTheGate />, testServices({ api: unavailable, chain }));
    fireEvent.click(screen.getByText("Try to post without holding"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Reverted: “No position, no call.” · via BSC eth_call"));
  });
});

describe("PostPage", () => {
  function walletWith(sent: unknown[]): () => Promise<ProviderDetail[]> {
    const provider: Eip1193Provider = {
      async request({ method, params }) {
        if (method === "eth_requestAccounts") return [CALLER];
        if (method === "eth_chainId") return "0x38";
        if (method === "eth_sendTransaction") {
          sent.push(params);
          return "0xbeef";
        }
        throw new Error(method);
      },
    };
    return async () => [{ info: { uuid: "w", name: "Test Wallet", icon: "", rdns: "test" }, provider }];
  }

  it("dry-runs, then posts and links the new call", async () => {
    const sent: unknown[] = [];
    const topics = encodeEventTopics({ abi: CALL_REGISTRY_ABI, eventName: "CallPosted", args: { callId: 12n, caller: CALLER, token: NVDAB } });
    const data = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "bool" }, { type: "string" }],
      [20_000_000_000_000_000n, 0n, false, "AI capex"],
    );
    const chain = fakeChain({
      simulateContract: async () => ({ result: 12n }),
      waitForTransactionReceipt: async () => ({ status: "success", logs: [{ address: TEST_REGISTRY, topics, data, blockNumber: 1n, logIndex: 0, transactionHash: "0xbeef" }] }),
    });
    const discover = walletWith(sent);
    renderWithServices(
      <WalletProvider discover={discover}>
        <PostPage tokens={{ byAddress: catalogOnly(), degraded: null }} />
      </WalletProvider>,
      testServices({ api: unavailable, chain }),
    );
    fireEvent.click(await screen.findByText("Connect Test Wallet"));
    await screen.findByText(/Test Wallet · 0x1111…1111/);
    fireEvent.change(screen.getByRole("textbox", { name: /Thesis/ }), { target: { value: "AI capex" } });
    fireEvent.click(screen.getByText("Dry-run"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Simulation succeeded/));
    fireEvent.click(screen.getByText("Post on-chain"));
    await waitFor(() => expect(screen.getByText("view call #12").getAttribute("href")).toBe("#/calls/12"));
    expect(sent).toEqual([[{ from: CALLER, to: TEST_REGISTRY, data: encodePost(NVDAB, 20_000_000_000_000_000n, "AI capex"), value: "0x0" }]]);
  });

  it("never asks the wallet to sign a call that would revert", async () => {
    const sent: unknown[] = [];
    const chain = fakeChain({
      simulateContract: async () => {
        throw gateRevert();
      },
    });
    renderWithServices(
      <WalletProvider discover={walletWith(sent)}>
        <PostPage tokens={{ byAddress: catalogOnly(), degraded: null }} />
      </WalletProvider>,
      testServices({ api: unavailable, chain }),
    );
    fireEvent.click(await screen.findByText("Connect Test Wallet"));
    await screen.findByText(/Test Wallet · 0x1111…1111/);
    fireEvent.click(screen.getByText("Post on-chain"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/No position, no call\./));
    expect(sent).toEqual([]);
  });
});
