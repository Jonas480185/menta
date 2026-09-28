import type { ActivityImportItem, ActivitySource } from "@/domain/activity";
import type { IsoDate } from "@/lib/dates";
import type { ServiceContext } from "@/server/context";

export type { ActivityImportItem } from "@/domain/activity";

/** Inclusive calendar range in the user's timezone. */
export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/** Steps of one day as reported by a provider. */
export interface DailyStepsItem {
  date: IsoDate;
  steps: number;
  /** Upstream id; defaults to `steps:<date>` (one row per provider and day). */
  externalId?: string;
}

export type ProviderAvailability =
  | { available: true }
  | {
      available: false;
      /** German, user-facing: why the source can't be used right now. */
      reason: string;
    };

/**
 * An activity data source (manual input, Apple Health, Health Connect, Garmin, Fitbit, …).
 *
 * Providers are bound to one user (created by a factory with the ServiceContext) so that OAuth tokens or
 * device links can be looked up without changing this interface. Providers only FETCH and NORMALISE
 * data – persisting always goes through `importActivities`, which validates and de-duplicates.
 *
 * Swapping or adding a provider = implementing this interface + registering the factory in registry.ts.
 */
export interface ActivityProvider {
  /** Matches the `activity_source` enum; stored in activities.source. */
  readonly id: ActivitySource;
  /** German name for the UI. */
  readonly displayName: string;
  isAvailable(): Promise<ProviderAvailability>;
  /** Workouts in the range, normalised. Must not return fabricated data. */
  fetchActivities(range: DateRange): Promise<ActivityImportItem[]>;
  /** Daily step totals in the range. */
  fetchDailySteps(range: DateRange): Promise<DailyStepsItem[]>;
}

export type ActivityProviderFactory = (ctx: ServiceContext) => ActivityProvider;
