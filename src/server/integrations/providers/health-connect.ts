import { createUnavailableProvider } from "./unavailable";

/**
 * Android Health Connect is an on-device store (androidx.health.connect.client) without a cloud API.
 * Needs an Android app (or TWA with a native bridge) that reads ExerciseSessionRecord / StepsRecord and
 * pushes them to our backend. Unavailable until that exists.
 */
export const createHealthConnectProvider = () =>
  createUnavailableProvider(
    "health_connect",
    "Health Connect",
    "Health Connect funktioniert nur über eine Android-App. Die kommt später – bis dahin trägst du Aktivitäten hier manuell ein.",
  );
