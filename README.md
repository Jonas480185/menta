# Menta – Nutrition & Fitness Tracker

„Klarheit auf dem Teller.“ Kalorien, Makros, Gewicht, Aktivität und Wasser tracken – schnell, modern, mit
Maskottchen **Milo** als funktionalem Coach. UI-Sprache: Deutsch. Light & Dark Mode, mobile-first.

Demo-Login nach `pnpm db:seed`: **demo@menta.app / menta-demo-2026** (21 Tage Beispiel-Tagebuch).

## Setup

```bash
pnpm install
cp .env.example .env        # Defaults funktionieren lokal ohne Änderungen
pnpm db:seed                # Migrationen + 17.986 Lebensmittel + Demo-User (≈ 6 s)
pnpm dev                    # http://localhost:3000
```

Kein Postgres-Server nötig: lokal läuft **PGlite** (echtes PostgreSQL 17 als WASM, Daten in `.data/pglite`).
Nur ein Prozess darf das Datenverzeichnis öffnen – Dev-Server stoppen, bevor `db:seed`/`db:migrate` läuft.

| Befehl | Zweck |
|---|---|
| `pnpm dev` / `pnpm build && pnpm start` | Entwicklung / Production |
| `pnpm typecheck && pnpm lint && pnpm test && pnpm build` | Quality Gate (`pnpm check`) |
| `pnpm test:e2e` | Playwright gegen laufenden Server (`E2E_BASE_URL`, Default `http://localhost:3200`) |
| `pnpm db:generate` / `db:migrate` / `db:seed` / `db:reset` | Migrationen & Seed |
| `pnpm db:bench-search` | Such-Benchmark mit 200k–1M synthetischen Foods |
| `tsx scripts/food/import-*.ts` | Food-Import-Pipeline (USDA, kuratiert, Open Food Facts API/Dump) |

## Environment Variables

| Variable | Default | Beschreibung |
|---|---|---|
| `DATABASE_URL` | leer | `postgres://…` → echtes PostgreSQL (Produktion). Leer → PGlite |
| `PGLITE_DATA_DIR` | `./.data/pglite` | PGlite-Datenverzeichnis |
| `BETTER_AUTH_SECRET` | Dev-Fallback | **Pflicht in Produktion**, ≥ 32 Zeichen (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS` | leer | Öffentliche URL / zusätzliche Origins |
| `USDA_API_KEY` | `DEMO_KEY` | USDA FoodData Central |
| `OFF_USER_AGENT` | App-Name | Pflicht-User-Agent für Open Food Facts |
| `FOOD_EXTERNAL_PROVIDERS_ENABLED` | `true` | `false` = Offline-Modus (nur lokale DB) |
| `LOG_LEVEL`, `DB_POOL_MAX` | – | Logging / Pool-Größe |

## Architecture

Next.js 16 (App Router, React 19, Turbopack) · TypeScript strict · Tailwind v4 + eigene Komponentenbibliothek
(Radix/shadcn-Konventionen) · Drizzle ORM · PostgreSQL/PGlite · better-auth · Zod · Recharts · motion.

```
src/domain/         reine Logik (Nährwert-Mathe, Kalorien, Makros, Gewichtstrend, Aktivität, Engagement/Milo) – unit-getestet
src/server/services Use-Cases: fn(ctx = { db, userId, timezone }, input) – gegen In-Memory-Postgres getestet
src/server/food/    FoodProvider-Abstraktion (OFF, USDA, Local), Normalisierung, Validierung, Import-Pipeline
src/app/            Routen; Server Components lesen via Services, Mutationen via Server Actions (ActionResult)
src/components/     ui/ (Bibliothek), Feature-Komponenten
```

Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/architecture/technical.md`](docs/architecture/technical.md),
Produkt: [`docs/product/`](docs/product/), Design: [`docs/design/`](docs/design/), Marke: [`docs/brand/`](docs/brand/).

## Database

Schema in `src/server/db/schema/*.ts`, Migrationen in `drizzle/` (`0000_extensions` aktiviert `pg_trgm` + `unaccent`).
Kernentscheidungen: Nährwerte **pro 100 g/ml**; Tagebuch-Einträge speichern einen **Nährwert-Snapshot** (Historie
ändert sich nicht, wenn Foods aktualisiert werden); Tagessummen werden live per SQL aggregiert (keine Redundanz,
nichts zu invalidieren); `daily_nutrition` friert die **Ziele** vergangener Tage ein; Rezepte besitzen eine
verknüpfte `foods`-Zeile und sind damit such-/logg-/favorisierbar wie Lebensmittel. 39 CHECK-Constraints sichern
plausible Werte. Suche: generierte `tsvector`-Spalte + Trigram-GIN + Präfix-Index, zweistufige Such-SQL
(1 Mio. Foods: meist 3–60 ms). → [`docs/architecture/database.md`](docs/architecture/database.md)

## Food Provider Strategy

Hybrid: **Open Food Facts** (DE/EU-Markenprodukte, Barcodes, ODbL) + **USDA FoodData Central** (generische
Lebensmittel, Mikronährstoffe, CC0) + **446 kuratierte deutsche Grundnahrungsmittel** (deutsche Namen, Werte aus USDA).
Offline-Snapshot (1,55 MB) mit 17.986 Foods wird beim Seed importiert. Suche: lokal zuerst
(Historie → exakte Treffer → Favoriten → eigene → Datenbank), bei < 8 Treffern Live-Fallback auf Open Food Facts
(Timeout 2 s), Ergebnisse werden normalisiert, validiert, dedupliziert, lokal gespeichert und in
`external_lookup_cache` gecacht (Suche 7 Tage, Barcode 30 Tage, Negativ-Cache 1 Tag). Pipeline:
Raw → Parser → Normalizer → Validation → Dedup → DB. → [`docs/architecture/food-data-strategy.md`](docs/architecture/food-data-strategy.md)

## Calorie Calculation

`CalorieCalculator`-Interface mit Registry; Default **Mifflin-St Jeor** (+ Harris-Benedict rev., Katch-McArdle).
TDEE = BMR × PAL (1,2 … 1,9). Tempo: −250/−500/−750 bzw. +150/+300 kcal (Defizit max. 25 % des TDEE),
Sicherheitsuntergrenzen mit Hinweis, 7.700 kcal/kg für Wochen-/Zielprognose, transparente Aufschlüsselung
(„Erhaltungsbedarf 2.773 kcal · Defizit −500 kcal · Tagesziel 2.273 kcal“). Ziel jederzeit manuell überschreibbar.
→ [`docs/architecture/calorie-engine.md`](docs/architecture/calorie-engine.md)

## Macro Calculation

Modi **Prozent**, **Gramm** (Protein + Fett fix, Carbs = Rest) und **Empfehlung** (Protein g/kg nach Ziel,
Fett-Untergrenze, Carbs Rest). 4/4/9 kcal/g, Rundung so, dass 4P+4C+9F ≤ ±5 kcal vom Ziel abweicht; die UI zeigt
immer „= X kcal“. **Tagesprofile** (Trainings-/Ruhetag, High/Low Carb, Refeed) per Wochentag oder Datum.
→ [`docs/architecture/macro-engine.md`](docs/architecture/macro-engine.md), [`docs/architecture/nutrition-engine.md`](docs/architecture/nutrition-engine.md)

## Features (Definition of Done)

Account & Login · Onboarding (8 Schritte) · Kalorien-/Makroziele berechnet oder manuell · Suche über 18k lokale
Foods + Open Food Facts live · Barcode-Scan (Kamera via `BarcodeDetector`, manuelle Eingabe, unbekannt →
Produkt anlegen) · eigene Lebensmittel · Loggen in ≤ 2 Taps (Zuletzt/Häufig/Favoriten mit letzter Portion),
Portionen ändern, duplizieren, löschen mit Rückgängig, Mahlzeit/Tag kopieren · Rezepte mit Live-Nährwerten ·
Gewicht mit geglättetem Trend · Aktivität (MET) & Wasser · Fortschritt 7T/30T/3M/6M/1J · Streaks, 13 Achievements,
Milo-Coach mit 15 kontextabhängigen Regeln (ohne Schuldzuweisungen) · Light/Dark · alles persistent.

## Testing

- **Unit + Integration (Vitest)**: 70 Dateien, > 1.240 Tests – Nährwert-Mathe, Kalorien/Makros, Rezepte,
  Gewichtstrend, Suche/Ranking, Logging, Auth, Constraints; DB-Tests gegen frische In-Memory-PGlite.
- **E2E (Playwright)**: `e2e/core-flow.spec.ts` – Signup → Onboarding → Suche → Loggen → Portion ändern → Reload.

## Deployment

Beliebiger Node-Host (z. B. Vercel/Fly/Render): `DATABASE_URL` auf PostgreSQL ≥ 14 mit Extensions `pg_trgm` und
`unaccent`, `BETTER_AUTH_SECRET` setzen, `pnpm build && pnpm start`. Migrationen laufen beim ersten DB-Zugriff
automatisch (oder `pnpm db:migrate`), Foods per `pnpm db:seed` (Demo-User-Schritt in Produktion auslassen:
`pnpm db:seed --only=extensions,foods`). Open-Food-Facts-Attribution (ODbL) ist in Suche und Food-Details sichtbar.


## Bekannte Grenzen

Kein Passwort-Reset/E-Mail-Verifizierung (kein Mail-Provider) · Wearable-Integrationen sind als austauschbare
Provider-Schnittstelle vorbereitet, aber nicht angebunden · Kamera-Scan benötigt einen Browser mit
`BarcodeDetector` (Chrome/Android), sonst manuelle Eingabe · Rezepte nutzen einen eigenen Zutaten-Picker (DB-Suche).
