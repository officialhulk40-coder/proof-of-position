/** A deliberate client-facing failure: the root onError turns it into { error: { code, msg } } with `status`. */
export class HttpError extends Error {
  readonly status: 400 | 404 | 409 | 503;
  readonly code: string;

  constructor(status: 400 | 404 | 409 | 503, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}
