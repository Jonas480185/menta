# Aktivität, Schritte & Wasser: Datenmodell, Kalorienlogik, Integrationen

Owner: Activity & Water. Code: `src/domain/activity`, `src/server/services/{activity,water}`, `src/server/integrations`,
UI unter `src/app/(app)/activity` und `src/components/{activity,water}`.

## 1. Datenmodell (bestehendes Schema, keine Migration)

| Tabelle         | Verwendung                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activities`    | Eine Zeile pro Workout **oder** pro Tages-Schrittsumme einer Quelle. `type` = `steps` · `cardio` · `strength` · `sport` · `other`; `source` = `manual` · `apple_health` · `health_connect` · `garmin` · `fitbit` · `other`; `external_id` + Unique-Index `(user_id, source, external_id)` für idempotente Importe. `details` (jsonb): `metKey`, `met`, `kcalEstimated`, `weightKg`, `note` bzw. Provider-Rohdaten. |
| `water_entries` | Ein Eintrag pro Getränk (`amount_ml` > 0), `logged_at` für Reihenfolge/Undo.                                                                                                                                                                                                                                                                                                                                       |
| `user_profiles` | `add_activity_calories` (Toggle), `step_goal` (Default 8.000), `water_goal_ml` (Default 2.500).                                                                                                                                                                                                                                                                                                                    |

Manuelle Schritte: genau **eine** Zeile pro Tag mit `source = manual`, `external_id = "manual-steps:<datum>"`
(Upsert über denselben Unique-Index). 0 Schritte löscht die Zeile.

## 2. Kalorienlogik

**Netto statt brutto.** Workouts werden mit `(MET − 1) × kg × Stunden` geschätzt
(`estimateActivityKcal`). Das Tagesziel basiert auf TDEE = Grundumsatz × Aktivitätsfaktor und enthält den
Ruheumsatz (1 MET) für alle 24 Stunden bereits. Brutto-MET würde diese Stunde doppelt zählen.
MET-Werte: Compendium of Physical Activities (Ainsworth et al. 2011, Herrmann et al. 2024): Tabelle mit
Compendium-Code je Eintrag in `src/domain/activity/met.ts`.

**Gewicht:** letzter Gewichtseintrag ≤ heute → Startgewicht aus dem Onboarding → 70 kg Fallback
(`weightForEstimates`; die UI weist beim Fallback darauf hin). Die Schätzung wird beim Anlegen gespeichert
(`kcalEstimated = true`) und bei Änderung der Dauer neu berechnet, solange der Nutzer die kcal nicht selbst
überschrieben hat. `caloriesBurned: null` im Update setzt auf die Schätzung zurück.

**Schritte bringen keine kcal ins Budget.** Alltagsgehen steckt bereits im Aktivitätslevel (Onboarding-Schritt
„Wie aktiv ist dein Alltag?“). Schrittzeilen haben daher immer `calories_burned = null`: auch importierte
(`importActivities` verwirft kcal bei `type = steps`). `estimateStepsKcal` (100 Schritte/min bei 3,5 MET,
netto) wird nur informativ angezeigt.

**Budget:** Die Nutrition-Engine (`services/nutrition/summary.ts`) addiert `SUM(calories_burned)` des Tages,
wenn `add_activity_calories` an ist. `getActivitySummary().activeKcal` ist exakt diese Summe: Karte und
Budget zeigen immer denselben Wert (Test in `activity.test.ts`).

**Schritte aus mehreren Quellen** werden nicht addiert: pro Quelle summiert, dann gewinnt die höchste
(`summarizeActivities`). Handy und Uhr messen dieselben Schritte.

## 3. Integrationsschicht (`src/server/integrations`)

```
ActivityProvider (types.ts)          registry.ts                     import.ts
 id / displayName                     id → (ctx) => ActivityProvider   importActivities(ctx, providerId, items)
 isAvailable() → {available,reason}   getActivityProvider(ctx, id)      Zod-Validierung, Upsert per
 fetchActivities(range)               listActivityProviders(ctx)        (user, source, externalId), 1 Transaktion
 fetchDailySteps(range)               registerActivityProvider(id, f)  syncActivityProvider(ctx, id, range)
```

- Provider werden **pro Nutzer** über eine Factory mit `ServiceContext` erzeugt: so können Tokens/Geräte-Links
  geladen werden, ohne das Interface zu ändern.
- Provider **holen und normalisieren nur**. Geschrieben wird immer über `importActivities` → Validierung,
  Deduplizierung und Kalorienregeln gelten für jede Quelle gleich.
- Austauschen/Ergänzen: Adapter implementieren, Factory in `registry.ts` eintragen (oder zur Laufzeit per
  `registerActivityProvider`, z. B. hinter einem Feature-Flag). Kein anderer Code ändert sich.
- Heute: `manual` (immer verfügbar, nichts zu holen) und Skelette für `apple_health`, `health_connect`,
  `garmin`, `fitbit`, die `isAvailable() = { available: false, reason }` liefern und **keine** Daten erfinden.

## 4. Wege zu echten Integrationen

| Quelle             | Weg                                                                                                                                                                                                                                                                                                                                                                                                   | Was fehlt                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Apple Health**   | Kein Web-API. Native iOS-App (oder Capacitor/React-Native-Hülle) liest HealthKit (`HKWorkout`, `HKQuantityTypeIdentifierStepCount`, `activeEnergyBurned`) und schickt normalisierte Items an einen authentifizierten Route Handler `POST /api/integrations/apple-health`, der `importActivities(ctx, "apple_health", items)` aufruft. Alternative ohne App: Apple-Kurzbefehl, der täglich exportiert. | iOS-App, Push-Endpunkt mit Geräte-Token                                                                                |
| **Health Connect** | On-Device-API (`androidx.health.connect.client`), ebenfalls ohne Cloud. Android-App/TWA mit nativer Brücke liest `ExerciseSessionRecord`, `StepsRecord`, `ActiveCaloriesBurnedRecord` und pusht wie oben.                                                                                                                                                                                             | Android-App                                                                                                            |
| **Garmin**         | Garmin Connect Developer Program (Health API + Activity API): OAuth 1.0a, Garmin pusht Daily Summaries (Schritte) und Activities per Webhook (Ping/Push). Webhook-Route → Nutzer über Garmin-User-ID auflösen → `importActivities`.                                                                                                                                                                   | Freigegebener Business-Developer-Account, Consumer Key/Secret, Tabelle für Tokens (`user_integrations`), Webhook-Route |
| **Fitbit**         | Fitbit Web API, OAuth 2.0 (PKCE), Scope `activity`. Pull: `GET /1/user/-/activities/list.json`, `/1/user/-/activities/steps/date/{from}/{to}.json`; Push: Subscriptions-API benachrichtigt, danach gezielt pullen. Adapter implementiert `fetchActivities`/`fetchDailySteps` direkt.                                                                                                                  | Registrierte App (Client-ID/Secret), Token-Speicher inkl. Refresh, Sync-Job                                            |

Gemeinsame Bausteine für die Cloud-Anbieter (Garmin, Fitbit):

1. Tabelle `user_integrations(user_id, provider, external_user_id, access_token (verschlüsselt), refresh_token,
expires_at, scopes, last_synced_at)`: Schema-Änderung, Aufgabe für den Lead.
2. Einstellungen „Datenquellen“: Liste aus `listActivityProviders(ctx)`, Button „Verbinden“ startet OAuth,
   Callback speichert Tokens; „Trennen“ löscht Tokens (importierte Zeilen bleiben, optional löschbar).
3. Sync: Webhook oder periodischer Job ruft `syncActivityProvider(ctx, id, { from, to })` für die letzten
   7 Tage auf: durch die Idempotenz beliebig wiederholbar.
4. `fetch()` mit `AbortSignal.timeout()` und `cache: "no-store"`, Fehler als `externalError()`,
   Rate-Limits respektieren. Payloads mit Zod parsen, bevor sie normalisiert werden.
5. Mapping: Workout-Typen der Quelle → `cardio`/`strength`/`sport`/`other`, Name auf Deutsch,
   `caloriesBurned` = **aktive** kcal der Quelle (nicht „total“, das enthält den Grundumsatz), `startedAt`
   mit Offset, `externalId` = stabile ID der Quelle.

## 5. Services & UI (Kurzreferenz)

- Aktivität: `addActivity`, `updateActivity`, `deleteActivity`, `listActivities`, `setDailySteps`,
  `getActivitySummary`, `setAddActivityCalories`, `setStepGoal` (`@/server/services/activity`).
- Wasser: `addWater`, `deleteWater`, `getWaterSummary`, `setWaterGoal` (`@/server/services/water`).
- Seite `/activity?date=YYYY-MM-DD`; Dashboard-Bausteine `WaterCard`, `AddWaterButton`
  (`@/components/water`) und `ActivityCard` (`@/components/activity`). Server Actions in
  `src/app/(app)/activity/actions.ts` revalidieren `/activity` und `/today`.
