/**
 * Pure preparation step shared by persistence and the offline snapshot builder:
 * canonical barcode, whitespace cleanup, serving sanitizing (100 g/ml base + one default),
 * validation (errors → reject, flags → dataQuality) and a richness score for dedupe.
 */
import type { NormalizedFood, NormalizedServing } from "@/server/food/types";
import { normalizeBarcode } from "@/domain/food/barcode";
import { isValidServingGrams } from "@/domain/food/units";
import { validateNormalizedFood, type DataQuality, type ValidationIssue } from "@/domain/food/validation";
import { finalizeServings } from "./common";

/** Stable key of a normalized food: "off:4014400400007", "usda:173944", "curated:apfel". */
export function foodKey(food: Pick<NormalizedFood, "source" | "sourceId">): string {
  return `${food.source}:${food.sourceId ?? ""}`;
}

export interface PreparedFood {
  key: string;
  food: NormalizedFood;
  barcode: string | null;
  quality: DataQuality;
  flags: string[];
  richness: number;
}

const QUALITY_RANK: Record<DataQuality, number> = { verified: 4, complete: 3, partial: 1, suspect: 0 };

/** Higher = better record for the same product (used for barcode dedupe). */
export function foodRichness(input: {
  quality: DataQuality;
  nutrients: Record<string, unknown>;
  servingCount: number;
  language: string | null;
  brandName: string | null;
  imageUrl: string | null;
}): number {
  const nutrientFields = Object.entries(input.nutrients).filter(
    ([k, v]) => k !== "micronutrients" && typeof v === "number",
  ).length;
  const micros = input.nutrients.micronutrients ? Object.keys(input.nutrients.micronutrients as object).length : 0;
  return (
    QUALITY_RANK[input.quality] * 100 +
    (input.language === "de" ? 20 : 0) +
    nutrientFields * 2 +
    Math.min(micros, 10) +
    Math.min(input.servingCount, 5) +
    (input.brandName ? 2 : 0) +
    (input.imageUrl ? 2 : 0)
  );
}

export function sanitizeServings(food: NormalizedFood): NormalizedServing[] {
  const valid = food.servings.filter(
    (s) => isValidServingGrams(s.grams) && s.amount > 0 && Number.isFinite(s.amount) && s.label?.trim(),
  );
  return finalizeServings(
    valid.map((s) => ({ ...s, label: s.label.trim().slice(0, 120) })),
    food.nutrientBasis,
  );
}

export function prepareFood(
  food: NormalizedFood,
  trusted: (f: NormalizedFood) => boolean,
): { ok: true; value: PreparedFood } | { ok: false; errors: ValidationIssue[] } {
  if (!food.sourceId) {
    return { ok: false, errors: [{ code: "missing_source_id", field: "sourceId", message: "sourceId fehlt." }] };
  }
  const barcode = food.barcode ? normalizeBarcode(food.barcode, { requireValidChecksum: false }) : null;
  const cleaned: NormalizedFood = {
    ...food,
    name: food.name?.replace(/\s+/g, " ").trim() ?? "",
    brandName: food.brandName?.replace(/\s+/g, " ").trim() || null,
    barcode,
    servings: sanitizeServings(food),
  };
  const v = validateNormalizedFood(cleaned, { trusted: trusted(food) });
  if (!v.valid) return { ok: false, errors: v.errors };
  const value: NormalizedFood = { ...cleaned, nutrients: v.nutrients, qualityFlags: v.flags };
  return {
    ok: true,
    value: {
      key: foodKey(food),
      food: value,
      barcode,
      quality: v.quality,
      flags: v.flags,
      richness: foodRichness({
        quality: v.quality,
        nutrients: v.nutrients as unknown as Record<string, unknown>,
        servingCount: value.servings.length,
        language: value.language,
        brandName: value.brandName,
        imageUrl: value.imageUrl,
      }),
    },
  };
}


export interface DedupeResult {
  winners: PreparedFood[];
  /** dropped key → winning key */
  aliases: Map<string, string>;
  duplicates: number;
}

/** In-memory dedupe by key, then by barcode – the richer record wins (ties: first seen). */
export function dedupePrepared(items: Iterable<PreparedFood>): DedupeResult {
  const byKey = new Map<string, PreparedFood>();
  const aliases = new Map<string, string>();
  let duplicates = 0;
  for (const p of items) {
    const existing = byKey.get(p.key);
    if (existing) {
      duplicates++;
      if (p.richness > existing.richness) byKey.set(p.key, p);
      continue;
    }
    byKey.set(p.key, p);
  }
  const byBarcode = new Map<string, PreparedFood>();
  for (const p of [...byKey.values()]) {
    if (!p.barcode) continue;
    const other = byBarcode.get(p.barcode);
    if (!other) {
      byBarcode.set(p.barcode, p);
      continue;
    }
    duplicates++;
    const [winner, loser] = p.richness > other.richness ? [p, other] : [other, p];
    byBarcode.set(p.barcode, winner);
    byKey.delete(loser.key);
    aliases.set(loser.key, winner.key);
  }
  return { winners: [...byKey.values()], aliases, duplicates };
}
