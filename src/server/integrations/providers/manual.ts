import type { ActivityProvider } from "../types";

/**
 * Manual input. Always available; it has nothing to fetch – manual entries are written directly by the
 * activity service (addActivity / setDailySteps). Registered so the UI can list sources uniformly and
 * so `importActivities(ctx, "manual", items)` can be used for file imports (e.g. CSV) later.
 */
export function createManualProvider(): ActivityProvider {
  return {
    id: "manual",
    displayName: "Manuell",
    isAvailable: async () => ({ available: true }),
    fetchActivities: async () => [],
    fetchDailySteps: async () => [],
  };
}
