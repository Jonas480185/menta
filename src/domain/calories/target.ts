import { formatKcal, formatSignedKcal } from "@/lib/format";
import {
  ACTIVITY_MULTIPLIERS,
  BODY_LIMITS,
  DEFAULT_GOAL_PACE,
  GOAL_PACES,
  KCAL_PER_KG_BODY_WEIGHT,
  SAFETY,
} from "./constants";
import { CalorieInputError } from "./errors";
import type {
  BodyProfile,
  CalorieCalculation,
  CalorieWarning,
  CalorieWarningCode,
  GoalPace,
  GoalSettings,
} from "./types";

const SEXES = ["female", "male", "unspecified"] as const;
const GOAL_TYPE_IDS = ["lose", "maintain", "gain"] as const;

const step = SAFETY.roundingStepKcal;
const round10 = (n: number) => Math.round(n / step) * step;
const ceil10 = (n: number) => Math.ceil(n / step) * step;
const floor10 = (n: number) => Math.floor(n / step) * step;

function inRange(value: unknown, range: { min: number; max: number }): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= range.min && value <= range.max;
}

/** Throws CalorieInputError (German message) when a body value is missing or outside BODY_LIMITS. */
export function validateBodyProfile(profile: BodyProfile): void {
  const { ageYears, heightCm, weightKg } = BODY_LIMITS;
  if (!inRange(profile.ageYears, ageYears)) {
    throw new CalorieInputError(
      "ageYears",
      `Bitte ein Alter zwischen ${ageYears.min} und ${ageYears.max} Jahren angeben.`,
    );
  }
  if (!inRange(profile.heightCm, heightCm)) {
    throw new CalorieInputError(
      "heightCm",
      `Bitte eine Größe zwischen ${heightCm.min} und ${heightCm.max} cm eingeben.`,
    );
  }
  if (!inRange(profile.weightKg, weightKg)) {
    throw new CalorieInputError(
      "weightKg",
      `Bitte ein Gewicht zwischen ${weightKg.min} und ${weightKg.max} kg eingeben.`,
    );
  }
  if (!SEXES.includes(profile.sex)) {
    throw new CalorieInputError("sex", "Bitte ein gültiges Geschlecht auswählen.");
  }
  if (!(profile.activityLevel in ACTIVITY_MULTIPLIERS)) {
    throw new CalorieInputError("activityLevel", "Bitte wähle aus, wie aktiv du im Alltag bist.");
  }
}

function validateGoal(goal: GoalSettings): void {
  if (!GOAL_TYPE_IDS.includes(goal.type)) {
    throw new CalorieInputError("goalType", "Bitte wähle ein Ziel aus.");
  }
  if (goal.targetWeightKg != null && !inRange(goal.targetWeightKg, BODY_LIMITS.weightKg)) {
    const { min, max } = BODY_LIMITS.weightKg;
    throw new CalorieInputError("targetWeightKg", `Bitte ein Zielgewicht zwischen ${min} und ${max} kg eingeben.`);
  }
}

/**
 * Resolves the effective pace for a goal: maintain → null; missing → "moderate";
 * gain + "fast" → "moderate" (adjusted = true).
 */
export function resolveGoalPace(goal: GoalSettings): { pace: GoalPace | null; adjusted: boolean } {
  if (goal.type === "maintain") return { pace: null, adjusted: false };
  const wanted = goal.pace ?? DEFAULT_GOAL_PACE;
  const available = GOAL_PACES.some((p) => p.goal === goal.type && p.pace === wanted);
  return available ? { pace: wanted, adjusted: false } : { pace: DEFAULT_GOAL_PACE, adjusted: true };
}

/** Requested daily adjustment for a goal before safety rules (kcal; negative = deficit). */
export function requestedAdjustmentKcal(goal: GoalSettings): number {
  const { pace } = resolveGoalPace(goal);
  if (pace === null) return 0;
  return GOAL_PACES.find((p) => p.goal === goal.type && p.pace === pace)?.adjustmentKcal ?? 0;
}

/**
 * Lowest recommended target when eating in a deficit, rounded to 10 kcal:
 * max(absolute minimum by sex, BMR), but never above the TDEE (so a deficit can shrink to
 * zero, but the floor never turns a "lose" goal into a surplus).
 */
export function safetyFloorKcal(profile: Pick<BodyProfile, "sex">, bmr: number, tdee: number): number {
  const absoluteMin = SAFETY.minTargetKcal[profile.sex];
  return Math.min(ceil10(Math.max(absoluteMin, bmr)), floor10(tdee));
}

/** Weekly body weight change in kg for a daily energy balance (kcal/day). Negative = loss. */
export function weeklyChangeKgFor(dailyBalanceKcal: number): number {
  return (dailyBalanceKcal * 7) / KCAL_PER_KG_BODY_WEIGHT;
}

export const WARNING_MESSAGES = {
  deficitCapped: (maxDeficit: number) =>
    `Dein Defizit ist auf ${formatSignedKcal(-maxDeficit)} begrenzt, also höchstens 25 % deines Erhaltungsbedarfs. So bleibt es gut durchhaltbar.`,
  floorApplied: (floor: number) =>
    `Dein Tagesziel bleibt bei mindestens ${formatKcal(floor)}. Weniger empfehlen wir nicht ohne ärztliche Begleitung. Dafür geht es etwas langsamer voran.`,
  lowMaintenance: () =>
    "Dein geschätzter Erhaltungsbedarf ist sehr niedrig. Sprich bei Unsicherheit gern mit einer Ärztin oder einem Arzt.",
  targetAboveCurrent: () =>
    "Dein Zielgewicht liegt über deinem aktuellen Gewicht. Passt „Abnehmen“ als Ziel, oder möchtest du lieber halten oder zunehmen?",
  targetBelowCurrent: () =>
    "Dein Zielgewicht liegt unter deinem aktuellen Gewicht. Passt „Zunehmen“ als Ziel, oder möchtest du lieber halten oder abnehmen?",
  goalReached: () => "Du bist schon bei deinem Zielgewicht. Magst du auf „Gewicht halten“ wechseln?",
  paceAdjusted: () =>
    "Beim Zunehmen empfehlen wir höchstens ein moderates Tempo. Wir rechnen deshalb mit „Moderat“.",
  calculatorFallback: (name: string, fallbackName: string) =>
    `Für ${name} fehlt ein gültiger Körperfettanteil. Wir rechnen deshalb mit ${fallbackName}.`,
  underAdultAge: () =>
    "Die Formeln wurden für Erwachsene entwickelt. Im Wachstum ist der Bedarf oft höher. Sprich im Zweifel mit einer Ärztin oder einem Arzt.",
  overAdultAge: () => "Die Formeln sind für dein Alter wenig erprobt. Nimm das Ergebnis als groben Richtwert.",
} as const;

/** Treat |current − target| below this as "already there" (kg). */
const GOAL_REACHED_TOLERANCE_KG = 0.1;

export interface ComputeTargetInput {
  calculatorId: string;
  bmr: number;
  profile: BodyProfile;
  goal: GoalSettings;
  /** Warnings produced before this step (e.g. calculator fallback): kept first. */
  warnings?: CalorieWarning[];
}

/**
 * Shared target logic for every calculator: TDEE = BMR × PAL, pace adjustment, 25 % deficit cap,
 * safety floor, weekly change and time to goal. See docs/architecture/calorie-engine.md §4.
 */
export function computeCalorieTarget(input: ComputeTargetInput): CalorieCalculation {
  const { calculatorId, bmr, profile, goal } = input;
  validateBodyProfile(profile);
  validateGoal(goal);

  const details: CalorieWarning[] = [...(input.warnings ?? [])];
  const warn = (code: CalorieWarningCode, message: string) => details.push({ code, message });

  if (profile.ageYears < BODY_LIMITS.adultAgeYears.min) warn("age_outside_range", WARNING_MESSAGES.underAdultAge());
  else if (profile.ageYears > BODY_LIMITS.adultAgeYears.max) warn("age_outside_range", WARNING_MESSAGES.overAdultAge());

  const activityMultiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel];
  const tdee = bmr * activityMultiplier;
  const roundedTdee = Math.round(tdee);

  if (resolveGoalPace(goal).adjusted) warn("pace_adjusted", WARNING_MESSAGES.paceAdjusted());
  const requestedAdjustment = requestedAdjustmentKcal(goal);

  // 1) Cap the deficit at 25 % of the TDEE (rounded down to 10 kcal → never more aggressive).
  let adjustment = requestedAdjustment;
  let capApplied = false;
  if (adjustment < 0) {
    const maxDeficit = floor10(tdee * SAFETY.maxDeficitShareOfTdee);
    if (-adjustment > maxDeficit) {
      adjustment = -maxDeficit;
      capApplied = true;
      warn("deficit_capped", WARNING_MESSAGES.deficitCapped(maxDeficit));
    }
  }

  // 2) Target = rounded TDEE + adjustment, rounded to 10 kcal ("2.798 − 500 = 2.300").
  let target = round10(roundedTdee + adjustment);

  // 3) Safety floor: only relevant when eating in a deficit.
  const floorKcal = safetyFloorKcal(profile, bmr, tdee);
  let floorApplied = false;
  if (adjustment < 0 && target < floorKcal) {
    target = floorKcal;
    adjustment = target - roundedTdee;
    // Floor at (rounded) TDEE: the "deficit" is only rounding noise → no deficit at all.
    if (adjustment > -step) adjustment = 0;
    floorApplied = true;
    warn("floor_applied", WARNING_MESSAGES.floorApplied(floorKcal));
  }
  if (tdee < SAFETY.minTargetKcal[profile.sex]) warn("low_maintenance", WARNING_MESSAGES.lowMaintenance());

  // 4) Weekly change & time to goal.
  const weeklyChangeKg = goal.type === "maintain" ? 0 : weeklyChangeKgFor(adjustment);
  let estimatedWeeksToGoal: number | null = null;
  if (goal.type !== "maintain" && goal.targetWeightKg != null) {
    const diffKg = goal.targetWeightKg - profile.weightKg; // negative = need to lose
    const wantsLoss = goal.type === "lose";
    if (Math.abs(diffKg) < GOAL_REACHED_TOLERANCE_KG) {
      estimatedWeeksToGoal = 0;
      warn("goal_reached", WARNING_MESSAGES.goalReached());
    } else if (wantsLoss && diffKg > 0) {
      warn("target_above_current", WARNING_MESSAGES.targetAboveCurrent());
    } else if (!wantsLoss && diffKg < 0) {
      warn("target_below_current", WARNING_MESSAGES.targetBelowCurrent());
    } else if (weeklyChangeKg !== 0 && Math.sign(weeklyChangeKg) === Math.sign(diffKg)) {
      estimatedWeeksToGoal = Math.ceil(Math.abs(diffKg / weeklyChangeKg) - 1e-9);
    }
  }

  return {
    calculatorId,
    bmr,
    activityMultiplier,
    tdee,
    adjustment,
    target,
    requestedAdjustment,
    floorKcal,
    floorApplied,
    capApplied,
    weeklyChangeKg,
    estimatedWeeksToGoal,
    warnings: details.map((w) => w.message),
    warningDetails: details,
  };
}
