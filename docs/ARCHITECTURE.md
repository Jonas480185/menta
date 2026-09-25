# Architektur – Grundsatzentscheidungen

> Dieses Dokument hält die **verbindlichen** Architekturentscheidungen fest.
> Detaildokumente liegen unter `docs/architecture/`, `docs/product/`, `docs/design/`, `docs/brand/`.

## 1. Repository-Audit (Ausgangslage)

- Arbeitsverzeichnis war leer: kein Repo, kein Stack, keine DB.
- Toolchain: Node 24, pnpm 12, git 2.50. **Kein** Docker, **kein** lokales PostgreSQL, kein Homebrew.
- Netzwerkzugriff auf Open Food Facts (API v2 + search-a-licious) und USDA FoodData Central (API + Bulk-Downloads) verifiziert.

→ Greenfield mit dem vorgeschlagenen Default-Stack. Da kein Postgres-Server verfügbar ist, nutzen wir
**PGlite** (echtes PostgreSQL 17 als WASM, eingebettet) für Entwicklung und Tests – inkl. `pg_trgm`,
`unaccent` und deutscher Volltextsuche (verifiziert). In Produktion zeigt `DATABASE_URL` auf einen
normalen PostgreSQL-Server; Schema, Migrationen und Queries sind identisch.

## 2. Stack

| Bereich | Wahl |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) – **Achtung:** `middleware.ts` heißt jetzt `proxy.ts`; Docs liegen unter `node_modules/next/dist/docs/` |
| Sprache | TypeScript strict |
| Styling | Tailwind CSS v4 (CSS-first `@theme`), shadcn/ui-Konventionen (Radix), `motion` für Animationen |
| DB | PostgreSQL via Drizzle ORM · Dev/Test: PGlite · Prod: node-postgres |
| Auth | better-auth (E-Mail + Passwort), Drizzle-Adapter |
| Validation | Zod 4 (Server + Forms), React Hook Form |
| Charts | Recharts |
| Icons | lucide-react |
| Tests | Vitest (Unit + DB-Integration gegen In-Memory-PGlite), Testing Library, Playwright (E2E) |
| Package Manager | pnpm (Hardlink-Store → billige Worktrees) |

## 3. Schichten

```
src/
  domain/          Reine Logik, framework-frei, 100 % unit-testbar
                   (Nährwert-Mathe, Kalorien-/Makro-Engine, Gewichtstrend, Streaks, Mascot-Regeln)
  server/
    db/            Drizzle-Schema (pro Domäne eine Datei), Client, Migrations-Runner
    food/          FoodProvider-Interface, Provider-Implementierungen, Normalisierung, Import
    services/<d>/  Use-Cases/Repositories: (ctx: ServiceContext, input) → Ergebnis
    auth/          better-auth + getServiceContext()
  app/             Routen (Server Components lesen via services, Mutationen via Server Actions)
    **/actions.ts  Server Actions: Zod-validieren → service aufrufen → ActionResult
    api/           Route Handler nur wo Client-Fetch nötig ist (Suche, Barcode, Auth)
  components/      ui/ (Component Library), <feature>/ (Feature-Komponenten)
  lib/             Utilities (dates, result, errors, format, cn)
```

Regeln:
- **Services** bekommen immer `ctx: ServiceContext = { db, userId, timezone }` als erstes Argument, lesen nie selbst
  Cookies und sind damit gegen `createTestDb()` testbar. Nutzerdaten werden **immer** über `ctx.userId` gescoped.
- **Server Actions** (`"use server"`) validieren mit Zod, rufen Services, geben `ActionResult<T>` zurück (`runAction()` aus
  `src/lib/result.ts`), und rufen danach `revalidatePath()` für betroffene Routen.
- **Fehler**: Services werfen `AppError(code, message)` (`src/lib/errors.ts`); unerwartete Fehler → `INTERNAL`.
  Fehlermeldungen sind deutsch und nutzerfreundlich.
- **Lesen**: Server Components rufen Services direkt (`const ctx = await getServiceContext()`).
- **Client-Fetch** nur für interaktive Suche/Barcode (`/api/foods/search`, `/api/foods/barcode/[code]`).
- Kein `cacheComponents` (bewusst): alle App-Routen sind nutzerspezifisch/dynamisch. Caching passiert in der
  Datenschicht (siehe §7).

## 4. Datenmodell (Kurzfassung)

Vollständig in `src/server/db/schema/*.ts` (jede Tabelle kommentiert). Details: `docs/architecture/database.md`.

| Konzept aus der Spec | Umsetzung |
|---|---|
| User / UserProfile | `user` (better-auth) + `user_profiles` |
| Food / FoodBrand / FoodServing | `foods`, `food_brands`, `food_servings` |
| FoodNutrients | Spalten auf `foods` (pro 100 g/ml) + `micronutrients jsonb`; Domain-Typ `NutrientProfile` |
| UserFood | `foods` mit `source='user'`, `owner_user_id`, `visibility='private'` |
| Recipe / RecipeIngredient | `recipes`, `recipe_ingredients`; jedes Rezept hat eine verknüpfte `foods`-Zeile (`source='recipe'`) → loggen/suchen/favorisieren wie jedes Lebensmittel |
| Meal / MealEntry | `meals` (konfigurierbare Slots) + `meal_entries` (Nährwert-**Snapshot** zum Logzeitpunkt) |
| NutritionGoal | `goal_profiles` (Tagesprofile: Default, Training, Rest, High/Low Carb, Refeed, Custom; Wochentags-Zuordnung) |
| DailyNutrition | `daily_nutrition`: friert die **Ziele** pro Tag ein; verbrauchte Summen werden **immer live** aus `meal_entries` aggregiert |
| WeightEntry / Activity / WaterEntry | `weight_entries`, `activities`, `water_entries` |
| FavoriteFood / RecentFood | `favorite_foods`, `food_usage` (recent + frequent + letzte Portion) |
| Gamification / Mascot | `user_achievements`, `mascot_interactions` (Streaks werden berechnet) |
| Externer Cache | `external_lookup_cache` (Such- und Barcode-Lookups inkl. Negativ-Cache) |

Warum Snapshots auf `meal_entries`? Externe Foods werden aktualisiert und eigene Foods editiert – ein historisches
Tagebuch darf sich dadurch nicht still ändern. Tagessummen werden daraus per `SUM … GROUP BY` berechnet
(Index `(user_id, date)`), es gibt keine redundante Summentabelle und damit nichts zu invalidieren.

Einheiten: Energie kcal · Makros g · Mineralstoffe mg · Nährwerte **pro 100 g** (Feststoffe) bzw. **pro 100 ml**
(`nutrient_basis='ml'`, optionale Dichte). `food_servings.grams` = Basiseinheiten einer Portion.
Datumswerte als Kalendertag `YYYY-MM-DD` in der Zeitzone des Nutzers (`src/lib/dates.ts`).

Migrationen: `drizzle/` (drizzle-kit). `0000_extensions.sql` aktiviert `pg_trgm` + `unaccent`.

## 5. Food-Database-Strategie (Entscheidung)

Hybrid, provider-agnostisch:

```
Open Food Facts (EU/DE-Markenprodukte + Barcodes, ODbL)  ─┐
USDA FoodData Central (generische Lebensmittel, CC0)     ─┼─► Normalization ► Validation ► Dedup ► PostgreSQL (foods)
Kuratiertes DE-Basis-Set (deutsche Namen → USDA-Werte)   ─┘                                        │
                                                                        pg_trgm + FTS + Popularity ◄┘
User Foods / Rezepte (lokal)  ──────────────────────────────────────────────────────────────────►  gleiche Tabelle
```

| Kriterium | Open Food Facts | USDA FDC | Entscheidung |
|---|---|---|---|
| DE/EU-Abdeckung | sehr gut (>400 k Produkte DE) | schwach (US-Marken) | OFF für Markenprodukte |
| Barcodes | Kernstärke | nur US Branded | OFF primär |
| Generische Lebensmittel | lückenhaft | exzellent (SR Legacy, Foundation) | USDA + deutsche Namen |
| Mikronährstoffe | lückenhaft | sehr gut | USDA |
| Limits | Suche ~10 req/min, Produkt ~100 req/min; Dumps frei | API-Key 1000 req/h; Bulk-CSV frei | Bulk-Import + Live-Fallback |
| Lizenz | ODbL (Attribution + Share-Alike für DB) | Public Domain / CC0 | beide nutzbar, Attribution in App |

Ablauf der Suche: lokale DB sofort (trgm/FTS + Nutzerhistorie) → bei zu wenigen Treffern externe
Provider (mit Timeout, Rate-Limit, Cache) → normalisieren → persistieren (`foods`) → nächstes Mal lokal.
Details und Import-Pipeline: `docs/architecture/food-data-strategy.md`.

## 6. Berechnungen

- **Kalorien**: `CalorieCalculator`-Interface, Default Mifflin-St Jeor, PAL-Multiplikatoren,
  Zieltempo → Defizit/Überschuss mit Sicherheitsgrenzen; manuell überschreibbar (`calorie_source='manual'`).
- **Makros**: Modi `percent` | `grams` | `auto`; 4/4/9 kcal/g; Invariante: kcal aus Makros ≈ Kalorienziel.
- **Tagesnährwerte**: Konsum = Summe Snapshots; Ziele = `daily_nutrition`-Snapshot (Vergangenheit) bzw.
  aufgelöstes Profil (heute/Zukunft); Remaining = Ziel − Konsum (+ optional Aktivitätskalorien).

## 7. Caching

| Was | Wo | Invalidierung |
|---|---|---|
| Externe Foods | `foods`-Tabelle selbst (Cache = Persistenz) | `fetched_at` + Refresh-TTL (30 Tage) |
| Externe Suchanfragen | `external_lookup_cache` (key = provider+query) | `expires_at` (7 Tage) |
| Barcode-Lookups (auch „nicht gefunden“) | `external_lookup_cache` | positiv 30 Tage, negativ 1 Tag |
| Suchergebnisse im Client | In-Memory LRU pro Session (Query → Results) | Seitenwechsel / Log-Aktion |
| Tagesaggregate | nicht gecacht – indexierte SUM-Query (< 5 ms) | – |
| Seiten | `revalidatePath()` nach Mutationen | pro Action |

## 8. Routen (verbindlich)

| Route | Zweck |
|---|---|
| `/` | Redirect: eingeloggt → `/today` (bzw. `/onboarding`), sonst `/login` |
| `/login`, `/signup` | Auth |
| `/onboarding` | Mehrstufiger Onboarding-Flow |
| `/today` | Dashboard „Wie stehe ich heute da?“ |
| `/diary/[date]` | Tagebuch eines Tages (Meals, Einträge, Kopieren) · `/diary` → heute |
| `/log?date=&meal=` | Lebensmittel suchen & loggen (Suche, Recents, Favoriten, Scan-Button) |
| `/log/food/[foodId]?date=&meal=&entry=` | Food-Detail + Portion/Menge/Mahlzeit wählen (auch Entry bearbeiten) |
| `/scan?date=&meal=` | Barcode-Scanner |
| `/foods` · `/foods/new?barcode=` · `/foods/[id]/edit` | Eigene Lebensmittel & Favoriten |
| `/recipes` · `/recipes/new` · `/recipes/[id]` · `/recipes/[id]/edit` | Rezepte |
| `/progress` | Analytics-Übersicht (7T/30T/3M/6M/1J) |
| `/progress/weight` | Gewicht: Einträge, Trend, Ziel |
| `/activity` | Aktivität & Wasser (Tagesliste, Eintrag) |
| `/achievements` | Streaks, Bestleistungen, Achievements |
| `/settings` · `/settings/goals` · `/settings/meals` · `/settings/profile` · `/settings/account` | Einstellungen |

Mobile Navigation (Bottom Bar): Heute · Tagebuch · **(+) Loggen** · Fortschritt · Profil.
Desktop: Sidebar mit denselben Zielen. Sprache der UI: **Deutsch**.
