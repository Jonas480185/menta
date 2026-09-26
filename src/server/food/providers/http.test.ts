import { describe, expect, it, vi } from "vitest";
import { HttpError, TokenBucket, fetchJson, redactUrl } from "./http";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const noSleep = vi.fn(async () => {});

describe("TokenBucket", () => {
  it("allows a burst up to capacity, then asks to wait", () => {
    let t = 0;
    const bucket = new TokenBucket({ capacity: 2, requests: 10, perMs: 60_000 }, () => t);
    expect(bucket.tryTake()).toBe(0);
    expect(bucket.tryTake()).toBe(0);
    expect(bucket.tryTake()).toBe(6000);
    t += 6000;
    expect(bucket.tryTake()).toBe(0);
  });

  it("take() sleeps until a token is refilled", async () => {
    let t = 0;
    const sleeps: number[] = [];
    const bucket = new TokenBucket({ capacity: 1, requests: 1, perMs: 1000 }, () => t, async (ms) => {
      sleeps.push(ms);
      t += ms;
    });
    await bucket.take();
    await bucket.take();
    expect(sleeps).toEqual([1000]);
  });

  it("drain() forces the next caller to wait", () => {
    const bucket = new TokenBucket({ capacity: 5, requests: 5, perMs: 1000 }, () => 0);
    bucket.drain();
    expect(bucket.tryTake()).toBeGreaterThan(0);
  });
});

describe("fetchJson", () => {
  it("returns parsed JSON and sends headers", async () => {
    const f = vi.fn(async () => json({ ok: 1 }));
    const res = await fetchJson("https://x.test/a", { fetch: f, headers: { "User-Agent": "Test/1" } });
    expect(res.data).toEqual({ ok: 1 });
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("Test/1");
  });

  it("retries 503 and 429 with backoff, honouring Retry-After", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("<html>", { status: 503 }))
      .mockResolvedValueOnce(json({}, 429, { "retry-after": "2" }))
      .mockResolvedValueOnce(json({ ok: true }));
    const sleepSpy = vi.fn(async () => {});
    const res = await fetchJson("https://x.test/b", { fetch: f, sleep: sleepSpy, retries: 2 });
    expect(res.data).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleepSpy.mock.calls[1]).toEqual([2000, undefined]);
  });

  it("gives up after the retry budget", async () => {
    const f = vi.fn(async () => new Response("down", { status: 502 }));
    await expect(fetchJson("https://x.test/c", { fetch: f, sleep: noSleep, retries: 1 })).rejects.toMatchObject({
      status: 502,
      retryable: true,
    });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx and returns accepted statuses", async () => {
    const f = vi.fn(async () => json({ status: 0 }, 404));
    const res = await fetchJson("https://x.test/d", { fetch: f, acceptStatuses: [404] });
    expect(res).toMatchObject({ status: 404, data: { status: 0 } });
    const g = vi.fn(async () => json({}, 400));
    await expect(fetchJson("https://x.test/e", { fetch: g, sleep: noSleep })).rejects.toBeInstanceOf(HttpError);
    expect(g).toHaveBeenCalledTimes(1);
  });

  it("retries network errors and times out slow requests", async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(json([1]));
    expect((await fetchJson("https://x.test/f", { fetch: f, sleep: noSleep })).data).toEqual([1]);

    const hang = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
    );
    await expect(
      fetchJson("https://x.test/g", { fetch: hang as unknown as typeof fetch, timeoutMs: 20, retries: 0 }),
    ).rejects.toThrow(/Timeout/);
  });

  it("never retries when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    const f = vi.fn(async () => json({}));
    await expect(fetchJson("https://x.test/h", { fetch: f, signal: controller.signal })).rejects.toBeDefined();
    expect(f).not.toHaveBeenCalled();
  });

  it("throws on invalid JSON", async () => {
    const f = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(fetchJson("https://x.test/i", { fetch: f })).rejects.toThrow(/Invalid JSON/);
  });

  it("redacts API keys", () => {
    expect(redactUrl("https://api.test/x?api_key=SECRET&q=1")).toBe("https://api.test/x?api_key=***&q=1");
  });
});
