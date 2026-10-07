import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { connectWallet, discoverProviders, sendTransaction, walletErrorMessage, type ProviderDetail, type WalletTx } from "./eip6963";

export interface WalletState {
  providers: ProviderDetail[];
  /** Lower-case connected address, or null. */
  address: `0x${string}` | null;
  walletName: string | null;
  error: string | null;
  connect: (detail: ProviderDetail) => Promise<void>;
  /** Sends from the connected address; throws when no wallet is connected. */
  send: (tx: Omit<WalletTx, "from">) => Promise<`0x${string}`>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children, discover = discoverProviders }: { children: ReactNode; discover?: () => Promise<ProviderDetail[]> }) {
  const [providers, setProviders] = useState<ProviderDetail[]>([]);
  const [active, setActive] = useState<{ detail: ProviderDetail; address: `0x${string}` } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void discover().then((list) => {
      if (!cancelled) setProviders(list);
    });
    return () => {
      cancelled = true;
    };
  }, [discover]);

  const connect = useCallback(async (detail: ProviderDetail) => {
    setError(null);
    try {
      setActive({ detail, address: await connectWallet(detail.provider) });
    } catch (cause) {
      setError(walletErrorMessage(cause));
    }
  }, []);

  const send = useCallback(
    async (tx: Omit<WalletTx, "from">) => {
      if (!active) throw new Error("Connect a wallet first.");
      try {
        return await sendTransaction(active.detail.provider, { ...tx, from: active.address });
      } catch (cause) {
        throw new Error(walletErrorMessage(cause));
      }
    },
    [active],
  );

  const value = useMemo<WalletState>(
    () => ({ providers, address: active?.address ?? null, walletName: active?.detail.info.name ?? null, error, connect, send }),
    [providers, active, error, connect, send],
  );
  return <WalletContext value={value}>{children}</WalletContext>;
}

export function useWallet(): WalletState {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWallet() needs a <WalletProvider>");
  return wallet;
}

export function WalletButton() {
  const wallet = useWallet();
  if (wallet.address) {
    return (
      <span className="wallet">
        {wallet.walletName} · {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)} · BSC
      </span>
    );
  }
  return (
    <span className="wallet">
      {wallet.providers.length === 0 && <span className="muted">No browser wallet found</span>}
      {wallet.providers.map((detail) => (
        <button type="button" key={detail.info.uuid} onClick={() => void wallet.connect(detail)}>
          Connect {detail.info.name}
        </button>
      ))}
      {wallet.error && <span className="error"> {wallet.error}</span>}
    </span>
  );
}
