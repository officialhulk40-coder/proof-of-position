import { z } from "zod";
import { W3W_BASE_URL } from "../chain/constants";
import { W3wApiError } from "./errors";
import { signW3wRequest } from "./sign";

export interface W3wTiming {
  method: "GET" | "POST";
  /** Path without the /build prefix, e.g. /api/v1/dex/market/rwa/tokens */
  endpoint: string;
  httpStatus: number;
  code: number | null;
  msg: string | null;
  ms: number;
}

export type QueryValue = string | number | boolean | undefined;

export interface W3wClientOptions {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Source of X-OC-TIMESTAMP. */
  now?: () => Date;
  /** Monotonic milliseconds for latency measurement. */
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onTiming?: (timing: W3wTiming) => void;
  /** Retries on HTTP 429 (honouring Retry-After). Default 2. */
  maxRetries?: number;
  /** X-OC-RECV-WINDOW in ms. Default 10000 (API max 60000). */
  recvWindowMs?: number;
}

export interface W3wClient {
  get<T>(path: string, query: Record<string, QueryValue>, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T>;
  post<T>(path: string, body: unknown, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T>;
}

const envelopeSchema = z.object({
  code: z.union([z.number(), z.string()]),
  msg: z.string().nullish(),
  data: z.unknown(),
});

/** Query string exactly as sent and signed: skips undefined, encodes with encodeURIComponent, keeps order. */
export function buildQueryString(query: Record<string, QueryValue>): string {
  return Object.entries(query)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

export function createW3wClient(options: W3wClientOptions): W3wClient {
  const baseUrl = options.baseUrl ?? W3W_BASE_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const clock = options.clock ?? (() => performance.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxRetries = options.maxRetries ?? 2;
  const recvWindowMs = options.recvWindowMs ?? 10_000;

  async function request<T>(
    method: "GET" | "POST",
    path: string,
    queryString: string,
    body: string | undefined,
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  ): Promise<T> {
    const requestPath = `/build${path}${queryString ? `?${queryString}` : ""}`;
    for (let attempt = 0; ; attempt++) {
      const timestamp = now().toISOString();
      const headers: Record<string, string> = {
        "X-OC-APIKEY": options.apiKey,
        "X-OC-TIMESTAMP": timestamp,
        "X-OC-SIGN": signW3wRequest({ secret: options.apiSecret, timestamp, method, requestPath, body: body ?? "" }),
        "X-OC-RECV-WINDOW": String(recvWindowMs),
        Accept: "application/json",
      };
      if (body !== undefined) headers["Content-Type"] = "application/json";

      const started = clock();
      const response = await fetchImpl(`${baseUrl}${requestPath}`, { method, headers, body });
      const text = await response.text();
      const ms = Math.round(clock() - started);

      let envelope: z.infer<typeof envelopeSchema> | null = null;
      try {
        const parsed = envelopeSchema.safeParse(JSON.parse(text));
        envelope = parsed.success ? parsed.data : null;
      } catch {
        envelope = null;
      }
      const code = envelope ? Number(envelope.code) : null;
      const msg = envelope?.msg ?? null;
      options.onTiming?.({ method, endpoint: path, httpStatus: response.status, code, msg, ms });

      if (response.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "1");
          await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1) * 1000);
          continue;
        }
        throw new W3wApiError({ code: 42900, msg: msg ?? "rate limited", httpStatus: 429, endpoint: path });
      }
      if (!envelope) {
        throw new W3wApiError({
          code: -1,
          msg: `non-JSON response: ${text.slice(0, 200)}`,
          httpStatus: response.status,
          endpoint: path,
        });
      }
      if (code !== 0 || !response.ok) {
        throw new W3wApiError({ code: code ?? -1, msg: msg ?? `HTTP ${response.status}`, httpStatus: response.status, endpoint: path });
      }
      return schema.parse(envelope.data);
    }
  }

  return {
    get: (path, query, schema) => request("GET", path, buildQueryString(query), undefined, schema),
    post: (path, body, schema) => request("POST", path, "", JSON.stringify(body), schema),
  };
}
