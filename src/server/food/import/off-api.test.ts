import { describe, expect, it } from "vitest";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TokenBucket } from "@/server/food/providers/http";
import { fetchOffPopularProducts } from "./off-api";

const unlimited = () => new TokenBucket({ capacity: 1000, requests: 1000, perMs: 1 });

describe("fetchOffPopularProducts", () => {
  it("crawls partitions, stops a partition on 401, dedupes codes and caches pages", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      calls.push(url.search);
      const category = url.searchParams.get("categories_tags_en");
      const page = Number(url.searchParams.get("page"));
      if (!category && page === 2) return new Response("<html>login</html>", { status: 401 });
      const codes = category === "cheeses" ? ["2", "3"] : ["1", "2"];
      return new Response(JSON.stringify({ count: 2, products: codes.map((code) => ({ code })) }));
    }) as typeof fetch;

    const cacheDir = await mkdtemp(path.join(tmpdir(), "off-"));
    const opts = { limit: 10, pageSize: 2, cacheDir, fetch: fetchImpl, limiter: unlimited(), partitions: [null, "cheeses"], maxPagesPerPartition: 2 };
    const codes: string[] = [];
    for await (const p of fetchOffPopularProducts(opts)) codes.push((p as { code: string }).code);
    expect(codes).toEqual(["1", "2", "3"]);
    expect(calls.some((c) => c.includes("popularity_tags=top-50000-de-scans-2025"))).toBe(true);
    expect((await readdir(cacheDir)).length).toBe(3);

    // second run is served from the page cache
    calls.length = 0;
    const again: string[] = [];
    for await (const p of fetchOffPopularProducts(opts)) again.push((p as { code: string }).code);
    expect(again).toEqual(["1", "2", "3"]);
    // only the (uncacheable) 401 page is requested again
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("page=2");
    expect(calls[0]).not.toContain("categories_tags_en");
  });

  it("respects the limit", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ products: [{ code: "a" }, { code: "b" }, { code: "c" }] }))) as unknown as typeof fetch;
    const cacheDir = await mkdtemp(path.join(tmpdir(), "off-"));
    const out: unknown[] = [];
    for await (const p of fetchOffPopularProducts({ limit: 2, cacheDir, fetch: fetchImpl, limiter: unlimited(), partitions: [null] })) out.push(p);
    expect(out).toHaveLength(2);
  });
});
