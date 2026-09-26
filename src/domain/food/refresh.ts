/**
 * Refresh policy for cached public foods (see docs/architecture/food-data-strategy.md §7).
 * Pure: callers (search/barcode services) decide whether to re-fetch from the provider.
 */
export const FOOD_REFRESH_TTL_DAYS: Readonly<Record<string, number | null>> = {
  /** Crowd-sourced, recipes and labels change: refresh lazily when a user touches it. */
  off: 30,
  /** Static releases (SR Legacy frozen 2018, Foundation twice a year): bulk re-import only. */
  usda: null,
  /** Versioned in the repo: re-seeded, never refreshed from an API. */
  curated: null,
  user: null,
  recipe: null,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** True if a live refresh is due. Rows without fetched_at count as stale for TTL sources. */
export function isFoodStale(source: string, fetchedAt: Date | null, now: Date = new Date()): boolean {
  const ttl = FOOD_REFRESH_TTL_DAYS[source];
  if (ttl === null || ttl === undefined) return false;
  if (!fetchedAt) return true;
  return now.getTime() - fetchedAt.getTime() > ttl * DAY_MS;
}
