import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../api/client";
import { callView, fakeChain, fakeFetch, NVDAB, NVDAB_DTO, renderWithServices, testServices } from "../testing";
import type { Eip1193Provider, ProviderDetail } from "../wallet/eip6963";
import { WalletProvider } from "../wallet/useWallet";
import { FollowModal } from "./FollowModal";

const FOLLOWER = "0x3333333333333333333333333333333333333333";

function wallet(sent: unknown[]): () => Promise<ProviderDetail[]> {
  const provider: Eip1193Provider = {
    async request({ method, params }) {
      if (method === "eth_requestAccounts") return [FOLLOWER];
      if (method === "eth_chainId") return "0x38";
      if (method === "eth_sendTransaction") {
        sent.push(params);
        return `0x${String(sent.length).padStart(64, "0")}`;
      }
      throw new Error(method);
    },
  };
  return async () => [{ info: { uuid: "w", name: "Test Wallet", icon: "", rdns: "test" }, provider }];
}

const tx = (to: string, data: string) => ({ from: FOLLOWER, to, data, value: "0", gas: "60000", gasPrice: null });
const okSimulation = { status: "SUCCESS", failReason: null, balanceChanges: [], allowanceChanges: [] };

describe("FollowModal", () => {
  it("asks for the restricted-persons confirmation, then approves and swaps", async () => {
    let builds = 0;
    const api = createApiClient(
      "",
      fakeFetch({
        "POST /api/follow/quote": () => ({
          body: { route: { quoteId: "q1", vendorName: "PancakeSwap", toTokenAmount: "5300000000000000", priceImpactPercent: "0.1", approveTarget: null }, toTokenFormatted: "0.0053" },
        }),
        "POST /api/follow/build": (body) => {
          expect(body).toEqual({ token: NVDAB, usdtAmount: "1", wallet: FOLLOWER });
          builds += 1;
          return builds === 1
            ? { body: { next: "approve", tx: tx("0x55d398326f99059ff775485246999027b3197955", "0xapprove"), simulation: okSimulation, spender: "0xrouter" } }
            : { body: { next: "swap", tx: tx("0xrouter", "0xswap"), simulation: okSimulation, toTokenAmount: "5300000000000000", minReceiveAmount: "5247000000000000" } };
        },
      }),
    );
    const chain = fakeChain({
      waitForTransactionReceipt: async () => ({ status: "success", logs: [] }),
      readContract: async (request: { functionName: string; args: readonly unknown[] }) => {
        expect(request).toMatchObject({ functionName: "balanceOf", args: [FOLLOWER] });
        return 5_300_000_000_000_000n;
      },
    });
    const sent: unknown[] = [];
    renderWithServices(
      <WalletProvider discover={wallet(sent)}>
        <FollowModal call={callView(3)} token={NVDAB_DTO} onClose={() => {}} />
      </WalletProvider>,
      testServices({ api, chain }),
    );
    fireEvent.click(await screen.findByText("Connect Test Wallet"));
    const buy = await screen.findByText("Buy NVIDIA with 1 USDT");
    expect((buy as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect((buy as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(buy);
    await waitFor(() => expect(screen.getByText(/You hold 0.0053 NVIDIA shares alongside them/)).toBeTruthy());
    expect(screen.getByText("Quote: ≈ 0.0053 NVDAB for 1 USDT via PancakeSwap")).toBeTruthy();
    expect(sent.map((params) => (params as Array<{ data: string }>)[0]?.data)).toEqual(["0xapprove", "0xswap"]);
  });

  it("shows why a follow is unavailable", async () => {
    const api = createApiClient(
      "",
      fakeFetch({
        "POST /api/follow/quote": () => ({ status: 409, body: { error: { code: "NO_SWAP_ROUTE", msg: "no SWAP route right now (only RFQ, which closes outside US market hours)" } } }),
      }),
    );
    renderWithServices(
      <WalletProvider discover={wallet([])}>
        <FollowModal call={callView(3)} token={NVDAB_DTO} onClose={() => {}} />
      </WalletProvider>,
      testServices({ api }),
    );
    fireEvent.click(await screen.findByText("Connect Test Wallet"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(await screen.findByText("Buy NVIDIA with 1 USDT"));
    await waitFor(() => expect(screen.getByText("no SWAP route right now (only RFQ, which closes outside US market hours)")).toBeTruthy());
  });
});
