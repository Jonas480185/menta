/**
 * USDA FoodData Central provider (api.nal.usda.gov/fdc/v1).
 * - search: `/foods/search` restricted to Foundation + SR Legacy by default (generic foods,
 *   lab-analysed); Branded can be enabled.
 * - details: `/food/{fdcId}` (full format incl. portions).
 * - barcode: `/foods/search` over Branded foods, exact GTIN match only (US products).
 *
 * Key from USDA_API_KEY (default DEMO_KEY, heavily limited). Returns NormalizedFood only.
 */
import type { FoodProvider, NormalizedFood, ProviderSearchOptions } from "@/server/food/types";
import { normalizeBarcode } from "@/domain/food/barcode";
import { mapUsdaRecord, usdaRecordFromApi } from "@/server/food/normalize/usda";
import { externalProvidersEnabled, RATE_LIMITS, usdaApiKey } from "./config";
import { fetchJson, TokenBucket, type FetchJsonOptions } from "./http";

export type UsdaSearchDataType = "Foundation" | "SR Legacy" | "Branded" | "Survey (FNDDS)";

const sharedLimiters = new Map<string, TokenBucket>();
function limiterFor(apiKey: string): TokenBucket {
  const key = apiKey === "DEMO_KEY" ? "demo" : apiKey;
  let bucket = sharedLimiters.get(key);
  if (!bucket) {
    bucket = new TokenBucket(apiKey === "DEMO_KEY" ? RATE_LIMITS.usdaDemo : RATE_LIMITS.usda);
    sharedLimiters.set(key, bucket);
  }
  return bucket;
}

export interface UsdaProviderOptions {
  fetch?: typeof fetch;
  apiKey?: string;
  enabled?: boolean;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  limiter?: TokenBucket;
  sleep?: FetchJsonOptions["sleep"];
  /** Data types used by searchFoods (default Foundation + SR Legacy). */
  searchDataTypes?: UsdaSearchDataType[];
}

export class UsdaProvider implements FoodProvider {
  readonly id = "usda" as const;
  private readonly baseUrl: string;

  constructor(private readonly opts: UsdaProviderOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "https://api.nal.usda.gov/fdc/v1").replace(/\/$/, "");
  }

  private get enabled() {
    return this.opts.enabled ?? externalProvidersEnabled();
  }

  private get apiKey() {
    return this.opts.apiKey ?? usdaApiKey();
  }

  private request(path: string, params: URLSearchParams, signal?: AbortSignal) {
    params.set("api_key", this.apiKey);
    return fetchJson<Record<string, unknown>>(`${this.baseUrl}${path}?${params}`, {
      fetch: this.opts.fetch,
      timeoutMs: this.opts.timeoutMs ?? 8_000,
      retries: this.opts.retries ?? 1,
      limiter: this.opts.limiter ?? limiterFor(this.apiKey),
      signal,
      sleep: this.opts.sleep,
      acceptStatuses: [404],
    });
  }

  private mapFoods(list: unknown): NormalizedFood[] {
    if (!Array.isArray(list)) return [];
    const out: NormalizedFood[] = [];
    for (const raw of list) {
      const rec = usdaRecordFromApi(raw);
      if (!rec) continue;
      const r = mapUsdaRecord(rec);
      if (r.ok) out.push(r.food);
    }
    return out;
  }

  async searchFoods(query: string, opts: ProviderSearchOptions = {}): Promise<NormalizedFood[]> {
    const q = query.trim();
    if (!this.enabled || q.length < 2) return [];
    const params = new URLSearchParams({
      query: q,
      dataType: (this.opts.searchDataTypes ?? ["Foundation", "SR Legacy"]).join(","),
      pageSize: String(Math.min(Math.max(opts.limit ?? 20, 1), 200)),
      pageNumber: "1",
    });
    const res = await this.request("/foods/search", params, opts.signal);
    return this.mapFoods(res.data?.foods);
  }

  async getFood(sourceId: string, signal?: AbortSignal): Promise<NormalizedFood | null> {
    if (!this.enabled || !/^\d+$/.test(sourceId)) return null;
    const res = await this.request(`/food/${sourceId}`, new URLSearchParams(), signal);
    if (res.status === 404 || !res.data) return null;
    return this.mapFoods([res.data])[0] ?? null;
  }

  async getFoodByBarcode(barcode: string, signal?: AbortSignal): Promise<NormalizedFood | null> {
    if (!this.enabled) return null;
    const code = normalizeBarcode(barcode, { requireValidChecksum: false });
    if (!code) return null;
    const params = new URLSearchParams({ query: code.replace(/^0+/, ""), dataType: "Branded", pageSize: "10" });
    const res = await this.request("/foods/search", params, signal);
    return this.mapFoods(res.data?.foods).find((f) => f.barcode === code) ?? null;
  }
}
