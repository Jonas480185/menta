import { addDays, type IsoDate } from "@/lib/dates";
import type { WeightTrendPoint } from "./types";

/** Chart periods of the weight screen. */
export type WeightRange = "30d" | "3m" | "6m" | "1y" | "all";

export const WEIGHT_RANGES: readonly {
  value: WeightRange;
  label: string;
  ariaLabel: string;
  days: number | null;
}[] = [
  { value: "30d", label: "30T", ariaLabel: "30 Tage", days: 30 },
  { value: "3m", label: "3M", ariaLabel: "3 Monate", days: 91 },
  { value: "6m", label: "6M", ariaLabel: "6 Monate", days: 182 },
  { value: "1y", label: "1J", ariaLabel: "1 Jahr", days: 365 },
  { value: "all", label: "Alle", ariaLabel: "Gesamter Zeitraum", days: null },
];

export function isWeightRange(value: unknown): value is WeightRange {
  return WEIGHT_RANGES.some((r) => r.value === value);
}

/** First day of `range` ending at `today` (inclusive); null for "all". */
export function rangeStart(range: WeightRange, today: IsoDate): IsoDate | null {
  const days = WEIGHT_RANGES.find((r) => r.value === range)?.days ?? null;
  return days === null ? null : addDays(today, -(days - 1));
}

/** Points of `range` (up to `today`). "all" starts at the first day with data. */
export function slicePoints(
  points: readonly WeightTrendPoint[],
  range: WeightRange,
  today: IsoDate,
): WeightTrendPoint[] {
  const start = rangeStart(range, today);
  const inRange = points.filter((p) => p.date <= today && (start === null || p.date >= start));
  if (range !== "all") return inRange;
  const firstWithData = inRange.findIndex((p) => p.weightKg !== null || p.trend !== null);
  return firstWithData === -1 ? [] : inRange.slice(firstWithData);
}

/**
 * Evenly thins long series for charts (every n-th day plus the first and last point) so
 * "1J"/"Alle" stay light. Returns a copy of the input when it's short enough.
 */
export function thinPoints(points: readonly WeightTrendPoint[], maxPoints = 400): WeightTrendPoint[] {
  if (points.length <= maxPoints) return [...points];
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, i) => i === 0 || i === points.length - 1 || i % step === 0);
}
