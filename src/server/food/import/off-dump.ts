/**
 * Offline Open Food Facts sources:
 * - `readCachedOffPages`: products from search pages cached by off-api.ts (data/raw/off):
 *   v2 search pages (`api-*.json`, `products`) and search-a-licious pages (`sal-*.json`, `hits`).
 * - `readOffJsonl`: streams the official JSONL dump (`openfoodfacts-products.jsonl.gz`,
 *   ~7 GB gzipped / 3.5 M products) line by line – constant memory, optional country filter.
 *
 * Data: © Open Food Facts contributors, Open Database License (ODbL) 1.0.
 */
import { createReadStream } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";

export const OFF_DUMP_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz";

const productCode = (p: unknown): string | null => {
  const code = (p as { code?: unknown } | null)?.code;
  return typeof code === "string" || typeof code === "number" ? String(code) : null;
};

/** Yields every product of the cached pages once (first occurrence wins). */
export async function* readCachedOffPages(cacheDir: string): AsyncGenerator<unknown> {
  let files: string[];
  try {
    files = (await readdir(cacheDir))
      .filter((f) => (f.startsWith("api-") || f.startsWith("sal-")) && f.endsWith(".json"))
      .sort(pageOrder);
  } catch {
    return;
  }
  const seen = new Set<string>();
  for (const f of files) {
    const data = JSON.parse(await readFile(path.join(cacheDir, f), "utf8")) as { products?: unknown[]; hits?: unknown[] };
    for (const p of data.products ?? data.hits ?? []) {
      const code = productCode(p);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      yield p;
    }
  }
}

/** search-a-licious pages (global scan ranking) first, then v2 top list, then categories. */
function pageOrder(a: string, b: string): number {
  const rank = (f: string) => (f.startsWith("sal-") ? 0 : f.includes("_any_") ? 1 : 2);
  return rank(a) - rank(b) || a.localeCompare(b);
}

export interface OffJsonlOptions {
  /** Keep only products whose countries_tags contain one of these (e.g. ["en:germany"]). */
  countries?: readonly string[];
  /** Stop after this many yielded products. */
  limit?: number;
  /** Called for lines that are not valid JSON. */
  onInvalidLine?: (lineNo: number) => void;
}

/** Streams a JSONL (optionally .gz) OFF dump. */
export async function* readOffJsonl(file: string, opts: OffJsonlOptions = {}): AsyncGenerator<unknown> {
  const raw = createReadStream(file);
  const input = file.endsWith(".gz") ? raw.pipe(createGunzip()) : raw;
  const rl = createInterface({ input, crlfDelay: Infinity });
  const countries = opts.countries?.length ? new Set(opts.countries) : null;
  let yielded = 0;
  let lineNo = 0;
  try {
    for await (const line of rl) {
      lineNo++;
      if (!line.trim()) continue;
      // cheap pre-filter before JSON.parse (the dump is huge)
      if (countries && ![...countries].some((c) => line.includes(c))) continue;
      let product: unknown;
      try {
        product = JSON.parse(line);
      } catch {
        opts.onInvalidLine?.(lineNo);
        continue;
      }
      if (countries) {
        const tags = (product as { countries_tags?: unknown }).countries_tags;
        if (!Array.isArray(tags) || !tags.some((t) => countries.has(String(t)))) continue;
      }
      yield product;
      if (opts.limit && ++yielded >= opts.limit) break;
    }
  } finally {
    rl.close();
    raw.destroy();
  }
}
