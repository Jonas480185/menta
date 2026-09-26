# Food-Daten: Quellen, Import-Pipeline, Qualität

> Owner: Food Data Import (Food Data Sources & Import) · Stand: 2026-09-26
> Code: `src/domain/food/**` (Barcode, Einheiten, Validierung, Refresh), `src/server/food/{providers,normalize,import}/**`,
> `src/server/food/persist.ts`, `scripts/food/**`, Daten: `data/curated/`, `data/seed/`.

## 1. Kurzfassung

Menta nutzt eine **hybride, lokal-zuerst** Lebensmitteldatenbank:

1. **Lokale Postgres-Tabelle `foods`** ist die einzige Quelle, aus der Suche und Tagebuch lesen.
2. Sie wird aus einem **committeten Offline-Snapshot** (`data/seed/*.jsonl.gz`, 17 986 Lebensmittel, 1,55 MiB) befüllt:
   446 **kuratierte deutsche Basis-Lebensmittel** (deutsche Namen + typische Portionen, Nährwerte aus USDA),
   8 229 **USDA**-Lebensmittel (Foundation + SR Legacy, inkl. Mikronährstoffe) und 9 311 der **meistgescannten
   Open-Food-Facts-Produkte in Deutschland** (mit Barcode).
3. **Live-Provider** (OFF Produkt-API für Barcodes, OFF search-a-licious für Suche, USDA-API) füllen Lücken zur
   Laufzeit; jedes Ergebnis wird normalisiert, validiert und in `foods` persistiert → beim nächsten Mal lokal.

Warum: schnelle, offline-fähige Suche (keine externe Latenz im Normalfall), deutsche Namen für Grundnahrungsmittel,
Barcodes für Markenprodukte, Mikronährstoffe für generische Lebensmittel, keine Kosten und saubere Lizenzen.

## 2. Evaluierte Quellen

| Quelle | Inhalt | Warum (nicht) |
|---|---|---|
| **Open Food Facts (OFF)** | Crowd-sourced Markenprodukte weltweit, stark in DE/FR; Barcode, Nährwerttabelle (EU-Label), Bilder, Nutri-Score | **Ja** – beste freie Barcode-Abdeckung für DE. Qualität schwankt → Validierung + Flags. |
| **USDA Foundation Foods** | ~470 analytisch gemessene Grundnahrungsmittel, sehr detaillierte Nährstoffe, halbjährliche Releases | **Ja** – höchste Qualität. |
| **USDA SR Legacy** | 7 793 generische Lebensmittel (Stand 2018, eingefroren), Mikronährstoffe, Portionsgrößen | **Ja** – breite generische Abdeckung, Basis für kuratierte DE-Liste. |
| **USDA FNDDS** (Survey) | ~5 000 „wie gegessen“-Lebensmittel/Gerichte der US-Ernährungserhebung | Später – US-Gerichte, wenig DE-Relevanz; Rezepte decken Gerichte besser ab. |
| **USDA Branded** | ~450 k US-Markenprodukte mit GTIN, Label-Daten | **Nein** im Seed – US-Marken, kaum DE-Treffer, groß (GBs). Über die USDA-API als Fallback erreichbar. |
| **BLS** (Bundeslebensmittelschlüssel, Max Rubner-Institut) | Deutsche Referenzdatenbank für generische Lebensmittel und Gerichte | **Noch nicht** – fachlich ideal für DE; Lizenz war historisch kostenpflichtig/restriktiv für App-Weitergabe. Aktuellen Lizenzstatus (BLS 4.x) prüfen → siehe §11. |
| **Kommerzielle APIs** (Nutritionix, Edamam, FatSecret, Spoonacular …) | Gepflegte Datenbanken, teils NLP-Parsing | **Nein** – laufende Kosten pro Request/Nutzer, ToS beschränken typischerweise dauerhaftes Speichern/Caching (widerspricht lokal-zuerst + Tagebuch-Snapshots), DE-Markenabdeckung nicht besser als OFF, Vendor-Lock-in. |

### Kriterien

| Kriterium | OFF | USDA Foundation / SR Legacy | USDA Branded | BLS | Kommerziell |
|---|---|---|---|---|---|
| Datenqualität | mittel (crowd-sourced, ~2 % geflaggt in unserem Sample) | sehr hoch (Labor) | mittel (Label) | sehr hoch | hoch |
| Abdeckung DE/EU | sehr gut (Hunderttausende DE-Produkte) | generisch, keine Marken | schwach (US) | sehr gut (generisch) | mittel |
| Barcodes | Kernstärke (EAN-13/8) | – | UPC/GTIN (US) | – | teils |
| Makros | ja (pro 100 g/ml) | ja | ja | ja | ja |
| Mikronährstoffe | lückenhaft | sehr gut (Vitamine, Mineralstoffe) | wenige | sehr gut | teils |
| Sprache | mehrsprachig (`product_name_de`) | Englisch | Englisch | Deutsch | meist Englisch |
| Limits | API v2 Suche 10 req/min, **anonym nur Seiten 1–10 je Suche (Seite 11 → HTTP 401)**, `page_size=100` → häufig 503; Produkt ~100 req/min (wir: 15/min); search-a-licious ohne publiziertes Limit (wir: 30/min), max. 10 000 Treffer je Query; **Dumps frei** | Bulk-CSV frei; API 1 000 req/h je Key, `DEMO_KEY` real 10 req/h | wie USDA | Lizenz | bezahlte Kontingente |
| Geschwindigkeit | Produkt-API ~0,2–1 s; v2-Suche langsam, am 2026-09-26 >2 h durchgehend 503; search-a-licious ~0,3 s | Bulk lokal: 8 262 Datensätze in ~0,7 s geladen | – | – | schnell |
| Lizenz | **ODbL 1.0** (DB), DbCL (Inhalte), Bilder CC BY-SA 3.0 → Attribution + Share-Alike für abgeleitete DB | **CC0 / Public Domain** (Zitierung erbeten) | CC0 | historisch kostenpflichtig | proprietär |

## 3. Zielarchitektur

```
                    ┌──────────────── Offline (Build/Seed) ────────────────┐
data/curated/*.json ─┐                                                      │
data/raw/usda (CSV) ─┼─► map ─► prepare/validate ─► dedupe ─► snapshot ─────┼─► pnpm db:seed ─► foods
data/raw/off (JSON) ─┘                                   data/seed/*.jsonl.gz│        (upsert)
                    └──────────────────────────────────────────────────────┘
                    ┌──────────────── Online (Laufzeit) ─────────┐
Suche/Barcode ─► LocalFoodProvider (foods) ─► zu wenig Treffer? ─► OFF / USDA Provider
                    ─► map ─► prepare/validate ─► upsertNormalizedFoods ─► foods (nächstes Mal lokal)
                    └──────────────────────────────────────────────────────┘
```

- **Provider-Vertrag**: `FoodProvider` (`src/server/food/types.ts`) – `searchFoods`, `getFood`, `getFoodByBarcode`;
  App-Code sieht nur `NormalizedFood`, nie Roh-JSON. Implementierungen: `OpenFoodFactsProvider`, `UsdaProvider`,
  `LocalFoodProvider`.
- **HTTP**: `fetchJson` mit Timeout, Retries mit Backoff (429/5xx, `Retry-After`) und Token-Bucket je Endpoint
  (`RATE_LIMITS` in `providers/config.ts`). User-Agent aus `OFF_USER_AGENT` (OFF verlangt einen identifizierbaren UA).
- **Sprache**: kuratierte Einträge `language: "de"`, USDA `"en"`, OFF nach Produkt-`lang` (deutscher Name bevorzugt).

## 4. Pipeline-Stufen

Gemeinsam für CLIs, Seed, Snapshot und Live-Persistenz (`src/server/food/import/pipeline.ts` → `persist.ts`).
Jede Stufe wird gezählt (`parsed · skipped · invalid · flagged · duplicates · inserted · updated · archived · kept-newer`).

| Stufe | Was passiert | Code |
|---|---|---|
| 1. Lesen | USDA-CSV (Streaming-Parser, Zip-Entpacker), OFF-API-Seiten (gecacht in `data/raw/off`), OFF-JSONL-Dump (gzip-Stream), kuratierte JSON | `import/usda-bulk.ts`, `import/off-api.ts`, `import/off-dump.ts`, `import/curated.ts` |
| 2. Mapping | Provider-JSON → `NormalizedFood`: Nährstoffe pro 100 g/ml (kJ→kcal, Natrium↔Salz), Portionen mit deutschen Labels („1 Scheibe (30 g)“), Mengenangaben parsen. **Skip** ohne Name / ohne Nährwerte / ungültiger Barcode | `normalize/off.ts`, `normalize/usda.ts`, `domain/food/units.ts` |
| 3. Prepare | GTIN kanonisieren (EAN-13), Whitespace, Portionen säubern (immer 100 g/ml-Basis, genau ein Default), **Validierung** → harte Fehler verwerfen, weiche Befunde als `qualityFlags` | `normalize/prepare.ts`, `domain/food/validation.ts` |
| 4. Dedupe | im Batch nach Schlüssel und Barcode, gegen DB nach Barcode (siehe §6) | `dedupePrepared`, `persist.ts` |
| 5. Upsert | Marken, `foods` (Upsert auf `(source, source_id)`, ≤ 800 Zeilen/Statement), Portionen-Sync | `persist.ts` |

### Validierung (`VALIDATION_LIMITS`)

Harte Fehler (Datensatz wird verworfen): kein Name, keine `sourceId`, nicht-numerische/negative Werte,
> 900 kcal/100 (+1 % Rundung), Protein+KH+Fett > 102 g/100 g (150 g/100 ml für Sirupe), Natrium > 40 g/100 g,
keine Nährwerte, ungültige Portionsgrammatur.

Weiche Flags (gespeichert, beeinflussen `dataQuality`):

| Flag | Regel | Qualität |
|---|---|---|
| `energy_mismatch` | kcal weicht > max(20 kcal, 20 %) von 4/4/9 (+7 Alkohol) ab; Ballaststoffe mit 0/2/4 kcal probiert (EU- vs. US-KH-Definition) | `suspect` (bei `trusted`/kuratiert nur informativ – USDA nutzt lebensmittelspezifische Atwater-Faktoren, z. B. Kleie, Kakaopulver) |
| `sugar_exceeds_carbs`, `saturated_fat_exceeds_fat` | Teilmenge > Obermenge (+0,5 g / 2 %) | `suspect` |
| `missing_kcal/protein/carbs/fat` | Kernwert fehlt | `partial` |
| `energy_derived`, `salt_derived`, `sodium_derived`, `energy_from_kj`, `carbs_clamped` | abgeleitete Werte | informativ |

`dataQuality`: `verified` (kuratiert & sauber) > `complete` > `partial` > `suspect`. Suche soll `suspect` abwerten
und in der UI einen Hinweis zeigen.

### CLIs

```bash
pnpm exec tsx scripts/food/import-usda.ts    [--datasets=foundation,sr_legacy] [--dry-run]
pnpm exec tsx scripts/food/import-curated.ts [--dry-run]              # bricht ab, wenn eine fdcId fehlt
pnpm exec tsx scripts/food/import-off.ts     [--dry-run]              # aus Cache data/raw/off
pnpm exec tsx scripts/food/import-off.ts --fetch [--limit=8000]       # search-a-licious crawlen (30 req/min)
pnpm exec tsx scripts/food/import-off.ts --fetch=v2 [--limit=3000]    # API v2, nach Kategorien partitioniert
pnpm exec tsx scripts/food/import-off.ts --file=openfoodfacts-products.jsonl.gz [--country=en:germany|all]
pnpm exec tsx scripts/food/build-seed-snapshot.ts [--off-limit=10000] [--off-dump=…]
pnpm exec tsx scripts/food/seed-foods.ts [--only=curated,usda,off]    # = Seed-Schritt „foods“
```

## 5. Kuratierte deutsche Basis-Lebensmittel

`data/curated/generic-foods.de.json` – 446 Einträge in 18 Kategorien (Obst, Gemüse, Kartoffeln, Brot & Backwaren,
Getreide/Nudeln/Reis, Milchprodukte inkl. Quark/Skyr/Joghurt, Käse, Eier, Fleisch, Wurst & Aufschnitt,
Fisch & Meeresfrüchte, Hülsenfrüchte & Soja, Nüsse & Samen, Öle & Fette, Getränke, Süßes & Snacks,
Saucen & Gewürze, Gerichte). Jeder Eintrag: stabile `id` (= `source_id`, nie ändern), `nameDe`, `category`,
`fdcId` (bestes USDA-SR-Legacy/Foundation-Match, `usdaDescription` zur Review), optional `basis: "ml"` +
`densityGPerMl` (Getränke, Milch), typische deutsche Portionen (erste = Default, 100 g/ml kommt automatisch dazu).

Nährwerte stehen **nicht** in der JSON, sondern werden beim Import aus den USDA-Daten aufgelöst (eine Wahrheit,
CC0; für `ml` × Dichte umgerechnet). Alle 446 fdcIds sind gegen die heruntergeladenen CSVs verifiziert
(`import-curated.ts` bricht sonst ab); alle Einträge landen als `verified`.
Grenzen: US-Referenzwerte (z. B. Milch 3,25 % statt 3,5 %, Quark ≈ Cottage Cheese nonfat), siehe §11 (BLS).

## 6. Dedupe-Regeln

1. **Identität** = `(source, source_id)` (partieller Unique-Index). Re-Importe sind Upserts.
2. **Im Batch**: gleicher Schlüssel → der „reichere“ Datensatz gewinnt; danach gleicher Barcode → dito.
3. **Gegen die DB, quellübergreifend nach Barcode** (OFF ↔ USDA Branded ↔ spätere Quellen): reicherer Datensatz bleibt
   aktiv, der andere wird **archiviert** (`is_archived = true`, nie gelöscht – Tagebucheinträge/Favoriten referenzieren ihn).
4. **Reichhaltigkeit** (`foodRichness`): Qualitätsrang × 100 + 20 für Deutsch + 2 je Nährstofffeld + Mikronährstoffe (≤ 10)
   + Portionen (≤ 5) + Marke 2 + Bild 2.
5. **Neuere Daten gewinnen**: Upsert überschreibt nur, wenn `fetched_at` der Zeile ≤ dem neuen Wert ist
   (Seed-Snapshot überschreibt nie einen später live aktualisierten Datensatz).
6. `popularity` sinkt nie (nutzungsbasierte Popularität bleibt erhalten).
7. **Portionen** werden per Label/Einheit+Gramm synchronisiert → IDs bleiben stabil (`food_usage.last_serving_id`,
   `meal_entries.serving_id`).
8. Kein unscharfes Namens-Dedupe zwischen Quellen (z. B. kuratiert „Banane“ ↔ USDA „Bananas, raw“) – das ist Ranking-
   Aufgabe der Suche: kuratierte deutsche Einträge vor USDA-Einträgen gleicher `fdcId` zeigen (§11).

## 7. Aktualisierung / TTL

`isFoodStale(source, fetchedAt)` in `src/domain/food/refresh.ts`:

| Quelle | TTL | Strategie |
|---|---|---|
| OFF | 30 Tage | lazy: beim Barcode-Scan/Detailaufruf veralteter Produkte im Hintergrund neu laden und upserten |
| USDA | – | statische Releases: Foundation-Release (halbjährlich) per `import-usda.ts` + Snapshot-Rebuild |
| kuratiert | – | versioniert im Repo, per Seed |
| user/recipe | – | gehören dem Nutzer, nie extern aktualisiert |

Tagebuchwerte sind Snapshots – Aktualisierungen ändern vergangene Einträge nie.

## 8. Attribution (Pflicht in der UI)

- Überall, wo Lebensmitteldaten angezeigt werden (Suche, Detailansicht, Impressum/Über-Seite):
  **„Daten: Open Food Facts (ODbL), USDA FoodData Central“**, verlinkt auf <https://world.openfoodfacts.org> und
  <https://fdc.nal.usda.gov>.
- Bei OFF-Produkten zusätzlich die Quelle am Produkt („Quelle: Open Food Facts“), Produktbilder sind CC BY-SA 3.0.
- **ODbL Share-Alike**: Veröffentlichen wir die abgeleitete Datenbank (z. B. Export/Download der `foods`-Tabelle),
  muss sie unter ODbL stehen. Die App-Nutzung selbst (Produced Work) erfordert nur die Attribution.
- USDA: Public Domain, Zitierung erbeten („U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.“).
- Details und Lizenztexte: `data/seed/README.md`.

## 9. Snapshot & Seed

| Datei | Lebensmittel | Größe |
|---|---:|---:|
| `foods-curated.de.jsonl.gz` | 446 | 55 KiB |
| `foods-usda.jsonl.gz` | 8 229 | 902 KiB |
| `foods-off.de.jsonl.gz` | 9 311 | 627 KiB |

Sortiert, gzip-9, `null`-Felder weggelassen → deterministische Rebuilds. `pnpm db:seed` auf frischem PGlite:
**17 986 eingefügt in 5,3 s** (Seed-Schritt 4,3 s); zweiter Lauf: **0 eingefügt, 17 986 aktualisiert, 4,1 s**,
Zeilen- und Portionenzahl (36 110) unverändert.

## 10. Skalierung auf den vollen OFF-Dump

- `import-off.ts --file=openfoodfacts-products.jsonl.gz` streamt den Dump (≈ 7 GB gzip, mehrere Mio. Produkte)
  zeilenweise mit konstantem Speicher; `--country=en:germany` filtert vor `JSON.parse` per Substring (der teure Teil
  ist Gunzip + Parse, ~10–20 min für den Weltdump auf einem Laptop). Chunks à 2 000, Transaktionen à 500 Foods.
- Gemessener Durchsatz der Upsert-Stufe auf PGlite: ~4 000 Foods/s (OFF 9 311 in 2,1 s) → DE-Teilmenge (Größenordnung
  einige 100 k Produkte) in wenigen Minuten; in Produktion gegen echtes Postgres (`DATABASE_URL`).
- Nicht in Git: der volle Import gehört in einen periodischen Job (z. B. wöchentlich Dump, täglich OFF-Delta-Exporte
  `static.openfoodfacts.org/data/delta/`), der Snapshot bleibt die kleine, schnelle Dev/CI-Basis (< 15 MB).
- Suche skaliert über die pg_trgm/FTS-Indizes aus `database.md`; Benchmark mit 1 Mio. Zeilen: `scripts/db/bench-search.ts`.
- Qualitätsschwelle für den Vollimport: nur Produkte mit Name + Kernnährwerten (Mapper skippt den Rest), `suspect`
  bleibt gespeichert aber abgewertet; optional nur Produkte mit `unique_scans_n > 0` oder `completeness > 0.5`.

## 11. Offene Punkte

- **BLS** prüfen: Lizenz BLS 4.x; wenn nutzbar, kuratierte Liste auf BLS-Nährwerte umstellen (deutsche Referenz statt US).
- Kuratiert ↔ USDA-Doppelungen im Ranking auflösen: USDA-Zeilen, deren fdcId kuratiert referenziert wird, abwerten.
- Popularitäts-Prior für kuratierte Einträge (derzeit 0) – z. B. aus Nutzungsdaten nach Launch.
- USDA FNDDS für typische Gerichte, falls Rezepte die Lücke nicht schließen.
- Live-Refresh-Job für veraltete OFF-Produkte (§7) implementieren (Food-Search/Barcode-Service).
