# Brand – Menta

**Menta** · *Klarheit auf dem Teller.* (EN: *Clarity on your plate.*) · Coach & Mascot: **Milo**

Ruhig, präzise, warm. Zahlen sind die Helden, Essen wird nie bewertet, Über-Ziel-Tage sind Information statt Schuld.

## Dokumente

| Dokument | Inhalt | Modul |
|---|---|---|
| [identity.md](./identity.md) | Name & Begründung, Logo (Konstruktion, Schutzzone, Mindestgrößen, Don'ts), Markenfarben & Rollen, Typografie-Haltung, Bildsprache, **Mascot-Briefing für Milo**, Do & Don't | Brand Identity |
| [voice-and-tone.md](./voice-and-tone.md) | Persönlichkeit, Sprachregeln, Glossar, Umgang mit Essen & Körper, Tonalität je Situation, **Microcopy-Bibliothek**, verbotene Formulierungen | Brand Identity |
| `mascot.md` | Milos finale Gestaltung, Zustände, Animation | Mascot Design |

## Code & Assets

| Pfad | Inhalt |
|---|---|
| `src/content/brand.ts` | `BRAND` (Name, Taglines, Beschreibung, Locale, Markenfarben, `mascotName`), `BRAND_ASSETS` (Asset-URLs), `BRAND_ASSET_RATIOS` |
| `public/brand/` | Bildmarke, Wortmarke, Lockups (light/dark/currentColor), App-Icons (SVG + PNG 192/512/maskable), `favicon.ico` |
| `src/app/icon.svg` | Favicon (Next.js-Dateikonvention) |
| `src/app/apple-icon.png` | Apple Touch Icon 180 × 180 |
| `src/app/manifest.ts` | PWA-Manifest (`start_url: /today`, standalone) |

```ts
import { BRAND, BRAND_ASSETS } from "@/content/brand";

BRAND.name;         // "Menta"
BRAND.tagline;      // "Klarheit auf dem Teller."
BRAND.mascotName;   // "Milo"
BRAND_ASSETS.lockupLight; // "/brand/menta-lockup-light.svg"
```

## Die wichtigsten Regeln

1. UI-Farben immer über Design-Tokens – `BRAND.colors` nur für Nicht-CSS-Kontexte (Manifest, OG, E-Mail).
2. Mint `#1FC98E` ist Akzent (≤ 10 % der Fläche) und **nie Text auf hellem Grund** – dafür Mint Deep `#167957`.
3. Auf Mint-Flächen steht Ink, nie Weiß.
4. Logo nie verzerren, umfärben, nachsetzen oder mit Mimik versehen – Mimik gehört Milo.
5. Texte: Zahlen zuerst, keine Moral über Essen, kein Kommentar zum Körper, keine Schuld (siehe voice-and-tone.md §7).
