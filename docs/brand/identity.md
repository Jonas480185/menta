# Markenidentität – Menta

> Owner: Brand Identity. Verbindlich für Logo-Nutzung, Markenfarben, Bildsprache und das Mascot-Briefing.
> UI-Tokens (Farbskalen, Radii, Typo-Scale) gehören Design System (`src/app/globals.css`, `docs/design/**`).
> Milos finale Gestaltung gehört Mascot Design (`docs/brand/mascot.md`, `src/components/mascot/milo*.tsx`).
> Konstanten für Code: `src/content/brand.ts` (`BRAND`, `BRAND_ASSETS`).

## 1. Die Marke in einem Satz

**Menta** macht Ernährung messbar, ohne sie zu bewerten: ruhige Oberfläche, präzise Zahlen, ein kleiner Coach
namens **Milo**, der mitdenkt statt mahnt.

- **Tagline (DE):** Klarheit auf dem Teller.
- **Tagline (EN):** Clarity on your plate.
- **Beschreibung:** Kalorien, Makros und Gewichtstrend im Blick – ruhig, präzise und ohne Schuldgefühle. Mit Milo als Coach an deiner Seite.
- **Haltung:** Linear/Arc/Apple-Health-Qualität mit einem Augenzwinkern Motivation. Nie kindlich, nie Handyspiel, nie Schuld.

### Markenwerte

| Wert | Bedeutung im Produkt |
|---|---|
| **Klarheit** | Die wichtigste Zahl ist immer sofort sichtbar. Eine Aussage pro Karte. |
| **Präzision** | Saubere Daten, nachvollziehbare Rechnung (4/4/9), Trends statt Rauschen. |
| **Gelassenheit** | Keine Alarme, keine Schuld, kein Druck. Ein Tag ist ein Datenpunkt. |
| **Wärme** | Milo, freundliche Sprache, kleine konkrete Anerkennung. |

## 2. Name

### Kandidaten

| Name | Idee | Aussprache DE/EN | Bewertung |
|---|---|---|---|
| **Menta** ✔ | ital./span./lat. für *Minze* → Markenfarbe Mint, Frische; Anklang an *mens* (Geist, achtsam) und *Mentor* (Coach) | MEN-ta / MEN-tuh – identisch | **Gewählt.** Siehe Begründung. |
| Kalo | von *Kalorie* und griech. *kalo* (gut, schön) | KA-lo / KAH-loh | Reimt auf „Milo“ („Kalo & Milo“ klingt nach Kinderserie). „Gut“ im Namen widerspricht „kein Essen ist gut/schlecht“. |
| Tara | *Tara* = Leergewicht auf der Küchenwaage – jeder Tag startet bei null | TA-ra / TAH-ruh | Schöne Metapher, aber verbreiteter Vorname; neben „Milo“ wirken zwei Personennamen verwirrend. |
| Ratio | Verhältnis (Makros) und Vernunft (ruhig, rational) | RA-tsio / RAY-shio – **unterschiedlich** | Aussprache DE/EN weicht ab; Alltagswort mit negativem Social-Media-Beiklang („ratio'd“), schwach schützbar. |
| Fenn | kurz für Fenchel/fennel, frisch und knapp | fenn / fen – identisch | Einsilbig und markant, aber wenig Bezug zu Zahlen, Coaching oder Gelassenheit; im Englischen „fen“ = Moor. |

### Begründung für „Menta“

- **Direkte Farb-Verbindung:** Menta = Minze = Markenfarbe `#1FC98E`. Name, Farbe und Logo erzählen dieselbe Geschichte.
- **Zweite Ebene:** klingt nach *mental/Mentor* – passt zu achtsamem, druckfreiem Tracking und zu Milo als Coach.
- **Aussprache:** zwei Silben, Betonung vorne, in Deutsch und Englisch gleich; keine Umlaute, kein Buchstabierproblem.
- **Paarung mit Milo:** gleiche Initiale (M) = Familienähnlichkeit, aber unterschiedliche Vokale und Rhythmus
  (MEN-ta / MI-lo) – kein Reim, keine Verwechslung. „Menta mit Milo“ liest sich natürlich.
- **Wortmarke:** fünf Kleinbuchstaben, nur eine Oberlänge (t), keine Unterlänge → sehr ruhiges, gleichmäßiges Schriftbild.

### Plausibilitätscheck (keine Markenrecherche!)

Bekannte Ernährungs-/Fitness-Apps, mit denen es **keine** Überschneidung gibt: MyFitnessPal, Yazio, Lifesum, FatSecret,
Cronometer, Lose It!, MacroFactor, Noom, fddb, Fitatu, Carb Manager, Foodvisor, Samsung Health, Apple Health.
Mir ist keine größere Ernährungs-App namens „Menta“ bekannt. *Menta* ist aber ein gängiges Wort (Minze) und wird
vermutlich in anderen Branchen (Süßwaren, Getränke, kleine Apps) verwendet.
→ **Vor einem öffentlichen Launch** DPMA/EUIPO/WIPO-Recherche in Klassen 9, 42 und 44 sowie Domain-/Store-Check
durchführen. Bis dahin ist der Name ein Arbeitsname, der zentral in `BRAND.name` gepflegt wird (Umbenennung = eine Zeile + Assets).

### Schreibweise

- Im Text immer **Menta** (großes M). Nie „MENTA“, „menta“ (außer in der gezeichneten Wortmarke), „Menta App“.
- Genus: **die** App Menta; „bei Menta“, „mit Menta“. Kein Genitiv-s-Konstrukt nötig („Mentas Ziele“ vermeiden → „deine Ziele in Menta“).

## 3. Logo

### Assets (`public/brand/`)

| Datei | Inhalt | Einsatz |
|---|---|---|
| `menta-mark.svg` | Bildmarke, Mint + Ink-Augen, 48×48 | Standard-Symbol auf hellem und dunklem Grund |
| `menta-mark-mono.svg` | Bildmarke einfarbig (`currentColor`), Augen ausgestanzt | Inline-SVG, einfarbige Kontexte, Druck |
| `menta-wordmark.svg` | Wortmarke „menta“ (`currentColor`) | Inline-SVG, wenn das Symbol schon sichtbar ist |
| `menta-lockup-light.svg` | Bildmarke + Wortmarke in Ink | Header/Marketing auf hellem Grund |
| `menta-lockup-dark.svg` | Bildmarke + Wortmarke in Paper | auf dunklem Grund |
| `menta-lockup.svg` | Bildmarke + Wortmarke in `currentColor` | Inline-SVG mit Theme-Farbe |
| `menta-app-icon.svg` / `icon-192.png` / `icon-512.png` | App-Icon, abgerundetes Quadrat, Ink-Grund | PWA-Icon (`purpose: any`) |
| `menta-app-icon-maskable.svg` / `icon-maskable-512.png` | App-Icon vollflächig, Marke in Safe-Zone | PWA-Icon (`purpose: maskable`) |
| `favicon.ico` | 16/32/48 px | Legacy-Favicon  |
| `src/app/icon.svg` | = Bildmarke | Favicon (Next.js-Konvention) |
| `src/app/apple-icon.png` | 180×180, vollflächig | Apple Touch Icon |

> Hinweis: `currentColor` greift nur bei **inline** eingebundenem SVG. Als `<img>` wird `currentColor` schwarz –
> dafür die `-light`/`-dark`-Varianten nutzen (z. B. per `<picture>` mit `prefers-color-scheme` oder Theme-Klasse).

### Konstruktion der Bildmarke

Raster 48 × 48 Einheiten.

- **Körper:** Kreis (r = 24), dessen **oberes rechtes Viertel** zu einer fast spitzen Ecke (Radius 6) wird.
  Eine Form, drei Lesarten: **Blatt** (Lebensmittel, Frische), **Tropfen** (Wasser) und **Sprechblase** (Coach, Milo spricht).
- **Augen:** zwei Pillen (7 × 9, voll gerundet), Mittelpunkte bei (21,5 | 21,5) und (33,5 | 21,5), leicht nach oben rechts versetzt –
  der Blick geht zur Blattspitze: nach vorn, nach oben. Das ist Milos Ruhe-Gesicht in reduzierter Form.
- **Farben:** Körper Mint `#1FC98E`, Augen Ink `#0B0F0E` (9 : 1 Kontrast). Auf dunklem Grund bleiben die Augen Ink
  und wirken wie Aussparungen – gewollt.
- Die Bildmarke ist die **statische Glyphe von Milo** (Milo in 16–32 px). Das Logo selbst zeigt **nie** andere Stimmungen,
  wird nie animiert (außer einem einmaligen, dezenten Blinzeln im Splash, optional).

### Wortmarke

Gezeichnet, nicht gesetzt: geometrische, monolineare Kleinbuchstaben (Strichstärke 5 auf 24 Einheiten x-Höhe),
runde Bögen, gerade Stammenden, runde Buchstaben mit optischem Überhang. Einstöckiges „a“ und „t“ mit
gerundetem Fuß als Echo der Blattform. Die Wortmarke wird **nie** in einer Schrift nachgesetzt.

### Schutzzone

Mindestabstand rund um Bildmarke, Wortmarke und Lockup: **¼ der Bildmarkenhöhe** (12 Einheiten = ein „Modul“).
Im Lockup ist der Abstand Bildmarke → Wortmarke fix (14 Einheiten) und die x-Höhe der Wortmarke = ½ Markenhöhe.

```
   ┌──────────────────────────────────┐
   │  M                            M  │     M = ¼ Höhe der Bildmarke
   │    ┌────┐                        │
   │  M │ ◖••│  menta              M  │
   │    └────┘                        │
   │  M                            M  │
   └──────────────────────────────────┘
```

### Mindestgrößen (digital)

| Asset | Minimum | Hinweis |
|---|---|---|
| Bildmarke | 16 px | Favicon. Unter 24 px nie mit Wortmarke kombinieren. |
| Wortmarke | 64 px Breite | darunter nur Bildmarke |
| Lockup | 100 px Breite (= Bildmarke 24 px) | Header mobil: 104–128 px Breite |
| App-Icon | 48 px | Plattform-Vorgaben beachten |

### Nicht erlaubt

- Proportionen verzerren, drehen, spiegeln (die Blattspitze zeigt immer nach oben rechts).
- Farben außerhalb der Markenfarben; Verläufe, Schatten, Glow, Outlines, 3D.
- Augen entfernen, vergrößern, anders platzieren oder durch andere Gesichtszüge ersetzen (Mimik gehört Milo, nicht dem Logo).
- Mint-Bildmarke auf Mint- oder mittelgrünem Grund (Kontrast); auf unruhigen Bildern.
- Wortmarke in einer Schrift nachbauen, sperren, fett/kursiv stellen, in Versalien setzen.
- Elemente neu anordnen (z. B. Wortmarke links, Marke rechts; gestapelte Varianten sind nicht freigegeben).
- Logo als Button, Icon für Aktionen oder als Ladeindikator zweckentfremden.

## 4. Farben – Markenrollen

**Abgrenzung:** Hier stehen die **Markenfarben und ihre Rollen**. Die konkreten UI-Tokens (Skalen, Hover-States,
Dark-Mode-Werte, Charts) definiert Design System in `globals.css`. UI-Code verwendet ausschließlich Tokens, nie diese Hex-Werte.
Hex-Werte im Code nur über `BRAND.colors` in Nicht-CSS-Kontexten (Manifest, OG-Bilder, E-Mails).

| Rolle | Name | Hex | Einsatz | Kontrast |
|---|---|---|---|---|
| Primär | **Menta Mint** | `#1FC98E` | Bildmarke, Milo, Fortschritt (Ringe/Balken), primärer CTA-Hintergrund, Fokus-Akzent | auf Ink 9,0 : 1 · auf Paper 2,0 : 1 (**kein Text auf Hell!**) |
| Primär, textfähig | Mint Deep | `#167957` | Mint als Text/Icon auf hellem Grund (Links, Werte) | auf Paper 5,0 : 1 · auf Weiß 5,4 : 1 |
| Primär, leise | Mint Soft | `#E0F7EF` | große Flächen, Hervorhebung, ausgewählte Zeilen (hell) | Hintergrund für Ink-Text |
| Auf Primär | Ink | `#0B0F0E` | Text/Icons **auf** Mint-Flächen (nie Weiß auf Mint: 2,1 : 1) | 9,0 : 1 |
| Neutral dunkel | **Ink** | `#0B0F0E` | Primärtext hell; Dark-Mode-Fläche (nahezu schwarz, kühl) | auf Paper 18 : 1 |
| Neutral hell | **Paper** | `#F6F8F7` | Hintergrund hell (leicht kühl), Text auf Dunkel | – |

### Mengenverhältnis

Ruhe entsteht durch Zurückhaltung: **~70 % Paper/Ink-Flächen, ~25 % neutrale Grautöne, ≤ 5–10 % Mint.**
Mint markiert *das Eine*, worauf es ankommt (Fortschritt, primäre Aktion, Milo) – nie ganze Screens, nie Fließtext.

### Makro-Farben

Makros sind Daten, keine Wertung. Die Farbfamilien sind festgelegt, die exakten Token-Werte liefert Design System
(inkl. Dark-Mode und Kontrastprüfung). Richtwerte zur Orientierung:

| Makro | Familie | Richtwert | Hinweis |
|---|---|---|---|
| Protein | Blau | ≈ `#4C8DF6` | kühl, präzise |
| Kohlenhydrate | Amber | ≈ `#F5A524` | warm, energiegeladen |
| Fett | Rosé | ≈ `#F0607F` | weich, nicht Alarm-Rot |

Regeln: Makro-Farben immer mit Label/Zahl (nie Farbe als einzige Information). Mint ist **nicht** Makro-Farbe.

### Status-Farben: Markenhaltung

- **Über dem Ziel ist kein Fehler.** Keine roten Farben, Warnsymbole oder „Danger“-Tokens für Kalorien/Makros über Ziel.
  Empfehlung an Design System: neutraler Zustand (Ink/Muted) oder ein ruhiges Amber-Neutral für den Überhang im Ring.
- Rot/Destruktiv nur für echte Fehler und destruktive Aktionen (Löschen, Konto).
- Erfolg = Mint, sparsam.

## 5. Typografie – Persönlichkeit

Die Schriftwahl und Typo-Scale verantwortet Design System. Aus Markensicht gilt:

- **Charakter:** klare, geometrisch-humanistische Grotesk (neutral, modern, gut lesbar) – z. B. Geist, Inter o. ä.
  Keine runden „Bubble“-Fonts, keine Serifen im Produkt, keine Display-Spielereien.
- **Zahlen sind die Helden:** große Ziffern, `font-variant-numeric: tabular-nums` für alles, was sich ändert
  (kcal, g, kg), leicht engere Laufweite bei großen Ziffern, Einheit kleiner und in gedämpfter Farbe daneben.
- **Hierarchie über Größe und Gewicht, nicht Farbe.** Maximal zwei Gewichte pro Karte.
- **Satzschreibung** überall, keine Versalien-Überschriften (Ausnahme: sehr kleine Overlines, gesperrt).
- Die Wortmarke ist gezeichnet und wird nie mit der UI-Schrift nachgestellt.

## 6. Bildsprache & Illustration

- **Abstrakt-geometrisch:** Formen aus der Grammatik der Bildmarke – Kreis, eine Blattecke, Pillen, Ringsegmente, Punkte.
- **Flach, ruhig, mit Luft:** max. 2–3 Farben pro Illustration (Mint + Neutrals, ggf. eine Makro-Farbe), keine Verläufe,
  keine Schlagschatten, keine Glossy-/3D-Effekte.
- **Keine Stockfotos** (weder Essen noch Menschen), keine Körper, keine Waagen-Klischees, kein Maßband, keine Vorher/Nachher.
- **Lebensmittel-Darstellung:** über Icons (lucide-react, konsistente Strichstärke) oder einfache geometrische Piktogramme –
  keine fotorealistischen Lebensmittel.
- **Leere Zustände:** Milo in passender Stimmung + ein Satz + eine Aktion. Keine großen Illustrationen, die Inhalte verdrängen.
- **Datenvisualisierung ist Bildsprache:** Ringe, Balken, Trendlinien sind die eigentlichen „Bilder“ der App.
  Sie dürfen schön sein – präzise, dünn, großzügig gesetzt.

## 7. Mascot-Briefing: Milo

> Mascot Design gestaltet Milos finale Artwork in `docs/brand/mascot.md` und `src/components/mascot/milo*.tsx`
> (Vertrag: `<Milo mood size animated />`, `MiloMood`). Dieses Briefing ist die Markenvorgabe.

### Wer Milo ist

Milo ist ein kleines, abstraktes Wesen – **die Bildmarke, lebendig geworden**. Er ist der Coach in der App:
aufmerksam, ruhig, ein bisschen neugierig, mit trockenem Humor. Er zählt mit, erkennt Muster und gibt kurze, nützliche
Hinweise. Er ist **Funktion, keine Deko**: Wenn Milo erscheint, hat er etwas zu sagen.

| Milo ist | Milo ist nicht |
|---|---|
| ruhig, aufmerksam, verlässlich | hibbelig, laut, aufdringlich |
| präzise – nennt Zahlen und Fakten | vage („Weiter so!“ ohne Inhalt) |
| warm, zugewandt, auf deiner Seite | Richter, Ernährungspolizei, Drill-Sergeant |
| leicht futuristisch, minimal | Cartoon-Tier, Baby, Plüschfigur, Handyspiel-Figur |
| subtil humorvoll (Augenzwinkern) | albern, sarkastisch, passiv-aggressiv |
| selten und gezielt präsent | Dauerbegleiter, der überall winkt |

### Formensprache

- **Silhouette = Bildmarke:** Kreis mit einer Blattecke oben rechts. Er darf sich leicht strecken, stauchen, neigen
  (Squash & Stretch max. ±8 %), bleibt aber immer als diese Form erkennbar.
- **Augen tragen die Emotion:** Pillenaugen in Ink. Ausdruck über Höhe, Rundung, Lidlinie (halb geschlossen, „Lächel-Augen“ ∩),
  Blickrichtung, Abstand. **Kein dauerhafter Mund**; höchstens ein minimaler Strich/Bogen in happy/celebrating.
- **Keine Gliedmaßen, keine Kleidung, keine Accessoires mit Realismus.** Erlaubt sind abstrakte Begleitelemente aus der
  Markengrammatik: Ringsegment (Fortschritt), kleine Punkte/Pillen (Funken, „Z“ als Pillen), ein kleiner Blatt-Trieb.
- **Leicht futuristisch:** präzise Geometrie, optional ein feiner Ring/Glow-Segment in Mint bei streak/goal_reached –
  kein Chrome, kein Neon, keine Sci-Fi-Klischees.
- **Farben:** Körper Mint, Augen Ink; Begleitelemente Mint oder die passende Makro-Farbe (z. B. Protein-Blau beim Protein-Ziel).
  Muss in Light **und** Dark Mode funktionieren, ohne Farbwechsel des Körpers.
- **Größen:** 16–32 px = statische Glyphe (entspricht der Bildmarke, keine Details) · 48–96 px = Inline-Coach ·
  120–200 px = Leere Zustände, Onboarding, Meilensteine.

### Die 8 Zustände (`MiloMood`)

| Mood | Ausdruck (Augen / Körper / Extras) | Wann | Beispiel-Nudge |
|---|---|---|---|
| `neutral` | Pillenaugen offen, Blick leicht nach oben rechts; Körper ruhig; langsames Blinzeln | Standard, Begrüßung, leere Zustände | „Guten Morgen. Heute sind 2.100 kcal dein Ziel.“ |
| `happy` | Augen als weiche Bögen (∩), Körper minimal gestreckt | kleines Ziel erreicht (Wasser), positive Bestätigung | „Wasserziel erreicht.“ |
| `celebrating` | Bogen-Augen, Körper hüpft einmal (Stretch), 3–5 geometrische Funken (Punkte/Pillen in Mint + Makro-Farbe) | seltene große Momente: Rekord-Serie, Zielgewicht | „30 Tage in Folge geloggt. Das ist jetzt Routine!“ |
| `thinking` | ein Auge leicht kleiner/zusammengekniffen, Blick zur Seite oben; Körper leicht geneigt; optional drei Punkte | Tipps, Analyse, Such-/Ladezustand, Fehlerscreen | „Dir fehlen noch 38 g Protein. Skyr oder Linsen wären eine einfache Ergänzung.“ |
| `sleepy` | Augen halb geschlossen (flache Pillen), Körper leicht gesunken; kleine „Z“-Pillen | spät abends, lange Inaktivität, Nachtrag | „Späte Mahlzeit? Ich trag sie gern noch für heute ein.“ |
| `encouraging` | Augen offen und warm (leicht gerundete Unterkante), Blick zum Nutzer; Körper neigt sich nach vorn | über/unter Ziel, Rückkehr nach Pause, Serie gerissen | „Morgen ist ein neuer Tag – dein Wochentrend passt.“ |
| `streak` | entschlossene Augen (leicht flache Oberkante), Ringsegment um Milo, das sich schließt | Serien-Meilensteine (3, 7, 14, 30 …) | „7 Tage in Folge. Ich hab mitgezählt.“ |
| `goal_reached` | Bogen-Augen, geschlossener Ring in Mint/Makro-Farbe um Milo, ein kurzer Puls | Makro-/Tagesziel erreicht | „Protein-Ziel erreicht.“ |

### Verhaltensregeln

- **Max. ein Milo pro Screen**, max. eine Nachricht gleichzeitig; Nachrichten sind schließbar.
- Jede Nachricht enthält eine **Information oder einen machbaren nächsten Schritt** – sonst schweigt Milo.
- Milo kommentiert **nie** Aussehen, Körper oder die Wahl eines Ziels, und bewertet nie Lebensmittel.
- Kein Milo bei Routine-Bestätigungen (Eintrag gespeichert) – dafür reicht ein Toast.
- `celebrating` ist selten (Richtwert: < 1× pro Woche). Inflation zerstört den Effekt.
- **Bewegung:** ruhig und kurz (Ease-out, 200–600 ms), Idle-Blinzeln alle 4–7 s, keine Dauerschleifen-Hüpfer.
  Bei `prefers-reduced-motion` nur statische Zustände (Stimmung bleibt über Augenform erkennbar).
- **Barrierefreiheit:** Milo ist dekorativ, wenn die Nachricht daneben steht (`aria-hidden`); sonst deutschsprachiges
  `aria-label`, z. B. „Milo freut sich“.
- Milo spricht in der ersten Person, im Ton von `voice-and-tone.md` (Abschnitt 6.10).

## 8. Do & Don't (Marke gesamt)

| Do | Don't |
|---|---|
| Eine klare Zahl pro Karte groß zeigen | Fünf gleich laute Kennzahlen nebeneinander |
| Viel Weißraum, ruhige Flächen, Mint als Akzent | Mint-Flächen überall, Verläufe, Neon |
| Trends und Durchschnitte hervorheben | Einzelne Tageswerte dramatisieren |
| Über-Ziel neutral darstellen | Rot, Warnsymbole, Ausrufezeichen bei Über-Ziel |
| Kleine, konkrete Anerkennung mit Zahl | Konfetti bei jeder Aktion, Superlative |
| Milo gezielt als Coach mit Inhalt | Milo als Deko in jeder Ecke |
| Geometrische Illustration, Icons, Datenvisualisierung | Stockfotos, Körperbilder, Vorher/Nachher |
| Eigene, gezeichnete Wortmarke und Bildmarke | MyFitnessPal-/Duolingo-Assets, -Namen, -Texte oder deren Look nachahmen |
| Deutsch, du-Form, Zahlen via `Intl.NumberFormat('de-DE')` | Anglizismen-Mix („Track deine Macros“), „Sie“-Form |
