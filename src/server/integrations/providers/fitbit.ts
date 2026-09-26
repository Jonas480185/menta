import { createUnavailableProvider } from "./unavailable";

/**
 * Fitbit Web API (OAuth 2.0 PKCE; scopes `activity`): GET /1/user/-/activities/list.json and
 * /1/user/-/activities/steps/date/{from}/{to}.json, plus subscriptions for push updates.
 * Needs a registered app (client id/secret) and per-user token storage. Unavailable until then.
 */
export const createFitbitProvider = () =>
  createUnavailableProvider(
    "fitbit",
    "Fitbit",
    "Die Fitbit-Verbindung ist noch nicht verfügbar. Bis dahin trägst du Aktivitäten hier manuell ein.",
  );
