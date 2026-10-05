/**
 * USDA FoodData Central → NormalizedFood. Pure.
 *
 * Both the live API (search + details JSON) and the bulk CSV importer first build a
 * provider-neutral `UsdaFoodRecord`, which `mapUsdaRecord()` normalizes. Data: CC0 / public domain.
 */
import { z } from "zod";
import type { NormalizedFood, NormalizedServing } from "@/server/food/types";
import { normalizeBarcode } from "@/domain/food/barcode";
import { kcalFromKj } from "@/domain/food/nutrients";
import { formatServingLabel, parseServing, type ServingUnit, type UnitLabel } from "@/domain/food/units";
import type { NutrientBasis, NutrientProfile } from "@/domain/nutrition/types";
import { cleanText, finalizeServings, num, round, titleCaseIfShouting } from "./common";

export type UsdaDataType = "foundation_food" | "sr_legacy_food" | "branded_food" | "survey_fndds_food" | string;

export interface UsdaPortion {
  amount: number | null;
  /** measure unit name ("cup", "tablespoon", "undetermined", "RACC", "Banana" …) */
  unitName: string | null;
  modifier: string | null;
  description: string | null;
  gramWeight: number;
}

export interface UsdaFoodRecord {
  fdcId: number;
  dataType: UsdaDataType;
  description: string;
  category: string | null;
  /** nutrient id → amount per 100 g (or 100 ml for liquid branded foods) in the nutrient's unit */
  nutrients: Map<number, number>;
  portions: UsdaPortion[];
  brandName?: string | null;
  brandOwner?: string | null;
  gtinUpc?: string | null;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
  householdServingFullText?: string | null;
}

/** FDC nutrient ids (nutrient.csv `id`, API `nutrient.id` / `nutrientId`). */
export const USDA_NUTRIENT = {
  energyKcal: 1008,
  energyKj: 1062,
  energyAtwaterGeneral: 2047,
  energyAtwaterSpecific: 2048,
  protein: 1003,
  fat: 1004,
  fatNlea: 1085,
  carbs: 1005,
  carbsBySummation: 1050,
  fiber: 1079,
  sugars: 2000,
  sugarsNlea: 1063,
  saturatedFat: 1258,
  sodium: 1093,
  potassium: 1092,
  calcium: 1087,
  iron: 1089,
  alcohol: 1018,
} as const;

/** nutrient id → micronutrient key (units in FDC already match our key suffix). */
export const USDA_MICRONUTRIENTS: Record<number, string> = {
  1106: "vitamin_a_ug", // Vitamin A, RAE (µg)
  1165: "vitamin_b1_mg",
  1166: "vitamin_b2_mg",
  1167: "vitamin_b3_mg",
  1170: "vitamin_b5_mg",
  1175: "vitamin_b6_mg",
  1190: "folate_ug", // Folate, DFE (µg)
  1178: "vitamin_b12_ug",
  1162: "vitamin_c_mg",
  1114: "vitamin_d_ug", // D2 + D3 (µg)
  1109: "vitamin_e_mg", // alpha-tocopherol
  1185: "vitamin_k_ug", // phylloquinone
  1090: "magnesium_mg",
  1091: "phosphorus_mg",
  1095: "zinc_mg",
  1098: "copper_mg",
  1101: "manganese_mg",
  1103: "selenium_ug",
  1100: "iodine_ug",
  1253: "cholesterol_mg",
  1257: "trans_fat_g",
  1292: "monounsaturated_fat_g",
  1293: "polyunsaturated_fat_g",
  1235: "added_sugar_g",
  1009: "starch_g",
  1018: "alcohol_g",
  1057: "caffeine_mg",
  1051: "water_g",
};
/** Fallback ids if the preferred one is missing (e.g. folate total when DFE is absent). */
const MICRO_FALLBACKS: Record<string, number[]> = { folate_ug: [1177], vitamin_a_ug: [] };

// ── Portions → German servings ───────────────────────────────────────────────

const SIZE_NOTES: [RegExp, string][] = [
  [/\bextra[ -]?small\b/, "sehr klein"],
  [/\bextra[ -]?large\b|\bjumbo\b/, "sehr groß"],
  [/\bsmall\b/, "klein"],
  [/\bmedium\b/, "mittel"],
  [/\blarge\b/, "groß"],
];

const PREP_NOTES: [RegExp, string][] = [
  [/\bchopped\b/, "gehackt"],
  [/\bsliced\b/, "in Scheiben"],
  [/\bdiced\b|\bcubed\b|\bcubes\b/, "gewürfelt"],
  [/\bmashed\b|\bpureed\b|\bpuree\b/, "püriert"],
  [/\bshredded\b/, "geraspelt"],
  [/\bgrated\b/, "gerieben"],
  [/\bcooked\b/, "gekocht"],
  [/\bhalves\b/, "Hälften"],
  [/\bpeeled\b/, "geschält"],
  [/\bpacked\b/, "gepresst"],
  [/\bmelted\b/, "geschmolzen"],
  [/\bwhipped\b/, "aufgeschlagen"],
  [/\bground\b/, "gemahlen"],
];

const PIECE_WORDS =
  /\b(piece|pieces|each|whole|item|fruit|egg|breast|thigh|drumstick|wing|patty|link|sausage|frank|roll|bun|bagel|muffin|cookie|cracker|bar|stalk|clove|leaf|leaves|spear|pepper|potato|tomato|onion|banana|apple|orange|pear|peach|plum|carrot|fillet|filet|steak|chop|slice of pizza|tortilla|pancake|waffle|croissant|donut|doughnut|nut|kernel)s?\b/;

interface PortionClass {
  unit: ServingUnit;
  label?: UnitLabel;
  note: string | null;
  rank: number;
}

function classifyPortion(p: UsdaPortion): PortionClass | null {
  const unitName = (p.unitName ?? "").toLowerCase();
  const unitPart = unitName === "undetermined" ? "" : unitName;
  const text = [unitPart, p.modifier ?? "", p.description ?? ""].join(" ").toLowerCase();
  if (/\bfl\.? ?oz\b|\boz\b|\bounces?\b|\blbs?\b|\bpounds?\b|\bquarts?\b|\bpints?\b|\bgallons?\b/.test(text)) {
    return null; // imperial weights/volumes: redundant with "100 g"
  }
  const prep = PREP_NOTES.filter(([re]) => re.test(text)).map(([, n]) => n);
  const size = SIZE_NOTES.find(([re]) => re.test(text))?.[1] ?? null;
  const note = [size, ...prep].filter(Boolean).join(", ") || null;

  if (/\bcups?\b/.test(text)) return { unit: "cup", note: prep.join(", ") || null, rank: 6 };
  if (/\btbsp\b|\btablespoons?\b/.test(text)) return { unit: "tbsp", note: prep.join(", ") || null, rank: 4 };
  if (/\btsp\b|\bteaspoons?\b/.test(text)) return { unit: "tsp", note: prep.join(", ") || null, rank: 5 };
  if (/\bslices?\b/.test(text)) return { unit: "slice", note: size, rank: 2 };
  if (/\bnlea serving\b|\bserving\b|\bracc\b|\bportion\b/.test(text)) return { unit: "serving", note: null, rank: 3 };
  if (/\bcan\b/.test(text)) return { unit: "can", note: null, rank: 7 };
  if (/\bbottle\b/.test(text)) return { unit: "bottle", note: null, rank: 7 };
  if (/\bpackage\b|\bpackage\b|\bpkg\b|\bcontainer\b|\bbox\b/.test(text)) return { unit: "package", note: null, rank: 7 };
  if (size || PIECE_WORDS.test(text) || (unitPart && unitPart !== "racc")) {
    return { unit: "piece", note, rank: size === "mittel" ? 0 : 1 };
  }
  return { unit: "serving", note: null, rank: 3 };
}

export function usdaPortionsToServings(portions: readonly UsdaPortion[], basis: NutrientBasis): NormalizedServing[] {
  const classified: (NormalizedServing & { rank: number })[] = [];
  for (const p of portions) {
    if (!(p.gramWeight > 0)) continue;
    const c = classifyPortion(p);
    if (!c) continue;
    const amount = p.amount && p.amount > 0 ? p.amount : 1;
    classified.push({
      label: formatServingLabel({ amount, unit: c.unit, grams: p.gramWeight, basis, unitLabel: c.label, note: c.note }),
      amount,
      unit: c.unit,
      grams: round(p.gramWeight, 2),
      rank: c.rank,
    });
  }
  classified.sort((a, b) => a.rank - b.rank || a.grams - b.grams);
  return classified.slice(0, 8).map((s, i) => ({ label: s.label, amount: s.amount, unit: s.unit, grams: s.grams, isDefault: i === 0 }));
}

// ── Mapping ─────────────────────────────────────────────────────────────────

export type UsdaMapResult = { ok: true; food: NormalizedFood } | { ok: false; reason: "missing_name" | "no_nutrition_data" };

const get = (m: Map<number, number>, ...ids: number[]) => {
  for (const id of ids) {
    const v = m.get(id);
    if (v !== undefined && Number.isFinite(v)) return v;
  }
  return null;
};

export function mapUsdaRecord(rec: UsdaFoodRecord): UsdaMapResult {
  const rawName = cleanText(rec.description, 250);
  if (!rawName) return { ok: false, reason: "missing_name" };
  const name = titleCaseIfShouting(rawName);
  const n = rec.nutrients;
  const N = USDA_NUTRIENT;
  const flags: string[] = [];

  let kcal = get(n, N.energyKcal, N.energyAtwaterSpecific, N.energyAtwaterGeneral);
  if (kcal === null) {
    const kj = get(n, N.energyKj);
    if (kj !== null) {
      kcal = round(kcalFromKj(kj), 1);
      flags.push("energy_from_kj");
    }
  }
  const proteinG = get(n, N.protein);
  const fatG = get(n, N.fat, N.fatNlea);
  let carbsG = get(n, N.carbs, N.carbsBySummation);
  // "Carbohydrate, by difference" can come out slightly negative for meats (analytical noise).
  if (carbsG !== null && carbsG < 0 && carbsG > -2) {
    carbsG = 0;
    flags.push("carbs_clamped");
  }
  if (kcal === null && proteinG === null && fatG === null && carbsG === null) {
    return { ok: false, reason: "no_nutrition_data" };
  }
  if (kcal === null) flags.push("missing_kcal");
  if (proteinG === null) flags.push("missing_protein");
  if (carbsG === null) flags.push("missing_carbs");
  if (fatG === null) flags.push("missing_fat");

  const micronutrients: Record<string, number> = {};
  for (const [idStr, key] of Object.entries(USDA_MICRONUTRIENTS)) {
    const v = get(n, Number(idStr), ...(MICRO_FALLBACKS[key] ?? []));
    if (v !== null && v > 0) micronutrients[key] = round(v, 4);
  }

  const nutrients: NutrientProfile = {
    kcal: kcal ?? 0,
    proteinG: proteinG ?? 0,
    carbsG: carbsG ?? 0,
    fatG: fatG ?? 0,
    fiberG: get(n, N.fiber),
    sugarG: get(n, N.sugars, N.sugarsNlea),
    saturatedFatG: get(n, N.saturatedFat),
    saltG: null,
    sodiumMg: get(n, N.sodium),
    potassiumMg: get(n, N.potassium),
    calciumMg: get(n, N.calcium),
    ironMg: get(n, N.iron),
    micronutrients: Object.keys(micronutrients).length ? micronutrients : null,
  };

  const isBranded = rec.dataType === "branded_food";
  const servingUnit = (rec.servingSizeUnit ?? "").toLowerCase();
  const basis: NutrientBasis = isBranded && (servingUnit === "ml" || servingUnit === "mlt") ? "ml" : "g";

  let servings: NormalizedServing[];
  if (isBranded) {
    servings = [];
    const size = num(rec.servingSize);
    if (size && size > 0) {
      const household = cleanText(rec.householdServingFullText, 80);
      const parsed = household ? parseServing(`${household} (${size} ${basis})`, { basis }) : null;
      servings.push(
        parsed && parsed.unit !== "g" && parsed.unit !== "ml"
          ? { ...parsed, isDefault: true }
          : {
              label: formatServingLabel({ amount: 1, unit: "serving", grams: size, basis }),
              amount: 1,
              unit: "serving",
              grams: size,
              isDefault: true,
            },
      );
    }
  } else {
    servings = usdaPortionsToServings(rec.portions, basis);
  }

  const gtin = rec.gtinUpc ? normalizeBarcode(rec.gtinUpc, { requireValidChecksum: false }) : null;
  return {
    ok: true,
    food: {
      source: "usda",
      sourceId: String(rec.fdcId),
      name,
      brandName: isBranded ? titleCaseIfShouting(cleanText(rec.brandName, 120) ?? cleanText(rec.brandOwner, 120) ?? "") || null : null,
      barcode: gtin,
      category: cleanText(rec.category, 120),
      language: "en",
      countries: ["US"],
      imageUrl: null,
      nutrientBasis: basis,
      densityGPerMl: null,
      nutrients,
      servings: finalizeServings(servings, basis),
      popularity: 0,
      qualityFlags: flags,
    },
  };
}

// ── API JSON → record ─────────────────────────────────────────────────────────

const apiNutrient = z.looseObject({
  // search format
  nutrientId: z.number().optional(),
  value: z.number().nullish(),
  // details format
  nutrient: z.looseObject({ id: z.number() }).optional(),
  amount: z.number().nullish(),
});

const apiPortion = z.looseObject({
  amount: z.number().nullish(),
  modifier: z.string().nullish(),
  portionDescription: z.string().nullish(),
  gramWeight: z.number().nullish(),
  measureUnit: z.looseObject({ name: z.string().nullish() }).nullish(),
});

export const usdaApiFoodSchema = z.looseObject({
  fdcId: z.number(),
  dataType: z.string().nullish(),
  description: z.string().nullish(),
  foodCategory: z.union([z.string(), z.looseObject({ description: z.string().nullish() })]).nullish(),
  brandedFoodCategory: z.string().nullish(),
  foodNutrients: z.array(apiNutrient).nullish(),
  foodPortions: z.array(apiPortion).nullish(),
  brandName: z.string().nullish(),
  brandOwner: z.string().nullish(),
  gtinUpc: z.string().nullish(),
  servingSize: z.number().nullish(),
  servingSizeUnit: z.string().nullish(),
  householdServingFullText: z.string().nullish(),
});

const DATA_TYPES: Record<string, UsdaDataType> = {
  foundation: "foundation_food",
  "sr legacy": "sr_legacy_food",
  branded: "branded_food",
  "survey (fndds)": "survey_fndds_food",
};

/** Converts a food from `/foods/search` or `/food/{id}` into a UsdaFoodRecord. */
export function usdaRecordFromApi(raw: unknown): UsdaFoodRecord | null {
  const parsed = usdaApiFoodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const f = parsed.data;
  const nutrients = new Map<number, number>();
  for (const fn of f.foodNutrients ?? []) {
    const id = fn.nutrient?.id ?? fn.nutrientId;
    const value = fn.amount ?? fn.value;
    if (id !== undefined && typeof value === "number") nutrients.set(id, value);
  }
  const category =
    typeof f.foodCategory === "string" ? f.foodCategory : (f.foodCategory?.description ?? f.brandedFoodCategory ?? null);
  return {
    fdcId: f.fdcId,
    dataType: DATA_TYPES[(f.dataType ?? "").toLowerCase()] ?? f.dataType ?? "unknown",
    description: f.description ?? "",
    category,
    nutrients,
    portions: (f.foodPortions ?? []).map((p) => ({
      amount: p.amount ?? null,
      unitName: p.measureUnit?.name ?? null,
      modifier: p.modifier ?? null,
      description: p.portionDescription ?? null,
      gramWeight: p.gramWeight ?? 0,
    })),
    brandName: f.brandName,
    brandOwner: f.brandOwner,
    gtinUpc: f.gtinUpc,
    servingSize: f.servingSize,
    servingSizeUnit: f.servingSizeUnit,
    householdServingFullText: f.householdServingFullText,
  };
}
