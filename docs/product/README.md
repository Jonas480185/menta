# Produktarchitektur

> Owner: Product Architecture. Verbindliche Produkt-Spezifikation für alle UI-Bereiche
> und die Abnahme. Technische Entscheidungen stehen in `docs/ARCHITECTURE.md`: bei Widerspruch
> gilt ARCHITECTURE.md, und der Widerspruch wird geklärt.
>
> Konvention: Struktur und Begriffe auf Deutsch, technische Bezeichner (Routen, Tabellen, Services) im Original.
> Beispiel-Texte für die UI stehen in „Anführungszeichen“ und sind als Vorlage verbindlich im Ton, nicht im Wortlaut.

## Dokumente

| Datei | Inhalt | Primär für |
|---|---|---|
| [user-journeys.md](./user-journeys.md) | Kern-Journeys Schritt für Schritt, Tap-Zahlen, Zielzeiten, Edge Cases | 05, 06, 12, 17, 19, 08, 18, 20, 21, 07, 24, 23 |
| [information-architecture.md](./information-architecture.md) | Navigation, Screen-Inventar, Hierarchie & Zustände pro Screen | UI, App Shell |
| [mvp-scope.md](./mvp-scope.md) | MVP vs. später, Mapping auf DoD | alle |
| [domain-boundaries.md](./domain-boundaries.md) | Bounded Contexts, Tabellen/Services, erlaubte Abhängigkeiten | Backend, Datenbank |
| [definition-of-done.md](./definition-of-done.md) | 20 DoD-Punkte mit Abnahmetest | 29, 30 |
| [ux-principles.md](./ux-principles.md) | Geschwindigkeit, Klarheit, Ton, Gamification, A11y, Motion | UI |

## Produktvision (5 Sätze)

1. Wir bauen den schnellsten und angenehmsten Weg, Essen zu tracken: Das Wiederholen einer bekannten Mahlzeit
   dauert zwei Taps, ein neues Lebensmittel unter 15 Sekunden.
2. Jede Zahl ist korrekt und nachvollziehbar: Kalorien, Makros und Ziele werden transparent berechnet, und die
   Vergangenheit ändert sich nie still.
3. Eine skalierbare Lebensmitteldatenbank (Open Food Facts, USDA, kuratiertes deutsches Basis-Set, eigene
   Lebensmittel, Rezepte) findet das Gesuchte auch im deutschen Supermarkt.
4. Das Dashboard beantwortet in einer Sekunde die Frage „Wie stehe ich heute da?“, übersichtlich und ohne
   Bewertung.
5. Milo, unser Maskottchen, ist kein Deko-Element, sondern ein Coach, der leere Zustände auflöst, den nächsten
   sinnvollen Schritt vorschlägt und Fortschritt sichtbar feiert.

## Produktprioritäten (Reihenfolge = Entscheidungsregel bei Zielkonflikten)

| # | Priorität | Was das konkret heißt |
|---|---|---|
| 1 | **Food Logging schnell & angenehm** | Re-Log ≤ 2 Taps, neues Food ≤ 15 s, optimistische UI, letzte Portion gemerkt, Mahlzeit nach Uhrzeit vorausgewählt |
| 2 | **Korrekte Nährwert-Mathe** | Pro 100 g/ml, 4/4/9, Snapshots auf `meal_entries`, Runden nur in der Anzeige, Ziele pro Tag eingefroren |
| 3 | **Skalierbare Food-Daten** | Lokale Suche zuerst (< 300 ms), externe Provider als Fallback, Ergebnisse werden persistiert |
| 4 | **Flexible Kalorien-/Makroziele** | Berechnet oder manuell; Makros in %, g oder auto; Tagesprofile (Training/Ruhe …) mit Wochentagen |
| 5 | **Dashboard sofort verständlich** | Eine Hauptzahl pro Karte, „noch X kcal“ statt Rechenaufgabe, klare Über-Ziel-Zustände |
| 6 | **Exzellente Mobile UX** | 375 px zuerst, Daumenzone, Touch-Ziele ≥ 44 px, Bottom Bar, Sheets statt Seitenwechsel wo sinnvoll |
| 7 | **Deutlich moderner als klassische Tracker** | Keine Tabellenwüsten, keine Werbe-Ästhetik, ruhige Typografie, sinnvolle Motion |
| 8 | **Maskottchen mit Funktion** | Milo erscheint nur mit Handlung oder Information, nie als reine Dekoration |
| 9 | **Erweiterbar** | Provider-, Calculator- und Aktivitäts-Adapter; Bounded Contexts mit klaren Abhängigkeiten |
| 10 | **Keine rein visuellen Demos** | Jede sichtbare Zahl kommt aus echten Daten; leere Zustände statt Mock-Daten |

**Entscheidungsregel:** Kollidieren zwei Prioritäten, gewinnt die kleinere Nummer. Beispiel: Eine Animation, die
das Speichern eines Eintrags verzögert (7), verliert gegen Logging-Speed (1).

## Kernbegriffe (Glossar)

| Begriff (UI) | Technisch | Bedeutung |
|---|---|---|
| Lebensmittel | `foods` | Jedes loggbare Objekt, auch eigene Lebensmittel und Rezepte |
| Portion | `food_servings` | z. B. „1 Scheibe (30 g)“; jedes Food hat mindestens „100 g“ bzw. „100 ml“ |
| Menge | `meal_entries.quantity` | Anzahl Portionen, z. B. 1,5 |
| Mahlzeit | `meals` | Konfigurierbarer Slot: Frühstück, Mittagessen, Abendessen, Snacks |
| Eintrag | `meal_entries` | Geloggtes Lebensmittel mit Nährwert-Snapshot |
| Tagesziel | `daily_nutrition` / `goal_profiles` | kcal + Makros eines Tages |
| Tagesprofil | `goal_profiles.kind` | Standard, Trainingstag, Ruhetag, High/Low Carb, Refeed, Eigenes |
| Erhaltungsbedarf | `user_profiles.tdee_kcal` | Kalorien, bei denen das Gewicht gleich bleibt |
| Trend | Domain `weight` | Geglättetes Gewicht, das Tagesschwankungen herausfiltert |
| Serie | Domain `gamification` | Aufeinanderfolgende Tage mit mindestens einem Eintrag |
| Milo | `mascot_interactions`, `<Milo />` | Maskottchen / Coach |

## Referenz-Nutzer (für Beispiele in allen Dokumenten)

Alle Beispielwerte in diesen Dokumenten verwenden denselben Nutzer, damit die Zahlen zusammenpassen:

- **Jonas**, männlich, 33 Jahre, 180 cm, 84 kg, moderat aktiv (PAL 1,55), Ziel: abnehmen, Tempo moderat, Zielgewicht 78 kg.
- Mifflin-St Jeor: Grundumsatz 1.805 kcal → Erhaltungsbedarf 2.798 kcal → Defizit −500 → **Tagesziel 2.300 kcal** (gerundet auf 10).
- Makros (auto): Protein 150 g (1,8 g/kg) · Fett 64 g (25 %) · Kohlenhydrate 281 g (Rest) → 600 + 576 + 1.124 = 2.300 kcal.
- Heute um 16:30: 1.620 kcal gegessen, Protein 96 g, KH 160 g, Fett 66 g (2 g über Ziel), Wasser 1.250 / 2.500 ml,
  6.420 / 8.000 Schritte, Gewicht 83,4 kg, Serie 12 Tage.

Die exakten Formeln, Tempo-Stufen und Sicherheitsgrenzen legt die Calorie Engine bzw. Macro Engine
 fest; die Werte oben sind Beispiele für Copy und Layout.
