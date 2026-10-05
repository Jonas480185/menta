/**
 * Open Food Facts product → NormalizedFood. Pure; used by the live provider, the API
 * importer and the dump importer (JSONL products have the same shape as API v2 products).
 *
 * Data license: ODbL (database) / DbCL (contents) / CC BY-SA (images), attribution required.
 */
import { z } from "zod";
import type { NormalizedFood, NormalizedServing } from "@/server/food/types";
import { parseBarcode } from "@/domain/food/barcode";
import { isEnergyMismatch } from "@/domain/food/validation";
import { KCAL_PER_G_FIBER, kcalFromKj, kcalFromMacros } from "@/domain/food/nutrients";
import { formatServingLabel, parseQuantity, parseServing, toBasisUnits } from "@/domain/food/units";
import type { NutrientBasis, NutrientProfile } from "@/domain/nutrition/types";
import { cleanText, countryCodesFromTags, finalizeServings, num, round } from "./common";

/** Fields requested from the OFF APIs (keep in sync with the mapping below). */
export const OFF_PRODUCT_FIELDS = [
  "code",
  "product_name",
  "product_name_de",
  "product_name_en",
  "generic_name_de",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
  "nutrition_data_per",
  "nutriments",
  "categories_tags",
  "countries_tags",
  "lang",
  "lc",
  "image_front_small_url",
  "unique_scans_n",
] as const;

const stringOrList = z.union([z.string(), z.array(z.string())]);

export const offProductSchema = z.looseObject({
  code: z.union([z.string(), z.number()]).transform(String),
  product_name: z.string().nullish(),
  product_name_de: z.string().nullish(),
  product_name_en: z.string().nullish(),
  generic_name_de: z.string().nullish(),
  brands: stringOrList.nullish(),
  quantity: z.union([z.string(), z.number()]).nullish(),
  serving_size: z.union([z.string(), z.number()]).nullish(),
  serving_quantity: z.union([z.number(), z.string()]).nullish(),
  serving_quantity_unit: z.string().nullish(),
  nutrition_data_per: z.string().nullish(),
  nutriments: z.record(z.string(), z.unknown()).nullish(),
  categories_tags: z.array(z.string()).nullish(),
  countries_tags: z.array(z.string()).nullish(),
  lang: z.string().nullish(),
  lc: z.string().nullish(),
  image_front_small_url: z.string().nullish(),
  unique_scans_n: z.union([z.number(), z.string()]).nullish(),
});
export type OffProduct = z.infer<typeof offProductSchema>;

export type OffMapResult = { ok: true; food: NormalizedFood } | { ok: false; reason: OffSkipReason };
export type OffSkipReason = "invalid_payload" | "invalid_barcode" | "missing_name" | "no_nutrition_data";

/** OFF nutriment (value in g per 100 g) → micronutrient key + factor to our unit. */
const MICROS: Record<string, [key: string, factor: number]> = {
  "vitamin-a": ["vitamin_a_ug", 1e6],
  "vitamin-b1": ["vitamin_b1_mg", 1e3],
  "vitamin-b2": ["vitamin_b2_mg", 1e3],
  "vitamin-pp": ["vitamin_b3_mg", 1e3],
  "pantothenic-acid": ["vitamin_b5_mg", 1e3],
  "vitamin-b6": ["vitamin_b6_mg", 1e3],
  "vitamin-b9": ["folate_ug", 1e6],
  folates: ["folate_ug", 1e6],
  "vitamin-b12": ["vitamin_b12_ug", 1e6],
  "vitamin-c": ["vitamin_c_mg", 1e3],
  "vitamin-d": ["vitamin_d_ug", 1e6],
  "vitamin-e": ["vitamin_e_mg", 1e3],
  "vitamin-k": ["vitamin_k_ug", 1e6],
  magnesium: ["magnesium_mg", 1e3],
  phosphorus: ["phosphorus_mg", 1e3],
  zinc: ["zinc_mg", 1e3],
  copper: ["copper_mg", 1e3],
  manganese: ["manganese_mg", 1e3],
  selenium: ["selenium_ug", 1e6],
  iodine: ["iodine_ug", 1e6],
  cholesterol: ["cholesterol_mg", 1e3],
  "trans-fat": ["trans_fat_g", 1],
  "monounsaturated-fat": ["monounsaturated_fat_g", 1],
  "polyunsaturated-fat": ["polyunsaturated_fat_g", 1],
  "added-sugars": ["added_sugar_g", 1],
  starch: ["starch_g", 1],
  polyols: ["polyols_g", 1],
  caffeine: ["caffeine_mg", 1e3],
};

/** Ethanol density: % vol → g per 100 ml. */
const ETHANOL_G_PER_ML = 0.789;

const LIQUID_CATEGORY_TAGS = new Set([
  "en:beverages",
  "en:waters",
  "en:milks",
  "en:juices",
  "en:sodas",
  "en:alcoholic-beverages",
  "en:plant-based-milk-alternatives",
]);

function first100g(n: Record<string, unknown>, key: string): number | null {
  return num(n[`${key}_100g`]);
}

function pickName(p: OffProduct): { name: string; language: string | null } | null {
  const lang = p.lang ?? p.lc ?? null;
  const de = cleanText(p.product_name_de);
  if (de) return { name: de, language: "de" };
  const main = cleanText(p.product_name);
  if (main) return { name: main, language: lang };
  const en = cleanText(p.product_name_en);
  if (en) return { name: en, language: "en" };
  const generic = cleanText(p.generic_name_de);
  if (generic) return { name: generic, language: "de" };
  return null;
}

function pickBrand(brands: OffProduct["brands"]): string | null {
  const list = Array.isArray(brands) ? brands : (brands ?? "").split(",");
  for (const b of list) {
    const clean = cleanText(b, 120);
    if (clean) return clean;
  }
  return null;
}

/** Most specific English category tag, e.g. "en:rolled-oats". */
function pickCategory(tags: readonly string[] | null | undefined): string | null {
  if (!tags?.length) return null;
  const en = tags.filter((t) => t.startsWith("en:"));
  return (en.length ? en[en.length - 1] : tags[tags.length - 1]) ?? null;
}

function detectBasis(p: OffProduct): NutrientBasis {
  if (p.nutrition_data_per?.toLowerCase().includes("ml")) return "ml";
  const qty = parseQuantity(p.quantity != null ? String(p.quantity) : null);
  if (qty) return qty.unit;
  const serving = p.serving_size != null ? String(p.serving_size) : "";
  if (/\d\s*(ml|cl|dl|l)\b/i.test(serving)) return "ml";
  if (p.categories_tags?.some((t) => LIQUID_CATEGORY_TAGS.has(t))) return "ml";
  return "g";
}

/**
 * kcal resolution: OFF has both `energy-kcal` and `energy-kj`; contributors sometimes enter
 * one wrongly. If they disagree, the value closer to the 4/4/9 macro estimate wins.
 */
function resolveEnergy(
  n: Record<string, unknown>,
  macros: { proteinG: number | null; carbsG: number | null; fatG: number | null; fiberG: number | null },
  flags: string[],
): number | null {
  const kcal = first100g(n, "energy-kcal");
  const kj = first100g(n, "energy-kj") ?? first100g(n, "energy");
  const fromKj = kj !== null ? kcalFromKj(kj) : null;
  if (kcal === null) {
    if (fromKj !== null) flags.push("energy_from_kj");
    return fromKj !== null ? round(fromKj, 1) : null;
  }
  if (fromKj === null) return kcal;
  const disagree = Math.abs(kcal - fromKj) > Math.max(5, 0.05 * Math.max(kcal, fromKj));
  if (!disagree || macros.proteinG === null || macros.carbsG === null || macros.fatG === null) return kcal;
  const m = { proteinG: macros.proteinG, carbsG: macros.carbsG, fatG: macros.fatG, fiberG: macros.fiberG };
  const base = kcalFromMacros(m);
  const fiber = m.fiberG ?? 0;
  const candidates = [base, base + fiber * KCAL_PER_G_FIBER, base - fiber * 2];
  const dist = (v: number) => Math.min(...candidates.map((c) => Math.abs(v - c)));
  if (dist(fromKj) < dist(kcal) && !isEnergyMismatch(fromKj, m)) {
    flags.push("energy_from_kj");
    return round(fromKj, 1);
  }
  return kcal;
}

function buildServings(p: OffProduct, basis: NutrientBasis): NormalizedServing[] {
  const servings: NormalizedServing[] = [];
  const qty = parseQuantity(p.quantity != null ? String(p.quantity) : null);
  const packageSize = qty ? toBasisUnits(qty.unitSize, qty.unit, basis) : null;

  let serving: NormalizedServing | null = null;
  if (p.serving_size != null && String(p.serving_size).trim()) {
    serving = parseServing(String(p.serving_size), { basis, packageSize });
    // A plain weight ("30 g") is the manufacturer's portion → show it as "1 Portion (30 g)".
    if (serving && (serving.unit === "g" || serving.unit === "ml")) {
      serving = {
        label: formatServingLabel({ amount: 1, unit: "serving", grams: serving.grams, basis }),
        amount: 1,
        unit: "serving",
        grams: serving.grams,
      };
    }
  }
  const servingQty = num(p.serving_quantity);
  if (!serving && servingQty && servingQty > 0 && servingQty <= 5000) {
    const unit = p.serving_quantity_unit?.toLowerCase() === "ml" ? "ml" : "g";
    const grams = toBasisUnits(servingQty, unit, basis);
    serving = {
      label: formatServingLabel({ amount: 1, unit: "serving", grams, basis }),
      amount: 1,
      unit: "serving",
      grams,
    };
  }
  if (serving) servings.push({ ...serving, isDefault: true });

  if (packageSize && packageSize <= 1000 && (!serving || Math.abs(serving.grams - packageSize) > 1)) {
    servings.push({
      label: formatServingLabel({ amount: 1, unit: "package", grams: packageSize, basis }),
      amount: 1,
      unit: "package",
      grams: packageSize,
      isDefault: !serving && packageSize <= 250,
    });
  }
  return finalizeServings(servings, basis);
}

export function mapOffProduct(raw: unknown): OffMapResult {
  const parsed = offProductSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid_payload" };
  const p = parsed.data;

  const barcode = parseBarcode(p.code);
  if (!barcode) return { ok: false, reason: "invalid_barcode" };
  const named = pickName(p);
  if (!named) return { ok: false, reason: "missing_name" };

  const n = p.nutriments ?? {};
  const flags: string[] = [];
  if (!barcode.checksumValid) flags.push("barcode_checksum_invalid");

  const proteinG = first100g(n, "proteins");
  const carbsG = first100g(n, "carbohydrates");
  const fatG = first100g(n, "fat");
  const fiberG = first100g(n, "fiber");
  const kcal = resolveEnergy(n, { proteinG, carbsG, fatG, fiberG }, flags);
  if (kcal === null && proteinG === null && carbsG === null && fatG === null) {
    return { ok: false, reason: "no_nutrition_data" };
  }
  if (kcal === null) flags.push("missing_kcal");
  if (proteinG === null) flags.push("missing_protein");
  if (carbsG === null) flags.push("missing_carbs");
  if (fatG === null) flags.push("missing_fat");

  const gToMg = (v: number | null) => (v === null ? null : round(v * 1000, 3));
  const micronutrients: Record<string, number> = {};
  for (const [offKey, [key, factor]] of Object.entries(MICROS)) {
    const v = first100g(n, offKey);
    if (v !== null && v > 0 && micronutrients[key] === undefined) micronutrients[key] = round(v * factor, 4);
  }
  const alcohol = first100g(n, "alcohol");
  if (alcohol !== null && alcohol > 0) micronutrients.alcohol_g = round(alcohol * ETHANOL_G_PER_ML, 2);

  const nutrients: NutrientProfile = {
    kcal: kcal ?? 0,
    proteinG: proteinG ?? 0,
    carbsG: carbsG ?? 0,
    fatG: fatG ?? 0,
    fiberG,
    sugarG: first100g(n, "sugars"),
    saturatedFatG: first100g(n, "saturated-fat"),
    saltG: first100g(n, "salt"),
    sodiumMg: gToMg(first100g(n, "sodium")),
    potassiumMg: gToMg(first100g(n, "potassium")),
    calciumMg: gToMg(first100g(n, "calcium")),
    ironMg: gToMg(first100g(n, "iron")),
    micronutrients: Object.keys(micronutrients).length ? micronutrients : null,
  };

  const basis = detectBasis(p);
  const scans = num(p.unique_scans_n);
  return {
    ok: true,
    food: {
      source: "off",
      sourceId: barcode.code,
      name: named.name,
      brandName: pickBrand(p.brands),
      barcode: barcode.code,
      category: pickCategory(p.categories_tags),
      language: named.language,
      countries: countryCodesFromTags(p.countries_tags),
      imageUrl: cleanText(p.image_front_small_url, 500),
      nutrientBasis: basis,
      densityGPerMl: null,
      nutrients,
      servings: buildServings(p, basis),
      popularity: scans !== null && scans > 0 ? Math.min(Math.round(scans), 2_000_000_000) : 0,
      qualityFlags: flags,
    },
  };
}
