# Macro Engine & Zielprofile

Owner: Macro Engine. Code: `src/domain/macros/**` (reine Logik, Client + Server nutzbar) und
`src/server/services/goals/**` (Service-Schicht, DB). Schema: `goal_profiles`, `daily_nutrition`
in `src/server/db/schema/goals.ts`.

| Modul | Inhalt |
|---|---|
| `domain/macros/math.ts` | kcal ↔ g ↔ %, Rundungsstrategie, Konsistenzprüfung, Warnungen |
| `domain/macros/recommend.ts` | Auto-Modus: Protein-/Fett-Empfehlung, Bezugsgewicht |
| `domain/macros/targets.ts` | `computeMacroTargets(spec)` – ein Einstieg für alle drei Modi (auch für Live-Vorschau im Client) |
| `domain/macros/presets.ts` | Prozent-Presets (Ausgewogen, Proteinreich, Low Carb, Ausdauer, Keto) |
| `domain/macros/day-profiles.ts` | Profilarten + `deriveDayProfile` (Trainingstag, Ruhetag, …) |
| `domain/macros/schedule.ts` | Wochentagsplan, Konfliktprüfung, `pickDayProfile` (Auflösungsreihenfolge) |
| `server/services/goals/*` | Profile lesen/schreiben, `resolveGoalProfileForDate`, Zod-Schemas |

---

## 1. Grundlagen

- Einheiten: Energie in **kcal**, Makros in **g**. Atwater-Faktoren **4 / 4 / 9** kcal pro g
  (Protein / Kohlenhydrate / Fett, `KCAL_PER_G` in `domain/nutrition/types.ts`).
- Invariante jedes gespeicherten Profils: **|4P + 4C + 9F − calorieTarget| ≤ 5 kcal**
  (`MACRO_KCAL_TOLERANCE`), Grammwerte ganzzahlig. Der Service speichert nie andere Werte.
- Gespeichert wird immer in **Gramm** (Quelle der Wahrheit für Tracking). Im Prozentmodus werden zusätzlich
  die vom Nutzer gewählten Prozente (`protein_pct` …) für die erneute Anzeige gespeichert.
- Grenzen: `calorieTarget` 1–20.000 kcal (ganzzahlig), Makros 0–2.000 g, Prozente je 0–100 mit Summe 100 ± 0,5.

## 2. Die drei Makro-Modi

| Modus | Eingabe | Rechnung |
|---|---|---|
| `percent` | kcal + Anteile (%) | g = kcal × % / 100 / Faktor, dann Rundungsstrategie (§3). Anteile werden auf exakt 100 normiert (33,3/33,3/33,4 geht). |
| `grams` | kcal + Protein g + Fett g | P, F fest (auf ganze g gerundet), **C = (kcal − 4P − 9F) / 4**. Ist das negativ → Warnung `carbs_negative`, der Service lehnt ab (`VALIDATION`). |
| `auto` | kcal + Gewicht, Ziel, Aktivität (optional Größe, Zielgewicht) | Empfehlung nach §4, dann Rundungsstrategie. |

Beispiele („diese Makros ergeben X kcal“):

```ts
computeMacroTargets({ mode: "percent", kcal: 2000, percents: { protein: 30, carbs: 40, fat: 30 } });
// → 150 P / 199 C / 67 F  = 600 + 796 + 603 = 1.999 kcal (diffKcal −1)

computeMacroTargets({ mode: "grams", kcal: 2400, proteinG: 180, fatG: 70 });
// → 180 P / 263 C / 70 F  = 720 + 1.052 + 630 = 2.402 kcal (C = (2400 − 720 − 630) / 4 = 262,5 → 263)

computeMacroTargets({ mode: "auto", kcal: 2300, weightKg: 75, goal: "lose", activityLevel: "moderate" });
// → 150 P / 281 C / 64 F  = 600 + 1.124 + 576 = 2.300 kcal
```

Jedes Ergebnis ist eine `MacroCalculation`:
`{ kcal, macros, macroKcal, diffKcal, percents (effektiv, ungerundet), warnings[] }` – genau die Daten für
die Transparenzzeile „Diese Makros ergeben 2.402 kcal (+2)“. Weil `computeMacroTargets` rein ist, kann ein
Client-Formular live dieselbe Rechnung zeigen, die der Service später speichert.

## 3. Rundungsstrategie („Kohlenhydrate balancieren“)

Problem: Rundet man alle drei Makros unabhängig, weicht 4P + 4C + 9F schnell um 10+ kcal vom Ziel ab
(Fett zählt 9-fach). Lösung in `fitMacrosToKcal(kcal, exact)`:

1. **Protein und Fett** werden auf ganze Gramm gerundet (kaufmännisch).
2. **Kohlenhydrate balancieren**: `C = round((kcal − 4P − 9F) / 4)` → Abweichung ≤ **2 kcal**.
3. Ist der exakte KH-Wert < 1 g (z. B. 0 %-KH-Profil) oder würde C negativ, ist C = 0 und **Fett balanciert**:
   `F = round((kcal − 4P) / 9)` → Abweichung ≤ **4,5 kcal**.
4. Übersteigt schon Protein allein das Ziel, balanciert Protein: `P = round(kcal / 4)`.

Damit gilt immer |Δ| ≤ 5 kcal (`MACRO_KCAL_TOLERANCE`). Warum Kohlenhydrate? Protein ist die
„Pflicht“-Größe (g/kg), Fett hat eine Untergrenze aus Gesundheitsgründen – KH sind die natürliche
Stellschraube, und ±1 g KH (±4 kcal) ist die feinste Stufe. Angezeigt werden ganze Gramm; ganzzahlige
Werte werden auch gespeichert, damit Anzeige und Rechnung übereinstimmen.

## 4. Empfehlungen (Auto-Modus) – Formeln und Quellen

### 4.1 Bezugsgewicht

Bei hohem Körpergewicht überschätzt g/kg × Gesamtgewicht den Proteinbedarf (Fettmasse braucht kaum Protein).
Daher wird – analog zum in der klinischen Ernährung üblichen *adjusted body weight* – nur ein Teil des
Übergewichts gezählt:

```
Anker        = 25 × (Größe in m)²          (Gewicht bei BMI 25), ohne Größe: Zielgewicht, sonst keiner
Bezugsgewicht = Gewicht,                              wenn Gewicht ≤ Anker oder kein Anker
              = Anker + 0,25 × (Gewicht − Anker),     sonst
```

Beispiel: 130 kg, 170 cm → Anker 72,3 kg → Bezugsgewicht 86,7 kg.

### 4.2 Protein

```
g/kg   = Basis nach Ziel (abnehmen 2,0 · halten 1,6 · zunehmen 1,8)
       + Aktivität (sitzend −0,2 · leicht −0,1 · moderat 0 · aktiv +0,1 · sehr aktiv +0,2)
g/kg   = clamp(g/kg, 1,2 … 2,2)
Protein = g/kg × Bezugsgewicht, höchstens 40 % der kcal
```

Begründung/Quellen:
- Morton et al., *Br J Sports Med* 52:376 – Meta-Analyse: Nutzen für Muskelzuwachs flacht bei
  ~1,6 g/kg/Tag ab (oberes KI ~2,2 g/kg) → Basis „halten“ 1,6, Obergrenze 2,2.
- Jäger et al., *ISSN Position Stand: Protein and Exercise*, JISSN 14:20 – 1,4–2,0 g/kg für
  Trainierende.
- Thomas, Erdman & Burke, *ACSM/AND/DC Joint Position: Nutrition and Athletic Performance* –
  1,2–2,0 g/kg → Untergrenze 1,2.
- Helms et al., JISSN 11:20; Phillips & Van Loon, *J Sports Sci* 29:S29 – im Kaloriendefizit
  schützt mehr Protein (bis ~2,3–3,1 g/kg fettfreie Masse) die Muskulatur → „abnehmen“ 2,0.
- Die DGE-Referenz (0,8 g/kg für Erwachsene) ist der Mindestbedarf, nicht das Optimum für aktive Menschen;
  alle Empfehlungen liegen darüber.
- Deckel 40 % der kcal: verhindert absurde Werte bei sehr niedrigen Kalorienzielen.

### 4.3 Fett

```
Fett = max(Anteil nach Ziel × kcal / 9 (abnehmen 25 % · halten 30 % · zunehmen 25 %),
           0,6 g × Bezugsgewicht)
       höchstens 40 % der kcal
```

Quellen: DGE-Referenzwerte (Richtwert 30 % der Energie), EFSA *Dietary Reference Values for fats*
(20–35 % E), IOM *AMDR* (20–35 % E). Die Untergrenze 0,6 g/kg bzw. die Warnung `fat_low` (< 20 % E oder
< 0,5 g/kg) schützt Hormonhaushalt und Aufnahme fettlöslicher Vitamine; bei Diäten wird 25 % statt 30 %
gewählt, damit mehr Raum für Protein und KH bleibt.

### 4.4 Kohlenhydrate

Rest der Energie (`(kcal − 4P − 9F) / 4`), anschließend §3. `recommendMacros` liefert zusätzlich
`referenceWeightKg`, `proteinGPerKg`, `fatGPerKg` und `rationale[]` (deutsche Sätze für „Wie berechnet?“).

### 4.5 Warnungen (nicht blockierend)

| Code | Bedingung | blockiert? |
|---|---|---|
| `carbs_negative` | Protein + Fett > kcal (Gramm-Modus) | **ja** (Service → `VALIDATION`, Feld `grams`) |
| `carbs_very_low` | KH < 50 g | nein |
| `fat_low` | Fett < 20 % kcal oder < 0,5 g/kg | nein |
| `protein_high` | > 2,5 g/kg | nein |
| `calories_low` | kcal < 1.200 | nein |

Texte sind deutsch, freundlich, ohne Schuldzuweisung (`warning.message`).

## 5. Presets

`MACRO_PRESETS` (Prozentmodus): Ausgewogen 30/40/30 · Proteinreich 40/30/30 · Low Carb 35/20/45 ·
Ausdauer 20/55/25 · Keto 25/5/70 (P/C/F). `findMatchingPreset(percents)` markiert ein passendes Preset (± 0,5).

## 6. Tagesprofile, Wochenplan, Auflösung

### 6.1 Modell

- Jeder Nutzer hat **genau ein aktives Standardprofil** (`is_default = true`, `kind = "default"`,
  keine Wochentage). Erzwungen durch den partiellen Unique-Index `goal_profiles_one_default_per_user`.
  Es kann nicht archiviert werden und behält `kind = "default"`.
- Weitere Profile (`kind`: `training`, `rest`, `high_carb`, `low_carb`, `refeed`, `custom`) haben eigene
  Ziele und optional **Wochentage** (ISO 1 = Mo … 7 = So, dedupliziert, sortiert).
- **Ein Wochentag gehört höchstens einem aktiven Profil** (sonst `CONFLICT`, z. B. „Montag und Mittwoch sind
  bereits dem Profil „Ruhetag“ zugeordnet. Entferne die Tage dort zuerst.“). Archivierte Profile geben ihre
  Tage frei.
- **Archivieren** statt löschen: vergangene `daily_nutrition`-Snapshots bleiben gültig; archivierte Profile
  sind schreibgeschützt.
- Einzelne Tage können per `daily_nutrition.profile_overridden = true` + `goal_profile_id` explizit
  ein Profil bekommen.

### 6.2 Ableitung (`deriveDayProfile`)

Protein bleibt gleich, kcal ändert sich um `kcalDelta`, optional wird Fett-Energie in KH verschoben
(`fatShiftKcal`, Fett nie unter 50 % des Basiswerts), KH balancieren:

| Art | kcal | Fett→KH | Name |
|---|---|---|---|
| training | +250 | 0 | Trainingstag |
| rest | −250 | 0 | Ruhetag |
| high_carb | +200 | 150 kcal | High-Carb-Tag |
| low_carb | −200 | −150 kcal (mehr Fett) | Low-Carb-Tag |
| refeed | +500 bzw. Erhaltungsbedarf | 200 kcal | Refeed-Tag |
| custom | 0 | 0 | Eigenes Profil |

Beispiel: Standard 2.300 kcal, 150/281/64 → Trainingstag 2.550 kcal, 150/344/64 (= 2.552 kcal).

### 6.3 Auflösungsreihenfolge

`resolveGoalProfileForDate(ctx, date)` (Entscheidung in der reinen Funktion `pickDayProfile`):

1. **Override**: `daily_nutrition` des Tages mit `profile_overridden = true` und einem **aktiven**
   (nicht archivierten) Profil des Nutzers. Archivierte oder gelöschte (`goal_profile_id = null`) Overrides
   werden ignoriert → weiter mit 2.
2. **Wochenplan**: aktives Nicht-Standard-Profil, dessen `weekdays` `isoWeekday(date)` enthält
   (bei Altdaten mit Überschneidung gewinnt das älteste Profil).
3. **Standardprofil**.
4. `null` – Onboarding noch nicht abgeschlossen.

`resolveGoalProfilesForRange(ctx, from, to)` liefert dasselbe für einen Zeitraum mit zwei Queries
.

## 7. Service-API (`@/server/services/goals`)

Alle Funktionen: `(ctx: ServiceContext, …)`, immer auf `ctx.userId` gescoped, Eingaben per Zod validiert
(Schemas im selben Modul exportiert, für Formulare/Actions wiederverwendbar). Erwartete Fehler sind
`AppError` mit deutscher Meldung: `VALIDATION` (+ `fieldErrors`), `NOT_FOUND` (auch fremde IDs),
`CONFLICT` (Wochentag belegt). `GoalProfileRow = typeof goalProfiles.$inferSelect`.

```ts
// Lesen
resolveGoalProfileForDate(ctx, date: IsoDate): Promise<GoalProfileRow | null>
resolveGoalProfilesForRange(ctx, from: IsoDate, to: IsoDate): Promise<Map<IsoDate, GoalProfileRow | null>>
listGoalProfiles(ctx, opts?: { includeArchived?: boolean }): Promise<GoalProfileRow[]>   // Standard zuerst
getGoalProfile(ctx, id: string): Promise<GoalProfileRow>                                 // inkl. archivierter
getDefaultGoalProfile(ctx): Promise<GoalProfileRow | null>

// Schreiben – Ergebnis: { profile: GoalProfileRow; calculation: MacroCalculation }
upsertDefaultGoalProfile(ctx, input: UpsertDefaultGoalProfileInput): Promise<GoalProfileWriteResult>
createGoalProfile(ctx, input: CreateGoalProfileInput): Promise<GoalProfileWriteResult>
createDerivedGoalProfile(ctx, input: CreateDerivedGoalProfileInput): Promise<GoalProfileWriteResult>
updateGoalProfile(ctx, id: string, input: UpdateGoalProfileInput): Promise<GoalProfileWriteResult>
archiveGoalProfile(ctx, id: string): Promise<GoalProfileRow>
setProfileWeekdays(ctx, id: string, weekdays: readonly number[]): Promise<GoalProfileRow>
```

### 7.1 Ziel-Eingabe (`GoalTargetsSchema`)

```ts
{
  calorieTarget: number;                          // ganze kcal, 1–20.000
  calorieSource: "calculated" | "manual";         // calculated = vom Calorie Engine berechnet
  macroMode: "percent" | "grams" | "auto";
  percents?: { protein: number; carbs: number; fat: number };   // Pflicht bei percent
  grams?: { proteinG: number; fatG: number };                    // Pflicht bei grams (KH = Rest)
  autoInput?: { weightKg?, targetWeightKg?, heightCm?, goal?, activityLevel? }
  fiberG?: number | null; sugarMaxG?: number | null; sodiumMaxMg?: number | null;
}
```

- `auto`: fehlende Felder kommen aus `user_profiles` (Ziel, Aktivität, Größe, Zielgewicht) und dem
  **letzten Gewichtseintrag** (sonst Startgewicht). Ohne Gewicht → `VALIDATION` auf `autoInput.weightKg`.
- Zusatzziele (Ballaststoffe, Zucker, Natrium): `undefined` = unverändert, `null` = löschen.

### 7.2 Beispiele

```ts
// Onboarding / Einstellungen – legt das Standardprofil an oder aktualisiert es (atomarer Upsert)
const { profile, calculation } = await upsertDefaultGoalProfile(ctx, {
  calorieTarget: 2000, calorieSource: "calculated", macroMode: "percent",
  percents: { protein: 30, carbs: 40, fat: 30 },
});
// profile: 150 P / 199 C / 67 F, proteinPct 30 …
// calculation.macroKcal === 1999 → „Diese Makros ergeben 1.999 kcal“

// Trainingstag aus dem Standard ableiten und Mo/Mi/Fr zuordnen
await createDerivedGoalProfile(ctx, { kind: "training", weekdays: [1, 3, 5] });

// Eigenes Profil mit Gramm-Vorgaben
await createGoalProfile(ctx, {
  name: "Ruhetag", kind: "rest", weekdays: [7],
  calorieTarget: 2050, calorieSource: "manual", macroMode: "grams", grams: { proteinG: 150, fatG: 64 },
}); // → 150 / 219 / 64 = 2.052 kcal

// Nur Name ändern (Ziele bleiben; calculation wird aus den gespeicherten Gramm gebildet)
await updateGoalProfile(ctx, id, { name: "Beintag" });
// Ziele ändern: `targets` immer vollständig (Modi hängen voneinander ab)
await updateGoalProfile(ctx, id, { targets: { calorieTarget: 2600, calorieSource: "manual",
  macroMode: "percent", percents: { protein: 25, carbs: 50, fat: 25 } } });

await setProfileWeekdays(ctx, id, [2, 4]);   // CONFLICT, wenn Di/Do schon vergeben
await archiveGoalProfile(ctx, id);           // VALIDATION für das Standardprofil
```

### 7.3 Regeln im Überblick

| Regel | Fehler |
|---|---|
| Zusätzliche Profile brauchen ein Standardprofil | `VALIDATION` „Lege zuerst dein Standardziel fest.“ |
| `kind: "default"` ist reserviert; Standardprofil ändert seine Art nicht | `VALIDATION` |
| Standardprofil bekommt keine Wochentage | `VALIDATION` |
| Wochentag schon einem anderen aktiven Profil zugeordnet | `CONFLICT` |
| Standardprofil archivieren | `VALIDATION` |
| Archiviertes Profil bearbeiten / Wochentage setzen | `VALIDATION` |
| Protein + Fett > Kalorienziel (Gramm-Modus) | `VALIDATION` (`fieldErrors.grams`) |
| Fremde oder unbekannte ID | `NOT_FOUND` |

Nebenläufigkeit: Schreibvorgänge mit Wochentagen laufen in `inTransaction` und sperren die aktiven Profile
des Nutzers (`SELECT … FOR UPDATE`), damit zwei parallele Zuordnungen keinen Doppel-Wochentag erzeugen.
Das Standardprofil wird per `INSERT … ON CONFLICT (user_id) WHERE is_default AND archived_at IS NULL
DO UPDATE` geschrieben.

## 8. Integration – Pflicht für Aufrufer

**Nach jedem erfolgreichen Schreibvorgang** (`upsertDefaultGoalProfile`, `createGoalProfile`,
`createDerivedGoalProfile`, `updateGoalProfile`, `archiveGoalProfile`, `setProfileWeekdays`) müssen die
aufrufenden Server Actions (Onboarding, Einstellungen, Tagesprofile) die Tagesziele von heute an
aktualisieren:

```ts
"use server";
import { refreshTargetsFrom } from "@/server/services/nutrition"; // Daily Nutrition Engine
import { upsertDefaultGoalProfile, type UpsertDefaultGoalProfileInput } from "@/server/services/goals";
import { todayInTimezone } from "@/lib/dates";

export async function saveGoalsAction(input: UpsertDefaultGoalProfileInput) {
  return runAction(async () => {
    const ctx = await getServiceContext();
    const res = await inTransaction(ctx, async (tx) => {
      const r = await upsertDefaultGoalProfile(tx, input); // validiert selbst per Zod
      await refreshTargetsFrom(tx, todayInTimezone(ctx.timezone));
      return r;
    });
    revalidatePath("/", "layout");
    return res;
  });
}
```

Der Goals-Service ruft `refreshTargetsFrom` bewusst **nicht** selbst auf (keine Abhängigkeit auf die
Daily-Nutrition-Engine, keine Zyklen). Vergangene Tage behalten ihren Snapshot. Gleiches gilt für das
Setzen eines Overrides in `daily_nutrition`: danach die Ziele des Tages aus
`resolveGoalProfileForDate` übernehmen.

## 9. Tests

- Domain: `src/domain/macros/*.test.ts` (Rundung, Modi, Empfehlungen, Ableitung, Wochenplan).
- Service: `src/server/services/goals/goals.test.ts` (PGlite): Eindeutigkeit Standardprofil,
  Archivierungsregeln, Wochentag-Konflikte, Auflösungsreihenfolge inkl. archiviertem Override,
  Nutzer-Isolation, Konsistenz 4P + 4C + 9F ≈ Ziel für alle Modi (in der DB gespeichert).
