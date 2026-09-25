# User Journeys

> Owner: Product Architecture. Jede Journey: Einstieg → Schritte (mit Tap-Zählung) → Zielzeit → Edge Cases & Empty States.
> **Tap-Zählung:** jeder Tap/Klick zählt, Tippen in ein Textfeld zählt nicht als Tap, Tastatur-„Enter“ zählt
> nicht. Start ist immer „App ist offen auf dem genannten Screen“. Zielzeiten gelten für einen geübten Nutzer auf
> einem Mittelklasse-Smartphone. Beispielwerte: Referenz-Nutzer aus [README](./README.md).

## Übersicht

| # | Journey | Taps | Zielzeit | Module |
|---|---|---|---|---|
| J1 | Signup → Onboarding → erster Eintrag | ~14 | ≤ 3 min | Auth, Onboarding, Calorie Engine, Macro Engine, Meal Logging |
| J2 | Frühstück erneut loggen | 2 | ≤ 5 s | Meal Logging, Today Dashboard |
| J3 | Suchen & neues Lebensmittel loggen | 3 | ≤ 15 s | Food Search, Meal Logging |
| J4 | Barcode scannen (gefunden / unbekannt) | 3 / ~7 | ≤ 10 s / ≤ 60 s | Barcode, Custom Foods, Meal Logging |
| J5 | Eigenes Lebensmittel anlegen | ~4 | ≤ 60 s | Custom Foods |
| J6 | Rezept anlegen & Portion loggen | ~12 | ≤ 3 min (5 Zutaten) | Recipes, Meal Logging |
| J7 | Eintrag bearbeiten / Portion ändern / löschen | 2–3 | ≤ 8 s | Diary, Meal Logging |
| J8 | Gestern / Mahlzeit kopieren | 2–3 | ≤ 5 s | Diary, Meal Logging |
| J9 | Gewicht eintragen & Trend sehen | 3 | ≤ 10 s | Weight Tracking, Today Dashboard |
| J10 | Kalorienziel / Makromodus / Trainingstag ändern | 4–6 | ≤ 45 s | Settings, Calorie Engine, Macro Engine |
| J11 | Wochenfortschritt prüfen | 1–2 | ≤ 10 s | Analytics |
| J12 | Milo über den Tag | 0–1 je Moment | – | Mascot Engine, Mascot Design, Today Dashboard |

---

## J1 – Signup → Onboarding → erster Eintrag

1. `/signup`: Name, E-Mail, Passwort (min. 8 Zeichen, Sichtbarkeits-Toggle) → **„Konto erstellen“** (1).
2. Redirect `/onboarding` Schritt 1 **Willkommen**: Milo (`happy`) „Hi, ich bin Milo. In 2 Minuten haben wir dein
   persönliches Tagesziel.“ → **„Los geht’s“** (2).
3. **Ziel**: 3 große Karten „Abnehmen · Gewicht halten · Zunehmen“ → Tap wählt **und** geht weiter (3).
4. **Körperdaten**: Geschlecht (Segment, 4), Geburtsdatum, Größe, aktuelles Gewicht (numerische Tastatur) → **„Weiter“** (5).
5. **Aktivität**: 5 Karten mit Alltagsbeispielen („Bürojob, kaum Sport“ …) → Tap wählt und geht weiter (6).
6. **Gewichtsziel** (entfällt bei „halten“): Zielgewicht + Tempo „Entspannt · Moderat · Ambitioniert“ mit kg/Woche
   und voraussichtlichem Datum → **„Weiter“** (7–8).
7. **Kalorien**: transparente Rechnung „Grundumsatz 1.805 → Erhaltungsbedarf 2.798 → Defizit −500 →
   **2.300 kcal**“. **„Passt“** (9) oder „Selbst festlegen“.
8. **Makros**: Vorschlag „Ausgewogen (auto)“ mit Balken 150 g / 281 g / 64 g; Alternativen „High Protein“,
   „Low Carb“, „Eigene Werte“ → **„Weiter“**.
9. **Überblick**: alle Werte als editierbare Zeilen (Tap öffnet den jeweiligen Schritt) → **„Plan starten“**.
10. `/today` mit Empty State: Milo „Dein Plan steht! Was hattest du zuletzt?“ + CTA **„Erstes Essen eintragen“**
    → `/log` (Mahlzeit nach Uhrzeit vorausgewählt) → Suche „Banane“ → Tap Treffer → **„Hinzufügen“**.
11. Zurück auf `/today`: Ring animiert von 0 auf 105 kcal, Milo `celebrating` „Erster Eintrag! Weiter so.“

**Edge Cases**
- E-Mail existiert: Inline-Fehler am Feld „Zu dieser E-Mail gibt es schon ein Konto. **Anmelden?**“ (Link).
- Abbruch/Reload mitten im Onboarding: jeder Schritt speichert sofort (`user_profiles`); Wiedereinstieg im ersten
  unvollständigen Schritt. `/today` leitet ohne `onboarding_completed_at` nach `/onboarding` um.
- Unplausible Eingaben (Größe < 120 / > 230 cm, Gewicht < 35 / > 300 kg, Alter < 16): Inline-Hinweis, kein Weiter.
- Alter 16–17 oder BMI < 18,5 mit Ziel „Abnehmen“: Milo-Hinweis, Ziel wird auf „halten“ vorgeschlagen, Defizit
  gedeckelt.
- Zielgewicht widerspricht Ziel (abnehmen, aber Zielgewicht > aktuelles): Inline-Hinweis mit Korrektur-Vorschlag.
- Geschlecht „keine Angabe“: Mittelwert der beiden Formel-Konstanten, Hinweis „Schätzung etwas ungenauer“.

## J2 – Frühstück erneut loggen (≤ 3 Taps, Ziel: 2)

**Variante A – ganze Mahlzeit (Standard morgens):**
1. Tap **(+)** (1) → `/log`, Mahlzeit „Frühstück“ vorausgewählt (Uhrzeit 07:40).
2. Oberste Karte „Wie gestern: Frühstück · 3 Lebensmittel · 520 kcal“ → **„Eintragen“** (2).
3. Optimistisch gespeichert, Toast „Frühstück eingetragen · **Rückgängig**“ (5 s). Bleibt auf `/log` für weitere Einträge.

**Variante B – einzelnes Lebensmittel:** Tap (+) (1) → Liste „Zuletzt“ → **„+“** neben „Haferflocken · 60 g“ (2).
Menge = zuletzt verwendete Portion (`food_usage.last_serving_id`, `last_quantity`).

**Variante C – vom Dashboard:** `/today` → Karte Frühstück (leer) zeigt „Wie gestern (520 kcal)“ → Tap (1). Fertig.

**Edge Cases**
- Gestern kein Frühstück: Karte zeigt die letzte Frühstücks-Kombination der letzten 7 Tage; sonst ausgeblendet.
- Heute bereits Frühstück geloggt: Karte ausgeblendet (keine Duplikate per Versehen); Einzel-Re-Log bleibt möglich.
- Neuer Nutzer ohne Historie: Bereich „Zuletzt“ zeigt Empty State „Hier landen deine Lieblinge – nach dem
  ersten Eintrag reicht ein Tap.“
- Lebensmittel inzwischen gelöscht/archiviert: Eintrag aus Snapshot kopieren (Name, Nährwerte), Hinweis nicht nötig.

## J3 – Suchen & neues Lebensmittel loggen (3 Taps, ≤ 15 s)

1. Tap **(+)** (1) → `/log`, Suchfeld hat Autofokus (Tastatur offen).
2. Tippen „skyr“ → lokale Treffer nach ≤ 300 ms (Debounce 150 ms), Rangfolge: eigene/Recents → Favoriten →
   lokale DB (Popularität) → externe Treffer werden unten nachgeladen („Weitere Treffer aus Open Food Facts …“).
3. Tap Treffer „Skyr Natur · Arla · 63 kcal / 100 g“ (2) → `/log/food/[id]` mit Standardportion, Menge 1,
   vorausgewählter Mahlzeit, Live-Nährwerten.
4. **„Hinzufügen“** (3) → zurück zu `/log` mit Toast; Suchfeld geleert und fokussiert für den nächsten Eintrag.

**Edge Cases**
- Keine Treffer: „Nichts gefunden für „skyrr“.“ + Aktionen „Barcode scannen“, „Eigenes Lebensmittel anlegen“
  (Name vorbefüllt). Tippfehler-Toleranz über Trigramm-Suche.
- Externe Provider langsam/offline: lokale Treffer bleiben, Zeile „Online-Suche gerade nicht erreichbar“ ohne Blockade.
- Unvollständige Daten (`data_quality = partial/suspect`): Badge „Werte unvollständig“ im Detail, trotzdem loggbar.
- Flüssigkeit (`nutrient_basis = ml`): Portionen in ml, Anzeige „pro 100 ml“.

## J4 – Barcode scannen

**Gefunden (3 Taps, ≤ 10 s):** `/log` → **„Scannen“** (1) → Kamera-Freigabe (einmalig, +1) → Code erkannt
(Vibration, kein Tap) → `/log/food/[id]` → **„Hinzufügen“** (2–3).

**Unbekannt (~7 Taps, ≤ 60 s):**
1. Sheet „Dieses Produkt kennen wir noch nicht.“ Milo `thinking` + **„Produkt anlegen“** (1).
2. `/foods/new?barcode=4001234567890`: Barcode vorbefüllt, Felder in Reihenfolge der Nährwerttabelle auf der
   Verpackung (Energie, Fett, davon gesättigt, KH, davon Zucker, Ballaststoffe, Eiweiß, Salz) pro 100 g.
3. Optional Portion „1 Becher = 150 g“ (2–3) → **„Speichern & eintragen“** (4) → `/log/food/[id]` mit neuer Portion
   → **„Hinzufügen“** (5). Der Barcode ist ab jetzt für diesen Nutzer auffindbar.

**Edge Cases**
- Kamera verweigert / nicht verfügbar (Desktop): manuelle EAN-Eingabe als Fallback mit Ziffern-Tastatur.
- Code nicht lesbar nach 10 s: Hinweis „Mehr Licht oder Abstand ändern“ + manuelle Eingabe.
- Mehrere Treffer für einen Code (OFF + eigenes Produkt): eigenes Produkt zuerst, Auswahlliste.
- Offline / Provider-Fehler: Fehlerzustand „Gerade keine Verbindung zur Produktdatenbank.“ + „Erneut versuchen“ und
  „Produkt selbst anlegen“ (Warteschlange für später ist nicht MVP). „Nicht gefunden“ wird 1 Tag negativ gecacht.

## J5 – Eigenes Lebensmittel anlegen (≤ 60 s)

Einstiege: `/log` Empty-Search-Aktion, `/foods` → „Neu“, Scan „unbekannt“.
1. Name (Pflicht), Marke (optional), Basis „pro 100 g · pro 100 ml“ (Segment).
2. Umschalter **„Werte pro 100 g · pro Portion“** – bei „pro Portion“ wird die Portionsgröße abgefragt und auf
   100 g umgerechnet (gespeichert wird immer pro 100 g/ml).
3. kcal, Eiweiß, KH, Fett (Pflicht); Ballaststoffe, Zucker, ges. Fett, Salz (aufklappbar „Weitere Nährwerte“).
4. Plausibilität: weicht kcal um > 15 % von 4/4/9 ab → Warnung „Kalorien passen nicht ganz zu den Makros
   (berechnet: 412 kcal). Trotzdem speichern?“ – nie blockierend. Makrosumme > 100 g / 100 g → blockierend.
5. **„Speichern“** oder **„Speichern & eintragen“**.

Empty State `/foods`: Milo „Noch keine eigenen Lebensmittel. Leg dein Lieblingsmüsli einmal an – danach ist es
einen Tap entfernt.“ + CTA.

## J6 – Rezept anlegen & Portion loggen

1. `/recipes` → **„Neues Rezept“** (1) → Name „Linsen-Dal“, Portionen „4“.
2. **„Zutat hinzufügen“** (2) → Suche (gleiche Komponente wie `/log`) → Treffer (3) → Menge „250 g“ → **„Übernehmen“** (4).
   Wiederholen für 5 Zutaten (+2 je Zutat).
3. Optional „Gewicht nach dem Kochen“ (z. B. 1.450 g) – verbessert Gramm-Portionen.
4. Live-Nährwerte „pro Portion: 486 kcal · 24 g P · 62 g KH · 14 g F“ und „pro 100 g“.
5. **„Speichern“** (~12) → `/recipes/[id]` mit CTA **„Portion eintragen“** → `/log/food/[recipeFoodId]` (Portion
   „1 Portion (363 g)“) → „Hinzufügen“.

**Edge Cases:** 0 Zutaten → Speichern deaktiviert mit Hinweis. Zutat später gelöscht → bleibt (FK `restrict`),
eigenes Food wird nur archiviert. Rezept bearbeitet → frühere Einträge bleiben unverändert (Snapshot).
Empty State `/recipes`: „Koch einmal, logge immer wieder. Dein erstes Rezept?“

## J7 – Eintrag bearbeiten, Portion ändern, löschen

- **Portion ändern (3 Taps):** Tagebuch/Heute → Tap Eintrag (1) → `/log/food/[foodId]?entry=…` (Sheet auf Mobile)
  mit aktuellen Werten → Menge ändern / andere Portion (2) → **„Speichern“** (3). Nährwerte neu aus Food berechnet;
  ist das Food gelöscht, skaliert der Snapshot proportional.
- **Mahlzeit ändern:** im selben Sheet Mahlzeit-Segment.
- **Löschen (2 Taps):** Swipe links → **„Löschen“** (Mobile) bzw. Menü „⋯ → Löschen“ (Desktop). Kein
  Bestätigungsdialog, stattdessen Toast „Eintrag gelöscht · **Rückgängig**“ (5 s).
- **Edge Case:** Vergangener Tag – editierbar ohne Einschränkung; Tagesziel bleibt der eingefrorene Snapshot.

## J8 – Gestern kopieren / Mahlzeit kopieren

- **Mahlzeit kopieren:** `/diary/[date]` → Mahlzeit-Menü „⋯“ (1) → „Kopieren nach …“ (2) → Datum (Standard: heute)
  + Ziel-Mahlzeit (Standard: gleiche) → **„Kopieren“** (3).
- **Ganzen Tag kopieren:** `/diary/[heute]` leer → Empty State „**Gestern übernehmen** (1.980 kcal)“ (1) → Auswahl
  aller Mahlzeiten vorangehakt → **„Übernehmen“** (2).
- Kopien sind neue Einträge mit neuem Snapshot aus dem aktuellen Food (Fallback: alter Snapshot).
- **Edge Case:** Ziel-Mahlzeit archiviert → Standard-Mahlzeit mit gleicher Sortierposition, sonst „Snacks“.

## J9 – Gewicht eintragen & Trend sehen (3 Taps, ≤ 10 s)

1. `/today` Gewichtskarte **„Eintragen“** (1) → Sheet mit Zahlenfeld, vorbefüllt mit letztem Wert (83,6), ±0,1-Stepper.
2. Wert „83,4“ → **„Speichern“** (2). Ein Wert pro Tag (Upsert, zweiter Eintrag ersetzt nach Rückfrage im Sheet).
3. Karte zeigt „83,4 kg · Trend −0,6 kg in 7 Tagen“; Tap (3) → `/progress/weight` mit Chart (Rohwerte als Punkte,
   Trend als Linie, Zielgewicht als gestrichelte Linie) und Prognose „Ziel 78 kg voraussichtlich im März“.

**Edge Cases:** < 3 Einträge → kein Trend, „Noch 2 Messungen bis zur Trendlinie“. Sprung > 3 kg zum Vortag →
„Tippfehler? 8,34 statt 83,4?“ (nicht blockierend). Zielgewicht erreicht → Milo `goal_reached`, Vorschlag
„Auf Gewicht halten umstellen?“.

## J10 – Kalorienziel, Makromodus, Trainingstag-Profil ändern

- **Kalorienziel manuell:** Profil → „Ziele“ (1, `/settings/goals`) → Karte „Standard“ (2) → Kalorien 2.300 → 2.200
  → Makros passen sich im Modus `auto`/`percent` automatisch an; im Modus `grams` Hinweis auf Differenz → **„Speichern“** (3).
  „Zurück zur Berechnung“ setzt `calorie_source = calculated`.
- **Makromodus:** Segment „Automatisch · Prozent · Gramm“; Prozent-Summe muss 100 ergeben (Live-Anzeige „Summe 100 %“).
- **Trainingstag-Profil (6 Taps):** „Tagesprofil hinzufügen“ (1) → Vorlage „Trainingstag“ (2, +250 kcal über KH) →
  Wochentage Mo/Mi/Fr (3–5) → „Speichern“ (6). `/today` zeigt Chip „Trainingstag“; Tap auf den Chip erlaubt
  Umstellung nur für heute (`daily_nutrition.profile_overridden`).
- **Regel:** Änderungen wirken ab heute; vergangene Tage behalten ihr Ziel (Hinweis im Speichern-Toast
  „Gilt ab heute. Vergangene Tage bleiben unverändert.“).

## J11 – Wochenfortschritt prüfen (1–2 Taps)

Tab **Fortschritt** (1) → `/progress` Zeitraum „7 T“ vorausgewählt: Ø kcal vs. Ziel („Ø 2.180 von 2.300 kcal“),
Tage im Zielkorridor (5 von 7), Protein-Ziel erreicht (4 von 7), Gewichtstrend, Balken pro Tag. Zeitraum-Wechsel
30T/3M/6M/1J (2). Empty State (< 2 Tage Daten): „Nach ein paar Tagen siehst du hier deine Muster.“ + Mini-Vorschau
der vorhandenen Tage – keine Fake-Charts.

## J12 – Milo über den Tag

| Moment | Bedingung | Milo (Stimmung) | Aktion |
|---|---|---|---|
| Morgens | noch kein Eintrag, 05–10 Uhr | „Guten Morgen! Dein Frühstück von gestern ist einen Tap entfernt.“ (`neutral`) | „Wie gestern“ |
| Mittags | Frühstück da, Mittag leer, 12–14 Uhr | „Noch 1.780 kcal für heute – genug Raum für ein gutes Mittagessen.“ | „Mittagessen eintragen“ |
| Nachmittags | Protein < 50 % um 16 Uhr | „Protein ist heute noch ausbaufähig. Skyr oder Hähnchen passen gut.“ (`thinking`) | Suche vorbefüllt |
| Abends | 20 Uhr, im Korridor | „Stark! Du bist heute genau im Plan.“ (`happy`) | – |
| Abends | über Ziel | „Heute etwas mehr – kein Problem. Morgen ist ein neuer Tag.“ (`encouraging`) | – |
| Meilenstein | Serie 7/30/100, neues Achievement | „7 Tage in Folge. Das ist schon eine Gewohnheit.“ (`streak`) – ohne Emojis | „Erfolge ansehen“ |

Regeln: max. 1 Milo-Nachricht pro Screen, max. 3 proaktive Nachrichten pro Tag, „Ausblenden“ unterdrückt die
Nachricht für den Tag (`mascot_interactions.action = dismissed`), keine Wiederholung derselben Nachricht innerhalb 3 Tagen.
