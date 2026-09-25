/**
 * Plausibility validation for food nutrient data – pure, framework-free.
 *
 * Used by every import path (providers, bulk import, seed) before anything is persisted:
 * hard errors reject a record, soft findings become `qualityFlags` and determine
 * `dataQuality` (verified | complete | partial | suspect).
 */
import type { NutrientBasis, NutrientProfile } from "@/domain/nutrition/types";
import {
  KCAL_PER_G_FIBER,
  kcalFromMacros,
  saltGFromSodiumMg,
  sodiumMgFromSaltG,
} from "./nutrients";
import { isValidServingGrams } from "./units";

export type DataQuality = "verified" | "complete" | "partial" | "suspect";

export type ValidationErrorCode =
  | "missing_name"
  | "not_a_number"
  | "negative_value"
  | "value_out_of_range"
  | "macro_sum_exceeds_100"
  | "kcal_exceeds_max"
  | "no_nutrition_data"
  | "invalid_serving";

export interface ValidationIssue {
  code: ValidationErrorCode;
  field?: string;
  message: string;
}

/**
 * Flags written by validation. Providers may add their own flags (e.g. "energy_from_kj",
 * "missing_protein"); they are passed through and deduplicated.
 */
export const QUALITY_FLAGS = {
  energy_mismatch: "kcal passen nicht zu den Makronährstoffen",
  energy_derived: "kcal aus Makronährstoffen berechnet",
  sugar_exceeds_carbs: "Zucker größer als Kohlenhydrate",
  saturated_fat_exceeds_fat: "Gesättigte Fettsäuren größer als Fett",
  salt_sodium_mismatch: "Salz und Natrium widersprechen sich",
  salt_derived: "Salz aus Natrium berechnet",
  sodium_derived: "Natrium aus Salz berechnet",
  missing_kcal: "Energie fehlt",
  missing_protein: "Eiweiß fehlt",
  missing_carbs: "Kohlenhydrate fehlen",
  missing_fat: "Fett fehlt",
  micronutrient_dropped: "Ungültiger Mikronährstoffwert verworfen",
} as const;
export type QualityFlag = keyof typeof QUALITY_FLAGS;

/** Flags that make a record "suspect" (still stored, but ranked down / shown with a hint). */
export const SUSPECT_FLAGS: ReadonlySet<string> = new Set([
  "energy_mismatch",
  "sugar_exceeds_carbs",
  "saturated_fat_exceeds_fat",
]);
const MISSING_CORE_FLAGS = ["missing_kcal", "missing_protein", "missing_carbs", "missing_fat"] as const;

/** Tolerances (documented in docs/architecture/food-data-strategy.md). */
export const VALIDATION_LIMITS = {
  maxKcalPer100: 900,
  /** protein + carbs + fat per 100 g; small allowance for label rounding. */
  maxMacroSumPer100g: 102,
  /** per 100 ml: dense liquids (syrups, honey) can exceed 100 g per 100 ml. */
  maxMacroSumPer100ml: 150,
  maxSodiumMgPer100g: 40_000,
  energyAbsToleranceKcal: 20,
  energyRelTolerance: 0.2,
  subsetAbsTolerance: 0.5,
  subsetRelTolerance: 0.02,
  saltAbsTolerance: 0.05,
  saltRelTolerance: 0.1,
} as const;

export type NutrientInput = { [K in keyof NutrientProfile]?: NutrientProfile[K] | null };

export interface ValidateOptions {
  basis?: NutrientBasis;
  /** Curated / reviewed data: a clean record becomes "verified" instead of "complete". */
  trusted?: boolean;
  /** Flags already set by the provider mapping (e.g. "missing_protein"). */
  existingFlags?: readonly string[] | null;
}

export interface NutrientValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  flags: string[];
  quality: DataQuality;
  /** Cleaned profile: missing core values → 0, derived salt/sodium/kcal filled in. */
  nutrients: NutrientProfile;
}

const CORE = ["kcal", "proteinG", "carbsG", "fatG"] as const;
const OPTIONAL_NUMERIC = [
  "fiberG",
  "sugarG",
  "saturatedFatG",
  "saltG",
  "sodiumMg",
  "potassiumMg",
  "calciumMg",
  "ironMg",
] as const;
const GRAM_FIELDS = ["proteinG", "carbsG", "fatG", "fiberG", "sugarG", "saturatedFatG", "saltG"] as const;

const round = (v: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

export function validateNutrients(input: NutrientInput, opts: ValidateOptions = {}): NutrientValidationResult {
  const basis = opts.basis ?? "g";
  const errors: ValidationIssue[] = [];
  const flags = new Set<string>(opts.existingFlags ?? []);
  const values: Record<string, number | null> = {};

  for (const field of [...CORE, ...OPTIONAL_NUMERIC]) {
    const raw = input[field];
    if (raw === null || raw === undefined) {
      values[field] = null;
      continue;
    }
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      errors.push({ code: "not_a_number", field, message: `${field} ist keine gültige Zahl.` });
      values[field] = null;
      continue;
    }
    if (raw < 0) {
      errors.push({ code: "negative_value", field, message: `${field} darf nicht negativ sein.` });
    }
    values[field] = raw;
  }

  // Provider flags "missing_x" mean the 0 in the profile is a placeholder.
  const missingFromFlags = (field: (typeof CORE)[number]) =>
    flags.has(`missing_${field === "kcal" ? "kcal" : field.replace(/G$/, "")}`);
  for (const field of CORE) {
    if (missingFromFlags(field)) values[field] = null;
  }

  const gramLimit = basis === "ml" ? VALIDATION_LIMITS.maxMacroSumPer100ml : 100;
  for (const field of GRAM_FIELDS) {
    const v = values[field];
    if (v !== null && v > gramLimit) {
      errors.push({ code: "value_out_of_range", field, message: `${field} liegt über ${gramLimit} g pro 100 ${basis}.` });
    }
  }
  if (values.sodiumMg !== null && values.sodiumMg > VALIDATION_LIMITS.maxSodiumMgPer100g * (basis === "ml" ? 1.5 : 1)) {
    errors.push({ code: "value_out_of_range", field: "sodiumMg", message: "Natrium ist unplausibel hoch." });
  }

  const { kcal, proteinG, carbsG, fatG } = values;
  const macrosKnown = proteinG !== null && carbsG !== null && fatG !== null;

  if (kcal === null && proteinG === null && carbsG === null && fatG === null) {
    errors.push({ code: "no_nutrition_data", message: "Keine Nährwerte vorhanden." });
  }

  if (kcal !== null && kcal > VALIDATION_LIMITS.maxKcalPer100) {
    errors.push({
      code: "kcal_exceeds_max",
      field: "kcal",
      message: `Mehr als ${VALIDATION_LIMITS.maxKcalPer100} kcal pro 100 ${basis} sind nicht möglich.`,
    });
  }

  const macroSum = (proteinG ?? 0) + (carbsG ?? 0) + (fatG ?? 0);
  const macroLimit =
    basis === "ml" ? VALIDATION_LIMITS.maxMacroSumPer100ml : VALIDATION_LIMITS.maxMacroSumPer100g;
  if (macroSum > macroLimit) {
    errors.push({
      code: "macro_sum_exceeds_100",
      message: `Eiweiß + Kohlenhydrate + Fett ergeben mehr als 100 g pro 100 ${basis}.`,
    });
  }

  const alcoholG = input.micronutrients?.alcohol_g ?? null;
  let finalKcal = kcal;
  if (kcal === null) {
    if (macrosKnown) {
      finalKcal = round(kcalFromMacros({ proteinG, carbsG, fatG, alcoholG }), 1);
      flags.add("energy_derived");
    } else {
      flags.add("missing_kcal");
    }
  } else if (macrosKnown && isEnergyMismatch(kcal, { proteinG, carbsG, fatG, alcoholG, fiberG: values.fiberG })) {
    flags.add("energy_mismatch");
  }
  if (proteinG === null) flags.add("missing_protein");
  if (carbsG === null) flags.add("missing_carbs");
  if (fatG === null) flags.add("missing_fat");

  const exceeds = (part: number | null, whole: number | null) =>
    part !== null &&
    whole !== null &&
    part - whole > Math.max(VALIDATION_LIMITS.subsetAbsTolerance, whole * VALIDATION_LIMITS.subsetRelTolerance);
  if (exceeds(values.sugarG, carbsG)) flags.add("sugar_exceeds_carbs");
  if (exceeds(values.saturatedFatG, fatG)) flags.add("saturated_fat_exceeds_fat");

  let saltG = values.saltG;
  let sodiumMg = values.sodiumMg;
  if (saltG !== null && sodiumMg !== null) {
    const expectedSalt = saltGFromSodiumMg(sodiumMg);
    const diff = Math.abs(saltG - expectedSalt);
    if (
      diff >
      Math.max(VALIDATION_LIMITS.saltAbsTolerance, Math.max(saltG, expectedSalt) * VALIDATION_LIMITS.saltRelTolerance)
    ) {
      // EU labels declare salt, so salt is the more trustworthy of the two.
      flags.add("salt_sodium_mismatch");
      flags.add("sodium_derived");
      sodiumMg = round(sodiumMgFromSaltG(saltG), 1);
    }
  } else if (saltG !== null) {
    sodiumMg = round(sodiumMgFromSaltG(saltG), 1);
    flags.add("sodium_derived");
  } else if (sodiumMg !== null) {
    saltG = round(saltGFromSodiumMg(sodiumMg), 3);
    flags.add("salt_derived");
  }

  let micronutrients: Record<string, number> | null = null;
  if (input.micronutrients) {
    micronutrients = {};
    for (const [key, value] of Object.entries(input.micronutrients)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) micronutrients[key] = value;
      else flags.add("micronutrient_dropped");
    }
    if (Object.keys(micronutrients).length === 0) micronutrients = null;
  }

  const nutrients: NutrientProfile = {
    kcal: finalKcal ?? 0,
    proteinG: proteinG ?? 0,
    carbsG: carbsG ?? 0,
    fatG: fatG ?? 0,
    fiberG: values.fiberG,
    sugarG: values.sugarG,
    saturatedFatG: values.saturatedFatG,
    saltG,
    sodiumMg,
    potassiumMg: values.potassiumMg,
    calciumMg: values.calciumMg,
    ironMg: values.ironMg,
    micronutrients,
  };

  const flagList = [...flags].sort();
  return {
    valid: errors.length === 0,
    errors,
    flags: flagList,
    quality: qualityFor(errors.length > 0, flagList, opts.trusted ?? false),
    nutrients,
  };
}

/** Derives the data quality from flags (exported for re-evaluation of stored rows). */
export function qualityFor(hasErrors: boolean, flags: readonly string[], trusted: boolean): DataQuality {
  if (hasErrors || flags.some((f) => SUSPECT_FLAGS.has(f))) return "suspect";
  if (MISSING_CORE_FLAGS.some((f) => flags.includes(f))) return "partial";
  return trusted ? "verified" : "complete";
}

/**
 * Energy plausibility: compares declared kcal with 4/4/9 (+7 alcohol). Because EU labels
 * exclude fibre from carbohydrates (fibre: 2 kcal/g) while USDA includes it, both
 * interpretations are tried and the closer one is used.
 */
export function isEnergyMismatch(
  kcal: number,
  m: { proteinG: number; carbsG: number; fatG: number; alcoholG?: number | null; fiberG?: number | null },
): boolean {
  const base = kcalFromMacros(m);
  const fiber = m.fiberG ?? 0;
  const candidates = [base, base + fiber * KCAL_PER_G_FIBER, base - fiber * (4 - KCAL_PER_G_FIBER)];
  let best = Infinity;
  let bestExpected = base;
  for (const c of candidates) {
    const d = Math.abs(kcal - c);
    if (d < best) {
      best = d;
      bestExpected = c;
    }
  }
  const tolerance = Math.max(
    VALIDATION_LIMITS.energyAbsToleranceKcal,
    Math.max(kcal, bestExpected) * VALIDATION_LIMITS.energyRelTolerance,
  );
  return best > tolerance;
}

export interface FoodLike {
  name: string;
  nutrientBasis: NutrientBasis;
  nutrients: NutrientInput;
  servings: readonly { label: string; amount: number; grams: number }[];
  qualityFlags?: readonly string[] | null;
}

/** Validates a full NormalizedFood (name, nutrients, servings). */
export function validateNormalizedFood(food: FoodLike, opts: Omit<ValidateOptions, "basis" | "existingFlags"> = {}) {
  const result = validateNutrients(food.nutrients, {
    ...opts,
    basis: food.nutrientBasis,
    existingFlags: food.qualityFlags,
  });
  const errors = [...result.errors];
  if (!food.name || !food.name.trim()) {
    errors.unshift({ code: "missing_name", field: "name", message: "Name fehlt." });
  }
  food.servings.forEach((s, i) => {
    if (!isValidServingGrams(s.grams) || !(s.amount > 0) || !s.label?.trim()) {
      errors.push({
        code: "invalid_serving",
        field: `servings.${i}`,
        message: `Portion „${s.label}“ hat keine gültige Menge.`,
      });
    }
  });
  const valid = errors.length === 0;
  return {
    ...result,
    valid,
    errors,
    quality: valid ? result.quality : ("suspect" as const),
  };
}
