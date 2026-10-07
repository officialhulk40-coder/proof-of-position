import { toHex } from "viem";

/** The EIP-1193 surface the app uses. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
}

export interface WalletInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface ProviderDetail {
  info: WalletInfo;
  provider: Eip1193Provider;
}

export const BSC_CHAIN_HEX = "0x38";

const BSC_CHAIN_PARAMS = {
  chainId: BSC_CHAIN_HEX,
  chainName: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: ["https://bsc-dataseed.bnbchain.org"],
  blockExplorerUrls: ["https://bscscan.com"],
};

/** EIP-6963 discovery: ask every injected wallet to announce itself; fall back to window.ethereum. */
export function discoverProviders(target: Window = window, waitMs = 300): Promise<ProviderDetail[]> {
  return new Promise((resolve) => {
    const found = new Map<string, ProviderDetail>();
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<ProviderDetail>).detail;
      if (detail?.info?.uuid && detail.provider) found.set(detail.info.uuid, detail);
    };
    target.addEventListener("eip6963:announceProvider", onAnnounce);
    target.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      target.removeEventListener("eip6963:announceProvider", onAnnounce);
      const providers = [...found.values()];
      const legacy = (target as Window & { ethereum?: Eip1193Provider }).ethereum;
      if (providers.length === 0 && legacy) {
        providers.push({ info: { uuid: "legacy", name: "Browser wallet", icon: "", rdns: "legacy" }, provider: legacy });
      }
      resolve(providers);
    }, waitMs);
  });
}

/** Switches the wallet to BSC mainnet (adding the network when the wallet does not know it: error 4902). */
export async function ensureBsc(provider: Eip1193Provider): Promise<void> {
  const current = await provider.request({ method: "eth_chainId" });
  if (typeof current === "string" && current.toLowerCase() === BSC_CHAIN_HEX) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_CHAIN_HEX }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({ method: "wallet_addEthereumChain", params: [BSC_CHAIN_PARAMS] });
  }
}

export async function connectWallet(provider: Eip1193Provider): Promise<`0x${string}`> {
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const first = Array.isArray(accounts) ? accounts[0] : undefined;
  if (typeof first !== "string") throw new Error("the wallet returned no account");
  await ensureBsc(provider);
  return first.toLowerCase() as `0x${string}`;
}

export interface WalletTx {
  from: string;
  to: string;
  data: string;
  /** Wei, decimal string. */
  value?: string;
  /** Gas limit, decimal string. */
  gas?: string | null;
}

/** eth_sendTransaction on BSC; the wallet shows the transaction and signs it. Returns the tx hash. */
export async function sendTransaction(provider: Eip1193Provider, tx: WalletTx): Promise<`0x${string}`> {
  await ensureBsc(provider);
  const params: Record<string, string> = { from: tx.from, to: tx.to, data: tx.data, value: toHex(BigInt(tx.value ?? "0")) };
  if (tx.gas) params.gas = toHex(BigInt(tx.gas));
  const hash = await provider.request({ method: "eth_sendTransaction", params: [params] });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("the wallet returned no transaction hash");
  return hash as `0x${string}`;
}

/** Wallet errors carry { code, message }; 4001 is the user rejecting the request. */
export function walletErrorMessage(error: unknown): string {
  const { code, message } = (error ?? {}) as { code?: number; message?: string };
  if (code === 4001) return "Request rejected in the wallet.";
  return message ?? String(error);
}
