import { isOfflineOrTimeoutError } from "./errors";

export type ApiResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  status: number;
  bodyText: string;
};

export class ShipstampApiError extends Error {
  readonly status: number;
  readonly bodyText: string;

  constructor(message: string, status: number, bodyText: string) {
    super(message);
    this.name = "ShipstampApiError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

export type ShipstampApiClientOptions = {
  baseUrl: string;
  token: string;
  timeoutMs: number;
};

export class ShipstampApiClient {
  private baseUrl: string;
  private token: string;
  private timeoutMs: number;

  constructor(opts: ShipstampApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
    this.timeoutMs = opts.timeoutMs;
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify(body),
        signal: ac.signal
      });

      const text = await res.text();
      if (!res.ok) {
        // v0 policy: treat 5xx as transient (unchecked), but surface 4xx as hard failures.
        if (res.status >= 500) {
          const e = new Error(`Shipstamp API error (${res.status})`) as any;
          e.name = "ShipstampServerError";
          e.code = "ESHIPSTAMP_SERVER";
          e.status = res.status;
          e.bodyText = text;
          throw e;
        }

        throw new ShipstampApiError(`Shipstamp API error (${res.status})`, res.status, text);
      }

      return JSON.parse(text) as T;
    } catch (err) {
      // Normalize AbortError and other network-ish failures for unchecked policy.
      if (isOfflineOrTimeoutError(err)) {
        const e = err as Error;
        (e as any).code = (e as any).code ?? "ETIMEDOUT";
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
  }
}
