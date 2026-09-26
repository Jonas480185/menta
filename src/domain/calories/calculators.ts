import { ACTIVITY_MULTIPLIERS, BODY_LIMITS } from "./constants";
import { CalorieInputError } from "./errors";
import { computeCalorieTarget, validateBodyProfile } from "./target";
import type { BodyProfile, CalorieCalculator, Sex } from "./types";

/**
 * BMR formulas behind the swappable CalorieCalculator interface.
 * Formulas, sources and the "unspecified" sex rule: docs/architecture/calorie-engine.md §3.
 */

export interface CalculatorDefinition {
  id: string;
  name: string;
  description: string;
  requires?: readonly (keyof BodyProfile)[];
  /** Extra availability check on top of validateBodyProfile (default: always true). */
  canCalculate?(profile: BodyProfile): boolean;
  /** Raw formula – input is already validated. kcal/day, unrounded. */
  bmr(profile: BodyProfile): number;
}

/**
 * Builds a CalorieCalculator from a BMR formula. TDEE (× PAL) and the target logic (pace,
 * 25 % cap, safety floor, time to goal) are shared by every calculator.
 */
export function defineCalculator(def: CalculatorDefinition): CalorieCalculator {
  const calculator: CalorieCalculator = {
    id: def.id,
    name: def.name,
    description: def.description,
    requires: def.requires ?? [],
    canCalculate: (profile) => def.canCalculate?.(profile) ?? true,
    calculateBMR(profile) {
      validateBodyProfile(profile);
      return def.bmr(profile);
    },
    calculateTDEE(profile) {
      return calculator.calculateBMR(profile) * ACTIVITY_MULTIPLIERS[profile.activityLevel];
    },
    calculateTarget(profile, goal) {
      return computeCalorieTarget({ calculatorId: def.id, bmr: calculator.calculateBMR(profile), profile, goal });
    },
  };
  return Object.freeze(calculator);
}

/** Sex-specific constant; "unspecified" = arithmetic mean of the male and female value. */
function bySex(sex: Sex, values: { male: number; female: number }): number {
  if (sex === "male") return values.male;
  if (sex === "female") return values.female;
  return (values.male + values.female) / 2;
}

/**
 * Mifflin-St Jeor (1990): BMR = 10·kg + 6.25·cm − 5·age + s,
 * s = +5 (male), −161 (female), −78 (unspecified, mean of both).
 */
export const mifflinStJeor = defineCalculator({
  id: "mifflin_st_jeor",
  name: "Mifflin-St Jeor",
  description: "Aktueller Standard für Erwachsene – die genaueste Schätzung ohne Körperfettmessung.",
  bmr: (p) => 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.ageYears + bySex(p.sex, { male: 5, female: -161 }),
});

/**
 * Revised Harris-Benedict (Roza & Shizgal 1984):
 *   male   88.362 + 13.397·kg + 4.799·cm − 5.677·age
 *   female 447.593 + 9.247·kg + 3.098·cm − 4.330·age
 *   unspecified: mean of both equations.
 */
export const harrisBenedictRevised = defineCalculator({
  id: "harris_benedict_revised",
  name: "Harris-Benedict (revidiert)",
  description: "Klassische Formel, überarbeitet 1984 – schätzt meist etwas höher als Mifflin-St Jeor.",
  bmr: (p) => {
    const male = 88.362 + 13.397 * p.weightKg + 4.799 * p.heightCm - 5.677 * p.ageYears;
    const female = 447.593 + 9.247 * p.weightKg + 3.098 * p.heightCm - 4.33 * p.ageYears;
    return bySex(p.sex, { male, female });
  },
});

function hasValidBodyFat(p: BodyProfile): p is BodyProfile & { bodyFatPct: number } {
  const { min, max } = BODY_LIMITS.bodyFatPct;
  return typeof p.bodyFatPct === "number" && Number.isFinite(p.bodyFatPct) && p.bodyFatPct >= min && p.bodyFatPct <= max;
}

/**
 * Katch-McArdle: BMR = 370 + 21.6 · lean body mass (kg), LBM = kg · (1 − body fat % / 100).
 * Sex-independent; needs a body fat percentage – calculateBMR throws CalorieInputError without it.
 */
export const katchMcArdle = defineCalculator({
  id: "katch_mcardle",
  name: "Katch-McArdle",
  description: "Rechnet mit deiner fettfreien Masse – sinnvoll, wenn du deinen Körperfettanteil kennst.",
  requires: ["bodyFatPct"],
  canCalculate: hasValidBodyFat,
  bmr: (p) => {
    if (!hasValidBodyFat(p)) {
      const { min, max } = BODY_LIMITS.bodyFatPct;
      throw new CalorieInputError(
        "bodyFatPct",
        `Für Katch-McArdle brauchen wir deinen Körperfettanteil (${min}–${max} %).`,
      );
    }
    const leanMassKg = p.weightKg * (1 - p.bodyFatPct / 100);
    return 370 + 21.6 * leanMassKg;
  },
});

export const DEFAULT_CALCULATOR_ID = mifflinStJeor.id;

/** All registered calculators, default first. Add new ones here (see docs §6). */
export const CALCULATORS: readonly CalorieCalculator[] = [mifflinStJeor, harrisBenedictRevised, katchMcArdle];

export function isCalculatorId(id: string): boolean {
  return CALCULATORS.some((c) => c.id === id);
}

/** Registered calculator by id; throws RangeError for unknown ids. */
export function getCalculator(id: string = DEFAULT_CALCULATOR_ID): CalorieCalculator {
  const calculator = CALCULATORS.find((c) => c.id === id);
  if (!calculator) throw new RangeError(`Unknown calorie calculator: "${id}"`);
  return calculator;
}
