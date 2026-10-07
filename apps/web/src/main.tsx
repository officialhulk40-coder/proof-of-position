import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createApiClient } from "./api/client";
import { getChainClient } from "./chain/client";
import { config } from "./config";
import { ServicesProvider } from "./services";
import "./styles.css";
import { WalletProvider } from "./wallet/useWallet";

const container = document.getElementById("root");
if (!container) throw new Error("index.html is missing #root");

createRoot(container).render(
  <StrictMode>
    <ServicesProvider value={{ api: createApiClient(config.apiBase), chain: getChainClient(), registry: config.registry }}>
      <WalletProvider>
        <App />
      </WalletProvider>
    </ServicesProvider>
  </StrictMode>,
);
