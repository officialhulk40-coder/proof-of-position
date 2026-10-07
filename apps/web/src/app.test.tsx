import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { createApiClient } from "./api/client";
import { catalogOnly } from "./api/useTokens";
import { fakeChain, fakeFetch, NVDAB_DTO, rawCall, renderWithServices, testServices } from "./testing";
import { WalletProvider } from "./wallet/useWallet";

function goTo(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

afterEach(() => {
  goTo("#/");
  window.localStorage.clear();
});

function setup() {
  let status = 0;
  let emit: (block: bigint) => void = () => {};
  const chain = fakeChain({
    readContract: async (request: { functionName: string }) => {
      if (request.functionName === "callCount") return 1n;
      if (request.functionName === "getCalls") return [[rawCall({ note: "AI capex keeps compounding" })], [status]];
      throw new Error(request.functionName);
    },
    watchBlockNumber: (options: { onBlockNumber: (block: bigint) => void }) => {
      emit = options.onBlockNumber;
      emit(100n);
      return () => {};
    },
  });
  const tokens = [...catalogOnly().values()].map((token) => (token.address === NVDAB_DTO.address ? NVDAB_DTO : token));
  const api = createApiClient(
    "",
    fakeFetch({
      "GET /api/tokens": () => ({ body: { updatedAt: 1, degraded: null, tokens } }),
      "GET /api/calls/0/exit": () => ({ body: { callId: 0, status: "EXITED", evidence: null } }),
    }),
  );
  renderWithServices(
    <WalletProvider discover={async () => []}>
      <App />
    </WalletProvider>,
    testServices({ api, chain }),
  );
  return {
    flip: async (next: number, block: bigint) => {
      status = next;
      await act(async () => emit(block));
    },
  };
}

describe("App", () => {
  it("renders the live feed and flips a badge with a toast", async () => {
    goTo("#/");
    const { flip } = setup();
    await waitFor(() => expect(screen.getByTestId("badge-0").textContent).toBe("HOLDING ✓verified on-chain"));
    expect(screen.getByRole("heading", { level: 2, name: "LONG NVIDIA · 0.02 shares · bStocks" })).toBeTruthy();
    expect(screen.getByText(/Live from BSC · block 100 · 1 calls/)).toBeTruthy();
    await flip(2, 101n);
    await waitFor(() => expect(screen.getByTestId("badge-0").textContent).toBe("EXITEDno longer holds it"));
    expect(screen.getByText("Call #0 · NVIDIA: the caller exited. Badge is now EXITED.")).toBeTruthy();
    expect(screen.getByTestId("call-0").className).toBe("card flash");
  });

  it("opens the follow modal from a card", async () => {
    goTo("#/");
    setup();
    fireEvent.click(await screen.findByText("Follow with USDT"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Follow call #0 · NVIDIA")).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("routes to the call, post and how pages", async () => {
    goTo("#/calls/0");
    setup();
    await waitFor(() => expect(screen.getByText("On-chain record")).toBeTruthy());
    goTo("#/post");
    expect(screen.getByRole("heading", { level: 1, name: "Post a call" })).toBeTruthy();
    goTo("#/how");
    expect(screen.getByRole("heading", { level: 1, name: "How Proof of Position works" })).toBeTruthy();
    goTo("#/nope");
    expect(screen.getByText(/Page not found/)).toBeTruthy();
    expect(screen.getByText("A badge proves the BSC position, not hedges held elsewhere.")).toBeTruthy();
  });
});
