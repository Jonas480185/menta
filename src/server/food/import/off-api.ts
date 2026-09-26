/**
 * Paginates Open Food Facts API v2 search for popular products of a country
 * (`countries_tags_en=<country>` + optional `popularity_tags`, sorted by `unique_scans_n`),
 * respecting the documented 10 req/min search limit. Raw pages are cached in data/raw/off
 * (gitignored) so re-runs and snapshot builds do not hit the API again.
 *
 * Anonymous clients only get the first 10 pages of any search (page 11+ → HTTP 401), so the
 * crawl is partitioned by category (each ≤ 10 × 50 products) and deduplicated by barcode.
 * For more than a few thousand products OFF asks to use the data dumps instead
 * (see off-dump.ts / `import-off.ts --file`).
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { OFF_PRODUCT_FIELDS } from "@/server/food/normalize/off";
import { offUserAgent, RATE_LIMITS } from "@/server/food/providers/config";
import { fetchJson, HttpError, TokenBucket, type SleepFn } from "@/server/food/providers/http";

export interface OffApiFetchOptions {
  limit: number;
  /** countries_tags_en value, default "germany". */
  country?: string;
  /** e.g. "top-50000-de-scans-2025" (products actually scanned in Germany). null = no filter. */
  popularityTag?: string | null;
  /** 50 is the largest page size the v2 search reliably serves (100 → frequent 503). */
  pageSize?: number;
  cacheDir: string;
  /** Ignore cached pages. */
  refresh?: boolean;
  userAgent?: string;
  fetch?: typeof fetch;
  sleep?: SleepFn;
  limiter?: TokenBucket;
  log?: (msg: string) => void;
  baseUrl?: string;
  /**
   * Category tags (categories_tags_en) to crawl one after another; `null` = no category
   * filter. Default: DEFAULT_OFF_PARTITIONS (overall top list first, then categories).
   */
  partitions?: (string | null)[];
  /** Pages per partition (anonymous limit: 10). */
  maxPagesPerPartition?: number;
}

/** Everyday German supermarket categories (OFF English category tags). */
export const DEFAULT_OFF_PARTITIONS: (string | null)[] = [
  null,
  "dairies",
  "cheeses",
  "yogurts",
  "milks",
  "breads",
  "breakfast-cereals",
  "biscuits-and-cakes",
  "chocolates",
  "candies",
  "salty-snacks",
  "sweet-spreads",
  "spreads",
  "beverages",
  "sodas",
  "fruit-juices",
  "alcoholic-beverages",
  "plant-based-milk-alternatives",
  "meats",
  "sausages",
  "hams",
  "fishes",
  "frozen-foods",
  "meals",
  "pizzas",
  "soups",
  "sauces",
  "condiments",
  "pastas",
  "rices",
  "nuts",
  "fruits",
  "vegetables",
  "legumes",
  "desserts",
  "ice-creams",
  "fats",
  "meat-alternatives",
];

export const DEFAULT_OFF_POPULARITY_TAG = "top-50000-de-scans-2025";

interface SearchPage {
  count?: number;
  page?: number;
  products?: unknown[];
}

export async function* fetchOffPopularProducts(opts: OffApiFetchOptions): AsyncGenerator<unknown> {
  const pageSize = opts.pageSize ?? 50;
  const country = opts.country ?? "germany";
  const tag = opts.popularityTag === undefined ? DEFAULT_OFF_POPULARITY_TAG : opts.popularityTag;
  const log = opts.log ?? (() => {});
  const limiter = opts.limiter ?? new TokenBucket(RATE_LIMITS.offSearch);
  const base = (opts.baseUrl ?? "https://world.openfoodfacts.org").replace(/\/$/, "");
  const slug = [country, tag ?? "all", `ps${pageSize}`].join("_").replace(/[^a-z0-9_-]/gi, "");
  await mkdir(opts.cacheDir, { recursive: true });

  const partitions = opts.partitions ?? DEFAULT_OFF_PARTITIONS;
  const maxPages = opts.maxPagesPerPartition ?? 10;
  const seen = new Set<string>();

  for (const category of partitions) {
    if (seen.size >= opts.limit) break;
    const slug = [country, tag ?? "all", category ?? "any", `ps${pageSize}`].join("_").replace(/[^a-z0-9_-]/gi, "");
    for (let page = 1; page <= maxPages && seen.size < opts.limit; page++) {
      const cacheFile = path.join(opts.cacheDir, `api-${slug}-p${String(page).padStart(2, "0")}.json`);
      let data: SearchPage | null = null;
      if (!opts.refresh && existsSync(cacheFile)) {
        data = JSON.parse(await readFile(cacheFile, "utf8")) as SearchPage;
      } else {
        const params = new URLSearchParams({
          countries_tags_en: country,
          sort_by: "unique_scans_n",
          page_size: String(pageSize),
          page: String(page),
          fields: OFF_PRODUCT_FIELDS.join(","),
        });
        if (tag) params.set("popularity_tags", tag);
        if (category) params.set("categories_tags_en", category);
        try {
          const res = await fetchJson<SearchPage>(`${base}/api/v2/search?${params}`, {
            fetch: opts.fetch,
            headers: { "User-Agent": opts.userAgent ?? offUserAgent() },
            limiter,
            timeoutMs: 45_000,
            retries: 6,
            backoffMs: 6_000,
            maxBackoffMs: 60_000,
            sleep: opts.sleep,
          });
          data = res.data;
        } catch (err) {
          if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
            log(`  ${category ?? "all"} page ${page}: not available anonymously – next partition`);
            break;
          }
          throw err;
        }
        if (data) await writeFile(cacheFile, JSON.stringify(data));
        log(`  ${category ?? "all"} page ${page}: ${data?.products?.length ?? 0} products (${data?.count ?? "?"} total, ${seen.size} unique so far)`);
      }
      const products = data?.products ?? [];
      for (const p of products) {
        if (seen.size >= opts.limit) break;
        const code = (p as { code?: unknown })?.code;
        if (typeof code !== "string" && typeof code !== "number") continue;
        if (seen.has(String(code))) continue;
        seen.add(String(code));
        yield p;
      }
      if (products.length < pageSize) break;
    }
  }
}
