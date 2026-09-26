import type { IsoDate } from "@/lib/dates";

/** One calendar day of the weight chart (see getWeightTrend in services/weight). */
export interface WeightTrendPoint {
  date: IsoDate;
  /** Logged weight of this day, null on days without an entry. */
  weightKg: number | null;
  /** Trailing 7-day average, null when the window has no entry. */
  avg7: number | null;
  /** Smoothed trend, null before the first entry and after the user's today. */
  trend: number | null;
}
