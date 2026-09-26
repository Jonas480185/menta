/**
 * Open Food Facts provider.
 * - Search: search-a-licious (search.openfoodfacts.org) – fast Elasticsearch-backed search with
 *   German language preference; results are re-ranked so products sold in the requested country
 *   come first (a Lucene country filter destroys relevance for multi-word queries).
 * - Barcode / product: API v2 `/api/v2/product/{code}` with a restricted `fields` list.
 *
 * Returns NormalizedFood only. No `server-only` import (scripts use it); app code imports it
 * through `./index.ts`.
 */
import type { FoodProvider, NormalizedFood, ProviderSearchOptions } from "@/server/food/types";
import { parseBarcode } from "@/domain/food/barcode";
import { mapOffProduct, OFF_PRODUCT_FIELDS } from "@/server/food/normalize/off";
import { externalProvidersEnabled, offUserAgent, RATE_LIMITS } from "./config";
import { fetchJson, TokenBucket, type FetchJsonOptions } from "./http";

const COUNTRY_TAG: Record<string, string> = {
  de: "en:germany",
  at: "en:austria",
  ch: "en:switzerland",
  fr: "en:france",
  nl: "en:netherlands",
  be: "en:belgium",
  it: "en:italy",
  es: "en:spain",
  pl: "en:poland",
  gb: "en:united-kingdom",
  us: "en:united-states",
};

// Shared across instances: limits are per IP, not per provider object.
const sharedLimiters = {
  product: new TokenBucket(RATE_LIMITS.offProduct),
  search: new TokenBucket(RATE_LIMITS.offSearchALicious),
};

export interface OpenFoodFactsProviderOptions {
  fetch?: typeof fetch;
  userAgent?: string;
  /** Overrides FOOD_EXTERNAL_PROVIDERS_ENABLED. */
  enabled?: boolean;
  apiBaseUrl?: string;
  searchBaseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  limiters?: { product?: TokenBucket; search?: TokenBucket };
  sleep?: FetchJsonOptions["sleep"];
}

export class OpenFoodFactsProvider implements FoodProvider {
  readonly id = "off" as const;
  private readonly apiBase: string;
  private readonly searchBase: string;

  constructor(private readonly opts: OpenFoodFactsProviderOptions = {}) {
    this.apiBase = (opts.apiBaseUrl ?? "https://world.openfoodfacts.org").replace(/\/$/, "");
    this.searchBase = (opts.searchBaseUrl ?? "https://search.openfoodfacts.org").replace(/\/$/, "");
  }

  private get enabled() {
    return this.opts.enabled ?? externalProvidersEnabled();
  }

  private request(url: string, limiter: TokenBucket, signal?: AbortSignal, accept?: number[]) {
    return fetchJson<Record<string, unknown>>(url, {
      fetch: this.opts.fetch,
      headers: { "User-Agent": this.opts.userAgent ?? offUserAgent() },
      timeoutMs: this.opts.timeoutMs ?? 6_000,
      retries: this.opts.retries ?? 1,
      limiter,
      signal,
      sleep: this.opts.sleep,
      acceptStatuses: accept,
    });
  }

  async searchFoods(query: string, opts: ProviderSearchOptions = {}): Promise<NormalizedFood[]> {
    const q = query.trim();
    if (!this.enabled || q.length < 2) return [];
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
    const language = (opts.language ?? "de").toLowerCase();
    const countryTag = COUNTRY_TAG[(opts.country ?? "de").toLowerCase()] ?? null;

    const params = new URLSearchParams({
      q,
      langs: language === "en" ? "en" : `${language},en`,
      page_size: String(Math.min(limit * 2, 50)),
      page: "1",
      fields: OFF_PRODUCT_FIELDS.join(","),
    });
    const res = await this.request(
      `${this.searchBase}/search?${params}`,
      this.opts.limiters?.search ?? sharedLimiters.search,
      opts.signal,
    );
    const hits = Array.isArray(res.data?.hits) ? (res.data.hits as unknown[]) : [];
    const mapped: { food: NormalizedFood; inCountry: boolean; rank: number }[] = [];
    hits.forEach((hit, rank) => {
      const r = mapOffProduct(hit);
      if (!r.ok) return;
      const tags = (hit as { countries_tags?: unknown }).countries_tags;
      const inCountry = !countryTag || (Array.isArray(tags) && tags.includes(countryTag));
      mapped.push({ food: r.food, inCountry, rank });
    });
    mapped.sort((a, b) => Number(b.inCountry) - Number(a.inCountry) || a.rank - b.rank);
    return mapped.slice(0, limit).map((m) => m.food);
  }

  /** OFF source ids are barcodes. */
  getFood(sourceId: string): Promise<NormalizedFood | null> {
    return this.getFoodByBarcode(sourceId);
  }

  async getFoodByBarcode(barcode: string, signal?: AbortSignal): Promise<NormalizedFood | null> {
    if (!this.enabled) return null;
    const parsed = parseBarcode(barcode);
    if (!parsed) return null;
    const params = new URLSearchParams({ fields: OFF_PRODUCT_FIELDS.join(",") });
    const res = await this.request(
      `${this.apiBase}/api/v2/product/${parsed.code}?${params}`,
      this.opts.limiters?.product ?? sharedLimiters.product,
      signal,
      [404],
    );
    const data = res.data;
    if (res.status === 404 || !data || data.status !== 1 || !data.product) return null;
    const r = mapOffProduct(data.product);
    return r.ok ? r.food : null;
  }
}
