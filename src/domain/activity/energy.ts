/**
 * Energy estimates for activities – NET calories.
 *
 * Why net (MET − 1) instead of gross (MET)?
 * The daily calorie target is derived from TDEE = BMR × activity factor, which already contains the
 * resting expenditure (1 MET) for every hour of the day. Adding the gross MET value of a workout on top
 * would count that resting hour twice. The net formula only adds what the activity burns *above rest*:
 *
 *   kcal = (MET − 1) × body weight [kg] × duration [h]
 *
 * (1 MET ≈ 1 kcal · kg⁻¹ · h⁻¹; Compendium of Physical Activities, Ainsworth 2011 / Herrmann 2024.)
 * Example: 30 min running at 10 km/h (9.8 MET), 70 kg → (9.8 − 1) × 70 × 0.5 = 308 kcal.
 *
 * Results are unrounded; round only for display.
 */

/** Fallback body weight when neither a weight entry nor a start weight exists. */
export const DEFAULT_WEIGHT_KG = 70;

export interface ActivityKcalInput {
  met: number;
  weightKg: number;
  durationMin: number;
}

function finitePositive(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Net kcal of an activity: (MET − 1) × kg × h. Never negative; invalid input → 0. */
export function estimateActivityKcal({ met, weightKg, durationMin }: ActivityKcalInput): number {
  const netMet = finitePositive(met - 1);
  return netMet * finitePositive(weightKg) * (finitePositive(durationMin) / 60);
}

/**
 * Assumptions for step estimates: an average cadence of 100 steps/min, which marks moderate-intensity
 * walking (Tudor-Locke C et al., Br J Sports Med 2018;52:776–788), at ~3.5 MET (Compendium 17190,
 * walking at a moderate pace). → net (3.5 − 1) × kg per 6,000 steps.
 */
export const STEP_CADENCE_PER_MIN = 100;
export const STEP_WALKING_MET = 3.5;

/**
 * Net kcal for a number of steps. 10,000 steps at 70 kg ≈ 292 kcal.
 *
 * Note: everyday steps are largely covered by the activity level of the TDEE. Menta therefore shows this
 * as an information only and does not add manual step counts to the calorie budget (see
 * docs/architecture/activity-integrations.md).
 */
export function estimateStepsKcal(steps: number, weightKg: number): number {
  const minutes = finitePositive(steps) / STEP_CADENCE_PER_MIN;
  return estimateActivityKcal({ met: STEP_WALKING_MET, weightKg, durationMin: minutes });
}
