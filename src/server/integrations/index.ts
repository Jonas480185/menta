/**
 * Activity integrations: provider interface, registry and idempotent import.
 * Docs: docs/architecture/activity-integrations.md
 */
export type {
  ActivityImportItem,
  ActivityProvider,
  ActivityProviderFactory,
  DailyStepsItem,
  DateRange,
  ProviderAvailability,
} from "./types";
export {
  getActivityProvider,
  listActivityProviderIds,
  listActivityProviders,
  registerActivityProvider,
  type ActivityProviderStatus,
} from "./registry";
export { importActivities, stepsToImportItems, syncActivityProvider, type ImportResult } from "./import";
