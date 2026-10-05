/**
 * Shared HTTP helper for food providers: per-request timeout, limited retries with
 * exponential backoff on 429/5xx/network errors (honouring Retry-After) and a token-bucket
 * rate limiter per upstream endpoint. No `server-only` import: scripts use it too.
 */
import type { RateLimit } from "./config";

export type SleepFn = (ms: number, signal?: AbortSignal) => Promise<void>;

export const sleep: SleepFn = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Classic token bucket: `capacity` tokens, refilled continuously at requests/perMs.
 * `take()` waits until a token is available (FIFO-ish via the shared clock).
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly limit: RateLimit,
    private readonly now: () => number = () => Date.now(),
    private readonly sleepFn: SleepFn = sleep,
  ) {
    this.tokens = limit.capacity;
    this.last = now();
  }

  private refill() {
    const t = this.now();
    const elapsed = t - this.last;
    if (elapsed > 0) {
      this.tokens = Math.min(this.limit.capacity, this.tokens + (elapsed * this.limit.requests) / this.limit.perMs);
      this.last = t;
    }
  }

  /** Takes a token if available; otherwise returns the ms to wait (token not taken). */
  tryTake(): number {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }
    return Math.ceil(((1 - this.tokens) * this.limit.perMs) / this.limit.requests);
  }

  async take(signal?: AbortSignal): Promise<void> {
    for (;;) {
      const wait = this.tryTake();
      if (wait === 0) return;
      await this.sleepFn(wait, signal);
    }
  }

  /** Drains the bucket (e.g. after an upstream 429) so callers back off. */
  drain() {
    this.refill();
    this.tokens = Math.min(this.tokens, 0);
  }
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly url: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  /** Per-attempt timeout (default 8 s). */
  timeoutMs?: number;
  /** Additional attempts after the first (default 2). */
  retries?: number;
  /** Base backoff (default 500 ms) → 500, 1000, 2000 … (+ jitter). */
  backoffMs?: number;
  /** Upper bound for a single wait (Retry-After included), default 30 s. */
  maxBackoffMs?: number;
  limiter?: TokenBucket;
  /** Non-2xx statuses returned instead of thrown (e.g. [404]). */
  acceptStatuses?: number[];
  signal?: AbortSignal;
  fetch?: typeof fetch;
  sleep?: SleepFn;
}

export interface JsonResponse<T = unknown> {
  status: number;
  data: T | null;
  headers: Headers;
}

const isRetryableStatus = (s: number) => s === 429 || s >= 500;

function retryAfterMs(headers: Headers): number | null {
  const v = headers.get("retry-after");
  if (!v) return null;
  const seconds = Number(v);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(v);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

/** Hides API keys in URLs used for error messages / logs. */
export function redactUrl(url: string): string {
  return url.replace(/(api_key=)[^&]+/i, "$1***");
}

export async function fetchJson<T = unknown>(url: string, opts: FetchJsonOptions = {}): Promise<JsonResponse<T>> {
  const doFetch = opts.fetch ?? fetch;
  const sleepFn = opts.sleep ?? sleep;
  const retries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const backoffMs = opts.backoffMs ?? 500;
  const maxBackoffMs = opts.maxBackoffMs ?? 30_000;
  const safeUrl = redactUrl(url);

  let lastError: HttpError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal?.aborted) throw opts.signal.reason ?? new DOMException("Aborted", "AbortError");
    await opts.limiter?.take(opts.signal);

    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    let waitMs = Math.min(maxBackoffMs, backoffMs * 2 ** attempt * (1 + Math.random() * 0.25));
    try {
      const res = await doFetch(url, { headers: { Accept: "application/json", ...opts.headers }, signal });
      if (res.ok || opts.acceptStatuses?.includes(res.status)) {
        const text = await res.text();
        let data: T | null = null;
        if (text) {
          try {
            data = JSON.parse(text) as T;
          } catch {
            if (res.ok) throw new HttpError(`Invalid JSON from ${safeUrl}`, res.status, safeUrl, false);
          }
        }
        return { status: res.status, data, headers: res.headers };
      }
      // Drain the body so the connection can be reused.
      await res.text().catch(() => undefined);
      const retryable = isRetryableStatus(res.status);
      lastError = new HttpError(`HTTP ${res.status} from ${safeUrl}`, res.status, safeUrl, retryable);
      if (!retryable) throw lastError;
      if (res.status === 429) opts.limiter?.drain();
      const ra = retryAfterMs(res.headers);
      if (ra !== null) waitMs = Math.min(maxBackoffMs, ra);
    } catch (err) {
      if (err instanceof HttpError) {
        if (!err.retryable) throw err;
        lastError = err;
      } else if (opts.signal?.aborted) {
        throw err; // caller cancelled: never retry
      } else {
        const isTimeout = timeout.aborted;
        lastError = new HttpError(
          isTimeout ? `Timeout after ${timeoutMs} ms: ${safeUrl}` : `Network error for ${safeUrl}: ${String(err)}`,
          null,
          safeUrl,
          true,
        );
      }
    }
    if (attempt < retries) await sleepFn(waitMs, opts.signal);
  }
  throw lastError ?? new HttpError(`Request failed: ${safeUrl}`, null, safeUrl, false);
}
