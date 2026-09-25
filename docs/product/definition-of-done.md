# Definition of Done – Abnahmetests

> Owner: Product Architecture. Checkliste für das finale Review und Vorlage für E2E-Tests.
> Jeder Punkt gilt erst als erfüllt, wenn **alle** erwarteten Ergebnisse eintreten – auf 375 × 812 (Mobile) **und**
> 1280 × 800 (Desktop), in **Hell und Dunkel**, gegen eine frisch migrierte Datenbank mit Seed-Daten.
> Zahlen beziehen sich auf den Referenz-Nutzer aus [README](./README.md). Toleranz für kcal ± 1, für g ± 0,1.

## Globale Kriterien (gelten für jeden Punkt)

- [ ] Keine Konsolen-Fehler, keine React-Hydration-Warnungen.
- [ ] Jeder beteiligte Screen hat einen echten Empty-, Loading- und Error-Zustand (kein „Lorem“, kein „TODO“, keine Mock-Zahlen).
- [ ] Alle Texte deutsch, Zahlen im Format `de-DE` („1.620“, „83,4“).
- [ ] Jede Aktion ist per Tastatur erreichbar, Fokus ist sichtbar, Touch-Ziele ≥ 44 × 44 px.
- [ ] Nach jedem Schritt mit Speichern: harter Reload (⌘R) zeigt denselben Zustand (siehe DoD 20).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` grün; E2E-Suite grün.

## Checkliste

### 1. Konto erstellen
- **Schritte:** `/signup` → Name „Jonas“, neue E-Mail, Passwort „sicher123“ → „Konto erstellen“.
- **Erwartet:** Weiterleitung auf `/onboarding`. Abmelden → `/login`; erneute Anmeldung mit denselben Daten
  führt auf `/onboarding` (nicht abgeschlossen) bzw. `/today` (abgeschlossen). Doppelte E-Mail zeigt Inline-Fehler
  am Feld. Falsches Passwort beim Login: „E-Mail oder Passwort stimmt nicht.“ Nicht eingeloggt `/today` → `/login`.

### 2. Onboarding abschließen
- **Schritte:** Alle 8 Schritte mit Referenzdaten (männlich, 33 J., 180 cm, 84 kg, moderat aktiv, Abnehmen,
  78 kg, Tempo moderat). Nach Schritt 4 Browser neu laden.
- **Erwartet:** Reload landet in Schritt 5 mit allen bisherigen Eingaben. Nach „Plan starten“: `/today`,
  `user_profiles.onboarding_completed_at` gesetzt, genau ein Default-`goal_profile`, vier Standard-Mahlzeiten
  (Frühstück, Mittagessen, Abendessen, Snacks). Erneuter Aufruf von `/onboarding` leitet auf `/today`.

### 3. Kalorienziel erhalten oder setzen
- **Schritte:** a) Onboarding-Schritt 6 ansehen. b) `/settings/goals` → Kalorien manuell 2.200 → Speichern.
  c) „Zurück zur Berechnung“.
- **Erwartet:** a) Anzeige der Kette Grundumsatz 1.805 → Erhaltungsbedarf 2.798 → −500 → 2.300 kcal.
  b) `/today` zeigt Ziel 2.200, `calorie_source = manual`; gestrige Tagesansicht zeigt weiterhin ihr altes Ziel.
  c) Ziel wieder 2.300. Eingabe unterhalb der Sicherheitsgrenze zeigt einen Hinweis (nicht still überschrieben).

### 4. Makroziele erhalten oder setzen
- **Schritte:** a) Auto-Vorschlag prüfen. b) Modus „Prozent“ 30/45/25. c) Modus „Gramm“ 160/250/70.
  d) Tagesprofil „Trainingstag“ für Mo/Mi/Fr anlegen.
- **Erwartet:** a) 150 / 281 / 64 g. b) Summe muss 100 % sein, sonst Speichern deaktiviert mit Hinweis; Gramm
  werden aus 2.300 kcal berechnet (173 / 259 / 64 g). c) Anzeige der resultierenden kcal (2.270) und Differenz
  zum Ziel. d) An einem Montag zeigt `/today` den Chip „Trainingstag“ und dessen Ziele; Umstellen nur für heute möglich.

### 5. Lebensmittel suchen
- **Schritte:** `/log` → „haferflocken“, „Haferflocken“, „haferfloken“ (Tippfehler), „skyr“, „Käse“/„kase“.
- **Erwartet:** Treffer erscheinen ≤ 300 ms nach Tippstopp (lokale DB); Tippfehler und fehlende Umlaute finden
  dieselben Top-Treffer; nach einmaligem Loggen steht das Lebensmittel bei der nächsten Suche ganz oben.
  Suche nach Unsinn („xqzv“) zeigt Empty State mit „Eigenes Lebensmittel anlegen“.

### 6. Lebensmittel über skalierbare Datenquelle finden
- **Schritte:** a) Suche nach einem deutschen Markenprodukt, das nicht im Seed ist. b) Barcode eines bekannten
  Produkts aus Open Food Facts (z. B. 3017620422003) manuell eingeben. c) Dieselbe Suche wiederholen.
- **Erwartet:** a) Externe Treffer werden nachgeladen und sind loggbar. b) Produkt mit Nährwerten pro 100 g
  und Portion erscheint. c) Treffer kommen jetzt lokal (Zeile in `foods`, Cache-Eintrag in `external_lookup_cache`).
  Seed enthält ≥ 1.000 generische Lebensmittel mit deutschen Namen. Quellenattribution im Food-Detail sichtbar.

### 7. Eigene Lebensmittel anlegen
- **Schritte:** `/foods/new` → „Omas Müsli“, pro Portion 50 g: 190 kcal, 6 g P, 28 g KH, 5 g F → „Speichern & eintragen“.
- **Erwartet:** Gespeichert pro 100 g (380 kcal, 12 / 56 / 10 g); Portion „1 Portion (50 g)“ existiert; Food
  erscheint in `/foods`, im Tab „Meine“ und in der Suche – für einen zweiten Testnutzer **nicht**. Unbekannter
  Barcode → „Produkt anlegen“ öffnet `/foods/new?barcode=…` mit vorbefülltem Barcode; danach findet der Scan das Produkt.

### 8. Lebensmittel zu Mahlzeiten hinzufügen
- **Schritte:** Um 07:30 (Systemzeit) (+) → Haferflocken → „Hinzufügen“. Dann „+“ an „Abendessen“ auf `/today`
  → Skyr → „Hinzufügen“. Dann auf `/diary/[gestern]` (+) → Banane.
- **Erwartet:** Haferflocken landen in Frühstück (Uhrzeit-Vorauswahl), Skyr in Abendessen (Kontext), Banane
  am gestrigen Datum. Die UI reagiert sofort (optimistisch), Toast mit „Rückgängig“ entfernt den Eintrag wieder.

### 9. Portionen ändern
- **Schritte:** Eintrag „Haferflocken 1 × 100 g“ öffnen → Portion „1 EL (10 g)“, Menge 4 → Speichern. Dann Menge
  1,5 per Stepper. Dann Mahlzeit → Snacks.
- **Erwartet:** Eintrag zeigt „4 × 1 EL (40 g)“ mit auf 40 g skalierten Nährwerten, danach „1,5 × …“ (15 g);
  Tages- und Mahlzeitsummen aktualisieren sich sofort; Eintrag steht danach unter Snacks. Löschen per Wischen/Menü
  mit funktionierendem „Rückgängig“.

### 10. Kalorien automatisch berechnet
- **Schritte:** Haferflocken (372 kcal/100 g) 60 g + Milch 1,5 % (47 kcal/100 ml) 200 ml loggen.
- **Erwartet:** Einträge 223 kcal und 94 kcal; Mahlzeit 317 kcal; Ring „317 / 2.300“, „1.983 kcal übrig“.
  Werte identisch auf `/today`, `/diary/[date]` und im Food-Detail. Bearbeiten des Food-Stammdatensatzes danach
  ändert den bestehenden Eintrag **nicht** (Snapshot).

### 11. Protein, Kohlenhydrate, Fett automatisch berechnet
- **Schritte:** Wie 10, zusätzlich Food mit bekannten Makros loggen, dann ein Makro überschreiten (z. B. 100 g Nüsse).
- **Erwartet:** Makros pro Eintrag = Wert pro 100 × Menge / 100, Summen korrekt auf allen Ansichten; Makro-Balken
  zeigt Über-Ziel-Zustand mit „x g über Ziel“ im `over`-Stil; Protein über Ziel wird neutral („Ziel übertroffen“) dargestellt.

### 12. Rezepte anlegen
- **Schritte:** `/recipes/new` → „Linsen-Dal“, 4 Portionen, 5 Zutaten, Endgewicht 1.450 g → Speichern →
  „Portion eintragen“.
- **Erwartet:** Nährwerte pro Portion = Summe / 4, pro 100 g = Summe / 14,5; Portion „1 Portion (363 g)“; Rezept
  in Suche und Tab „Meine“ findbar, favorisierbar; Rezept nachträglich ändern lässt alte Einträge unverändert.

### 13. Gewicht loggen
- **Schritte:** `/today` → Gewicht „83,4“ → Speichern. Gleicher Tag erneut „83,2“. Einträge für 3 Vortage in `/progress/weight`.
- **Erwartet:** Ein Eintrag pro Tag (zweiter ersetzt nach Rückfrage); Karte zeigt aktuellen Wert und ab
  3 Einträgen einen Trend; unplausibler Sprung (8,34) erzeugt Hinweis; Eintrag löschbar.

### 14. Fortschritt sehen
- **Schritte:** Mit Seed/Test-Daten über 14 Tage: `/progress` Zeitraum 7T, 30T; `/progress/weight`.
- **Erwartet:** Ø kcal vs. Ziel, Tage im Zielkorridor, Makro-Treffer, Tagesbalken; Werte stimmen mit der Summe
  der Tagebuchtage überein (Stichprobe 2 Tage). Gewichtschart mit Rohwerten, Trendlinie und Ziellinie. Neuer
  Nutzer ohne Daten sieht Empty State statt leerer Achsen.

### 15. Favoriten nutzen
- **Schritte:** Food-Detail → Stern. `/log` Tab „Favoriten“ → „+“. `/foods` Segment „Favoriten“ → Stern entfernen.
- **Erwartet:** Favorit erscheint sofort im Tab und in der Suche mit Stern-Markierung; Quick-Add loggt mit
  letzter/Standard-Portion; Entfernen wirkt überall; Zustand überlebt Reload.

### 16. Häufig genutzte Lebensmittel wiederfinden
- **Schritte:** Haferflocken 3× an drei Tagen mit 60 g loggen, Banane 1×. `/log` Tabs „Zuletzt“ und „Häufig“. Am
  nächsten Morgen „Wie gestern“ nutzen. Mahlzeit von gestern nach heute kopieren.
- **Erwartet:** „Häufig“: Haferflocken vor Banane; „Zuletzt“ nach Zeit sortiert; Quick-Add nutzt 60 g
  (letzte Portion); „Wie gestern“ und „Kopieren“ erzeugen neue Einträge mit korrekten Summen in ≤ 2 Taps.

### 17. Mobile UI nutzen
- **Schritte:** Alle Journeys J1–J11 auf 375 × 812 und 390 × 844 mit Touch-Emulation, einmal im Querformat.
- **Erwartet:** Keine horizontale Scrollbar, Bottom Bar mit 5 Zielen und korrektem Aktiv-Zustand, Safe-Area
  unten eingehalten, numerische Tastatur bei Zahlenfeldern (`inputmode`), Sticky-„Hinzufügen“ nicht von der
  Tastatur verdeckt, Fokus-Flows ohne Bottom Bar. Lighthouse Mobile: Accessibility ≥ 95, Performance ≥ 85 auf `/today`.

### 18. Hell- und Dunkelmodus
- **Schritte:** `/settings/profile` Theme „Hell“, „Dunkel“, „System“ (OS-Einstellung umschalten). Alle Hauptscreens durchgehen.
- **Erwartet:** Kein Aufblitzen des falschen Themes beim Laden (kein FOUC); Kontrast Text ≥ 4,5:1 in beiden
  Modi; Charts, Ring, Makrofarben und Milo in beiden Modi gut erkennbar; Auswahl ist nach Reload und auf anderem
  Gerät (gleiches Konto) erhalten.

### 19. Mit dem Maskottchen-System interagieren
- **Schritte:** Neuer Nutzer ohne Einträge morgens auf `/today`; erster Eintrag; Protein < 50 % um 16 Uhr;
  Milo-Nachricht ausblenden; 3-Tage-Serie erreichen; Onboarding durchlaufen.
- **Erwartet:** Milo erscheint im Onboarding, in Empty States und als Insight mit jeweils passender Stimmung;
  jede proaktive Nachricht hat eine sinnvolle Aktion oder Information; „Ausblenden“ unterdrückt sie für den Tag
  (auch nach Reload); max. 1 Nachricht pro Screen; Serien-Meilenstein löst `streak`/`celebrating` aus und ein
  Achievement wird in `/achievements` freigeschaltet. Mit `prefers-reduced-motion` keine Milo-Animation.

### 20. Alle Daten bleiben nach Reload erhalten
- **Schritte:** Nach DoD 1–19: Browser komplett schließen, Dev-Server neu starten, erneut anmelden.
- **Erwartet:** Profil, Ziele, Tagesprofile, Einträge (inkl. vergangener Tage), eigene Foods, Rezepte, Favoriten,
  Gewicht, Wasser, Aktivität, Achievements, ausgeblendete Milo-Nachrichten und Theme sind unverändert. Kein
  relevanter Zustand liegt nur in `localStorage`.

## Abnahme-Protokoll

Final Review dokumentiert pro Punkt in `docs/review/**`: Status (✅ / ⚠️ Gap / ❌), getestete Viewports + Themes,
Abweichungen mit Screenshot-Pfad und verantwortlichem Modul laut [mvp-scope.md](./mvp-scope.md).
