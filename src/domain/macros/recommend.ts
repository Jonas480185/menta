/**
 * Auto mode: macro recommendation from calorie target, body weight, goal and activity.
 *
 * Model (sources and reasoning: docs/architecture/macro-engine.md §4):
 *   Protein  = g/kg by goal (lose 2.0 · maintain 1.6 · gain 1.8) + activity adjustment (−0.2 … +0.2),
 *              clamped to 1.2–2.2 g/kg, times a *reference weight* (adjusted for high body weights),
 *              and capped at 40 % of the calories.
 *   Fat      = max(share of kcal by goal (lose 25 % · maintain 30 % · gain 25 %), 0.6 g/kg reference weight),
 *              capped at 40 % of the calories.
 *   Carbs    = remainder (balancing macro of the rounding strategy).
 */
import { KCAL_PER_G } from "@/domain/nutrition/types";
import { assertKcal, buildCalculation, fitMacrosToKcal } from "./math";
import { MacroInputError, type ActivityLevel, type GoalType, type MacroCalculation } from "./types";

export const PROTEIN_G_PER_KG_BY_GOAL: Record<GoalType, number> = {
  lose: 2.0,
  maintain: 1.6,
  gain: 1.8,
};

/** More training volume → slightly more protein; sedentary people need less. */
export const PROTEIN_ACTIVITY_ADJUSTMENT: Record<ActivityLevel, number> = {
  sedentary: -0.2,
  light: -0.1,
  moderate: 0,
  active: 0.1,
  very_active: 0.2,
};

export const PROTEIN_G_PER_KG_MIN = 1.2;
export const PROTEIN_G_PER_KG_MAX = 2.2;
export const PROTEIN_MAX_KCAL_SHARE = 0.4;

export const FAT_KCAL_SHARE_BY_GOAL: Record<GoalType, number> = {
  lose: 0.25,
  maintain: 0.3,
  gain: 0.25,
};
export const FAT_MIN_G_PER_KG = 0.6;
export const FAT_MAX_KCAL_SHARE = 0.4;

/** BMI above which the reference weight is adjusted. */
export const REFERENCE_BMI = 25;
/** Share of the excess weight (above BMI 25 / target weight) counted for protein & fat floors. */
export const EXCESS_WEIGHT_FACTOR = 0.25;

export interface RecommendMacrosInput {
  /** Daily calorie target (kcal). */
  kcal: number;
  /** Current body weight (kg). */
  weightKg: number;
  /** Optional target weight; used as anchor for the reference weight when no height is known. */
  targetWeightKg?: number | null;
  /** Optional height; enables the BMI-based reference weight. */
  heightCm?: number | null;
  goal: GoalType;
  activityLevel: ActivityLevel;
}

export interface MacroRecommendation extends MacroCalculation {
  /** Weight the g/kg factors were applied to. */
  referenceWeightKg: number;
  /** Protein factor that was used (g per kg reference weight, before the kcal cap). */
  proteinGPerKg: number;
  /** Effective fat per kg reference weight. */
  fatGPerKg: number;
  /** German, one line per decision – shown under "Wie berechnet?". */
  rationale: string[];
}

/**
 * Weight used for g/kg factors. For high body weights the full weight would overstate protein needs
 * (fat mass needs little protein), so only 25 % of the excess above the BMI-25 weight
 * (or, without height, above the target weight) is counted.
 */
export function referenceWeight(input: {
  weightKg: number;
  heightCm?: number | null;
  targetWeightKg?: number | null;
}): number {
  const { weightKg, heightCm, targetWeightKg } = input;
  let anchor: number | null = null;
  if (heightCm && heightCm > 0) {
    const m = heightCm / 100;
    anchor = REFERENCE_BMI * m * m;
  } else if (targetWeightKg && targetWeightKg > 0) {
    anchor = targetWeightKg;
  }
  if (anchor === null || weightKg <= anchor) return weightKg;
  return anchor + EXCESS_WEIGHT_FACTOR * (weightKg - anchor);
}

/**
 * Recommends integer macro grams whose energy matches `kcal` (± 5 kcal).
 *
 *   recommendMacros({ kcal: 2300, weightKg: 75, goal: "lose", activityLevel: "moderate" })
 *   // → { proteinG: 150, carbsG: 281, fatG: 64 }  (= 2300 kcal)
 */
export function recommendMacros(input: RecommendMacrosInput): MacroRecommendation {
  const { kcal, weightKg, goal, activityLevel } = input;
  assertKcal(kcal);
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
    throw new MacroInputError(
      "invalid_weight",
      "Bitte gib ein Gewicht zwischen 20 und 400 kg an.",
      "weightKg",
    );
  }

  const refKg = referenceWeight(input);
  const rationale: string[] = [];
  if (Math.abs(refKg - weightKg) > 0.05) {
    rationale.push(
      `Bezugsgewicht ${fmt(refKg)} kg statt ${fmt(weightKg)} kg – bei höherem Gewicht zählt nur ein Teil davon für den Proteinbedarf.`,
    );
  }

  // Protein
  const perKg = clamp(
    PROTEIN_G_PER_KG_BY_GOAL[goal] + PROTEIN_ACTIVITY_ADJUSTMENT[activityLevel],
    PROTEIN_G_PER_KG_MIN,
    PROTEIN_G_PER_KG_MAX,
  );
  let proteinG = perKg * refKg;
  const proteinCap = (kcal * PROTEIN_MAX_KCAL_SHARE) / KCAL_PER_G.protein;
  if (proteinG > proteinCap) {
    proteinG = proteinCap;
    rationale.push(
      `Protein auf 40 % der Kalorien begrenzt, damit genug Energie für Kohlenhydrate und Fett bleibt.`,
    );
  } else {
    rationale.push(`Protein ${fmt(perKg)} g pro kg ${GOAL_REASON[goal]}`);
  }

  // Fat
  const share = FAT_KCAL_SHARE_BY_GOAL[goal];
  const fatByShare = (kcal * share) / KCAL_PER_G.fat;
  const fatFloor = FAT_MIN_G_PER_KG * refKg;
  const fatCap = (kcal * FAT_MAX_KCAL_SHARE) / KCAL_PER_G.fat;
  let fatG = Math.max(fatByShare, fatFloor);
  if (fatG > fatCap) fatG = fatCap;
  if (fatFloor > fatByShare) {
    rationale.push(
      `Fett mindestens ${fmt(FAT_MIN_G_PER_KG)} g pro kg – wichtig für Hormone und Vitaminaufnahme.`,
    );
  } else {
    rationale.push(`Fett ${Math.round(share * 100)} % der Kalorien – im Rahmen der DGE-Empfehlung (30 %).`);
  }

  // Carbs = remainder
  const carbsG = Math.max(
    0,
    (kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs,
  );
  rationale.push(
    "Kohlenhydrate füllen die restlichen Kalorien auf – dein wichtigster Energielieferant fürs Training.",
  );

  const macros = fitMacrosToKcal(kcal, { proteinG, carbsG, fatG });
  const calc = buildCalculation(kcal, macros, { weightKg: refKg });
  return {
    ...calc,
    referenceWeightKg: refKg,
    proteinGPerKg: perKg,
    fatGPerKg: macros.fatG / refKg,
    rationale,
  };
}

const GOAL_REASON: Record<GoalType, string> = {
  lose: "– schützt deine Muskeln im Kaloriendefizit und sättigt gut.",
  maintain: "– deckt den Bedarf bei regelmäßiger Bewegung gut ab.",
  gain: "– unterstützt den Muskelaufbau im Kalorienüberschuss.",
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

const fmtNum = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
function fmt(n: number): string {
  return fmtNum.format(n);
}
