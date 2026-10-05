/**
 * Nutrient constants, conversions and the micronutrient catalog: pure, framework-free.
 */
import { KCAL_PER_G } from "@/domain/nutrition/types";

export const KJ_PER_KCAL = 4.184;
/** EU labelling: salt = sodium × 2.5 */
export const SALT_PER_SODIUM = 2.5;
/** Fibre energy factor used on EU labels (kcal/g). */
export const KCAL_PER_G_FIBER = 2;

export function kcalFromKj(kj: number): number {
  return kj / KJ_PER_KCAL;
}

/** sodium (mg) → salt (g) */
export function saltGFromSodiumMg(sodiumMg: number): number {
  return (sodiumMg / 1000) * SALT_PER_SODIUM;
}

/** salt (g) → sodium (mg) */
export function sodiumMgFromSaltG(saltG: number): number {
  return (saltG / SALT_PER_SODIUM) * 1000;
}

/** Atwater general factors (4/4/9, alcohol 7). */
export function kcalFromMacros(m: { proteinG: number; carbsG: number; fatG: number; alcoholG?: number | null }): number {
  return (
    m.proteinG * KCAL_PER_G.protein +
    m.carbsG * KCAL_PER_G.carbs +
    m.fatG * KCAL_PER_G.fat +
    (m.alcoholG ?? 0) * KCAL_PER_G.alcohol
  );
}

export interface MicronutrientDef {
  /** German display name. */
  label: string;
  unit: "g" | "mg" | "µg";
}

/**
 * Keys used in `foods.micronutrients` (jsonb). Key = `<name>_<unit>`, values per 100 g/ml.
 * Only these keys are written by the import pipeline; UI can render them generically.
 */
export const MICRONUTRIENTS = {
  vitamin_a_ug: { label: "Vitamin A", unit: "µg" },
  vitamin_b1_mg: { label: "Vitamin B1 (Thiamin)", unit: "mg" },
  vitamin_b2_mg: { label: "Vitamin B2 (Riboflavin)", unit: "mg" },
  vitamin_b3_mg: { label: "Niacin", unit: "mg" },
  vitamin_b5_mg: { label: "Pantothensäure", unit: "mg" },
  vitamin_b6_mg: { label: "Vitamin B6", unit: "mg" },
  folate_ug: { label: "Folat", unit: "µg" },
  vitamin_b12_ug: { label: "Vitamin B12", unit: "µg" },
  vitamin_c_mg: { label: "Vitamin C", unit: "mg" },
  vitamin_d_ug: { label: "Vitamin D", unit: "µg" },
  vitamin_e_mg: { label: "Vitamin E", unit: "mg" },
  vitamin_k_ug: { label: "Vitamin K", unit: "µg" },
  magnesium_mg: { label: "Magnesium", unit: "mg" },
  phosphorus_mg: { label: "Phosphor", unit: "mg" },
  zinc_mg: { label: "Zink", unit: "mg" },
  copper_mg: { label: "Kupfer", unit: "mg" },
  manganese_mg: { label: "Mangan", unit: "mg" },
  selenium_ug: { label: "Selen", unit: "µg" },
  iodine_ug: { label: "Jod", unit: "µg" },
  cholesterol_mg: { label: "Cholesterin", unit: "mg" },
  trans_fat_g: { label: "Transfette", unit: "g" },
  monounsaturated_fat_g: { label: "Einfach ungesättigte Fettsäuren", unit: "g" },
  polyunsaturated_fat_g: { label: "Mehrfach ungesättigte Fettsäuren", unit: "g" },
  added_sugar_g: { label: "Zugesetzter Zucker", unit: "g" },
  starch_g: { label: "Stärke", unit: "g" },
  polyols_g: { label: "Mehrwertige Alkohole", unit: "g" },
  alcohol_g: { label: "Alkohol", unit: "g" },
  caffeine_mg: { label: "Koffein", unit: "mg" },
  water_g: { label: "Wasser", unit: "g" },
} as const satisfies Record<string, MicronutrientDef>;

export type MicronutrientKey = keyof typeof MICRONUTRIENTS;

export function isMicronutrientKey(key: string): key is MicronutrientKey {
  return Object.prototype.hasOwnProperty.call(MICRONUTRIENTS, key);
}
