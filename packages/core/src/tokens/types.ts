export type Issuer = "bStocks" | "Ondo" | "xStocks";

/** How CallRegistry measures a position: raw balanceOf (PLAIN) or non-rebasing sharesOf (XSTOCK). */
export type ListedModel = "PLAIN" | "XSTOCK";

export interface TokenInfo {
  /** Lower-case address, as in the pack CSV. */
  address: `0x${string}`;
  symbol: string;
  ticker: string;
  issuer: Issuer;
  model: ListedModel;
  /** 1 = Stock, 2 = Pre-IPO, 3 = ETF; null when the registry has no value. */
  assetType: 1 | 2 | 3 | null;
}
