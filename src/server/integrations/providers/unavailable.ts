import type { ActivitySource } from "@/domain/activity";
import type { ActivityProvider } from "../types";

/**
 * Skeleton for a source that is not connected yet. Reports `available: false` with a reason and never
 * returns data (no fake data). Replace with a real adapter as described in
 * docs/architecture/activity-integrations.md.
 */
export function createUnavailableProvider(
  id: ActivitySource,
  displayName: string,
  reason: string,
): ActivityProvider {
  return {
    id,
    displayName,
    isAvailable: async () => ({ available: false, reason }),
    fetchActivities: async () => [],
    fetchDailySteps: async () => [],
  };
}
