<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/menta-lockup-dark.svg">
  <img src="public/brand/menta-lockup-light.svg" alt="Menta" height="64">
</picture>

### Ernährung, Gewicht und Aktivität erfassen

Kalorien und Nährstoffe im Tagebuch festhalten.<br>
Ziele festlegen und Veränderungen über mehrere Wochen auswerten.

![Next.js](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_strict-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle_ORM-C5F74F?logo=drizzle&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
[![CI](https://github.com/Jonas480185/menta/actions/workflows/ci.yml/badge.svg)](https://github.com/Jonas480185/menta/actions/workflows/ci.yml)

[Lokal starten](#lokal-starten) · [Funktionen](#funktionen) · [Screenshots](#screenshots) · [Technischer Aufbau](#technischer-aufbau)

</div>

<br>

![Menta: Ernährungstagebuch und Auswertungen auf dem Smartphone](docs/media/hero.png)

## Überblick

Menta ist eine Web-App für ein Ernährungstagebuch. Lebensmittel lassen sich suchen, einer Mahlzeit zuordnen und mit der gegessenen Menge erfassen. Die App berechnet daraus Kalorien und Nährstoffe und zeigt sie zusammen mit den Tageszielen an. Zusätzlich können Gewicht, Wasser und Aktivitäten eingetragen werden.

Die Auswertungen zeigen die Entwicklung über mehrere Wochen oder Monate. Ein geglätteter Gewichtstrend hilft dabei, Veränderungen über längere Zeit zu erkennen. Die Oberfläche ist auf Deutsch und bietet Ansichten für Smartphone und Desktop sowie einen hellen und einen dunklen Modus.

**Die App lässt sich lokal mit Beispieldaten ausprobieren.** Eine eingebettete PostgreSQL-Datenbank speichert die Einträge; ein separater Datenbankserver ist für den lokalen Start nicht erforderlich.

## Funktionen

| Bereich | Funktionen |
| --- | --- |
| **Konto und Einrichtung** | Registrierung, Anmeldung und schrittweise Einrichtung von Körperdaten und Zielen |
| **Ernährungstagebuch** | Lebensmittel suchen, Mengen und Portionen erfassen, Mahlzeiten oder Tage kopieren und Einträge bearbeiten |
| **Lebensmittel und Rezepte** | Eigene Lebensmittel anlegen, Favoriten speichern und Nährwerte pro Rezeptportion berechnen |
| **Barcode** | Produkte per Kamera suchen; unbekannte Produkte manuell anlegen |
| **Ziele** | Kalorienziele berechnen oder manuell festlegen; Makros in Gramm oder Prozent einstellen und Ziele nach Wochentag wählen |
| **Gewicht und Aktivität** | Gewicht, Schritte, Aktivitäten und Wasser erfassen; den Gewichtstrend anzeigen |
| **Auswertungen** | Kalorien, Protein, erfasste Tage und Zielerreichung über Zeiträume von sieben Tagen bis zu einem Jahr anzeigen |
| **Milo** | Hinweise zu den erfassten Werten, Serien von erfassten Tagen und freigeschaltete Erfolge anzeigen |

Die lokale Lebensmitteldatenbank enthält rund 18.000 Einträge. Ergänzende Produktdaten und Barcodes können über Open Food Facts abgerufen werden. Zuletzt verwendete Lebensmittel, häufige Einträge und Favoriten erleichtern die erneute Auswahl.

## Screenshots

![Tagebuch, Suche, Portionseingabe, Auswertungen und Erfolge](docs/media/screens.png)

### Milo

<table>
<tr>
<td width="52%"><img src="docs/media/milo.gif" alt="Milo reagiert auf Tippen, Doppeltippen, Gedrückthalten und Ziehen"></td>
<td>

Milo ist das Maskottchen der App. Er zeigt kurze Hinweise an, zum Beispiel zu einem erreichten Proteinziel oder einer fehlenden Mahlzeit. Die Hinweise entstehen aus festen Regeln und den erfassten Daten.

Die Figur reagiert auf Tippen, Ziehen und Mausbewegungen. Sie lässt sich auch mit der Tastatur bedienen. Die Animationen berücksichtigen die Systemeinstellung für reduzierte Bewegung (`prefers-reduced-motion`).

</td>
</tr>
</table>

### Desktop

![Desktop-Ansicht im hellen und dunklen Modus](docs/media/desktop.png)

### Dunkler Modus

![Menta im dunklen Modus](docs/media/dark.png)

## Lokal starten

Empfohlen: **Node.js 24 und pnpm**. Die CI verwendet Node.js 24. Die pnpm-Version ist in `package.json` festgelegt.

```bash
git clone https://github.com/Jonas480185/menta.git
cd menta
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:seed
pnpm dev
```

Die App ist unter [localhost:3000](http://localhost:3000) erreichbar. `pnpm db:seed` führt die Migrationen aus und legt Lebensmittel sowie ein Demokonto mit drei Wochen Beispiel-Tagebuch an.

| Demo-Zugang | Wert |
| --- | --- |
| E-Mail | `demo@menta.app` |
| Passwort | `menta-demo-2026` |

Die Beispielkonfiguration reicht für den lokalen Start. PGlite speichert die Daten in `.data/pglite`; Einträge bleiben nach einem Neustart erhalten. Für eine gehostete Instanz wird PostgreSQL ab Version 14 mit den Erweiterungen `pg_trgm` und `unaccent` benötigt. Die Verbindung wird über `DATABASE_URL` oder den Fallback `POSTGRES_URL` eingerichtet.

| Befehl | Zweck |
| --- | --- |
| `pnpm dev` | Entwicklungsserver starten |
| `pnpm build` · `pnpm start` | Anwendung bauen und starten |
| `pnpm check` | Typprüfung, Lint, Vitest-Tests und Build ausführen |
| `pnpm test:e2e` | Playwright-Test gegen einen laufenden Server ausführen |
| `pnpm db:migrate` | Datenbankschema aktualisieren |
| `pnpm db:seed` | Lebensmittel und Beispieldaten anlegen |
| `pnpm db:reset` | Lokale PGlite-Daten löschen und die Datenbank neu anlegen |

<details>
<summary><b>Umgebungsvariablen</b></summary>

| Variable | Standardwert | Beschreibung |
|---|---|---|
| `DATABASE_URL` | leer | `postgres://…` für echtes PostgreSQL, leer = PGlite |
| `POSTGRES_URL` | leer | Fallback für `DATABASE_URL` (setzt die Supabase-Integration auf Vercel) |
| `DATABASE_SSL_CA` | leer | Root-Zertifikat des Postgres-Anbieters (PEM), aktiviert volle Zertifikatsprüfung, z. B. für Supabase |
| `PGLITE_DATA_DIR` | `./.data/pglite` | Datenverzeichnis für PGlite |
| `BETTER_AUTH_SECRET` | Dev-Fallback | **In Produktion Pflicht**, ≥ 32 Zeichen (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | leer | Öffentliche URL der App |
| `USDA_API_KEY` | `DEMO_KEY` | USDA FoodData Central |
| `OFF_USER_AGENT` | App-Name | User-Agent für Open Food Facts |
| `FOOD_EXTERNAL_PROVIDERS_ENABLED` | `true` | `false` deaktiviert externe Lebensmittelabfragen; die Suche nutzt dann nur die lokale Datenbank |

</details>

## Technischer Aufbau

| Bereich | Umsetzung |
| --- | --- |
| **Framework** | Next.js 16 App Router, React 19, TypeScript im Strict-Modus |
| **Datenbank** | PostgreSQL und Drizzle ORM; lokal PGlite |
| **Anmeldung** | better-auth mit E-Mail und Passwort |
| **Oberfläche** | Tailwind CSS 4, Radix, Motion, Recharts und Lucide |
| **Validierung** | Zod und Prüfbedingungen in der Datenbank |
| **Tests** | Vitest, Testing Library und Playwright |

### Architektur

```text
src/
  domain/       Berechnungen für Nährwerte, Kalorienziele, Makros und Gewichtstrends
  server/
    db/         Datenbankschema, Migrationen und Suchabfragen
    food/       Datenquellen, Normalisierung und Lebensmittelimport
    services/   Funktionen zum Lesen und Ändern der Daten eines Nutzers
  app/          Seiten, Server Components und Server Actions
  components/   Gemeinsame UI-Komponenten und Komponenten für einzelne Funktionen
```

- **Nährwerte im Tagebuch:** Ein Eintrag speichert die Nährwerte zum Zeitpunkt der Erfassung. Spätere Änderungen am Lebensmittel aktualisieren bestehende Tagebucheinträge nicht automatisch. Tagessummen werden aus den Einträgen berechnet.
- **Tagesziele:** Ziele vergangener Tage bleiben gespeichert. Eine spätere Änderung des aktuellen Ziels verändert dadurch nicht die bisherige Auswertung.
- **Lebensmitteldaten:** Open Food Facts liefert Markenprodukte und Barcodes, USDA FoodData Central generische Lebensmittel und Nährwerte. Hinzu kommen kuratierte deutsche Grundnahrungsmittel. Der Import vereinheitlicht die Daten, prüft Werte und behandelt doppelte Datensätze.
- **Suche:** PostgreSQL-Volltextsuche, Trigram- und Präfix-Indizes unterstützen die Suche nach Namen, Marken und ähnlichen Schreibweisen. Messungen mit synthetischen Daten bis zu einer Million Einträgen sind in der [Datenbankdokumentation](docs/architecture/database.md) beschrieben. Sie wurden lokal mit PGlite durchgeführt.
- **Datenintegrität:** Prüfbedingungen in der Datenbank begrenzen Mengen und Nährwerte auf zulässige Werte.
- **Bedienung:** Die Oberfläche verwendet beschriftete Datenanzeigen, sichtbare Fokuszustände und Tastenkürzel. Tests prüfen ausgewählte Farbkontraste und Komponenten; die Details und bekannten Einschränkungen stehen im [Design-System](docs/design/design-system.md).

Weitere Dokumentation: [Architektur](docs/ARCHITECTURE.md) · [Lebensmitteldaten](docs/architecture/food-data-strategy.md) · [Kalorienberechnung](docs/architecture/calorie-engine.md) · [Makroberechnung](docs/architecture/macro-engine.md) · [Marke](docs/brand/identity.md).

## Tests und Sicherheit

Die [GitHub-Actions-Pipeline](.github/workflows/ci.yml) führt Typprüfung, Lint, Vitest-Tests und einen Produktionsbuild aus. Die Tests prüfen Berechnungen, UI-Komponenten und Datenbankzugriffe mit temporären PGlite-Datenbanken.

Ein separater [Playwright-Test](e2e/core-flow.spec.ts) prüft Registrierung, Einrichtung, Lebensmittelsuche, Erfassung, Mengenänderung und Speicherung nach dem Neuladen. Er wird mit `pnpm test:e2e` ausgeführt und ist derzeit nicht Teil der CI.

Zugriffe auf persönliche Daten werden serverseitig anhand der Sitzung und des jeweiligen Nutzers geprüft. Eingaben werden validiert, SQL-Abfragen verwenden Parameter. better-auth übernimmt Passwort-Hashing, Sitzungscookies und Rate-Limiting. Das Löschen eines Kontos erfordert das Passwort.

Eine Content Security Policy mit einer Nonce pro Anfrage und weitere HTTP-Header beschränken unter anderem eingebettete Inhalte und Skripte. Hinweise zum vertraulichen Melden von Sicherheitslücken: [SECURITY.md](SECURITY.md).

## Projektstand

Passwort-Reset und E-Mail-Verifizierung sind noch nicht umgesetzt. Die Schnittstelle für externe Aktivitätsanbieter ist vorbereitet; eine Verbindung zu Wearables besteht derzeit nicht.

Der Kamera-Scan benötigt die Browserfunktion `BarcodeDetector`. Wenn sie nicht verfügbar ist, lässt sich der Barcode manuell eingeben. Die Kalorien- und Aktivitätsberechnungen liefern Schätzwerte; die verwendeten Formeln und Annahmen sind in der technischen Dokumentation beschrieben.

## Datenquellen und Lizenzen

- [Open Food Facts](https://world.openfoodfacts.org): Lebensmitteldaten unter ODbL; die Quellenangabe wird in der App angezeigt.
- [USDA FoodData Central](https://fdc.nal.usda.gov): Daten im Public Domain / unter CC0.
- [Nunito](https://fonts.google.com/specimen/Nunito): Schrift unter der SIL Open Font License.

---

<div align="center">
Entwickelt von <a href="https://github.com/Jonas480185">Jonas Lunkwitz</a>
</div>
