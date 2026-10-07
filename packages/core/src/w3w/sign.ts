import { createHmac } from "node:crypto";

export interface W3wSignInput {
  secret: string;
  /** Exactly the X-OC-TIMESTAMP header value, ISO 8601 with milliseconds. */
  timestamp: string;
  method: string;
  /** Path as sent on the wire, including the /build prefix and the raw query string. */
  requestPath: string;
  /** Raw request body for POST; "" for GET. */
  body: string;
}

/**
 * X-OC-SIGN = Base64(HMAC-SHA256(timestamp + METHOD + requestPath + body, secret)).
 * The #1 cause of `40102 Invalid signature` is signing a path without the /build prefix, so it is enforced.
 */
export function signW3wRequest(input: W3wSignInput): string {
  if (!input.requestPath.startsWith("/build/")) {
    throw new Error(`requestPath must start with /build/: ${input.requestPath}`);
  }
  const preHash = `${input.timestamp}${input.method.toUpperCase()}${input.requestPath}${input.body}`;
  return createHmac("sha256", input.secret).update(preHash, "utf8").digest("base64");
}
