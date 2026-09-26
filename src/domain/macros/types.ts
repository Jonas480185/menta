/**
 * Macro Engine – shared types. Pure TypeScript (no framework/DB imports).
 * Units: energy kcal, macros g. Energy factors 4/4/9 (see KCAL_PER_G).
 *
 * Docs: docs/architecture/macro-engine.md
 */
import type { Macros } from "@/domain/nutrition/types";

export type { Macros };

/** Share of energy per macro in percent (0–100); protein + carbs + fat = 100. */
export interface MacroPercents {
  protein: number;
  carbs: number;
  fat: number;
}

/** Mirrors the `macro_mode` enum of goal_profiles. */
export type MacroMode = "percent" | "grams" | "auto";

/** Mirrors the `goal_type` enum of user_profiles. */
export type GoalType = "lose" | "maintain" | "gain";

/** Mirrors the `activity_level` enum of user_profiles. */
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

/** Mirrors the `goal_profile_kind` enum of goal_profiles. */
export type DayProfileKind = "default" | "training" | "rest" | "high_carb" | "low_carb" | "refeed" | "custom";

/**
 * Non-fatal findings of a calculation. The UI shows them as hints; services reject only
 * `carbs_negative` (the grams can't be satisfied within the calorie target).
 */
export type MacroWarningCode =
  /** Protein + fat alone exceed the calorie target → carbs clamped to 0. */
  | "carbs_negative"
  /** Carbs < 50 g/day – fine for keto, but worth a hint. */
  | "carbs_very_low"
  /** Fat below ~0.5 g/kg or < 20 % kcal (hormonal health). */
  | "fat_low"
  /** Protein above 2.5 g/kg (not harmful for healthy people, rarely useful). */
  | "protein_high"
  /** Calorie target below 1200 kcal. */
  | "calories_low";

export interface MacroWarning {
  code: MacroWarningCode;
  /** German, friendly, user-facing. */
  message: string;
}

/** Result of every target calculation – the "these macros equal X kcal" transparency payload. */
export interface MacroCalculation {
  /** The calorie target the grams were fitted to. */
  kcal: number;
  /** Integer grams, fitted so that 4P + 4C + 9F is within MACRO_KCAL_TOLERANCE of `kcal`. */
  macros: Macros;
  /** 4P + 4C + 9F of `macros`. */
  macroKcal: number;
  /** macroKcal − kcal (usually −2 … +2). */
  diffKcal: number;
  /** Effective energy shares of the rounded grams (unrounded, sum = 100 – round for display only). */
  percents: MacroPercents;
  warnings: MacroWarning[];
}

export type MacroErrorCode =
  | "invalid_kcal"
  | "invalid_grams"
  | "invalid_percent"
  | "percent_sum"
  | "invalid_weight"
  | "invalid_weekday"
  | "weekday_conflict";

/**
 * Invalid input to a macro function (programming error or unvalidated user input).
 * Services translate it into AppError("VALIDATION"). `message` is German and user-presentable.
 */
export class MacroInputError extends Error {
  constructor(
    public readonly code: MacroErrorCode,
    message: string,
    /** Field name the error belongs to, e.g. "percents" or "grams.fatG". */
    public readonly field?: string,
  ) {
    super(message);
    this.name = "MacroInputError";
  }
}
