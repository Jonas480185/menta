import type { NutrientBasis, NutrientProfile } from "@/domain/nutrition/types";

/**
 * Food Provider contract. The application only ever talks to providers through this
 * interface and only ever consumes the normalized shapes below – never raw provider JSON.
 *
 * Implementations: OpenFoodFactsProvider, UsdaProvider, LocalFoodProvider,
 * UserFoodProvider. Orchestration/ranking across providers lives in the Food Search
 * service.
 */
export type FoodSource = "usda" | "off" | "curated" | "user" | "recipe";

export interface NormalizedServing {
  label: string;
  amount: number;
  /** g | ml | piece | slice | serving | tbsp | tsp | package | cup | ... */
  unit: string;
  /** Base units (g or ml, matching nutrientBasis) for one serving. */
  grams: number;
  isDefault?: boolean;
}

/** Provider-agnostic food as produced by the normalization layer (pre-persistence). */
export interface NormalizedFood {
  source: FoodSource;
  sourceId: string | null;
  name: string;
  brandName: string | null;
  barcode: string | null;
  category: string | null;
  language: string | null;
  countries: string[] | null;
  imageUrl: string | null;
  nutrientBasis: NutrientBasis;
  densityGPerMl: number | null;
  /** Per 100 g / 100 ml. */
  nutrients: NutrientProfile;
  servings: NormalizedServing[];
  /** Upstream popularity signal (e.g. OFF unique scans), used as a ranking prior. */
  popularity?: number;
  qualityFlags?: string[];
}

/** Lightweight row for result lists. `id` is our DB id when persisted, else "source:sourceId". */
export interface FoodSearchResult {
  id: string;
  persisted: boolean;
  source: FoodSource;
  name: string;
  brandName: string | null;
  barcode: string | null;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  nutrientBasis: NutrientBasis;
  defaultServing: { id: string | null; label: string; grams: number } | null;
  imageUrl: string | null;
  dataQuality: "verified" | "complete" | "partial" | "suspect";
}

/** Full food incl. servings, as stored in our DB. */
export interface FoodDetails extends Omit<NormalizedFood, "servings"> {
  id: string;
  ownerUserId: string | null;
  dataQuality: "verified" | "complete" | "partial" | "suspect";
  servings: (NormalizedServing & { id: string })[];
}

export interface ProviderSearchOptions {
  limit?: number;
  /** ISO 639-1, default "de". */
  language?: string;
  /** ISO country, default "de". */
  country?: string;
  signal?: AbortSignal;
}

export interface FoodProvider {
  readonly id: FoodSource | string;
  /** External providers return NormalizedFood; local providers may return persisted rows. */
  searchFoods(query: string, opts?: ProviderSearchOptions): Promise<NormalizedFood[]>;
  getFood(sourceId: string): Promise<NormalizedFood | null>;
  getFoodByBarcode(barcode: string): Promise<NormalizedFood | null>;
}
