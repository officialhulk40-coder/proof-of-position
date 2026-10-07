/** BSC mainnet, the only chain this project touches. */
export const BSC_CHAIN_ID = 56;

/** The Binance Web3 API's chain id parameter for BSC (a string). */
export const BINANCE_CHAIN_ID = "56";

/** Binance Web3 API host; every path is signed and sent as /build/api/v1/... */
export const W3W_BASE_URL = "https://web3.binance.com";

/** Official public BSC RPC endpoints (CORS-enabled; no eth_getLogs, no historical state). */
export const DEFAULT_BSC_RPC_URLS: readonly string[] = [
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
];

/** A public RPC that serves eth_getLogs for recent blocks (used for exit evidence). */
export const DEFAULT_LOGS_RPC_URL = "https://bsc-rpc.publicnode.com";

/** Mainnet addresses (EIP-55 checksums verified 2026-10-06/07). */
export const ADDRESSES = {
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  usdt: "0x55d398326f99059fF775485246999027B3197955",
  usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  u: "0xcE24439F2D9C6a2289F741120FE202248B666666",
  usd1: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d",
  binanceAggregatorRouter: "0xB44446b0c8E56988c34f7Ff73Ae904982b5FdDA5",
} as const satisfies Record<string, `0x${string}`>;

/** Splits a comma-separated RPC list (e.g. the BSC_RPC_URLS env var); empty input → the official endpoints. */
export function parseRpcUrls(value: string | undefined): string[] {
  const urls = (value ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return urls.length > 0 ? urls : [...DEFAULT_BSC_RPC_URLS];
}
