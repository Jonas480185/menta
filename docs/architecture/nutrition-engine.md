# Nutrition Engine: Referenz

Zwei Schichten:

| Schicht | Ort | Inhalt |
|---|---|---|
| Domain (rein, ohne DB/Next) | `src/domain/nutrition/*` | Skalierung, Summen, Ziele/Rest/Status, Anzeige-Rundung |
| Services (`fn(ctx, …)`, nach `ctx.userId` gescoped) | `src/server/services/nutrition/*` | Tagesziele + `daily_nutrition`-Snapshot, Tageszusammenfassung, Zeitraum-Aggregate |

Import: `@/domain/nutrition` bzw. `@/server/services/nutrition` (Barrels).

---

## 1. Einheiten & Formeln

- Energie **kcal**, Makros **g**, Natrium **mg**. Nährwerte eines Lebensmittels sind **pro 100 g bzw. 100 ml**
  (`nutrientBasis`).
- **Skalierung:** `wert = per100 × menge / 100` (erst multiplizieren, dann dividieren).
- **Eintrag:** `grams = servingGrams × quantity`; Nährwerte = `scaleNutrients(per100, grams)`.
  Das Ergebnis wird als **Snapshot** auf `meal_entries` gespeichert (Änderungen am Lebensmittel ändern die
  Historie nicht). Neu berechnen nur, wenn sich Menge/Portion des Eintrags ändert.
- **Salz → Natrium:** Wenn nur Salz bekannt ist: `sodiumMg = saltG / 2.5 × 1000` (EU-VO 1169/2011).
- **Atwater:** `kcalFromMacros = 4·P + 4·KH + 9·F (+ 7·Alkohol)`, nur Plausibilität/Split; die kcal des
  Etiketts bleiben maßgeblich.
- **Makro-Energieanteil:** `macroEnergySplit` teilt durch die **Makro-Energie** (4/4/9), nicht durch die
  Etikett-kcal → die drei Anteile ergeben immer 100 %. Keine Makros → `{0,0,0}`.
- **Kalorienbudget:** `budget = calories + activityKcal` (activityKcal nur, wenn
  `user_profiles.add_activity_calories` = true; sonst 0).
- **Rest:** `kcal = budget − consumed.kcal`; Makros `target − consumed`; Ballaststoffe `target − (consumed ?? 0)`,
  `null` ohne Ballaststoffziel. Negative Werte = über dem Ziel.
- **Runden nur für die Anzeige**, immer auf dem Endaggregat (`roundKcal`: ganze kcal; `roundGrams`/`roundMg`:
  < 10 eine Nachkommastelle, sonst ganzzahlig; „half away from zero“, nie `-0`). Gespeichert und summiert wird
  ungerundet.

## 2. Null-Semantik

- `kcal`, `proteinG`, `carbsG`, `fatG` sind immer Zahlen (Pflichtfelder eines Eintrags).
- Optionale Nährwerte (`fiberG`, `sugarG`, `saturatedFatG`, `sodiumMg`): `null` = **unbekannt**, nie 0.
- `sumTotals` = SQL `SUM()`: Summe der **bekannten** Werte; `null` nur, wenn **alle** Werte `null` sind (oder die
  Liste leer ist). Eine teilweise bekannte Summe ist eine Untergrenze („mindestens 12 g Ballaststoffe“).
  In-Memory-Summen (`getDaySummary`) und SQL-Aggregate (`getDailyTotals`) liefern daher identische Werte.

## 3. Status & Schwellen

`STATUS_THRESHOLDS = { near: 0.9, reached: 1, over: 1.05 }` (Verhältnis verbraucht / Ziel):

| Status | Bedingung | UI |
|---|---|---|
| `none` | verbraucht ≤ 0 | – |
| `under` | r < 0,90 | |
| `near` | 0,90 ≤ r < 1,00 | „Fast geschafft“ |
| `reached` | 1,00 ≤ r ≤ 1,05 | „Ziel erreicht“ (5 % Toleranz) |
| `over` | r > 1,05 | „über Ziel“ (Token `over`, nie Alarm) |

- **kcal, Kohlenhydrate, Fett:** > 105 % → `over`. kcal wird gegen das Budget (inkl. Aktivität) gemessen.
- **Protein, Ballaststoffe** (`exceedIsNeutral`): Überschreiten ist neutral/positiv → bleibt `reached`.
- Ziel 0 (z. B. Zero-Carb) und verbraucht > 0 → `over` (bzw. `reached` bei exceedIsNeutral).
- `progressRatio(consumed, target)` → ungeklemmtes Verhältnis oder `null` ohne sinnvolles Ziel.

## 4. Tagesziele & Snapshot (`daily_nutrition`)

„Heute“ = `todayInTimezone(ctx.timezone)`.

| Tag | Quelle der Ziele |
|---|---|
| **Vergangen** (< heute) mit Snapshot-Zeile | **eingefroren**: Werte der Zeile. Zieländerungen ändern sie nie. |
| Vergangen ohne Zeile | live aufgelöst (beste verfügbare Information); `ensureDailyNutrition` friert sie ein |
| **Heute/Zukunft** | **live**: explizit gewähltes Profil (`profile_overridden` und Profil existiert noch), sonst `resolveGoalProfileForDate` (Wochentag → Standard) |
| Kein Profil auflösbar | Snapshot als letzter Fallback, sonst `null` (Onboarding nicht fertig) |

Wer schreibt die Zeile?

- **Meal Logging** ruft `ensureDailyNutrition(ctx, date)` beim Hinzufügen/Verschieben eines Eintrags
  (gern in derselben Transaktion). Idempotent: vergangene Zeilen bleiben unberührt, heute/Zukunft wird auf die
  Live-Ziele gebracht (kein Write, wenn unverändert). Ohne Zielprofil wird nichts geschrieben.
- **Goals/Macro** rufen nach jeder Zieländerung (Profil anlegen/ändern/archivieren/löschen,
  Wochentage, Standardwechsel) `refreshTargetsFrom(ctx)` auf. `fromDate` wird auf heute **geklemmt**:
  vergangene Tage werden nie neu berechnet.
- **Tagesprofil wählen** (`setDayProfile`): setzt `profile_overridden = true` + Profil + Zielwerte; gilt auch
  für vergangene Tage (explizite Nutzerentscheidung ist der einzige Weg, einen eingefrorenen Tag zu ändern).
  `null` hebt die Auswahl auf und schreibt die ohne Override geltenden Ziele.
- Wird ein gewähltes Profil gelöscht, setzt die FK `goal_profile_id` auf `null`; Leser behandeln das wie
  „nicht überschrieben“, `refreshTargetsFrom` setzt dann `profile_overridden = false`.

Verbrauchte Summen werden **nie** gespeichert, sondern immer aus `meal_entries` aggregiert.

## 5. API-Referenz

### Domain: `@/domain/nutrition`

```ts
// Typen
interface Macros { proteinG: number; carbsG: number; fatG: number }
interface NutrientTotals extends Macros { kcal: number; fiberG: number | null; sugarG: number | null;
  saturatedFatG: number | null; sodiumMg: number | null }
interface NutrientProfile extends Macros { kcal: number; fiberG?; sugarG?; saturatedFatG?; saltG?; sodiumMg?; … } // pro 100
interface DailyTargets extends Macros { calories: number; fiberG: number | null;
  goalProfileId: string | null; goalProfileName: string | null }
interface NutrientRemaining extends Macros { kcal: number; fiberG: number | null }
type NutrientStatus = "none" | "under" | "near" | "reached" | "over";
interface DayNutrientStatus { kcal; protein; carbs; fat: NutrientStatus; fiber: NutrientStatus | null }
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9, alcohol: 7 };
const ZERO_TOTALS: NutrientTotals;

// scale.ts
scaleNutrients(profilePer100: NutrientProfile, amount: number): NutrientTotals
computeEntryNutrients({ per100, servingGrams, quantity }): { grams: number; totals: NutrientTotals }
sodiumMgFromSaltG(saltG: number): number          // SALT_PER_SODIUM = 2.5

// totals.ts
sumTotals(list: readonly NutrientTotals[]): NutrientTotals
kcalFromMacros(macros: Macros & { alcoholG?: number | null }): number
macroEnergySplit(totals: Macros): { protein: number; carbs: number; fat: number }   // Verhältnisse 0-1

// targets.ts
STATUS_THRESHOLDS = { near: 0.9, reached: 1, over: 1.05 }
progressRatio(consumed: number, target: number | null | undefined): number | null
macroStatus(consumed: number, target: number, { exceedIsNeutral?: boolean }?): NutrientStatus
kcalBudget(targets: { calories }, { activityKcal?: number }?): number
computeRemaining(targets: TargetValues, consumed: NutrientTotals, { activityKcal?: number }?): NutrientRemaining
dayNutrientStatus(targets: TargetValues, consumed: NutrientTotals, { activityKcal?: number }?): DayNutrientStatus

// rounding.ts
roundTo(value: number, digits = 0): number
roundKcal(kcal: number): number
roundGrams(grams: number): number
roundMg(mg: number): number
```

`scaleNutrients`/`computeEntryNutrients` werfen `RangeError` bei negativen/nicht-endlichen Mengen bzw.
`quantity ≤ 0`: Nutzereingaben vorher mit Zod validieren.

### Services: `@/server/services/nutrition`

Alle Datumswerte sind `IsoDate` (`"YYYY-MM-DD"`, lokaler Tag); ungültige Daten → `AppError("VALIDATION")`.

```ts
getDailyTargets(ctx, date): Promise<DailyTargets | null>                // read-only
ensureDailyNutrition(ctx, date): Promise<DailyTargets | null>           // idempotenter Snapshot-Upsert
refreshTargetsFrom(ctx, fromDate?): Promise<{ updated: number }>        // fromDate ≥ heute (geklemmt)
setDayProfile(ctx, date, goalProfileId: string | null): Promise<DailyTargets | null>
                                                                        // NOT_FOUND: fremd/archiviert/unbekannt
getDaySummary(ctx, date): Promise<DaySummary>
getDailyTotals(ctx, from, to): Promise<DailyTotalsRow[]>                // nur geloggte Tage, aufsteigend
getLoggedDates(ctx, from, to): Promise<IsoDate[]>
targetsFromProfile(p: GoalProfileRow): DailyTargets
targetsFromSnapshot(row: DailyNutritionRow, profileName: string | null): DailyTargets

interface DaySummary {
  date: IsoDate;
  targets: DailyTargets | null;          // null ohne Zielprofil
  consumed: NutrientTotals;
  remaining: NutrientRemaining | null;   // kcal inkl. activityKcal
  activityKcal: number;                  // 0, wenn add_activity_calories = false
  status: DayNutrientStatus | null;
  meals: { meal: { id; name; icon; sortOrder; isArchived }; totals: NutrientTotals; entries: DayEntry[] }[];
  entryCount: number;
}
interface DayEntry { id; mealId; foodId; recipeId; servingId; foodName; brandName; servingLabel;
  servingGrams; quantity; grams; sortOrder; loggedAt: Date; totals: NutrientTotals }
interface DailyTotalsRow { date: IsoDate; totals: NutrientTotals; entryCount: number;
  targets: DailyTargets | null }         // targets = Snapshot, null ohne daily_nutrition-Zeile
```

`getDaySummary`:
- Mahlzeiten: alle nicht archivierten Slots in `sortOrder`, danach archivierte Slots **nur**, wenn sie an
  diesem Tag Einträge haben.
- Einträge je Slot nach `sortOrder`, dann `loggedAt`.
- 4 kleine Queries (Ziele, Slots, Einträge, Aktivität+Flag), Summen in Memory mit `sumTotals`.

`getDailyTotals`: **eine** `GROUP BY date`-Query über den Index `meal_entries (user_id, date)` mit LEFT JOIN auf
`daily_nutrition`. Tage ohne Einträge fehlen bewusst („nicht geloggt“ ≠ „0 kcal“). Ein Jahr (365 Tage ×
4 Einträge) wird im Test in einer Query aggregiert.

## 6. Beispiele

```ts
// Meal Logging: Eintrag anlegen
const { grams, totals } = computeEntryNutrients({ per100: food, servingGrams: serving.grams, quantity });
await inTransaction(ctx, async (tx) => {
  await tx.db.insert(mealEntries).values({ …, grams, kcal: totals.kcal, proteinG: totals.proteinG, … });
  await ensureDailyNutrition(tx, date);
});

// Heute-Seite
const day = await getDaySummary(ctx, today);
formatKcal(roundKcal(day.remaining?.kcal ?? 0));

// Goals nach dem Speichern eines Profils
await refreshTargetsFrom(ctx);
```
