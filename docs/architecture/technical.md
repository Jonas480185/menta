# Technische Architektur – Referenz

> Owner: Technical Architecture. Ergänzt die verbindlichen Architekturentscheidungen in
> [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md), widerspricht ihnen nicht. Bei Konflikten gilt ARCHITECTURE.md.
> Datenmodell: [`database.md`](./database.md) · Food-Daten: [`food-data-strategy.md`](./food-data-strategy.md).

**Kurzfassung für Eilige:**

1. Lesen in **Server Components** → `const ctx = await getServiceContext()` → `service(ctx, …)`.
2. Schreiben per **Server Action** → Zod → `runAction()` → `service(ctx, …)` → `revalidatePath()`.
3. Im Client **`useAction(action)`** → `{ execute, isPending, fieldErrors }`, Fehler-Toasts automatisch.
4. Erwartete Fehler: **`throw new AppError(code, "deutsche Meldung")`**. Alles andere wird `INTERNAL`.
5. Zahlen/Daten nur über **`@/lib/format`** anzeigen. Umgebungsvariablen nur über **`env` aus `@/lib/env`**.
6. DB nur über **`getDb()`** (bzw. `ctx.db`), nie `createDatabase()` in App-Code, nie auf Modulebene.
7. **PGlite = ein Prozess pro Datenverzeichnis.** Dev-Server stoppen, bevor `pnpm db:*` läuft.

---

## 1. Schichten & Abhängigkeitsregeln

```
 ┌──────────────────────────── src/app ─────────────────────────────┐
 │  page.tsx / layout.tsx (Server Components)   actions.ts ("use server")   api/**/route.ts │
 └───────────────┬───────────────────────────────────┬──────────────┘
                 │ getServiceContext()               │ Props (serialisierbar)
                 ▼                                   ▼
 ┌──────── src/server ────────┐          ┌──── src/components ────┐
 │ services/<domäne>/*.ts      │          │ ui/ (Library)           │
 │   fn(ctx, input)            │          │ <feature>/ (meist Client│
 │ food/ (Provider, Import)    │          │  Components)            │
 │ auth/ (better-auth, ctx)    │          └───────────┬────────────┘
 │ db/ (Schema, getDb)         │                      │
 └───────────┬────────────────┘                      │
             ▼                                        ▼
 ┌──────── src/domain ───────── rein, framework-frei ───────────────┐
 └──────────────────────────────────────────────────────────────────┘
 ┌──────── src/lib ─────────── geteilt Client + Server (format, result, errors, env*, logger) ┐
 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

| Schicht | Darf importieren | Darf NICHT importieren | Durchgesetzt |
|---|---|---|---|
| `src/domain/**` | `@/domain/**`, `@/lib/**` (reine Utils), `zod` | `next/*`, `react*`, `@/server/**`, `@/app/**`, `@/components/**`, `drizzle-orm`, `pg`, PGlite | ESLint (Typ-Importe erlaubt) |
| `src/lib/**` | `@/lib/**`, `@/domain/**`, `zod`, `next/navigation` | `@/server/**`, DB-Treiber | ESLint (Typ-Importe erlaubt) |
| `src/components/**`, `src/hooks/**` | `@/components/**`, `@/lib/**`, `@/domain/**`, Server Actions | `@/server/db*`, `drizzle-orm`, `pg`, PGlite | ESLint (Typ-Importe erlaubt) |
| `src/server/services/**` | `@/server/**`, `@/domain/**`, `@/lib/**`, `drizzle-orm` | `react`, `next/navigation` (kein redirect im Service) | Review |
| `src/app/**` | alles außer `createDatabase` | `@/server/db/create` (Wert-Import) | ESLint |
| überall außer `src/server/db/**`, Tests | `getDb` | `createDatabase` (öffnet zweite PGlite-Instanz) | ESLint |

Weitere Regeln:

- **Services** haben die Signatur `fn(ctx: ServiceContext, input)`. Sie lesen nie Cookies oder Header, kennen
  weder `redirect` noch `revalidatePath` und scopen Nutzerdaten **immer** über `ctx.userId`.
  Empfehlung: `import "server-only";` als erste Zeile jeder Service-Datei. Tests mocken es in `src/test/setup.ts`.
- **Transaktionen** mit `inTransaction(ctx, async (tx) => …)` aus `@/server/context`. Der Callback bekommt
  einen `ServiceContext`, dessen `db` die Transaktion ist, und kann deshalb dieselben Service-Funktionen aufrufen.
  Verschachtelte Aufrufe werden zu Savepoints.
- **Client Components** importieren Server Actions (`"use server"`-Dateien), niemals Services. Ein Service-Import
  im Client scheitert beim Build an `server-only` (gewollt).
- `@/lib/env` ist bewusst **ohne** `server-only` (Scripts/Tests), wirft aber im Browser. Werte als Props weitergeben.

---

## 2. Request-Flows

### 2.1 Lesen: Server Component

```
Browser ──GET /today──► proxy.ts (nur optimistischer Cookie-Check)
                          │
                          ▼
                 app/(app)/today/page.tsx  (async Server Component, dynamisch)
                          │ const ctx = await getServiceContext()   ← liest Header/Cookie → Session
                          │                                           (kein Login → redirect("/login"))
                          │ const [summary, entries] = await Promise.all([
                          │   getDailySummary(ctx, today), listEntries(ctx, today) ])
                          ▼
                 services ──► ctx.db (Drizzle) ──► PGlite/Postgres
                          │
                          ▼
                 RSC-Payload → HTML-Streaming; <Suspense> um langsame Teile, loading.tsx als Skeleton
```

- Unabhängige Queries **parallel** mit `Promise.all`, keine Wasserfälle.
- „Heute“ immer über `todayInTimezone(ctx.timezone)`, nie `new Date()` in der Serverzeitzone.
- Seiten, die DB lesen, **müssen dynamisch** sein. `getServiceContext()` liest Header und macht die Seite
  automatisch dynamisch. Wer ohne Session DB liest (selten), ruft vorher `await connection()` aus `next/server` auf.
  Sonst versucht `next build` die Seite zu prerendern und öffnet die DB in mehreren Build-Workern (siehe §8).

### 2.2 Schreiben: Server Action

```
Client Component                     app/…/actions.ts ("use server")              services
────────────────                     ───────────────────────────────              ────────
useAction(addEntryAction)
execute(input) ──POST (RSC)──► addEntryAction(input: unknown)
                                 runAction(async () => {
                                   const data = Schema.parse(input)     ─ ZodError → VALIDATION + fieldErrors
                                   const ctx  = await getServiceContext() ─ redirect() propagiert
                                   const res  = await addEntry(ctx, data) ─► AppError → code/message
                                   revalidatePath("/today"); revalidatePath(`/diary/${data.date}`)
                                   return { id: res.id }                  ─ nur serialisierbare Daten
                                 })
◄── ActionResult<T> ──────────── { ok: true, data } | { ok: false, error }
isPending=false nach Action + RSC-Refresh; bei Fehler toast.error(message)
```

- Actions nehmen `input: unknown` und validieren **immer** mit Zod. Der Client ist nicht vertrauenswürdig.
- Rückgabe klein halten (IDs, nicht ganze Objekte). Die UI aktualisiert sich über `revalidatePath()`.
- `redirect()` gehört **nach** `runAction` oder wird von `runAction` durchgereicht (`unstable_rethrow`).

### 2.3 Client-Fetch: Suche und Barcode

```
<FoodSearch> (Client) ─ debounce 150–250 ms ─ AbortController ─► GET /api/foods/search?q=…
     ▲  In-Memory-LRU (Query → Ergebnisse)                          │ route.ts (Node runtime)
     │                                                              │ ctx = await getServiceContext()
     └──────────────── JSON (klein, paginiert) ◄────────────────────┤ Zod(searchParams) → searchFoods(ctx, q)
                                                                    │ catch → toErrorResponse(err)
```

- Route Handler nur, wo der Client interaktiv fetchen muss (Suche, Barcode, Auth). Sonst Server Actions.
- Fehler als `toErrorResponse(err)` → `{ error: { code, message } }` mit passendem HTTP-Status (§4).
- Laufende Requests bei neuer Eingabe abbrechen (`AbortController`). Veraltete Antworten verwerfen.

---

## 3. Auth-Flow

- **better-auth** (E-Mail + Passwort, Drizzle-Adapter, Tabellen in `schema/auth.ts`). Endpunkte unter
  `/api/auth/[...all]`.
- `src/proxy.ts` (früher `middleware.ts`) macht nur einen **optimistischen** Redirect anhand des Session-Cookies.
  Die echte Prüfung passiert serverseitig.
- Vertrag in `src/server/auth/context.ts`:
  - `getCurrentUser(): Promise<SessionUser | null>`: kein Redirect.
  - `requireUser(): Promise<SessionUser>`: leitet ausgeloggt auf `/login` um.
  - `getServiceContext(): Promise<ServiceContext>`: `{ db, userId, timezone }` für den eingeloggten Nutzer, sonst Redirect.
- Reihenfolge in `getServiceContext`: **erst Header/Cookies lesen, dann `getDb()`**. Dadurch ist die Route
  dynamisch und wird nie beim Build prerendert (Auth-Fix).
- Env: `BETTER_AUTH_SECRET` (≥ 32 Zeichen, in Produktion Pflicht), `BETTER_AUTH_URL` (optional; leer lassen
  in Dev), `BETTER_AUTH_TRUSTED_ORIGINS` (Komma-Liste). Validiert in `@/lib/env` (§6).

---

## 4. Fehlerbehandlung

Services werfen `AppError` (`@/lib/errors`); Factories: `notFound(what)`, `forbidden()`, `unauthorized()`,
`conflict(msg?)`, `validationError(fieldErrors, msg?)`, `rateLimited()`, `externalError(msg?)`.
Die `message` ist **deutsch, freundlich, ohne Schuldzuweisung** und wird 1:1 angezeigt.

| Code | HTTP | Typischer Auslöser | UI-Verhalten |
|---|---|---|---|
| `VALIDATION` | 400 | Zod, `validationError()`, SQLSTATE 23503/22P02 | `fieldErrors` inline am Feld; Toast nur ohne fieldErrors |
| `UNAUTHORIZED` | 401 | keine Session in Route Handlern | Redirect `/login` (in Pages macht das `getServiceContext`) |
| `FORBIDDEN` | 403 | fremde Ressource | Toast; Ressource ausblenden |
| `NOT_FOUND` | 404 | ID unbekannt oder gehört anderem Nutzer | Toast bzw. `notFound()` in Pages |
| `CONFLICT` | 409 | Duplikat, SQLSTATE 23505 | Toast mit Hinweis |
| `RATE_LIMITED` | 429 | externe Provider / eigene Limits | Toast „bitte kurz warten“, `Retry-After` |
| `EXTERNAL` | 502 | OFF/USDA down/Timeout | Lokale Ergebnisse trotzdem zeigen, dezenter Hinweis |
| `INTERNAL` | 500 | alles Unerwartete (wird geloggt) | Generischer Toast „Etwas ist schiefgelaufen…“ |

Mapping-Bausteine (`@/lib/result`):

- `runAction(fn)`: Server-Action-Wrapper, gibt **nie** einen Fehler weiter, außer Next-Control-Flow
  (`redirect`, `notFound`, dynamische APIs). Die werden per `unstable_rethrow` + Digest-Check weitergereicht.
- `toErrorResult(err)`: `AppError` → Code; `ZodError` → `VALIDATION` + `fieldErrors` (`"servings.0.label"`,
  pfadlose Issues unter `"_"`); Postgres-SQLSTATE 23505 → `CONFLICT`, 23503/22P02 → `VALIDATION`
  (auch in Drizzles `cause`-Kette); sonst `INTERNAL` + `logger.error`.
- `toErrorResponse(err)` für Route Handler · `fail(code, msg, fieldErrors?)` · `unwrap(result)` · `ok(data)`.
- Unerwartete Render-Fehler landen in `error.tsx`. Pages rufen bei fehlenden Ressourcen `notFound()`.

**Wichtig:** Kein `try/catch` um `redirect()`. Wer Fehler selbst fängt, ruft zuerst
`if (isNextControlFlowError(err)) throw err;` auf.

---

## 5. State-Management

| Zustand | Wo | Wie |
|---|---|---|
| Server-State (Tagebuch, Ziele, Profile, Gewicht …) | Server Components | Lesen via Services, Aktualisierung via `revalidatePath()` nach Actions. **Kein** Client-Cache (SWR/React Query) nötig |
| Formular-State | Client | React Hook Form + `zodResolver` (gleiches Schema wie die Action, geteilt aus `schemas.ts` der Feature-Route) |
| Optimistische Updates | Client | `useOptimistic` für Loggen/Löschen/Wasser-+1; Rollback automatisch bei Fehler, Toast via `useAction` |
| Lokaler UI-State | Client | `useState`/`useReducer` (Sheets, Tabs, Stepper) |
| URL-State | URL | Datum, Mahlzeit, Filter als Search-Params (`/log?date=&meal=`), damit teilbar und mit Zurück-Button nutzbar |
| Suchergebnisse | Client | Kleiner In-Memory-LRU pro Session (Query → Ergebnisse), invalidiert bei Log-Aktion |
| Theme | `next-themes` | Design System |

**Kein globaler Store** (Redux/Zustand), außer er ist gut begründet.
Zwischen Geschwister-Komponenten: State anheben oder React Context im Feature-Ordner.

---

## 6. Konfiguration: `@/lib/env`

```ts
import { env } from "@/lib/env";      // lazy Proxy, parst beim ersten Zugriff
env.FOOD_EXTERNAL_PROVIDERS_ENABLED  // boolean
env.dbDriver                          // "pglite" | "postgres"
```

| Variable | Typ / Default | Hinweis |
|---|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` | von Next/Vitest gesetzt |
| `DATABASE_URL` | `postgres://…` optional | leer → PGlite |
| `PGLITE_DATA_DIR` | `./.data/pglite` | `memory://` für In-Memory |
| `DB_POOL_MAX` | `10` | nur node-postgres |
| `BETTER_AUTH_SECRET` | Pflicht in Prod (≥ 32), sonst Dev-Fallback | Alias `AUTH_SECRET`; `env.authSecretIsPlaceholder` erkennt Platzhalter |
| `BETTER_AUTH_URL` | URL, optional | Dev: leer lassen |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Komma-Liste → `string[]` | Wildcards wie `http://localhost:*` ok |
| `USDA_API_KEY` | `DEMO_KEY` | |
| `OFF_USER_AGENT` | `NutritionApp/0.1 (dev@example.com)` | |
| `FOOD_EXTERNAL_PROVIDERS_ENABLED` | bool, `true` | akzeptiert true/false/1/0/yes/no/on/off |
| `LOG_LEVEL` | `debug`/`info`/`warn`/`error`/`silent` | Default: dev debug, prod info, test warn |

- **Lazy:** Importieren wirft nie. Deshalb läuft `next build` ohne Secrets, und während
  `NEXT_PHASE=phase-production-build` ist das Secret nicht Pflicht.
- Leere Strings (`DATABASE_URL=` in `.env`) gelten als nicht gesetzt.
- Ungültige Konfiguration → `EnvError` mit **allen** Problemen auf einmal.
- Tests: `parseEnv({...})` (rein) oder `vi.stubEnv()` + `resetEnvCache()`.
- Neue Variable = Schema in `src/lib/env.ts` + `.env.example` + diese Tabelle.

---

## 7. Caching-Strategie

Übernommen aus ARCHITECTURE §7, konkretisiert:

| Ebene | Mechanismus | Regel |
|---|---|---|
| Seiten | dynamisch, **kein** `cacheComponents` | Nach jeder Mutation `revalidatePath()` für **alle** betroffenen Routen (z. B. `/today` + `/diary/[date]` + `/progress`) |
| Route Handler | nicht gecacht (Default in Next 16 ohne cacheComponents) | `export const dynamic = "force-dynamic"` nur für Health-Checks o. ä. nötig; `Cache-Control: no-store` bei nutzerspezifischen Antworten |
| Externe Foods | `foods`-Tabelle (Cache = Persistenz) | `fetched_at` + 30 Tage Refresh-TTL |
| Externe Suchanfragen / Barcodes | `external_lookup_cache` | Suche 7 Tage; Barcode positiv 30 Tage, negativ 1 Tag |
| Tagesaggregate | keiner | indexierte `SUM … GROUP BY` (< 5 ms) |
| Client-Suche | In-Memory-LRU | Session-lokal |
| Statische Assets | Next-Default (immutable, gehasht) | – |

`fetch()` zu externen Providern immer mit Timeout (`AbortSignal.timeout(ms)`) und explizitem `cache: "no-store"`.
Gecacht wird in der DB, nicht im Next-Fetch-Cache.

---

## 8. Datenbank im Next.js-Runtime (PGlite) – Fallstricke

Empirisch verifiziert mit Next 16.3.6 (Turbopack) und `@electric-sql/pglite` 0.5.8, in `pnpm dev` **und**
`pnpm build && pnpm start`, per `curl /api/health`:

| # | Problem | Lösung (umgesetzt) |
|---|---|---|
| 1 | Turbopack **bündelt** PGlite: ~18 MB WASM/Daten landen in `.next/server`, und die Extension-Tarballs (`pg_trgm`, `unaccent`) werden über `new URL(…, import.meta.url)` aufgelöst. In Dev führt das zu „Extension bundle not found“, in Prod zeigen sie zurück in `node_modules` | `serverExternalPackages: ["@electric-sql/pglite", "pg"]` in `next.config.ts` → natives `require`, identisch in Dev/Build/Scripts/Tests. `.next/server` schrumpft von 24 MB auf 5,7 MB |
| 2 | Frischer Checkout ohne `.data/` → `ENOENT mkdir .data/pglite` (PGlite legt nur das letzte Verzeichnis an) | `createDatabase` legt das Elternverzeichnis rekursiv an |
| 3 | Ein fehlgeschlagener `getDb()`-Promise blieb im Singleton → jede weitere Anfrage schlug fehl, bis zum Neustart (auch über HMR hinweg) | Fehlgeschlagene Promises werden nicht gecacht; nächster Aufruf versucht es erneut |
| 4 | **PGlite sperrt sein Datenverzeichnis nicht.** Ein zweiter Prozess (`db:seed` während `pnpm dev`, `next start` parallel zu `next dev`) öffnet es klaglos, und danach ist das Verzeichnis **korrupt** (`RuntimeError: Aborted()` beim nächsten Öffnen) | Advisory PID-Lock `<dataDir>.lock` in `createDatabase`. Zweiter Prozess bekommt sofort `DataDirLockedError` („in use by process 1234 … stop the other process“). Verwaiste Locks (SIGKILL) werden übernommen, Freigabe beim Prozessende |
| 5 | HMR wertet Module neu aus → neue PGlite-Instanz auf demselben Verzeichnis | Singleton auf `globalThis` (`getDb`). Verifiziert: 5 HMR-Edits (Route, create, client, env) → genau **ein** „pglite ready“ |
| 6 | `next build` darf die DB nicht öffnen: mehrere Build-Worker = mehrere Prozesse = Korruption | Aller DB-Zugriff ist lazy. Verifiziert: Build mit frischem `PGLITE_DATA_DIR` legt kein Verzeichnis an. **Nie** `await getDb()` auf Modulebene, und DB-lesende Seiten müssen dynamisch sein (§2.1) |
| 7 | Tracing-Warnung „Dynamic filesystem access causes tracing of the whole project“ | `/*turbopackIgnore: true*/` an den dynamischen Pfaden. Der Migrationsordner ist statisch (`path.join(process.cwd(), "drizzle")`) und wird mitgetraced |

Arbeitsregeln:

- **Ein Prozess pro Datenverzeichnis:** Dev-Server stoppen vor `pnpm db:migrate|db:seed|db:reset` und vor `pnpm start`.
  Der Lock meldet Verstöße, verhindert aber keine Korruption, wenn jemand das `.lock` löscht.
- Korruptes Verzeichnis: `pnpm db:reset` (löscht `.data/pglite`, migriert, seedet neu).
- Ein Crash (SIGKILL) nach einem Commit ist unkritisch. Verifiziert: Daten bleiben erhalten (Postgres-WAL).
- Parallele Worktrees haben je eigenes `.data/`. Tests nutzen `memory://` und sind unabhängig vom Dev-Server.
- Migrationen laufen beim ersten `getDb()` automatisch (`migrate: true`). Kaltstart ~0,9–1,3 s, danach ~0,5 ms/Query.
- Produktion: `DATABASE_URL=postgres://…` → node-postgres-Pool, gleiche Migrationen und Queries.
- `GET /api/health` → `200 { ok: true, db: "pglite" | "postgres", latencyMs }` bzw. `503 { ok: false, db, error }`.

---

## 9. Logging: `@/lib/logger`

```ts
import { logger } from "@/lib/logger";
const log = logger.child({ scope: "food-search" });
log.info("external lookup", { provider: "off", q, ms });
log.error("provider failed", { err });           // Error wird inkl. code/cause/stack serialisiert
```

- Prod: eine JSON-Zeile pro Eintrag (`{"time","level","msg","scope",…}`). Dev: `12:00:01.123 INFO  [scope] msg k=v`.
- Level über `LOG_LEVEL`. **Keine** personenbezogenen Daten loggen (E-Mail, Gewicht, Mahlzeiten-Inhalte);
  IDs sind ok.
- Nicht `console.log` im App-Code (nur in `scripts/**`).

---

## 10. Formatierung: `@/lib/format`

| Funktion | Beispiel |
|---|---|
| `formatNumber(n, { maxFractionDigits, minFractionDigits, signed })` | `1620` → `1.620` |
| `formatKcal(n)` / `formatSignedKcal(n)` | `1.620 kcal` / `−400 kcal`, `+250 kcal` |
| `formatGrams(n)` | `142 g`, `2,5 g` (eine Nachkommastelle unter 10) |
| `formatMg(n)` | `0,25 mg`, `2,5 mg`, `140 mg` |
| `formatMl(n)` / `formatLiters(ml)` | `1.500 ml` / `1,5 l` |
| `formatWeightKg(n, { signed })` | `82,4 kg`, `82,0 kg`, `−0,4 kg` |
| `formatPercent(ratio)` | `0.25` → `25 %` (**Ratio**, nicht Prozentwert) |
| `formatRelativeDay(iso, today)` | `Heute`, `Gestern`, `Morgen`, `Mo., 22. Sep.` (+ Jahr, falls anders) |
| `formatDateLong(iso, { weekday })` | `Dienstag, 22. September 2026` |
| `formatDateShort(iso, { withYear })` / `formatWeekdayShort(iso)` | `22. Sep.` / `Di.` |
| `parseDecimalInput(str)` | `"1,5"` → `1.5`, `"1.250,5"` → `1250.5`, ungültig → `null` |

- Zahl und Einheit sind mit **geschütztem Leerzeichen** (`NBSP`, U+00A0) verbunden, Minus ist U+2212.
  In Unit-Tests `NBSP`/`MINUS` importieren. Testing Library und Playwright normalisieren Whitespace ohnehin.
- `null`/`NaN` → `–`. Kein `-0`.
- Datumsnamen kommen aus festen Tabellen statt aus `Intl`, damit Server-ICU und Browser-ICU gleich rendern
  (sonst Hydration-Mismatch „Sep.“ vs. „Sept.“).
- Nur für die Anzeige runden. Formatierte Werte nie weiterrechnen.

---

## 11. Performance-Budgets

| Metrik | Budget | Messung |
|---|---|---|
| TTFB dynamische Seite (lokal, warm) | < 200 ms | `next start`, `curl -w "%{time_starttransfer}"` |
| LCP mobil (Moto G Power, 4G) | < 2,5 s | Lighthouse |
| INP | < 200 ms | Lighthouse / Web Vitals |
| CLS | < 0,1 | Skeletons mit fixen Höhen |
| Lokale Food-Suche p95 (Server, lokal) | **< 150 ms** | Log `ms` im Route Handler, Test mit Seed-Daten |
| Barcode lokal (Cache-Hit) | < 50 ms | |
| Externer Lookup (OFF/USDA) | Timeout 3–5 s, nie blockierend für lokale Treffer | |
| Server Action „Eintrag loggen“ inkl. Revalidate | < 300 ms | |
| Tagesaggregat-Query | < 5 ms | `EXPLAIN ANALYZE`, Index `(user_id, date)` |
| Client-JS pro Route (gzip) | < 180 KB First Load | `next build` Ausgabe |
| DB-Kaltstart PGlite (inkl. Migrationen) | < 1,5 s (einmalig pro Prozess) | `pglite ready ms=` im Log |

Richtlinien: Server Components als Default und `"use client"` so tief wie möglich. Recharts und der Scanner
laden per `next/dynamic` nach. Queries mit `Promise.all` parallel, N+1 vermeiden (Relationen/Joins), Listen paginieren.

---

## 12. Teststrategie

| Ebene | Werkzeug | Ort | Was |
|---|---|---|---|
| Domain-Unit | Vitest (node) | `src/domain/**/*.test.ts` | Reine Logik, Randfälle, table-driven (`it.each`), hohe Abdeckung |
| Lib-Unit | Vitest | `src/lib/*.test.ts` | Formatierung, Result-Mapping, Env |
| Service-Integration | Vitest + `createTestDb()` (In-Memory-PGlite, ~1 s) | `src/server/services/**/*.test.ts` | Echte SQL inkl. `pg_trgm`/`unaccent`; `createTestUser(db)` pro Szenario → isoliert ohne Truncate |
| Actions | Vitest | neben der Action | Nur, wenn Logik über „parse → service → revalidate“ hinausgeht. `vi.mock("next/cache")` und `vi.mock("@/server/auth/context")` |
| Komponenten | Vitest + Testing Library (`// @vitest-environment jsdom`) | neben der Komponente | Verhalten und a11y-Rollen (`getByRole`), keine Snapshots |
| Hooks | `renderHook` (jsdom) | `src/lib/use-action.test.tsx` als Vorlage | |
| E2E | Playwright | `e2e/**` | Kritische Flows: Signup → Onboarding → Loggen → Tagebuch; mobil 375 px |

Regeln: `createTestDb()` einmal pro Datei in `beforeAll`. Keine Netzwerkaufrufe in Tests (Provider mit
Fixtures/`vi.fn()`). Keine Zeitabhängigkeit, `today` wird übergeben. Jeder Bugfix bekommt einen Regressionstest.

---

## 13. Referenzimplementierung (Copy-Paste-Vorlage)

> **Nur Beispiel.** Es zeigt das Muster an einem kleinen, realen Fall („Mahlzeit umbenennen“) mit der echten
> `meals`-Tabelle. Die tatsächliche Implementierung gehört Settings/17. **Nicht** unter diesen Pfaden anlegen,
> wenn ihr nicht Owner seid.

### 13.1 Schema (geteilt Client + Server): `src/app/(app)/settings/meals/schemas.ts`

```ts
import { z } from "zod";
import type { RenameMealInput } from "@/server/services/meals/rename"; // Typ-Import: erlaubt, zur Laufzeit weg

export const RenameMealSchema = z.object({
  mealId: z.uuid("Ungültige Mahlzeit."),
  name: z.string().trim().min(1, "Bitte gib einen Namen ein.").max(40, "Maximal 40 Zeichen."),
}) satisfies z.ZodType<RenameMealInput>;
```

Abhängigkeitsrichtung: `app` → `server` → `domain`. Der Service definiert seinen Input-Typ selbst und importiert
nie aus `@/app`. Das Schema lebt bei der Route, weil Form und Action es teilen.

### 13.2 Service: `src/server/services/meals/rename.ts`

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import type { ServiceContext } from "@/server/context";
import { meals } from "@/server/db/schema";
import { conflict, notFound } from "@/lib/errors";

export interface RenameMealInput {
  mealId: string;
  name: string;
}

export async function renameMeal(ctx: ServiceContext, input: RenameMealInput) {
  const existing = await ctx.db.query.meals.findMany({
    where: (m, { eq, and }) => and(eq(m.userId, ctx.userId), eq(m.isArchived, false)),
    columns: { id: true, name: true },
  });
  if (!existing.some((m) => m.id === input.mealId)) throw notFound("Mahlzeit"); // auch: gehört anderem Nutzer
  if (existing.some((m) => m.id !== input.mealId && m.name.toLowerCase() === input.name.toLowerCase())) {
    throw conflict("Eine Mahlzeit mit diesem Namen gibt es schon.");
  }
  const [row] = await ctx.db
    .update(meals)
    .set({ name: input.name })
    .where(and(eq(meals.id, input.mealId), eq(meals.userId, ctx.userId))) // immer nach userId scopen
    .returning({ id: meals.id, name: meals.name });
  return row;
}
```

### 13.3 Server Action: `src/app/(app)/settings/meals/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/result";
import { getServiceContext } from "@/server/auth/context";
import { renameMeal } from "@/server/services/meals/rename";
import { RenameMealSchema } from "./schemas";

export async function renameMealAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = RenameMealSchema.parse(input);      // → VALIDATION + fieldErrors
    const ctx = await getServiceContext();           // ausgeloggt → redirect("/login") (propagiert)
    const meal = await renameMeal(ctx, data);        // AppError → code + deutsche Meldung
    revalidatePath("/settings/meals");
    revalidatePath("/today");
    revalidatePath("/diary", "layout");              // alle Tagebuch-Tage zeigen den neuen Namen
    return { id: meal.id };
  });
}
```

### 13.4 Client Component: `src/components/settings/rename-meal-form.tsx`

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "@/lib/use-action";
import { renameMealAction } from "@/app/(app)/settings/meals/actions";
import { RenameMealSchema } from "@/app/(app)/settings/meals/schemas";
import type { RenameMealInput } from "@/server/services/meals/rename";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RenameMealForm({ mealId, name }: { mealId: string; name: string }) {
  const form = useForm<RenameMealInput>({ resolver: zodResolver(RenameMealSchema), defaultValues: { mealId, name } });
  const { execute, isPending, fieldErrors } = useAction(renameMealAction, { successMessage: "Gespeichert" });
  const nameError = form.formState.errors.name?.message ?? fieldErrors.name?.[0];

  return (
    <form onSubmit={form.handleSubmit((values) => execute(values))} className="flex flex-col gap-3">
      <label htmlFor="meal-name" className="text-sm font-medium">Name</label>
      <Input id="meal-name" {...form.register("name")} aria-invalid={!!nameError}
             aria-describedby={nameError ? "meal-name-error" : undefined} />
      {nameError && <p id="meal-name-error" className="text-sm text-destructive">{nameError}</p>}
      <Button type="submit" disabled={isPending} className="min-h-11">
        {isPending ? "Speichern …" : "Speichern"}
      </Button>
    </form>
  );
}
```

Optimistisch (z. B. Loggen/Löschen in Listen):

```tsx
const [optimisticEntries, removeOptimistic] = useOptimistic(entries, (list, id: string) => list.filter((e) => e.id !== id));
const { execute } = useAction(deleteEntryAction);
const onDelete = (id: string) => startTransition(async () => { removeOptimistic(id); await execute({ id }); });
// Bei Fehler rendert React wieder die Server-Liste (Rollback), useAction zeigt den Toast.
```

### 13.5 Service-Test: `src/server/services/meals/rename.test.ts`

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, createTestUser } from "@/test/db";
import type { Db } from "@/server/db/create";
import { AppError } from "@/lib/errors";
import { renameMeal } from "./rename";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

describe("renameMeal", () => {
  it("renames the user's meal", async () => {
    const ctx = await createTestUser(db);
    const row = await renameMeal(ctx, { mealId: ctx.mealIds.snacks, name: "Zwischendurch" });
    expect(row.name).toBe("Zwischendurch");
  });

  it("rejects duplicates (case-insensitive)", async () => {
    const ctx = await createTestUser(db);
    await expect(renameMeal(ctx, { mealId: ctx.mealIds.snacks, name: "frühstück" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("cannot touch another user's meal", async () => {
    const alice = await createTestUser(db);
    const bob = await createTestUser(db);
    await expect(renameMeal(bob, { mealId: alice.mealIds.lunch, name: "Hack" })).rejects.toBeInstanceOf(AppError);
  });
});
```

### 13.6 Route Handler (nur für Client-Fetch): `src/app/api/<x>/route.ts`

```ts
import { z } from "zod";
import { toErrorResponse } from "@/lib/result";
import { getServiceContext } from "@/server/auth/context";

const Query = z.object({ q: z.string().trim().min(1).max(100), limit: z.coerce.number().int().min(1).max(50).default(20) });

export async function GET(request: Request) {
  try {
    const params = Query.parse(Object.fromEntries(new URL(request.url).searchParams));
    const ctx = await getServiceContext();
    const results = await someService(ctx, params);
    return Response.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return toErrorResponse(err); // 400/404/409/429/500 + { error: { code, message } }
  }
}
```

---

## 14. Tooling

- **ESLint** (`eslint.config.mjs`): Next Core Web Vitals + TypeScript + Schichtregeln aus §1
  (`@typescript-eslint/no-restricted-imports`, Typ-Importe erlaubt, Tests ausgenommen).
- **Prettier** (`.prettierrc.json`): `printWidth 110`, doppelte Anführungszeichen, `trailingComma: "all"`,
  `prettier-plugin-tailwindcss` (Klassen-Sortierung, `cn`/`cva` erkannt). **Nur eigene Dateien formatieren**
  (`pnpm exec prettier --write <dateien>`). Ein repo-weites `pnpm format` erfolgt nach dem letzten Merge,
  sonst gibt es Konflikte zwischen den Worktrees.
- **Quality Gate:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (= `pnpm check`).

## 15. Checkliste für neue Features

- [ ] Reine Logik in `src/domain/<d>/` mit Unit-Tests
- [ ] Service `fn(ctx, input)` mit `ctx.userId`-Scope, `AppError` für erwartete Fehler, Integrationstest mit `createTestDb`
- [ ] Zod-Schema geteilt zwischen Form und Action
- [ ] Action mit `runAction` und `revalidatePath` für **alle** betroffenen Routen
- [ ] UI mit `useAction`, `fieldErrors` inline, `isPending` am Button, `useOptimistic` wo es sich lohnt
- [ ] Anzeige nur über `@/lib/format`, Texte deutsch und freundlich
- [ ] Leere Zustände statt Fake-Daten; Lade-Zustände via `loading.tsx`/Suspense-Skeletons
- [ ] Keine `console.log`, keine Env-Zugriffe außer über `env`
