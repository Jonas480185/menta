import { createUnavailableProvider } from "./unavailable";

/**
 * Garmin Connect Developer Program (Health API + Activity API): OAuth, push/ping webhooks with daily
 * summaries (steps) and activity files. Requires an approved business developer account and
 * consumer key/secret. Unavailable until credentials and the per-user token storage exist.
 */
export const createGarminProvider = () =>
  createUnavailableProvider(
    "garmin",
    "Garmin",
    "Die Garmin-Verbindung ist noch nicht verfügbar. Bis dahin trägst du Aktivitäten hier manuell ein.",
  );
