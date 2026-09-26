import type { ActivityLevel, GoalPace, GoalType, Sex } from "./types";

/**
 * Calorie Engine parameters. Every number here is documented (with sources) in
 * docs/architecture/calorie-engine.md – change both together.
 */

/** Energy content of 1 kg body weight change (Wishnofsky rule of thumb, ≈ 7700 kcal/kg). */
export const KCAL_PER_KG_BODY_WEIGHT = 7700;

/** Safety rules applied to every calculated target. */
export const SAFETY = {
  /** A deficit never exceeds this share of the TDEE. */
  maxDeficitShareOfTdee: 0.25,
  /**
   * Absolute minimum daily target when losing weight (commonly cited lower bounds for
   * unsupervised diets: 1200 kcal women, 1500 kcal men; "unspecified" = midpoint).
   * The effective floor is max(absolute minimum, BMR), but never above the TDEE.
   */
  minTargetKcal: { female: 1200, male: 1500, unspecified: 1350 } satisfies Record<Sex, number>,
  /** Targets are rounded to this step (kcal). */
  roundingStepKcal: 10,
} as const;

/** Hard input limits. Height/weight match the DB CHECKs on user_profiles / weight_entries. */
export const BODY_LIMITS = {
  ageYears: { min: 14, max: 120 },
  /** The formulas were derived from adults – below/above this we add a gentle hint. */
  adultAgeYears: { min: 18, max: 100 },
  heightCm: { min: 50, max: 300 },
  weightKg: { min: 20, max: 400 },
  /** Plausible range for Katch-McArdle; outside of it we fall back to the default formula. */
  bodyFatPct: { min: 2, max: 70 },
} as const;

export interface ActivityLevelInfo {
  id: ActivityLevel;
  /** PAL multiplier applied to the BMR. */
  multiplier: number;
  /** Short German label, e.g. "Moderat aktiv". */
  label: string;
  /** One German sentence with everyday examples. */
  description: string;
}

/**
 * Activity levels (PAL multipliers after McArdle/Katch; the classic Harris-Benedict factors),
 * ordered from least to most active – render them in this order.
 */
export const ACTIVITY_LEVELS: readonly ActivityLevelInfo[] = [
  {
    id: "sedentary",
    multiplier: 1.2,
    label: "Kaum aktiv",
    description: "Überwiegend sitzend, z. B. Bürojob, wenig Wege zu Fuß, kein Sport.",
  },
  {
    id: "light",
    multiplier: 1.375,
    label: "Leicht aktiv",
    description: "Sitzender Job mit etwas Bewegung im Alltag oder 1–3 Trainings pro Woche.",
  },
  {
    id: "moderate",
    multiplier: 1.55,
    label: "Moderat aktiv",
    description: "Viel auf den Beinen, z. B. Verkauf oder Pflege, oder 3–5 Trainings pro Woche.",
  },
  {
    id: "active",
    multiplier: 1.725,
    label: "Sehr aktiv",
    description: "Körperlich fordernder Job, z. B. Handwerk, oder 6–7 Trainings pro Woche.",
  },
  {
    id: "very_active",
    multiplier: 1.9,
    label: "Extrem aktiv",
    description: "Harte körperliche Arbeit plus Training oder Leistungssport mit täglich mehreren Einheiten.",
  },
];

export const ACTIVITY_MULTIPLIERS: Readonly<Record<ActivityLevel, number>> = Object.fromEntries(
  ACTIVITY_LEVELS.map((l) => [l.id, l.multiplier]),
) as Record<ActivityLevel, number>;

export function getActivityLevel(id: ActivityLevel): ActivityLevelInfo {
  const level = ACTIVITY_LEVELS.find((l) => l.id === id);
  if (!level) throw new RangeError(`Unknown activity level: ${String(id)}`);
  return level;
}

export interface GoalTypeInfo {
  id: GoalType;
  label: string;
  description: string;
}

export const GOAL_TYPES: readonly GoalTypeInfo[] = [
  { id: "lose", label: "Abnehmen", description: "Mit einem moderaten Kaloriendefizit Gewicht verlieren." },
  { id: "maintain", label: "Gewicht halten", description: "So viel essen, wie du verbrauchst." },
  { id: "gain", label: "Zunehmen", description: "Mit einem kleinen Überschuss Gewicht oder Muskeln aufbauen." },
];

export interface GoalPaceInfo {
  goal: Exclude<GoalType, "maintain">;
  pace: GoalPace;
  /** Requested daily adjustment in kcal before safety rules (negative = deficit). */
  adjustmentKcal: number;
  /** Approximate weekly change in kg the label promises (negative = loss). */
  approxWeeklyKg: number;
  /** Full German label, e.g. "Langsam abnehmen (≈ 0,25 kg/Woche)". */
  label: string;
  /** Short chip label used in onboarding ("Entspannt · Moderat · Ambitioniert"). */
  shortLabel: string;
  description: string;
}

/** Pace options per goal, ordered from slowest to fastest. Gain has no "fast". */
export const GOAL_PACES: readonly GoalPaceInfo[] = [
  {
    goal: "lose",
    pace: "slow",
    adjustmentKcal: -250,
    approxWeeklyKg: -0.25,
    label: "Langsam abnehmen (≈ 0,25 kg/Woche)",
    shortLabel: "Entspannt",
    description: "Kaum spürbar im Alltag – gut, wenn du langfristig dranbleiben willst.",
  },
  {
    goal: "lose",
    pace: "moderate",
    adjustmentKcal: -500,
    approxWeeklyKg: -0.5,
    label: "Moderat abnehmen (≈ 0,5 kg/Woche)",
    shortLabel: "Moderat",
    description: "Der Klassiker: sichtbare Fortschritte, ohne dass du hungern musst.",
  },
  {
    goal: "lose",
    pace: "fast",
    adjustmentKcal: -750,
    approxWeeklyKg: -0.75,
    label: "Zügig abnehmen (≈ 0,75 kg/Woche)",
    shortLabel: "Ambitioniert",
    description: "Schneller, aber fordernder. Achte auf genug Protein und Schlaf.",
  },
  {
    goal: "gain",
    pace: "slow",
    adjustmentKcal: 150,
    approxWeeklyKg: 0.15,
    label: "Langsam zunehmen (≈ 0,15 kg/Woche)",
    shortLabel: "Entspannt",
    description: "Ideal für Muskelaufbau mit möglichst wenig Fettzuwachs.",
  },
  {
    goal: "gain",
    pace: "moderate",
    adjustmentKcal: 300,
    approxWeeklyKg: 0.25,
    label: "Moderat zunehmen (≈ 0,25 kg/Woche)",
    shortLabel: "Moderat",
    description: "Schnellere Zunahme – gut, wenn du bisher schwer zunimmst.",
  },
];

/** Default pace when a lose/gain goal has none stored. */
export const DEFAULT_GOAL_PACE: GoalPace = "moderate";

/** Pace options for a goal (empty for "maintain"). */
export function getGoalPaces(goal: GoalType): GoalPaceInfo[] {
  return GOAL_PACES.filter((p) => p.goal === goal);
}
