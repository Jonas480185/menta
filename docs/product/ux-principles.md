# UX-Prinzipien

> Owner: Product Architecture. Verbindlich für alle UI-Bereiche.
> Visuelle Tokens und Komponenten: `docs/design/**`. Ton und Marke: `docs/brand/**`, Milo: `docs/brand/mascot.md`.
> Jede Regel ist prüfbar formuliert. Bei Konflikt gilt die Prioritätenliste im [README](./README.md).

## 1. Geschwindigkeit

| Regel | Konkret |
|---|---|
| **Optimistische UI** | Hinzufügen, Löschen, Menge ändern, Favorit, Wasser, Gewicht: UI aktualisiert sofort (≤ 100 ms), Server bestätigt im Hintergrund. Bei Fehler: Zustand zurückrollen + Toast „Konnte nicht gespeichert werden. **Erneut versuchen**“. |
| **Rückgängig statt Bestätigen** | Keine „Wirklich löschen?“-Dialoge für Einträge. Toast mit „Rückgängig“ für 5 s. Bestätigungsdialoge nur für Konto löschen und Rezept/Food löschen, das in Rezepten verwendet wird. |
| **Letzte Portion merken** | Quick-Add und Food-Detail verwenden `food_usage.last_serving_id` + `last_quantity`; sonst die Portion mit `is_default`, sonst 100 g/ml. |
| **Mahlzeit vorauswählen** | Reihenfolge: 1. `meal`-Parameter aus URL. 2. `food_usage.last_meal_id`, wenn dieses Food ≥ 3× in derselben Mahlzeit geloggt wurde. 3. Uhrzeit: aktive Mahlzeit, deren `default_time` am nächsten an „jetzt“ liegt, max. ±2 h. 4. Sonst „Snacks“ (bzw. letzte Mahlzeit in Sortierung). Standardzeiten: Frühstück 07:30, Mittagessen 12:30, Abendessen 18:30, Snacks ohne Zeit. |
| **Datum bleibt Kontext** | Wer aus einem vergangenen Tag loggt, loggt in diesen Tag. Der Kontext-Chip „Frühstück · Do., 24. Sept.“ macht das sichtbar. |
| **Mehrfach-Loggen** | Nach „Hinzufügen“ bleibt `/log` offen (Suche geleert), Sammel-Leiste zeigt Anzahl + kcal; „Fertig“ kehrt zurück. |
| **Wahrgenommene Performance** | Server Components rendern Daten sofort; Skeletons erst nach 150 ms; kein Layout-Sprung (CLS < 0,1); Suche debounced 150 ms, Ergebnisse ≤ 300 ms lokal. |
| **Tastatur passend** | `inputmode="decimal"` für Mengen/Gewicht, `numeric` für Barcodes; Enter im Suchfeld öffnet ersten Treffer. |

## 2. Klarheit

1. **Eine Hauptzahl pro Karte.** Die Kalorienkarte zeigt „680 kcal übrig“ groß; „1.620 gegessen · 2.300 Ziel“ ist klein.
   Die Gewichtskarte zeigt „83,4 kg“ groß; der Trend ist klein.
2. **Die Antwort, nicht die Rechnung.** „noch 54 g Protein“ statt „96 / 150 g“ allein. Die Rechnung darf daneben stehen.
3. **Einheiten immer dabei**, abgesetzt und kleiner: „680 kcal“, „83,4 kg“, „1.250 ml“. Zahlen mit `Intl.NumberFormat('de-DE')`,
   kcal ganzzahlig, Gramm ganzzahlig ab 10 g und mit einer Nachkommastelle darunter, Gewicht mit einer Nachkommastelle.
4. **Farbe trägt nie allein Bedeutung.** Über-Ziel-Zustände haben immer Text („2 g über Ziel“); Makros haben Label + Farbe.
5. **Konsistente Makro-Reihenfolge und -Farben** überall: Protein → Kohlenhydrate → Fett (`text-protein`, `text-carbs`, `text-fat`).
6. **Progressive Disclosure.** Mikronährstoffe, Rechenwege und Quellen stehen hinter „Details“ bzw. „Was heißt das?“.
7. **Keine Tabellenwüsten.** Listen mit max. 2 Textzeilen pro Eintrag; Detailwerte erst im Detail.
8. **Über-Ziel ist ein Zustand, kein Alarm.** Token `over` statt `destructive`; kein Warn-Icon, kein Rot-Blinken.
   Protein über Ziel gilt als neutral/positiv.

## 3. Ton – freundlich, nie Schuld

Grundhaltung: Milo und die App sind ein ruhiger, kompetenter Begleiter. Wir beschreiben, wir bewerten nicht.
Essen ist nie „gut“ oder „schlecht“, der Nutzer auch nicht. Anrede: **du**. Kurze Sätze. Keine Ausrufezeichen-Ketten, keine Emojis in UI-Texten.

| Verboten | Stattdessen |
|---|---|
| „Du warst heute schlecht.“ | „Heute war etwas mehr – kein Problem. Morgen ist ein neuer Tag.“ |
| „Du hast dein Ziel verfehlt.“ | „310 kcal über Ziel. Über die Woche gleicht sich das oft aus.“ |
| „Zu viel gegessen!“ / „Achtung: Limit überschritten!“ | „Über deinem Tagesziel“ |
| „Du hast versagt / aufgegeben.“ | „Schön, dass du wieder da bist. Weiter geht’s.“ |
| „Deine Serie ist verloren!“ | „Neue Serie, neuer Start. Deine Bestmarke: 12 Tage.“ |
| „Sündigen“, „Cheat Day“, „Schummeln“, „böse Lebensmittel“ | Neutral benennen: „Pizza“, „freier Tag“ |
| „Das musst du wieder abtrainieren.“ / „Verbrenne X kcal, um das auszugleichen.“ | Kein Zusammenhang zwischen Essen und Sport als Strafe – nie formulieren. |
| „Du musst mehr Protein essen.“ | „Protein ist heute noch ausbaufähig. Skyr oder Linsen passen gut.“ |
| „Nur noch 200 kcal!“ (Knappheit) | „Noch 200 kcal übrig.“ |
| „Keine Einträge. Du hast nichts getrackt.“ | „Für diesen Tag ist noch nichts eingetragen.“ |
| „Fehler 500“ / „Ungültige Eingabe“ | „Das hat nicht geklappt. Deine Daten sind sicher – versuch es gleich noch mal.“ / „Bitte eine Zahl zwischen 35 und 300 eingeben.“ |

Zusatzregeln: Keine Körperbewertungen („zu dick“, „Problemzonen“). BMI wird nicht prominent gezeigt. Gewichtszunahme
bei Ziel „Abnehmen“ wird sachlich als Trend beschrieben („Trend +0,3 kg in 7 Tagen – Tagesschwankungen sind normal“).

## 4. Gamification – dezent

- **Ziel ist Gewohnheit, nicht Spielsucht.** Keine Punkte-Währung, keine Level-Ups, keine Lootboxen, keine Konfetti-Explosionen, keine Leaderboards.
- **Serie** = Tage in Folge mit ≥ 1 Eintrag. Ein Tag ohne Eintrag beendet die Serie; die Bestmarke bleibt sichtbar.
- **Achievements** sind sachliche Meilensteine („7 Tage in Folge“, „Erstes Rezept“, „30 Tage Protein-Ziel erreicht“, „Erstes Kilo Trend“)
  mit schlichtem Icon – keine Pokal-Grafiken im Casino-Stil. Gesperrte Achievements zeigen den Fortschritt („4 / 7 Tage“).
- **Feiern mit Maß:** Meilensteine erzeugen einen einmaligen Milo-Moment (`celebrating`/`streak`, ≤ 1,2 s Animation) und einen Toast.
  Maximal eine Feier pro Session-Screen; nie ein blockierendes Modal.
- **Keine negativen Streak-Mechaniken:** keine Warnung „Deine Serie endet heute!“ als Druckmittel; höchstens abends ein neutraler Hinweis
  „Heute noch nichts eingetragen – möchtest du kurz nachtragen?“, einmal, ausblendbar.

## 5. Milo – Funktion vor Dekoration

1. Milo erscheint nur, wenn er **informiert, anleitet oder feiert** – nie als reine Verzierung von Header oder Rand.
2. **Einsatzorte:** Onboarding (Anleitung), Empty States (nächster Schritt mit CTA), Daily Insight auf `/today`, Meilensteine, Fehlerseiten.
3. **Pro Screen max. eine** Milo-Instanz mit Nachricht; **max. 3 proaktive Nachrichten pro Tag**; dieselbe Nachricht nicht innerhalb von 3 Tagen.
4. Jede Nachricht hat **höchstens eine Aktion** und ist **ausblendbar** („Ausblenden“ → `mascot_interactions`).
5. **Stimmung passt zum Inhalt** (`MiloMood`): `neutral` Normalfall · `happy` im Plan · `thinking` Hinweis/Fehler · `encouraging` nach
   Über-Ziel oder Pause · `celebrating`/`streak`/`goal_reached` Meilensteine · `sleepy` leere/vergangene Tage.
6. Größen: 96–128 px in Onboarding/Empty States, 48–64 px in Insight-Karten, ≤ 32 px als Icon.
7. Milo spricht in der Ich-Form nur im Onboarding; sonst sind Texte direkt an den Nutzer gerichtet („Noch 54 g Protein …“).

## 6. Barrierefreiheit (WCAG 2.2 AA)

- Kontrast Text ≥ 4,5:1, große Zahlen/Icons ≥ 3:1 – in Hell **und** Dunkel.
- Touch-Ziele ≥ 44 × 44 px, Abstand ≥ 8 px; Quick-Add-„+“ ebenfalls 44 px (visuell kleiner, Trefferfläche groß).
- Vollständige Tastaturbedienung, sichtbarer Fokusring, logische Tab-Reihenfolge; Sheets/Dialoge fangen den Fokus und geben ihn zurück.
- Kalorien-Ring: `role="img"` + `aria-label="1.620 von 2.300 Kilokalorien gegessen, 680 übrig"`; Makrobalken als `progressbar` mit `aria-valuetext`.
- Toasts in `aria-live="polite"`; Fehler an Feldern mit `aria-describedby`, nicht nur oben im Formular.
- Charts haben eine Textalternative (Zusammenfassung „Ø 2.180 kcal, 5 von 7 Tagen im Ziel“) und eine Tabellen-Ansicht.
- Wischgesten haben immer eine sichtbare Alternative (Menü „⋯“).
- Zoom bis 200 % ohne Informationsverlust; kein `user-scalable=no`.
- Icons ohne Text haben `aria-label`; keine Emojis als Icons (lucide-react).

## 7. Motion

- **Motion erklärt, sie dekoriert nicht:** Ring füllt sich zum neuen Wert, neuer Eintrag gleitet in die Liste, gelöschter Eintrag klappt zusammen.
- Dauer 150–250 ms für Zustandswechsel, 300–500 ms für Ring/Balken, ≤ 1,2 s für Milo-Feiern. Ease-out beim Eintreten, ease-in beim Verlassen,
  Verlassen schneller als Eintreten.
- Max. 1–2 animierte Elemente gleichzeitig pro View. Nur `transform`/`opacity` animieren.
- Druck-Feedback auf Buttons (Scale 0,97, sofort). Haptik (`navigator.vibrate`) nur bei Barcode-Erkennung.
- `prefers-reduced-motion: reduce` → keine Bewegung, nur Überblendungen ≤ 150 ms; Milo statisch.
- Nie Animation, die das Speichern verzögert oder eine Eingabe blockiert.

## 8. Formulare & Eingaben

- Labels immer sichtbar (kein Placeholder-only). Pflichtfelder minimal halten; Optionales hinter „Weitere Angaben“.
- Validierung beim Verlassen des Feldes, Fehlermeldung direkt am Feld, konkret mit gültigem Bereich.
- Dezimaleingabe akzeptiert Komma **und** Punkt („83,4“ = „83.4“).
- Sinnvolle Vorbelegung (letzter Wert, berechneter Vorschlag); nie leere Pflicht-Zahlenfelder, wenn ein guter Default existiert.
- Plausibilitäts-Warnungen sind nicht blockierend (kcal vs. Makros, Gewichtssprung); harte Fehler nur bei Unmöglichem (negative Werte, Makros > 100 g/100 g).

## 9. Zustände – jede Ansicht hat vier

| Zustand | Regel |
|---|---|
| **Daten** | Echte Daten, nie Mock-Werte. |
| **Leer** | Erklärt in einem Satz, warum leer, und bietet genau eine Hauptaktion (oft mit Milo). Keine leeren Charts mit Achsen. |
| **Laden** | Skeleton in der Geometrie des Inhalts, erscheint nach 150 ms. Kein Vollbild-Spinner. |
| **Fehler** | Freundlich, konkret, mit „Erneut versuchen“. Teilfehler bleiben lokal auf der Karte, der Rest der Seite funktioniert. |

## 10. Checkliste für jeden UI-PR

- [ ] 375 px zuerst geprüft, dann 768 und 1280 px; keine horizontale Scrollbar.
- [ ] Hell und Dunkel geprüft; nur semantische Tokens.
- [ ] Empty, Loading, Error vorhanden und getextet.
- [ ] Texte gegen Tabelle §3 geprüft (keine Schuld, keine Emojis, Du-Form).
- [ ] Tap-Zahl der betroffenen Journey ≤ Zielwert aus [user-journeys.md](./user-journeys.md).
- [ ] Tastatur, Fokus, Screenreader-Labels, `prefers-reduced-motion`.
