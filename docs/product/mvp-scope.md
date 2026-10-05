# MVP-Scope

> Owner: Product Architecture. Legt fest, was für die Abnahme fertig sein **muss**, was bei Zeit dazukommt und was
> bewusst später kommt. Die Nummern `DoD n` verweisen auf [definition-of-done.md](./definition-of-done.md).

## Stufen

| Stufe | Bedeutung |
|---|---|
| **MVP (Must)** | Ohne das gilt das Produkt nicht als fertig. Blockiert die Abnahme. |
| **MVP+ (Should)** | Geplant und spezifiziert; wird gebaut, wenn der Must-Teil grün ist. Fehlt es, wird es im Review als Gap gelistet, blockiert aber nicht. |
| **Später** | Bewusst nicht in dieser Runde. Datenmodell/Architektur lassen es zu, UI zeigt keine Platzhalter („Kommt bald“ ist verboten). |

## MVP (Must): Feature-Matrix

| Bereich | Feature | DoD | Module |
|---|---|---|---|
| Konto | Registrieren, Anmelden, Abmelden (E-Mail + Passwort), Session bleibt nach Reload | 1, 20 | Auth |
| Onboarding | 8 Schritte, serverseitig pro Schritt gespeichert, Wiedereinstieg | 2 | Onboarding |
| Kalorien | Berechnung Mifflin-St Jeor + PAL + Tempo, transparente Anzeige, manuelle Übersteuerung | 3 | Calorie Engine, Onboarding, Settings |
| Makros | Modi auto / Prozent / Gramm, Invariante kcal ≈ 4/4/9 | 4 | Macro Engine, Onboarding, Settings |
| Tagesprofile | Standard + mindestens ein weiteres Profil (Trainingstag) mit Wochentagen, Tages-Override | 4 | Macro Engine, Settings, Today Dashboard |
| Suche | Lokale Suche (Trigramm + Volltext, deutsch), Ranking mit Nutzerhistorie, externer Fallback | 5, 6 | Food Search |
| Food-Daten | Import kuratiertes DE-Basis-Set + USDA generisch; OFF live für Suche und Barcode; Persistenz in `foods` | 6 | Food Data Import, Food Search |
| Barcode | Kamera-Scan + manuelle Eingabe, gefunden → Log, unbekannt → Anlegen mit Vorbefüllung | 6, 7 | Barcode, Custom Foods |
| Eigene Lebensmittel | Anlegen, bearbeiten, archivieren; pro 100 g/ml oder pro Portion eingeben; Portionen | 7 | Custom Foods |
| Loggen | Food → Portion → Menge → Mahlzeit → Speichern; Quick-Add; letzte Portion; Mahlzeit nach Uhrzeit | 8, 9 | Meal Logging |
| Einträge | Bearbeiten (Menge, Portion, Mahlzeit), löschen mit Rückgängig | 9 | Meal Logging, Diary |
| Kopieren | Mahlzeit kopieren nach Datum/Mahlzeit, „Wie gestern“, Tag übernehmen | 16 | Meal Logging, Diary |
| Berechnung | kcal + Protein/KH/Fett pro Eintrag (Snapshot), pro Mahlzeit, pro Tag; Ziele pro Tag eingefroren | 10, 11 | Daily Nutrition Engine, Meal Logging |
| Rezepte | Anlegen mit Zutaten, Portionen, optional Endgewicht; loggen wie ein Lebensmittel | 12 | Recipes |
| Gewicht | Eintragen (1/Tag), Liste, Trend, Zielgewicht, Chart | 13, 14 | Weight Tracking |
| Fortschritt | `/progress` mit 7T/30T/3M/6M/1J: Ø kcal vs. Ziel, Makro-Treffer, Gewichtstrend | 14 | Analytics |
| Dashboard | `/today` komplett laut IA §3 | 14, 19 | Today Dashboard |
| Tagebuch | `/diary/[date]` laut IA §6, Datumsnavigation | 8, 9 | Diary |
| Favoriten | Stern im Food-Detail, Tab „Favoriten“ in `/log`, Liste in `/foods` | 15 | Food Search, Custom Foods, Meal Logging |
| Recents / Häufig | `food_usage` bei jedem Log, Tabs „Zuletzt“/„Häufig“, Ranking in Suche | 16 | Meal Logging, Food Search |
| Wasser | +250 ml in 1 Tap, Tagesziel, Liste bearbeiten | 14 | Activity & Water, Today Dashboard |
| Aktivität | Manuell: Schritte, Cardio, Kraft, Sport mit kcal; optional aufs Budget anrechnen | 14 | Activity & Water |
| Gamification | Serie (berechnet), längste Serie, ≥ 8 Achievements, `/achievements` | 19 | Gamification |
| Milo | Komponente mit 8 Stimmungen; Regel-Engine für Insight, Empty States, Meilensteine; Ausblenden | 19 | Mascot Design, Mascot Engine, Today Dashboard |
| Mobile | 375 px, Bottom Bar, Touch ≥ 44 px, Safe Areas, keine horizontale Scrollbar | 17 | 26, alle UI |
| Theme | Hell / Dunkel / System, persistiert in `user_profiles.theme` | 18 | Design System, Settings |
| Persistenz | Alle Daten in PostgreSQL, nichts nur im Client | 20 | alle |
| Einstellungen | Ziele, Mahlzeiten, Körperdaten, Theme, Konto | 3, 4 | Settings, Auth |

## MVP+ (Should)

| Feature | Warum wertvoll | Module |
|---|---|---|
| Schnelleintrag „nur kcal/Makros“ ohne Lebensmittel | Restaurant, Schätzung; `meal_entries.food_id` ist nullable | Meal Logging |
| Tagesnotiz (`daily_nutrition.note`) | Kontext für Ausreißer | Diary |
| Tag als „abgeschlossen“ markieren (`completed_at`) | Klarer Tagesabschluss, Milo-Feedback | Diary, Mascot Engine |
| Ballaststoff-Ziel und Zucker-/Salz-Obergrenze auf `/today` (aufklappbar) | Felder existieren in `goal_profiles` | Today Dashboard, Macro Engine |
| Mikronährstoffe im Tagesdetail | Daten aus USDA vorhanden | Diary, Daily Nutrition Engine |
| Körperfett % beim Gewicht | Spalte existiert | Weight Tracking |
| Portionsvorschläge in der Suche („1 Scheibe · 90 kcal“ statt pro 100 g) | Schnelleres Erfassen | Food Search |
| CSV-Export von Tagebuch und Gewicht | Datenhoheit | Analytics |
| PWA-Installierbarkeit (Manifest, Icons) | Home-Screen-Start | Brand Identity, App Shell |

## Später (bewusst nicht im MVP)

| Feature | Vorbereitung im System | Grund für „später“ |
|---|---|---|
| Wearable-Sync (Apple Health, Health Connect, Garmin, Fitbit) | `activity_source`-Enum, `external_id`-Dedup, `src/server/integrations/**` | Native Bridges / OAuth-Apps nötig |
| Community-Lebensmittel (eigene Foods öffentlich teilen, Moderation) | `foods.visibility`, `data_quality` | Moderation, Lizenzfragen (ODbL Share-Alike) |
| Mahlzeit-Fotos / KI-Erkennung | – | Storage, Datenschutz, Kosten |
| Push-Benachrichtigungen / Erinnerungen | `mascot_interactions` als Frequenz-Log | Service Worker + Opt-in-Flow |
| Offline-Logging mit Sync-Warteschlange | – | Konfliktauflösung |
| Soziale Features (Freunde, Challenges) | – | Nicht Kern der Priorität 1-5 |
| Essensplanung / Einkaufslisten | Zukunftsdaten im Tagebuch erlaubt | Eigenes Produkt |
| Intervallfasten-Timer | – | Nebenprodukt |
| Weitere Kalorienformeln (Katch-McArdle) | `calculator_id` + `CalorieCalculator`-Interface | Mifflin reicht für MVP |
| Mehrsprachigkeit (EN) | `user_profiles.locale` | UI bleibt Deutsch |
| Premium / Bezahlmodell | – | Kein Geschäftsmodell im Scope |

## Scope-Regeln

1. **Keine Attrappen.** Ein Feature ist entweder funktionsfähig mit echten Daten oder nicht sichtbar. Keine
   ausgegrauten „Bald verfügbar“-Buttons, keine Demo-Charts.
2. **Must vor Should.** MVP+ beginnt erst, wenn die Must-Punkte inklusive Empty/Loading/Error-Zuständen fertig sind.
3. **Datenmodell nicht für „Später“ erweitern.** Neue Tabellen nur nach Abstimmung.
4. **Scope-Konflikt** zwischen Bereichen: Entscheidung anhand der Prioritäten in [README](./README.md).

## Zuordnung DoD → verantwortliche Module

| DoD | Kurztitel | Hauptmodul | Beteiligt |
|---|---|---|---|
| 1 | Konto erstellen | Auth | App Shell |
| 2 | Onboarding abschließen | Onboarding | Calorie Engine, Macro Engine, Mascot Design |
| 3 | Kalorienziel erhalten/setzen | Calorie Engine | Onboarding, Settings |
| 4 | Makroziele erhalten/setzen | Macro Engine | Onboarding, Settings |
| 5 | Lebensmittel suchen | Food Search | Meal Logging |
| 6 | Skalierbare Datenquelle | Food Data Import | Food Search, Barcode, Database |
| 7 | Eigene Lebensmittel | Custom Foods | Barcode |
| 8 | Zu Mahlzeiten hinzufügen | Meal Logging | Diary, Today Dashboard |
| 9 | Portionen ändern | Meal Logging | Diary |
| 10 | Kalorien automatisch | Daily Nutrition Engine | Meal Logging |
| 11 | Makros automatisch | Daily Nutrition Engine | Meal Logging |
| 12 | Rezepte | Recipes | Meal Logging |
| 13 | Gewicht loggen | Weight Tracking | Today Dashboard |
| 14 | Fortschritt sehen | Analytics | Weight Tracking, Today Dashboard |
| 15 | Favoriten | Food Search | Custom Foods, Meal Logging |
| 16 | Häufige Lebensmittel wiederfinden | Meal Logging | Food Search |
| 17 | Mobile UI | App Shell | alle UI |
| 18 | Hell/Dunkel | Design System | Settings, Component Library |
| 19 | Maskottchen-System | Mascot Engine | Mascot Design, Gamification, Today Dashboard |
| 20 | Daten nach Reload | Database | alle, 29 |
