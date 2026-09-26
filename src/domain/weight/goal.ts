import { addDays, type IsoDate } from "@/lib/dates";

/**
 * Goal-weight math (pure). Goals are direction-neutral: losing, maintaining and gaining are
 * treated the same way – "towards" / "away" relative to the user's own target.
 */

export type WeightGoalDirection = "lose" | "maintain" | "gain";
export type TrendDirection = "towards" | "away" | "stable";

/** ± band around the target that counts as "on target" for maintain goals (and as reached). */
export const MAINTAIN_BAND_KG = 1.5;
/** |kg/week| below this is "stable" (≈ 0,4 kg per month – inside normal noise). */
export const STABLE_RATE_KG_PER_WEEK = 0.1;
/** Projections further out than this are not shown (too uncertain). */
export const MAX_PROJECTION_WEEKS = 104;

export interface GoalProgressInput {
  /** Weight when the goal was set (profile start weight or first entry). */
  start: number;
  /** Current (trend) weight. */
  current: number;
  target: number;
  /** Profile goal type; "maintain" forces the maintain band. Otherwise derived from start → target. */
  goalType?: WeightGoalDirection | null;
}

export interface GoalProgress {
  direction: WeightGoalDirection;
  /**
   * Share of the way from start to target, clamped to 0–1 (0 when moving away from the start).
   * `null` for maintain goals – use `inBand` instead.
   */
  fraction: number | null;
  /** kg still to go (≥ 0). For maintain: distance to the edge of the band. */
  remainingKg: number;
  /** Target reached (lose: current ≤ target, gain: current ≥ target, maintain: within the band). */
  reached: boolean;
  /** |current − target| ≤ MAINTAIN_BAND_KG. */
  inBand: boolean;
}

/** Direction of a goal: maintain when the start is already within the band around the target. */
export function goalDirection(start: number, target: number): WeightGoalDirection {
  if (Math.abs(target - start) <= MAINTAIN_BAND_KG) return "maintain";
  return target < start ? "lose" : "gain";
}

export function goalProgress({ start, current, target, goalType }: GoalProgressInput): GoalProgress {
  const direction: WeightGoalDirection = goalType === "maintain" ? "maintain" : goalDirection(start, target);
  const distance = Math.abs(current - target);
  const inBand = distance <= MAINTAIN_BAND_KG;

  if (direction === "maintain") {
    return {
      direction,
      fraction: null,
      remainingKg: Math.max(0, distance - MAINTAIN_BAND_KG),
      reached: inBand,
      inBand,
    };
  }

  const sign = direction === "lose" ? -1 : 1;
  const total = (target - start) * sign; // > 0
  const done = (current - start) * sign;
  const reached = (current - target) * sign >= 0;
  return {
    direction,
    fraction: reached ? 1 : Math.min(1, Math.max(0, done / total)),
    remainingKg: reached ? 0 : distance,
    reached,
    inBand,
  };
}

export interface TrendDirectionInput {
  /** kg/week (negative = decreasing); null = not enough data → "stable". */
  weeklyRate: number | null;
  current: number;
  target: number;
  goalType?: WeightGoalDirection | null;
}

/**
 * Where the trend is heading relative to the goal:
 * - "stable" when |rate| < STABLE_RATE_KG_PER_WEEK (or no rate yet),
 * - "towards" when it moves in the direction of the target,
 * - "away" otherwise (incl. drifting out of the maintain band / past a reached target).
 */
export function trendDirectionRelativeToGoal({
  weeklyRate,
  current,
  target,
  goalType,
}: TrendDirectionInput): TrendDirection {
  if (weeklyRate === null || Math.abs(weeklyRate) < STABLE_RATE_KG_PER_WEEK) return "stable";
  const gap = target - current;
  const withinBand = Math.abs(gap) <= MAINTAIN_BAND_KG;
  if (goalType === "maintain" && withinBand) return "away";
  if (gap === 0) return "away";
  return Math.sign(gap) === Math.sign(weeklyRate) ? "towards" : "away";
}

export interface ProjectGoalDateInput {
  current: number;
  target: number;
  /** kg/week. */
  weeklyRate: number | null;
  /** The user's today – the projection starts here. */
  today: IsoDate;
}

/**
 * Projected day the trend reaches the target at the current weekly rate.
 * `null` when there's no rate, the trend is flat or heading away, the target is already
 * reached, or the projection is more than MAX_PROJECTION_WEEKS away.
 */
export function projectGoalDate({ current, target, weeklyRate, today }: ProjectGoalDateInput): IsoDate | null {
  if (weeklyRate === null || Math.abs(weeklyRate) < STABLE_RATE_KG_PER_WEEK) return null;
  const gap = target - current;
  if (gap === 0 || Math.sign(gap) !== Math.sign(weeklyRate)) return null;
  const weeks = gap / weeklyRate;
  if (!Number.isFinite(weeks) || weeks > MAX_PROJECTION_WEEKS) return null;
  return addDays(today, Math.max(1, Math.ceil(weeks * 7)));
}
