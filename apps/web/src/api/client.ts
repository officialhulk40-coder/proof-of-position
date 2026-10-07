import type { Simulation, StatusInfo, TokenInfo } from "@pop/core/browser";

export interface TokenDto extends TokenInfo {
  name: string | null;
  tokenToShareRatio: string | null;
  priceUsd: string | null;
  status: StatusInfo | null;
}

export interface TokensResponse {
  updatedAt: number;
  degraded: { code: number; msg: string } | null;
  tokens: TokenDto[];
}

export interface ExitEvidence {
  kind: "sale" | "contract" | "transfer";
  txHash: string;
  amount: string | null;
  timeMs: number | null;
  priceUsd: string | null;
  volumeUsd: string | null;
  dexName: string | null;
  counterparty: string | null;
  source: "market-api" | "rpc-logs";
}

export interface ExitResponse {
  callId: number;
  status: string;
  evidence: ExitEvidence | null;
}

export interface DryRunRequest {
  from: string;
  to: string;
  data: string;
  value?: string;
}

export interface DryRunResponse {
  success: boolean;
  status: string;
  failReason: string | null;
  balanceChanges: { contractAddress: string; change: string; owner: string }[];
}

export interface FollowRequest {
  token: string;
  usdtAmount: string;
  wallet: string;
}

export interface UnsignedTx {
  from: string;
  to: string;
  data: string;
  value: string;
  gas: string | null;
  gasPrice: string | null;
}

export interface FollowQuoteResponse {
  route: { quoteId: string; vendorName: string; toTokenAmount: string; priceImpactPercent: string | null; approveTarget: string | null };
  toTokenFormatted: string;
}

export type FollowBuildResponse =
  | { next: "approve"; tx: UnsignedTx; simulation: Simulation; spender: string }
  | { next: "swap"; tx: UnsignedTx; simulation: Simulation; toTokenAmount: string; minReceiveAmount: string | null };

/** A failed /api call with the server's { error: { code, msg, hint? } } body. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | number;
  readonly hint: string | null;

  constructor(status: number, code: string | number, message: string, hint: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

export function createApiClient(baseUrl: string, fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}${path}`, init);
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const error = (body as { error?: { code?: string | number; msg?: string; hint?: string | null } } | null)?.error;
      throw new ApiError(response.status, error?.code ?? response.status, error?.msg ?? `HTTP ${response.status}`, error?.hint ?? null);
    }
    return body as T;
  }
  const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return {
    tokens: () => call<TokensResponse>("/api/tokens"),
    exit: (callId: number) => call<ExitResponse>(`/api/calls/${callId}/exit`),
    dryRun: (tx: DryRunRequest) => call<DryRunResponse>("/api/dry-run", post(tx)),
    followQuote: (request: FollowRequest) => call<FollowQuoteResponse>("/api/follow/quote", post(request)),
    followBuild: (request: FollowRequest) => call<FollowBuildResponse>("/api/follow/build", post(request)),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
