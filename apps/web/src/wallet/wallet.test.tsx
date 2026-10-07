import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { connectWallet, discoverProviders, ensureBsc, sendTransaction, walletErrorMessage, type Eip1193Provider, type ProviderDetail } from "./eip6963";
import { WalletButton, WalletProvider } from "./useWallet";

const ACCOUNT = "0xAbCdEf0000000000000000000000000000000001";

function fakeProvider(options: { chainId?: string; unknownChain?: boolean; reject?: boolean } = {}) {
  const calls: Array<{ method: string; params?: unknown }> = [];
  let chainId = options.chainId ?? "0x38";
  const provider: Eip1193Provider = {
    async request({ method, params }) {
      calls.push({ method, params });
      if (options.reject) throw { code: 4001, message: "User rejected the request." };
      switch (method) {
        case "eth_requestAccounts":
          return [ACCOUNT];
        case "eth_chainId":
          return chainId;
        case "wallet_switchEthereumChain":
          if (options.unknownChain) throw { code: 4902, message: "Unrecognized chain ID" };
          chainId = "0x38";
          return null;
        case "wallet_addEthereumChain":
          chainId = "0x38";
          return null;
        case "eth_sendTransaction":
          return "0xfeed";
        default:
          throw new Error(method);
      }
    },
  };
  return { provider, calls };
}

describe("eip6963", () => {
  it("collects announced wallets", async () => {
    const { provider } = fakeProvider();
    const detail: ProviderDetail = { info: { uuid: "u1", name: "Binance Wallet", icon: "", rdns: "com.binance.wallet" }, provider };
    const onRequest = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
    window.addEventListener("eip6963:requestProvider", onRequest);
    const found = await discoverProviders(window, 10);
    window.removeEventListener("eip6963:requestProvider", onRequest);
    expect(found.map((d) => d.info.name)).toEqual(["Binance Wallet"]);
  });

  it("switches to BSC, adding it when the wallet does not know it", async () => {
    const switching = fakeProvider({ chainId: "0x1" });
    await ensureBsc(switching.provider);
    expect(switching.calls.map((c) => c.method)).toEqual(["eth_chainId", "wallet_switchEthereumChain"]);
    const adding = fakeProvider({ chainId: "0x1", unknownChain: true });
    await ensureBsc(adding.provider);
    expect(adding.calls.map((c) => c.method)).toEqual(["eth_chainId", "wallet_switchEthereumChain", "wallet_addEthereumChain"]);
  });

  it("connects and sends hex-encoded transactions", async () => {
    const { provider, calls } = fakeProvider();
    expect(await connectWallet(provider)).toBe(ACCOUNT.toLowerCase());
    expect(await sendTransaction(provider, { from: ACCOUNT, to: "0x2", data: "0xabcd", value: "0", gas: "21000" })).toBe("0xfeed");
    expect(calls.at(-1)).toEqual({ method: "eth_sendTransaction", params: [{ from: ACCOUNT, to: "0x2", data: "0xabcd", value: "0x0", gas: "0x5208" }] });
  });

  it("explains rejections", () => {
    expect(walletErrorMessage({ code: 4001, message: "User rejected" })).toBe("Request rejected in the wallet.");
    expect(walletErrorMessage(new Error("boom"))).toBe("boom");
  });
});

describe("WalletProvider", () => {
  it("connects through the button", async () => {
    const { provider } = fakeProvider();
    const detail: ProviderDetail = { info: { uuid: "u1", name: "Binance Wallet", icon: "", rdns: "com.binance.wallet" }, provider };
    const discover = async () => [detail];
    render(
      <WalletProvider discover={discover}>
        <WalletButton />
      </WalletProvider>,
    );
    fireEvent.click(await screen.findByText("Connect Binance Wallet"));
    await waitFor(() => expect(screen.getByText(/0xabcd…0001/).textContent).toBe("Binance Wallet · 0xabcd…0001 · BSC"));
  });

  it("shows wallet errors", async () => {
    const { provider } = fakeProvider({ reject: true });
    const detail: ProviderDetail = { info: { uuid: "u2", name: "Rabby", icon: "", rdns: "io.rabby" }, provider };
    const discover = async () => [detail];
    render(
      <WalletProvider discover={discover}>
        <WalletButton />
      </WalletProvider>,
    );
    fireEvent.click(await screen.findByText("Connect Rabby"));
    await waitFor(() => expect(screen.getByText("Request rejected in the wallet.")).toBeTruthy());
  });
});
