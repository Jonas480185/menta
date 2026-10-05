/**
 * Activity domain types. Mirrors the `activity_type` / `activity_source` enums of
 * src/server/db/schema/tracking.ts (kept as literal lists here so the domain stays DB-free).
 */

export const ACTIVITY_TYPES = ["steps", "cardio", "strength", "sport", "other"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_SOURCES = [
  "manual",
  "apple_health",
  "health_connect",
  "garmin",
  "fitbit",
  "other",
] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

/** Minimal shape `summarizeActivities` needs: satisfied by DB rows and DTOs alike. */
export interface ActivityLike {
  type: ActivityType;
  source: ActivitySource;
  durationMin: number | null;
  steps: number | null;
  caloriesBurned: number | null;
}

export interface ActivityTotals {
  /** Sum of `calories_burned` of all rows: exactly what the daily budget adds (see nutrition engine). */
  activeKcal: number;
  /** Minutes of all non-steps activities. */
  minutes: number;
  /** Steps of the day (per source summed, then the highest source wins: see summarizeActivities). */
  steps: number;
  /** Number of non-steps activities. */
  count: number;
}
