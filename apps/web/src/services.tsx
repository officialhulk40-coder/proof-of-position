import { createContext, useContext, type ReactNode } from "react";
import type { PublicClient } from "viem";
import type { ApiClient } from "./api/client";

/** Everything the UI reads from BSC; the real value is the shared viem client, tests pass fakes. */
export type ChainServices = Pick<PublicClient, "readContract" | "watchBlockNumber" | "simulateContract" | "waitForTransactionReceipt">;

export interface Services {
  api: ApiClient;
  chain: ChainServices;
  /** Null until VITE_REGISTRY_ADDRESS is set at build time. */
  registry: `0x${string}` | null;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ value, children }: { value: Services; children: ReactNode }) {
  return <ServicesContext value={value}>{children}</ServicesContext>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("useServices() needs a <ServicesProvider>");
  return services;
}
