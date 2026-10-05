/**
 * Curated German basics (data/curated/generic-foods.de.json).
 *
 * Each entry carries a German name, a category, typical German household servings and the
 * fdcId of the best-matching USDA SR Legacy / Foundation food. Nutrients are NOT stored in the
 * JSON: they are resolved from the USDA bulk data at import time (single source of truth,
 * CC0), so the curated list stays small and reviewable.
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { NutrientProfile } from "@/domain/nutrition/types";
import { isServingUnit, parseAmount } from "@/domain/food/units";
import type { NormalizedFood, NormalizedServing } from "@/server/food/types";
import { mapUsdaRecord, type UsdaFoodRecord } from "@/server/food/normalize/usda";
import { finalizeServings, round } from "@/server/food/normalize/common";

export const CURATED_FOODS_PATH = "data/curated/generic-foods.de.json";

export const curatedServingSchema = z.object({
  label: z.string().trim().min(1).max(120),
  unit: z.string().refine(isServingUnit, "unbekannte Einheit"),
  /** Base units (g, or ml when basis = "ml") for one serving. */
  grams: z.number().positive().max(10_000),
});

export const curatedFoodSchema = z.object({
  /** Stable slug → foods.source_id (never change once published: diary entries reference it). */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameDe: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  fdcId: z.number().int().positive(),
  /** Informational: USDA description the fdcId pointed to when curated. */
  usdaDescription: z.string().optional(),
  basis: z.enum(["g", "ml"]).default("g"),
  /** Required for basis = "ml": converts USDA per-100 g values to per-100 ml. */
  densityGPerMl: z.number().positive().max(3).optional(),
  servings: z.array(curatedServingSchema).max(8),
});
export type CuratedFood = z.infer<typeof curatedFoodSchema>;

export const curatedFileSchema = z
  .object({
    version: z.literal(1),
    description: z.string().optional(),
    foods: z.array(curatedFoodSchema),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.foods.forEach((f, i) => {
      if (seen.has(f.id)) ctx.addIssue({ code: "custom", path: ["foods", i, "id"], message: `doppelte id ${f.id}` });
      seen.add(f.id);
      if (f.basis === "ml" && !f.densityGPerMl) {
        ctx.addIssue({ code: "custom", path: ["foods", i, "densityGPerMl"], message: "basis ml braucht densityGPerMl" });
      }
    });
  });
export type CuratedFile = z.infer<typeof curatedFileSchema>;

export async function loadCuratedFoods(file = CURATED_FOODS_PATH): Promise<CuratedFood[]> {
  return curatedFileSchema.parse(JSON.parse(await readFile(file, "utf8"))).foods;
}

/** "½ Stück" → 0.5, "2 Scheiben" → 2, "1 Glas" → 1; no leading number → 1. */
export function servingAmountFromLabel(label: string): number {
  const m = /^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔])/.exec(label);
  if (!m) return 1;
  const fractions: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
  const v = fractions[m[1]] ?? parseAmount(m[1]);
  return v && v > 0 ? round(v, 3) : 1;
}

function scaleNutrients(n: NutrientProfile, factor: number): NutrientProfile {
  if (factor === 1) return n;
  const s = (v: number | null | undefined) => (typeof v === "number" ? round(v * factor, 4) : (v ?? null));
  const micros = n.micronutrients
    ? Object.fromEntries(Object.entries(n.micronutrients).map(([k, v]) => [k, round(v * factor, 4)]))
    : null;
  return {
    kcal: round(n.kcal * factor, 2),
    proteinG: round(n.proteinG * factor, 3),
    carbsG: round(n.carbsG * factor, 3),
    fatG: round(n.fatG * factor, 3),
    fiberG: s(n.fiberG),
    sugarG: s(n.sugarG),
    saturatedFatG: s(n.saturatedFatG),
    saltG: s(n.saltG),
    sodiumMg: s(n.sodiumMg),
    potassiumMg: s(n.potassiumMg),
    calciumMg: s(n.calciumMg),
    ironMg: s(n.ironMg),
    micronutrients: micros,
  };
}

export type CuratedResolveResult =
  | { ok: true; food: NormalizedFood }
  | { ok: false; id: string; reason: "unknown_fdc_id" | "no_nutrition_data" | "missing_name" };

/**
 * Pure: curated entry + its USDA record → NormalizedFood (source "curated", language "de").
 * Nutrients come from USDA (per 100 g, converted to per 100 ml for basis "ml"); servings are
 * the curated ones (first = default) plus the 100 g/ml base serving.
 */
export function resolveCuratedFood(entry: CuratedFood, rec: UsdaFoodRecord | undefined): CuratedResolveResult {
  if (!rec) return { ok: false, id: entry.id, reason: "unknown_fdc_id" };
  const mapped = mapUsdaRecord(rec);
  if (!mapped.ok) return { ok: false, id: entry.id, reason: mapped.reason };
  const basis = entry.basis;
  const density = basis === "ml" ? (entry.densityGPerMl ?? 1) : null;
  const servings: NormalizedServing[] = entry.servings.map((s, i) => ({
    label: s.label,
    amount: servingAmountFromLabel(s.label),
    unit: s.unit,
    grams: s.grams,
    isDefault: i === 0,
  }));
  return {
    ok: true,
    food: {
      source: "curated",
      sourceId: entry.id,
      name: entry.nameDe,
      brandName: null,
      barcode: null,
      category: entry.category,
      language: "de",
      countries: ["DE"],
      imageUrl: null,
      nutrientBasis: basis,
      densityGPerMl: density,
      nutrients: scaleNutrients(mapped.food.nutrients, density ?? 1),
      servings: finalizeServings(servings, basis),
      popularity: 0,
      qualityFlags: mapped.food.qualityFlags,
    },
  };
}

export interface CuratedBuildResult {
  foods: NormalizedFood[];
  missing: { id: string; fdcId: number; reason: string }[];
}

/** Resolves all entries against USDA records (merge Foundation + SR Legacy maps first). */
export function buildCuratedFoods(
  entries: readonly CuratedFood[],
  usda: ReadonlyMap<number, UsdaFoodRecord>,
): CuratedBuildResult {
  const out: CuratedBuildResult = { foods: [], missing: [] };
  for (const e of entries) {
    const r = resolveCuratedFood(e, usda.get(e.fdcId));
    if (r.ok) out.foods.push(r.food);
    else out.missing.push({ id: e.id, fdcId: e.fdcId, reason: r.reason });
  }
  return out;
}
