# Calorie Engine

Berechnet aus Körperdaten, Aktivität und Ziel eine **transparente, sichere Kalorienempfehlung**:

```
Grundumsatz (BMR) → × Aktivitätsfaktor (PAL) = Erhaltungsbedarf (TDEE) → ± Anpassung = Tagesziel
```

| Schicht | Pfad | Inhalt |
|---|---|---|
| Domain (rein, auch im Client nutzbar) | `src/domain/calories/**` | Formeln, Regeln, Konstanten, Zod-Schemas, Breakdown-Text |
| Services (server-only) | `src/server/services/calories/**` | Berechnung für den eingeloggten Nutzer, Speichern von BMR/TDEE |
| Services (server-only) | `src/server/services/profile/**` | Profil lesen/ändern, aktuelles Gewicht |

Einheiten: kcal/Tag, kg, cm, Jahre. Gerundet wird **nur für Anzeige/Speicherung**: `bmr`/`tdee` bleiben
ungerundet, `target` ist eine Empfehlung und wird auf 10 kcal gerundet.

---

## 1. Überblick & Datenfluss

```
user_profiles (sex, birth_date, height_cm, start_weight_kg, target_weight_kg,
               activity_level, goal_type, goal_pace, calculator_id)
weight_entries (neuestes Gewicht ≤ heute, ggf. Körperfett)
        │
        ▼  calculateCaloriesForUser(ctx, overrides?)       ← services/calories
        │     Alter = calculateAge(birth_date, heute in ctx.timezone)
        │     Gewicht = override → letzter weight_entry → start_weight_kg
        ▼
calculateCalories(body, goal, { calculatorId })              ← domain/calories
        │     Rechner wählen (Fallback) → BMR → TDEE → Tempo → 25-%-Deckel → Untergrenze → Wochen bis Ziel
        ▼
CalorieCalculation { bmr, tdee, adjustment, target, warnings, … }
        │
        ├─ describeCalorieCalculation(calc) → Breakdown-Zeilen + Summary für die UI
        └─ recalculateAndStore(ctx) → user_profiles.bmr_kcal / tdee_kcal
```

Die Engine schreibt **keine** `goal_profiles`: das Tagesziel samt Makros gehört der Macro Engine,
siehe §8.

---

## 2. Parameter (`src/domain/calories/constants.ts`)

| Konstante | Wert | Bedeutung |
|---|---|---|
| `KCAL_PER_KG_BODY_WEIGHT` | 7700 | Energiegehalt von 1 kg Körpergewicht (Faustregel nach Wishnofsky 1958) |
| `SAFETY.maxDeficitShareOfTdee` | 0,25 | Defizit höchstens 25 % des TDEE |
| `SAFETY.minTargetKcal` | ♀ 1200 · ♂ 1500 · unspecified 1350 | absolute Untergrenze beim Abnehmen |
| `SAFETY.roundingStepKcal` | 10 | Rundung des Tagesziels |
| `BODY_LIMITS.ageYears` | 14-120 | harte Grenze (Validierung) |
| `BODY_LIMITS.adultAgeYears` | 18-100 | außerhalb → freundlicher Hinweis (`age_outside_range`) |
| `BODY_LIMITS.heightCm` | 50-300 | = DB-CHECK `user_profiles_height_range` |
| `BODY_LIMITS.weightKg` | 20-400 | = DB-CHECKs `user_profiles_weight_range`, `weight_entries_weight_range` |
| `BODY_LIMITS.bodyFatPct` | 2-70 | plausibler Bereich für Katch-McArdle, sonst Fallback |

### Aktivitätsfaktoren (`ACTIVITY_LEVELS`, PAL)

Klassische Harris-Benedict-/McArdle-Faktoren. `ACTIVITY_LEVELS` liefert Label + Beschreibung (deutsch) für die UI,
Reihenfolge = Anzeige-Reihenfolge.

| id | Faktor | Label |
|---|---|---|
| `sedentary` | 1,2 | Kaum aktiv |
| `light` | 1,375 | Leicht aktiv |
| `moderate` | 1,55 | Moderat aktiv |
| `active` | 1,725 | Sehr aktiv |
| `very_active` | 1,9 | Extrem aktiv |

### Tempo (`GOAL_PACES`, `getGoalPaces(goal)`)

| Ziel | Tempo | Anpassung/Tag | ≈ kg/Woche (× 7 / 7700) | Chip-Label |
|---|---|---|---|---|
| lose | slow | −250 | −0,23 („≈ 0,25“) | Entspannt |
| lose | moderate | −500 | −0,45 | Moderat |
| lose | fast | −750 | −0,68 („≈ 0,7“) | Ambitioniert |
| gain | slow | +150 | +0,14 („≈ 0,15“) | Entspannt |
| gain | moderate | +300 | +0,27 („≈ 0,25“) | Moderat |
| maintain |, | 0 | 0 |, |

Kein Tempo gespeichert → `moderate` (`DEFAULT_GOAL_PACE`). `gain` + `fast` gibt es nicht: die Domain rechnet mit
`moderate` und warnt (`pace_adjusted`), `updateProfile` lehnt es ab. Die Labels versprechen nur, was die
7700-kcal-Regel hergibt (Test in `calculate.test.ts`).

---

## 3. Formeln (Rechner) & Quellen

Alle Rechner implementieren `CalorieCalculator` und unterscheiden sich **nur im BMR**. TDEE und Zielberechnung
teilen sich `defineCalculator()` → `computeCalorieTarget()`.

| id | Name | BMR (kcal/Tag) | Quelle |
|---|---|---|---|
| `mifflin_st_jeor` **(Default)** | Mifflin-St Jeor | `10·kg + 6,25·cm − 5·Alter + s`, s = +5 ♂ / −161 ♀ | Mifflin MD et al., *Am J Clin Nutr* 1990;51:241-247 |
| `harris_benedict_revised` | Harris-Benedict (revidiert) | ♂ `88,362 + 13,397·kg + 4,799·cm − 5,677·Alter`; ♀ `447,593 + 9,247·kg + 3,098·cm − 4,330·Alter` | Roza AM, Shizgal HM, *Am J Clin Nutr* 1984;40:168-182 |
| `katch_mcardle` | Katch-McArdle | `370 + 21,6 · LBM`, LBM = kg · (1 − KFA/100) | Katch & McArdle, *Nutrition, Weight Control and Exercise* (1975/1983) |

**Geschlecht „unspecified“**: arithmetisches Mittel der männlichen und weiblichen Konstante bzw. Gleichung
(Mifflin: s = −78). Katch-McArdle ist geschlechtsunabhängig.

**Fallback**: Unbekannte `calculator_id` (veralteter DB-Wert) → still Mifflin-St Jeor. Katch-McArdle ohne gültigen
Körperfettanteil (2-70 %) → Mifflin-St Jeor mit Hinweis `calculator_fallback`. Der Körperfettanteil kommt aus dem
neuesten `weight_entries.body_fat_pct` (oder als Override).

Referenzwerte (Tests):

| Person | BMR (Mifflin) |
|---|---|
| ♂ 30 J, 180 cm, 80 kg | 1780 |
| ♀ 25 J, 165 cm, 60 kg | 1345,25 |
| unspecified 30 J, 180 cm, 80 kg | 1697 |

---

## 4. Zielberechnung & Sicherheitsregeln (`computeCalorieTarget`)

1. **TDEE** = BMR × PAL.
2. **Gewünschte Anpassung** aus Ziel + Tempo (`requestedAdjustmentKcal`).
3. **25-%-Deckel**: Ein Defizit wird auf `floor10(TDEE × 0,25)` begrenzt → `capApplied`, Hinweis `deficit_capped`.
4. **Tagesziel** = `round10(round(TDEE) + Anpassung)`.
5. **Untergrenze** (nur im Defizit): `floorKcal = min(ceil10(max(Minimum nach Geschlecht, BMR)), floor10(TDEE))`, also nie über dem TDEE
   (ein Abnehmziel wird so nie zum Überschuss). Liegt das Ziel darunter → Ziel = Untergrenze, `floorApplied`,
   Hinweis `floor_applied`; die Anpassung wird zu `Ziel − round(TDEE)`.
6. TDEE selbst unter dem Minimum → zusätzlicher Hinweis `low_maintenance`.
7. **Wochenänderung** = `Anpassung × 7 / 7700` kg (bei `maintain` 0).
8. **Zeit bis zum Ziel** (`estimatedWeeksToGoal`, aufgerundete Wochen) nur, wenn Zielgewicht gesetzt ist und
   Richtung passt. Zielgewicht ±0,1 kg erreicht → 0 + `goal_reached`. Richtung falsch (abnehmen, Ziel über aktuellem
   Gewicht) → `null` + `target_above_current` bzw. `target_below_current`. `estimateGoalDate(from, weeks)` liefert
   das Datum.

Alle Hinweise sind freundliche deutsche Sätze (`warnings: string[]`) plus maschinenlesbare Codes
(`warningDetails: { code, message }[]`), die UI wählt Ton/Icon über den Code, nie über den Text. Keine Schuld,
keine Verbote: „Weniger empfehlen wir nicht ohne ärztliche Begleitung, dafür geht es etwas langsamer voran.“

### Manuelles Ziel (`checkManualTarget`)

Der Nutzer darf das Ziel jederzeit selbst festlegen („Selbst festlegen“). Werte in `MANUAL_TARGET_LIMITS`
(800-10.000 kcal) werden akzeptiert; unter `floorKcal` gibt es nur einen **nicht blockierenden** Hinweis
(`manual_below_floor`). Außerhalb der Grenzen → `CalorieInputError("target")`.

---

## 5. Beispiel-Breakdown

♂ 33 J, 180 cm, 84 kg, moderat aktiv, Ziel „Abnehmen / Moderat“, Zielgewicht 78 kg:

```
BMR    = 10·84 + 6,25·180 − 5·33 + 5 = 1805
TDEE   = 1805 × 1,55 = 2797,75 → 2798
Ziel   = round10(2798 − 500) = 2300
Woche  = −500 × 7 / 7700 = −0,45 kg → 6 kg in 14 Wochen
```

`describeCalorieCalculation(calc)`:

| key | label | value | hint |
|---|---|---|---|
| bmr | Grundumsatz | 1.805 kcal | Das verbraucht dein Körper in völliger Ruhe … |
| tdee | Geschätzter Erhaltungsbedarf | 2.798 kcal | Grundumsatz × 1,55 für deinen Alltag … |
| adjustment | Gewähltes Defizit | −500 kcal | Damit verlierst du etwa 0,45 kg pro Woche. |
| target | Tagesziel | 2.300 kcal | Deine Empfehlung pro Tag. Du kannst sie jederzeit selbst anpassen. |

`summary`: **„Geschätzter Erhaltungsbedarf: 2.798 kcal · Gewähltes Defizit: −500 kcal · Tagesziel: 2.300 kcal“**
(die Anpassung entfällt bei 0; bei Deckel/Untergrenze heißt sie „Defizit (begrenzt)“).

---

## 6. Einen Rechner hinzufügen

1. In `src/domain/calories/calculators.ts`:
   ```ts
   export const cunningham = defineCalculator({
     id: "cunningham",                 // stabil, landet in user_profiles.calculator_id
     name: "Cunningham",
     description: "Ein deutscher Satz für die Einstellungen.",
     requires: ["bodyFatPct"],         // optional
     canCalculate: hasValidBodyFat,    // optional, false → Fallback auf Mifflin mit Hinweis
     bmr: (p) => 500 + 22 * p.weightKg * (1 - p.bodyFatPct! / 100),
   });
   ```
2. In `CALCULATORS` eintragen (Default bleibt an erster Stelle), in `index.ts` exportieren.
3. Referenzwerte in `calculators.test.ts`, Formel + Quelle in §3 dieser Datei.

TDEE, Tempo, Deckel, Untergrenze, Warnungen und Breakdown kommen automatisch mit. Kein Schema-Change nötig
(`calculator_id` ist `text`); `updateProfile` akzeptiert neue ids über `isCalculatorId`.

---

## 7. API-Referenz

### Domain: `@/domain/calories` (rein, client-tauglich)

```ts
// Hauptfunktion
calculateCalories(profile: BodyProfile, goal: GoalSettings, options?: { calculatorId?: string | null }): CalorieCalculation
estimateGoalDate(from: IsoDate, estimatedWeeksToGoal: number | null): IsoDate | null
describeCalorieCalculation(calc: CalorieCalculation): CalorieBreakdown   // { lines, summary }
checkManualTarget(calc: CalorieCalculation, manualKcal: number): ManualTargetCheck
calculateAge(birthDate: IsoDate, onDate: IsoDate): number                // vollendete Jahre; 29.02. → 01.03.

// Registry
interface CalorieCalculator {
  id: string; name: string; description: string; requires: readonly (keyof BodyProfile)[];
  canCalculate(p: BodyProfile): boolean;
  calculateBMR(p: BodyProfile): number;
  calculateTDEE(p: BodyProfile): number;
  calculateTarget(p: BodyProfile, goal: GoalSettings): CalorieTarget;
}
CALCULATORS, DEFAULT_CALCULATOR_ID, getCalculator(id?), isCalculatorId(id), defineCalculator(def)
mifflinStJeor, harrisBenedictRevised, katchMcArdle

// Bausteine
computeCalorieTarget(input: ComputeTargetInput): CalorieCalculation
resolveGoalPace(goal): { pace: GoalPace | null; adjusted: boolean }
requestedAdjustmentKcal(goal): number
safetyFloorKcal(profile, bmr, tdee): number
weeklyChangeKgFor(dailyBalanceKcal): number
validateBodyProfile(profile): void                                       // wirft CalorieInputError

// Metadaten für die UI
ACTIVITY_LEVELS, ACTIVITY_MULTIPLIERS, getActivityLevel(id), GOAL_TYPES, GOAL_PACES, getGoalPaces(goal),
DEFAULT_GOAL_PACE, SAFETY, BODY_LIMITS, KCAL_PER_KG_BODY_WEIGHT, MANUAL_TARGET_LIMITS

// Zod (deutsche Meldungen, Grenzen = DB-CHECKs)
BodyProfileSchema, GoalSettingsSchema, CalorieInputSchema, ProfilePatchSchema, CalorieOverridesSchema,
HeightCmSchema, WeightKgSchema, TargetWeightKgSchema, AgeYearsSchema, BodyFatPctSchema, TimezoneSchema, …

// Fehler
class CalorieInputError extends Error { field: string }   isCalorieInputError(err)
```

`CalorieCalculation`: `calculatorId, bmr, activityMultiplier, tdee, adjustment, target, requestedAdjustment,
floorKcal, floorApplied, capApplied, weeklyChangeKg, estimatedWeeksToGoal, warnings, warningDetails`.

### Services: `@/server/services/profile`

```ts
getProfile(ctx: ServiceContext): Promise<ProfileRow>                        // NOT_FOUND ohne Zeile
updateProfile(ctx: ServiceContext, patch: ProfilePatch): Promise<ProfileRow>
getCurrentWeight(ctx: ServiceContext): Promise<CurrentWeight | null>
//   { weightKg, source: "entry" | "start", date: IsoDate | null, bodyFatPct: number | null }
getCurrentWeightKg(ctx: ServiceContext): Promise<number | null>
```

`updateProfile`: Zod-strict (unbekannte/geschützte Felder wie `bmrKcal` → `VALIDATION`), Alter aus
Geburtsdatum 14-120 am heutigen Tag, `maintain` löscht das Tempo, `gain` + `fast` → Feldfehler (geerbtes `fast`
wird beim Wechsel auf `gain` zu `moderate`), `calculatorId` muss registriert sein, `timezone` muss eine gültige
IANA-Zone sein. Rechnet **nicht** neu: danach `recalculateAndStore(ctx)` aufrufen.

`getCurrentWeight`: neuester `weight_entries`-Eintrag mit `date ≤ heute` (Zeitzone des Nutzers; zukünftige
Einträge zählen nicht), sonst `start_weight_kg`, sonst `null`. Körperfett = neuester Eintrag mit Wert. Nur lesend.

### Services: `@/server/services/calories`

```ts
calculateCaloriesForUser(ctx: ServiceContext, overrides?: CalorieOverrides): Promise<UserCalorieCalculation>
recalculateAndStore(ctx: ServiceContext): Promise<UserCalorieCalculation>

type CalorieOverrides = Partial<{
  sex; birthDate; ageYears; heightCm; weightKg; bodyFatPct; activityLevel;
  goalType; goalPace; targetWeightKg; calculatorId;
}>
interface UserCalorieCalculation extends CalorieCalculation {
  input: { body: BodyProfile; goal: GoalSettings; weightSource: "override" | "entry" | "start" };
}
```

- Overrides ersetzen gespeicherte Werte nur für diese Rechnung (Onboarding-/Einstellungs-Vorschau, nichts wird
  geschrieben). `ageYears` schlägt `birthDate`; `null` bei `goalPace`/`targetWeightKg`/`bodyFatPct` löscht den Wert
  für die Rechnung.
- Fehlende Daten → `AppError("VALIDATION", "Für die Berechnung fehlen noch ein paar Angaben.", fieldErrors)` mit
  allen fehlenden Feldern auf einmal (`birthDate`, `heightCm`, `weightKg`). `CalorieInputError` der Domain wird zu
  `VALIDATION` mit Feldfehler.
- `recalculateAndStore` schreibt `round(bmr)` / `round(tdee)` nach `user_profiles.bmr_kcal` / `tdee_kcal` und gibt
  die Rechnung zurück; `goal_profiles` bleiben unberührt.

---

## 8. Zusammenspiel: Onboarding & Einstellungen

Die Calorie Engine liefert das **Kalorienziel**; Makros und gespeicherte Tagesziele gehören anderen Engines.

| Schritt | Wer | Funktion |
|---|---|---|
| 1. Profil speichern | Calorie Engine | `updateProfile(ctx, patch)` |
| 2. Rechnen + BMR/TDEE speichern | Calorie Engine | `recalculateAndStore(ctx)` → `calc.target` |
| 3. Standard-Zielprofil (kcal + Makros) anlegen/aktualisieren | Macro Engine | `upsertDefaultGoalProfile(ctx, { calorieTarget: calc.target, … })` |
| 4. Tagesziele ab heute neu berechnen | Daily Nutrition Engine | `refreshTargetsFrom(ctx, todayInTimezone(ctx.timezone))` |

Beispiel (Server Action, Onboarding-Abschluss oder „Einstellungen → Ziel“):

```ts
"use server";
export async function saveGoalAction(input: unknown) {
  return runAction(async () => {
    const patch = ProfilePatchSchema.parse(input);
    const ctx = await getServiceContext();
    return inTransaction(ctx, async (tx) => {
      await updateProfile(tx, patch);
      const calc = await recalculateAndStore(tx);
      await upsertDefaultGoalProfile;
      await refreshTargetsFrom(tx, todayInTimezone(tx.timezone));
      return describeCalorieCalculation(calc);
    });
  });
}
```

- **Live-Vorschau** im Onboarding: entweder rein im Client `calculateCalories(body, goal)` (Domain ist
  client-tauglich) oder serverseitig `calculateCaloriesForUser(ctx, overrides)`, wenn gespeicherte Werte (z. B.
  aktuelles Gewicht) einfließen sollen.
- **Manuelles Ziel**: `checkManualTarget(calc, kcal)` für den Hinweis, dann direkt an Macro Engine übergeben, die
  Engine überschreibt manuelle Ziele nie.
- **Neues Gewicht** (Gewichts-Tracking): optional `recalculateAndStore(ctx)` nach dem Speichern, damit
  „Erhaltungsbedarf“ aktuell bleibt. Ob das gespeicherte Tagesziel automatisch nachgezogen wird, entscheidet der
  Aufrufer (nur, wenn das Ziel nicht manuell gesetzt ist).

Die Signaturen von `upsertDefaultGoalProfile` und `refreshTargetsFrom` sind hier nur
skizziert: maßgeblich ist der jeweilige Service.
