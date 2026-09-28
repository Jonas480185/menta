import { createUnavailableProvider } from "./unavailable";

/**
 * Apple Health (HealthKit) has no web/server API – data only leaves the iPhone through a native app
 * (HealthKit query → HKWorkout / HKQuantityTypeIdentifierStepCount) that pushes to our backend.
 * Until a companion app (or a Shortcuts-based export) exists, this adapter is unavailable.
 */
export const createAppleHealthProvider = () =>
  createUnavailableProvider(
    "apple_health",
    "Apple Health",
    "Apple Health lässt sich nur über eine iPhone-App verbinden. Die kommt später – bis dahin trägst du Aktivitäten hier manuell ein.",
  );
