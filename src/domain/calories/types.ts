/**
 * Calorie Engine – value types.
 * Pure TypeScript: no framework or DB imports. Units: kcal/day, kg, cm, years.
 *
 * The string unions mirror the Postgres enums in src/server/db/schema/profile.ts
 * (sex, activity_level, goal_type, goal_pace) so rows can be passed in without mapping.
 */

export type Sex = "female" | "male" | "unspecified";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "lose" | "maintain" | "gain";
export type GoalPace = "slow" | "moderate" | "fast";

/** Everything a calculator needs about the body. */
export interface BodyProfile {
  ageYears: number;
  /** "unspecified" → average of the male/female sex constants (see docs/architecture/calorie-engine.md). */
  sex: Sex;
  heightCm: number;
  /** Current weight (latest weight entry, else start weight). */
  weightKg: number;
  /** Body fat in percent (0–100). Required by Katch-McArdle only. */
  bodyFatPct?: number | null;
  activityLevel: ActivityLevel;
}

export interface GoalSettings {
  type: GoalType;
  /** Ignored for "maintain". Missing for lose/gain → "moderate". Gain has no "fast" (treated as "moderate"). */
  pace?: GoalPace | null;
  targetWeightKg?: number | null;
}

/** Machine-readable reason for a warning – lets the UI pick an icon/tone without parsing text. */
export type CalorieWarningCode =
  | "deficit_capped"
  | "floor_applied"
  | "low_maintenance"
  | "target_above_current"
  | "target_below_current"
  | "goal_reached"
  | "pace_adjusted"
  | "calculator_fallback"
  | "age_outside_range"
  /** Only from checkManualTarget(). */
  | "manual_below_floor";

export interface CalorieWarning {
  code: CalorieWarningCode;
  /** Friendly German sentence, ready to show as-is. */
  message: string;
}

/**
 * Result of a calorie calculation – everything the UI needs for the transparent chain
 * "Grundumsatz → × Aktivität = Erhaltungsbedarf → ± Anpassung = Tagesziel".
 *
 * `bmr` and `tdee` are unrounded (round only for display / storage); `adjustment` and `target`
 * are whole kcal – `target` is rounded to 10 kcal (a recommendation, not a measurement).
 */
export interface CalorieCalculation {
  calculatorId: string;
  /** Basal metabolic rate (Grundumsatz), kcal/day, unrounded. */
  bmr: number;
  /** Physical activity level multiplier (PAL), e.g. 1.55. */
  activityMultiplier: number;
  /** Total daily energy expenditure (Erhaltungsbedarf) = bmr × activityMultiplier, unrounded. */
  tdee: number;
  /**
   * Applied daily adjustment in kcal (negative = deficit, positive = surplus, 0 = maintain).
   * After the 25 % cap; when the safety floor kicks in it is `target − round(tdee)`.
   */
  adjustment: number;
  /** Recommended daily calorie target (Tagesziel), rounded to 10 kcal. */
  target: number;
  /** The adjustment the chosen pace asked for before cap/floor (e.g. −750 for "fast"). */
  requestedAdjustment: number;
  /** Lowest target we recommend for this person (kcal), see SAFETY in constants.ts. */
  floorKcal: number;
  /** True when the safety floor raised the target. */
  floorApplied: boolean;
  /** True when the deficit was limited to 25 % of the TDEE. */
  capApplied: boolean;
  /** Expected weight change per week in kg (adjustment × 7 / 7700); negative = loss. */
  weeklyChangeKg: number;
  /** Whole weeks until the target weight, or null (no target, maintain, wrong direction, no change). */
  estimatedWeeksToGoal: number | null;
  /** German messages, ready to show. Same order as `warningDetails`. */
  warnings: string[];
  warningDetails: CalorieWarning[];
}

/** The public result type of `CalorieCalculator.calculateTarget`. */
export type CalorieTarget = CalorieCalculation;

/**
 * A swappable BMR/TDEE/target strategy. Implementations only differ in `calculateBMR`;
 * use `defineCalculator()` (calculators.ts) to get the shared TDEE/target logic.
 */
export interface CalorieCalculator {
  /** Stable identifier stored in user_profiles.calculator_id, e.g. "mifflin_st_jeor". */
  id: string;
  /** German display name, e.g. "Mifflin-St Jeor". */
  name: string;
  /** One German sentence for the settings screen. */
  description: string;
  /** Profile fields the formula needs beyond the basics (e.g. ["bodyFatPct"]). */
  requires: readonly (keyof BodyProfile)[];
  /** False when the profile lacks something the formula needs (e.g. body fat for Katch-McArdle). */
  canCalculate(profile: BodyProfile): boolean;
  /** kcal/day, unrounded. Throws CalorieInputError on invalid/missing input. */
  calculateBMR(profile: BodyProfile): number;
  /** kcal/day, unrounded = BMR × activity multiplier. */
  calculateTDEE(profile: BodyProfile): number;
  calculateTarget(profile: BodyProfile, goal: GoalSettings): CalorieTarget;
}
