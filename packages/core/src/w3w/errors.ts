export interface W3wApiErrorInit {
  code: number;
  msg: string;
  httpStatus: number;
  endpoint: string;
}

/** A Binance Web3 API failure: a non-zero envelope `code`, a non-2xx status, or a non-JSON body. */
export class W3wApiError extends Error {
  readonly code: number;
  readonly msg: string;
  readonly httpStatus: number;
  readonly endpoint: string;

  constructor(init: W3wApiErrorInit) {
    super(`W3W ${init.endpoint} failed: code ${init.code} (HTTP ${init.httpStatus}) ${init.msg}`);
    this.name = "W3wApiError";
    this.code = init.code;
    this.msg = init.msg;
    this.httpStatus = init.httpStatus;
    this.endpoint = init.endpoint;
  }
}

/** Plain-language hints for the codes this project expects to meet (shown next to the verbatim msg). */
export const W3W_ERROR_HINTS: Readonly<Record<number, string>> = {
  40001: "invalid parameters",
  40101: "API key missing, invalid or disabled",
  40102: "signature mismatch — the signed requestPath must include the /build prefix and the raw query",
  40103: "timestamp expired or replayed — check the clock",
  40104: "the API key lacks this module's permission (Trading, Market, Wallet, Transaction)",
  40304: "service not available due to compliance restriction (region / datacenter IP)",
  40369: "bStock RFQ is closed outside US market hours (AMM SWAP routes still trade)",
  40370: "counter token not on the bStock whitelist",
  40374: "insufficient liquidity for this equity token",
  40401: "quote expired (quoteId lives about 30 s)",
  42900: "rate limited",
};

export function describeW3wError(error: W3wApiError): string {
  const hint = W3W_ERROR_HINTS[error.code];
  return hint ? `${error.code} ${error.msg} — ${hint}` : `${error.code} ${error.msg}`;
}
