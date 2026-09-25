# Informationsarchitektur

> Owner: Product Architecture. Routen sind verbindlich aus `docs/ARCHITECTURE.md §8`. Dieses Dokument legt fest, **was** auf
> jedem Screen steht und **in welcher Rangfolge**. Das visuelle „Wie“ kommt aus `docs/design/**`.
> Hierarchie: **P** = primär (eine Sache, sofort sichtbar) · **S** = sekundär · **T** = tertiär.

## 1. Navigationsmodell

| Breakpoint | Muster |
|---|---|
| < 768 px | **Bottom Bar** (fix, Safe-Area beachten), 5 Ziele, Labels immer sichtbar |
| 768–1023 px | **Icon-Rail** links (Icons + Tooltips + Labels unter Icons) |
| ≥ 1024 px | **Sidebar** mit Labels, Primäraktion „+ Eintragen“ als Button oben, darunter Sekundärgruppe |

**Bottom Bar:** Heute · Tagebuch · **(+) Loggen** · Fortschritt · Profil

| Tab | Ziel-Route | Aktiv bei Route-Präfix |
|---|---|---|
| Heute | `/today` | `/today` |
| Tagebuch | `/diary` → `/diary/[heute]` | `/diary` |
| (+) Loggen | `/log?date=&meal=` | `/log`, `/scan` |
| Fortschritt | `/progress` | `/progress`, `/achievements`, `/activity` |
| Profil | `/settings` | `/settings`, `/foods`, `/recipes` |

Regeln:
- **(+)** ist visuell hervorgehoben (größer, Primärfarbe) und öffnet `/log` **direkt** – kein Zwischenmenü, weil
  Food Logging > 90 % der Log-Aktionen ausmacht. Wasser, Gewicht und Aktivität werden über ihre Karten auf `/today`
  geloggt (1 Tap).
- Kontext wird weitergereicht: (+) auf `/diary/2026-09-24` → `/log?date=2026-09-24`; „+“ an einer Mahlzeit →
  `&meal=<id>`. Ohne `meal` wählt `/log` die Mahlzeit nach Uhrzeit (siehe ux-principles §1).
- **Fokus-Flows ohne Bottom Bar** (Header mit „Schließen“/„Zurück“): `/log`, `/log/food/[id]`, `/scan`,
  `/onboarding`, `/foods/new`, `/foods/[id]/edit`, `/recipes/new`, `/recipes/[id]/edit`. „Schließen“ auf `/log`
  kehrt zur Ursprungsseite zurück (Browser-History, Fallback `/today`).
- **Desktop-Sidebar Sekundärgruppe:** Meine Lebensmittel (`/foods`) · Rezepte (`/recipes`) · Aktivität & Wasser
  (`/activity`) · Erfolge (`/achievements`) · Einstellungen (`/settings`).
- Zurück-Verhalten nutzt echte History (`router.back()` nur, wenn es eine Vorgängerseite in der App gibt).
- Jede Ansicht ist deep-linkbar; Datum und Mahlzeit stehen in URL-Parametern, nie nur im Client-State.

## 2. Screen-Inventar

| Route | Screen | Darstellung Mobile | Modul |
|---|---|---|---|
| `/` | Redirect | – | Auth |
| `/login`, `/signup` | Anmelden / Registrieren | Vollbild ohne Nav | Auth |
| `/onboarding` | Onboarding (8 Schritte) | Vollbild ohne Nav | Onboarding |
| `/today` | Heute-Dashboard | Tab | Today Dashboard |
| `/diary/[date]` | Tagebuch | Tab | Diary |
| `/log` | Suchen & Eintragen | Fokus-Flow | 17 (Suche: 14) |
| `/log/food/[foodId]` | Portion wählen / Eintrag bearbeiten | Fokus-Flow | Meal Logging |
| `/scan` | Barcode-Scanner | Fokus-Flow, Vollbild-Kamera | Barcode |
| `/foods` | Meine Lebensmittel & Favoriten | Unterseite (Profil) | Custom Foods |
| `/foods/new`, `/foods/[id]/edit` | Lebensmittel anlegen / bearbeiten | Fokus-Flow | Custom Foods |
| `/recipes`, `/recipes/[id]` | Rezeptliste / Rezeptdetail | Unterseite (Profil) | Recipes |
| `/recipes/new`, `/recipes/[id]/edit` | Rezept-Editor | Fokus-Flow | Recipes |
| `/progress` | Fortschritt | Tab | Analytics |
| `/progress/weight` | Gewicht | Unterseite | Weight Tracking |
| `/activity` | Aktivität & Wasser | Unterseite | Activity & Water |
| `/achievements` | Erfolge | Unterseite | Gamification |
| `/settings` | Profil-Hub | Tab | Settings |
| `/settings/goals` · `/meals` · `/profile` | Ziele · Mahlzeiten · Körperdaten & App | Unterseiten | Settings |
| `/settings/account` | Konto (E-Mail, Passwort, Abmelden, Löschen) | Unterseite | Auth |
| `not-found` | 404 | Shell | App Shell |

**Globale Zustände (App Shell):** `loading.tsx` = Skeleton im Layout der Zielseite (keine Vollbild-Spinner);
`error.tsx` = Milo `thinking`, „Da ist etwas schiefgelaufen. Deine Daten sind sicher.“ + „Erneut versuchen“;
`not-found` = „Diese Seite gibt es nicht.“ + „Zu Heute“.

## 3. `/today` – „Wie stehe ich heute da?“

Die Seite beantwortet **eine** Frage. Alles andere ist untergeordnet. Reihenfolge Mobile (oben → unten):

| # | Element | Rang | Inhalt (Referenz-Nutzer 16:30) |
|---|---|---|---|
| 1 | Header | T | „Heute“ · „Freitag, 25. September“ · Chip Tagesprofil („Standard“/„Trainingstag“, Tap = nur heute umstellen) · Chip Serie „12“ (Flamme-Icon, → `/achievements`) |
| 2 | **Kalorien-Ring** | **P** | Mitte groß: **„680“** + „kcal übrig“. Darunter: „1.620 gegessen · 2.300 Ziel“. Mit Aktivitätsbonus: „+ 320 Aktivität“ als dritte Zeile |
| 3 | Makro-Balken | S | Protein „96 / 150 g · noch 54 g“ · Kohlenhydrate „160 / 281 g · noch 121 g“ · Fett „66 / 64 g · **2 g über Ziel**“ |
| 4 | Milo-Insight | S | Eine Aussage + max. eine Aktion, z. B. „Protein ist heute noch ausbaufähig.“ → „Ideen ansehen“ |
| 5 | Mahlzeiten | S | Je Mahlzeit: Icon, Name, „540 kcal · 3 Einträge“, „+“ (→ `/log?meal=`). Leere Mahlzeit: „Wie gestern (520 kcal)“ oder „Eintragen“ |
| 6 | Kachel-Raster 2×2 | T | Wasser „1.250 / 2.500 ml“ + „+250 ml“ · Gewicht „83,4 kg · −0,6 kg / 7 T“ + „Eintragen“ · Aktivität „6.420 Schritte · 320 kcal“ · Serie „12 Tage“ |

Desktop (≥ 1024): zwei Spalten – links Ring, Makros, Mahlzeiten; rechts Milo, Wasser, Gewicht, Aktivität, Serie.

**Zustände Kalorien-Ring**
| Zustand | Bedingung | Darstellung |
|---|---|---|
| Normal | Konsum < 90 % | Ring in `kcal`-Farbe, „680 kcal übrig“ |
| Nahe Ziel | 90–100 % | gleiche Farbe, Text „Fast geschafft – noch 120 kcal“ |
| Erreicht | 100–105 % | Ring geschlossen, „Ziel erreicht“ |
| Über Ziel | > 105 % | Ring voll + zweite Umrundung im `over`-Token, Mitte „310“ + „kcal über Ziel“. Kein Warn-Icon, kein Alarmton |
| Leer | 0 Einträge | Ring leer, „2.300 kcal verfügbar“ |

**Makro über Ziel:** Balken voll, Überschuss als abgesetztes Segment am Ende im `over`-Token, Text „2 g über Ziel“.
Für Protein gilt Überschreiten als neutral („Ziel übertroffen“), nicht als Über-Ziel-Zustand.

**Primäraktionen:** (+) in der Bottom Bar · „+“ je Mahlzeit · „+250 ml“ Wasser (1 Tap, optimistisch) ·
„Gewicht eintragen“ (Sheet).
**Empty State (neuer Tag / neuer Nutzer):** Ring leer, Milo-Karte ersetzt Makros nicht, sondern steht über den
Mahlzeiten: „Neuer Tag, neue Runde. Starte mit dem Frühstück?“ + „Wie gestern“ (falls vorhanden).
**Loading:** Skeleton mit exakt gleicher Geometrie (Ring-Kreis, 3 Balken, 4 Zeilen, 4 Kacheln) – kein Layout-Sprung.
**Error:** Teilfehler pro Karte (z. B. Gewicht lädt nicht → Karte zeigt „Gerade nicht verfügbar“), Seite bleibt nutzbar.

## 4. `/log` – Suchen & Eintragen

Ziel: vom Öffnen bis „gespeichert“ in 2 Taps (bekannt) bzw. 4 Taps (neu). Reihenfolge:

| # | Element | Rang | Inhalt |
|---|---|---|---|
| 1 | Header | T | „Schließen“ · Titel „Eintragen“ · Kontext-Chip „Frühstück · Heute ▾“ (Tap → Sheet: Mahlzeit + Datum ändern) |
| 2 | **Suchfeld** | **P** | Sticky. Placeholder „Lebensmittel, Marke oder Rezept“. Rechts im Feld: Barcode-Icon-Button → `/scan` (Label „Barcode scannen“) |
| 3 | „Wie gestern“-Karte | S | Nur wenn Mahlzeit heute leer und gestern (oder letzte 7 Tage) gefüllt: „Frühstück wie gestern · 3 Lebensmittel · 520 kcal“ + „Eintragen“ |
| 4 | Tabs | S | **Zuletzt** · Häufig · Favoriten · Meine (eigene Lebensmittel + Rezepte) |
| 5 | Listen-Zeilen | S | Name, Marke/Quelle klein, „Portion · kcal“ (letzte Portion falls bekannt), rechts „+“ (Quick-Add mit letzter/Standard-Portion) |
| 6 | Sammel-Leiste | T | Erscheint nach erstem Hinzufügen, unten fix: „3 hinzugefügt · 690 kcal“ + „Fertig“ |

- Ab 2 Zeichen ersetzen **Suchergebnisse** die Tabs. Sektionen: „Deine Lebensmittel“ (Recents/Favoriten/eigene
  Treffer) → „Lebensmittel-Datenbank“ → „Weitere Treffer online“ (nachgeladen, mit Skeleton-Zeilen).
- Tap auf Zeile → `/log/food/[id]?date=&meal=`. Tap auf „+“ → sofort gespeichert, Zeile zeigt Häkchen 1,5 s, Toast mit Rückgängig.
- **Empty States:** Zuletzt leer → „Hier landen deine Lieblinge …“ · Favoriten leer → „Tippe im Lebensmittel auf
  den Stern, um es hier zu merken.“ · Meine leer → „Eigenes Lebensmittel anlegen“ / „Rezept erstellen“ ·
  Suche ohne Treffer → Journey J3.
- **Loading:** Suchergebnisse als 5 Skeleton-Zeilen nach 150 ms (vorher nichts, um Flackern zu vermeiden).
- **Error:** Suche-API-Fehler → „Suche gerade nicht möglich. Deine zuletzt genutzten Lebensmittel funktionieren weiter.“

## 5. `/log/food/[foodId]` – Portion & Menge

Reihenfolge folgt dem Denkweg **Lebensmittel → Portion → Menge → Mahlzeit → Speichern**:

| # | Element | Rang | Inhalt |
|---|---|---|---|
| 1 | Kopf | S | Name, Marke, Stern (Favorit, 1 Tap), Qualitäts-Badge falls `partial/suspect` |
| 2 | **Ergebnis** | **P** | Große Zahl „189 kcal“ für die gewählte Menge; darunter P/KH/F in g mit Farbpunkten und „13 % deines Proteinziels“ |
| 3 | Portion | S | Chips: zuletzt genutzte Portion zuerst markiert, dann Food-Portionen, immer „g“ bzw. „ml“ |
| 4 | Menge | S | Stepper −/+ (Schritt 0,5 bei Portionen, 10 bei g/ml), Zahlenfeld mit `inputmode="decimal"`, Chips ½ · 1 · 1½ · 2 |
| 5 | Mahlzeit | S | Segment mit allen aktiven Mahlzeiten, vorausgewählt aus URL oder Uhrzeit |
| 6 | Speichern | P-Aktion | Sticky unten: „Hinzufügen · 189 kcal“. Edit-Modus (`?entry=`): „Speichern“ + sekundär „Löschen“ |
| 7 | Details | T | Aufklappbar: Nährwerte pro 100 g/ml und pro Menge, Mikronährstoffe, Quelle mit Attribution („Daten: Open Food Facts, ODbL“) |

Live-Berechnung bei jeder Änderung (< 16 ms, rein clientseitig aus `NutrientProfile`); Server berechnet beim
Speichern neu und ist maßgeblich. **Loading:** Skeleton für Kopf + Ergebnis. **Error:** Food nicht gefunden →
„Dieses Lebensmittel gibt es nicht mehr.“ + zurück zur Suche; beim Bearbeiten eines Eintrags mit gelöschtem Food
wird der Snapshot bearbeitet (nur Menge skalierbar).

## 6. `/diary/[date]` – Tagebuch

| # | Element | Rang | Inhalt |
|---|---|---|---|
| 1 | Datums-Navigator | S | „‹ Donnerstag, 24. Sept. ›“, Wischen links/rechts wechselt den Tag, Tap auf Datum → Kalender (Tage mit Einträgen markiert), „Heute“-Button wenn nicht heute |
| 2 | **Tagesbilanz** | **P** | Kompakt: „1.980 / 2.300 kcal · 320 übrig“ + drei Mini-Makrobalken + Tagesprofil-Chip |
| 3 | Mahlzeit-Sektionen | S | Kopf: Name, kcal, „P 32 · KH 60 · F 18“, „⋯“ (Kopieren nach …, Alle löschen), „+ Hinzufügen“ |
| 4 | Einträge | S | Name, „1,5 × Scheibe (45 g)“, kcal rechtsbündig; Tap = bearbeiten, Wischen = löschen |
| 5 | Tagesfuß | T | Wasser, Aktivität, Gewicht des Tages als eine Zeile (→ `/activity?date=`, `/progress/weight`) |

- Vergangene Tage sind voll editierbar; Ziele zeigen den eingefrorenen `daily_nutrition`-Snapshot.
- Zukünftige Tage erlaubt (Planung), Kennzeichnung „Geplant“ im Navigator.
- **Empty State (leerer Tag):** Milo `sleepy` klein, „Für diesen Tag ist noch nichts eingetragen.“ +
  „Gestern übernehmen (1.980 kcal)“ (nur wenn Vortag Einträge hat) + „Eintragen“.
- **Loading:** Skeleton pro Mahlzeit-Sektion. **Error:** ungültiges Datum in URL → Redirect auf heute.

## 7. `/onboarding` – 8 Schritte

Fortschrittsbalken oben („Schritt 3 von 8“), „Zurück“ immer möglich, jeder Schritt speichert serverseitig.

| # | Schritt | Felder / Inhalt | Validierung | Milo |
|---|---|---|---|---|
| 1 | Willkommen | Kurzversprechen, „Los geht’s“ | – | `happy`, groß |
| 2 | Ziel | Abnehmen · Halten · Zunehmen (`goal_type`) | Pflicht | `neutral` |
| 3 | Körperdaten | Geschlecht, Geburtsdatum, Größe (cm), Gewicht (kg) | Bereiche siehe J1 | – |
| 4 | Aktivität | 5 Stufen mit Alltagsbeispielen (`activity_level`) | Pflicht | – |
| 5 | Gewichtsziel | Zielgewicht, Tempo (`goal_pace`), Prognosedatum; entfällt bei „Halten“ | Richtung passt zum Ziel | `encouraging` |
| 6 | Kalorien | Transparente Kette: Grundumsatz → × Aktivität = Erhaltungsbedarf → ± Defizit/Überschuss = **Tagesziel**. Jede Zeile mit „Was heißt das?“ | Sicherheitsgrenzen | `thinking` |
| 7 | Makros | Vorschlag „Ausgewogen“ + Vorlagen; Balken und g-Werte; kcal-Summe live | Summe = Ziel ± 1 % | – |
| 8 | Überblick | Alle Werte editierbar, Wasserziel (2.500 ml), Schrittziel (8.000) | – | `celebrating` |

Abschluss setzt `onboarding_completed_at`, legt das Default-`goal_profile` an und leitet auf `/today`.
**Error:** Speichern schlägt fehl → Inline-Banner im Schritt, Eingaben bleiben erhalten, „Erneut versuchen“.

## 8. Weitere Screens (kompakt)

| Route | Zweck | P | S / T | Primäraktion | Empty / Error |
|---|---|---|---|---|---|
| `/login` | Anmelden | E-Mail + Passwort | „Konto erstellen“-Link | „Anmelden“ | Falsche Daten: „E-Mail oder Passwort stimmt nicht.“ |
| `/signup` | Registrieren | Name, E-Mail, Passwort | Datenschutz-Hinweis | „Konto erstellen“ | siehe J1 |
| `/scan` | Barcode | Kamerabild mit Rahmen | Taschenlampe, „Code eingeben“ | automatisch | siehe J4 |
| `/foods` | Eigene & Favoriten | Segment „Eigene · Favoriten“, Liste | Suche in Liste | „Neu“ | Milo-Empty-State (J5) |
| `/foods/new` · `edit` | Food-Formular | Name + Nährwerte | Portionen, weitere Nährwerte | „Speichern (& eintragen)“ | Inline-Validierung |
| `/recipes` | Rezeptliste | Karten: Name, kcal/Portion | Portionen, Zutatenzahl | „Neues Rezept“ | siehe J6 |
| `/recipes/[id]` | Rezeptdetail | Nährwerte pro Portion | Zutatenliste, pro 100 g | „Portion eintragen“ | Nicht gefunden → Liste |
| `/recipes/new` · `edit` | Rezept-Editor | Zutatenliste + Live-Summe | Name, Portionen, Endgewicht | „Speichern“ | 0 Zutaten: Speichern deaktiviert |
| `/progress` | Muster erkennen | Ø kcal vs. Ziel im Zeitraum | Tage im Korridor, Makro-Treffer, Gewichtstrend, Tagesbalken | Zeitraum 7T/30T/3M/6M/1J | < 2 Tage: Hinweis statt Chart |
| `/progress/weight` | Gewicht | Aktueller Trendwert + Veränderung | Chart, Ziel, Prognose, Liste | „Gewicht eintragen“ | < 3 Einträge: kein Trend |
| `/activity` | Aktivität & Wasser | Tages-Summe verbrannte kcal / Wasser | Liste der Einträge, Datumswahl | „Aktivität hinzufügen“, „+250 ml“ | „Noch keine Aktivität heute.“ |
| `/achievements` | Erfolge | Aktuelle Serie + längste Serie | Freigeschaltete / gesperrte Erfolge mit Fortschritt | – | „Dein erster Erfolg wartet: 3 Tage in Folge eintragen.“ |
| `/settings` | Profil-Hub | Name + aktuelles Ziel („2.300 kcal · Abnehmen“) | Gruppen: Meine Inhalte · Ziele & Plan · Konto & App | – | – |
| `/settings/goals` | Ziele | Tagesprofile mit kcal + Makros | Rechenweg, Makromodus, Wochentage | „Speichern“ | – |
| `/settings/meals` | Mahlzeiten | Sortierbare Liste | Name, Standardzeit, archivieren | „Mahlzeit hinzufügen“ | Letzte aktive Mahlzeit nicht archivierbar |
| `/settings/profile` | Körperdaten & App | Körperdaten, Aktivität, Ziel | Theme (System/Hell/Dunkel), Wasser-/Schrittziel, Aktivitätskalorien anrechnen | „Speichern“ → Neuberechnung anbieten | – |
| `/settings/account` | Konto | E-Mail, Passwort ändern | Abmelden, Konto löschen (Bestätigung mit Eingabe) | – | – |
