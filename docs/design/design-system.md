# Menta Design System

> Owner: Design System. Source of truth for values: `src/app/globals.css`.
> Live styleguide: **`/design`** (dev route, `noindex`), in light and dark mode.
> Components: `docs/design/components.md`. Brand roles: `docs/brand/identity.md`.
> Concrete look of key screens: [`visual-language.md`](./visual-language.md).

## 1. Principles

1. **Numbers are the hero.** One main number per card, big and tabular. Units are smaller and muted.
   Hierarchy comes from size and weight, not from color.
2. **Calm by default, mint for the one thing that matters.** About 70 % paper or ink, 25 % neutral greys,
   5–10 % mint (progress, the primary action, Milo). Never color whole screens.
3. **Data, not judgment.** Macro colors are neutral data colors. Over target is shown as information
   (`over`, calm orange), never as an error (`destructive`).
4. **Precise and quiet surfaces.** Generous whitespace, 20 px card radius, soft layered shadows in light
   mode, hairlines and tint steps in dark mode. At most two font weights per card.
5. **Motion explains.** Rings fill to the new value and new entries slide in. Motion is fast (150–300 ms),
   uses springs for progress and always respects `prefers-reduced-motion`.
6. **Accessible by construction.** Every text token pair is checked for WCAG AA in both themes by a test.
   Touch targets are at least 44 px, focus is always visible, and color never carries meaning alone.

### How this was derived (ui-ux-pro-max)

The `ui-ux-pro-max` search (`"health fitness nutrition tracker premium calm minimal"`,
`"premium SaaS productivity dark mode clean minimal"`) was the starting point:

| Recommendation | Decision |
|---|---|
| Inter single-family "precision" system for high-end productivity and fintech-style number UIs | **Adopted.** Inter with its optical-size axis, used for UI and numbers. |
| UX rules: 4.5:1 contrast, `number-tabular`, `spring-physics`, `exit-faster-than-enter`, 150–300 ms, safe areas, 44 px targets, `color-not-decorative-only` | **Adopted** and encoded as tokens, utilities and tests |
| Style "Vibrant & Block-based" / "Liquid Glass"; Lora + Raleway; cyan palette | **Rejected.** They conflict with the brief (calm, precise, not a mobile game) and the brand (Menta Mint). Glass effects also cost performance and contrast. |
| Charts: gauge/bullet with a visible numeric value and % of target | **Adopted** for the ring and macro bars (see visual-language.md) |

## 2. Token architecture

```
Primitives   --mint-50 … --mint-950, --ink-0 … --ink-950,        raw values, NOT Tailwind classes
             --duration-*, --gutter, --card-padding …
      │
Semantics    --background, --primary, --protein, --surface-2 …   :root / .light = light, .dark = dark
      │      (exposed as Tailwind colors via @theme inline)
      │
Components   --radius-card, --radius-sheet, --radius-control,     rounded-card, p-card, px-gutter,
             --spacing-gutter/card/section/header/bottom-nav      pb-bottom-nav, h-header …
```

Rules:

- **Components use semantic utilities only**: `bg-card`, `text-muted-foreground`, `bg-protein-soft text-protein-strong`.
  Never raw hex, never Tailwind palette classes (`bg-zinc-100`, `text-emerald-600`), and never primitives
  (`var(--mint-500)`) in feature code.
- Token **names** are a contract. We add names and never rename them. `tokens.test.ts` fails if a skeleton token disappears.
- JS consumers (Recharts, motion, SVG) import `src/components/theme/tokens.ts`. It only exports `var(--…)`
  references and spring presets, never hex values.
- `.light` / `.dark` classes create **theme islands**: `<div className="dark">…</div>` renders its subtree dark
  even in light mode. Examples: the styleguide, previews, OG images.

## 3. Color catalogue

Values are light / dark. Every text pair is AA-verified (`src/components/theme/tokens.test.ts`, 250+ assertions).

### Neutrals and surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#F6F8F7` paper | `#0B0F0E` ink | page canvas (= `theme-color`) |
| `foreground` | `#0B0F0E` | `#F6F8F7` | primary text |
| `card` / `surface-1` | `#FFFFFF` | `#121615` | cards |
| `surface-2` / `popover` | `#FFFFFF` | `#191E1C` | sticky header, bottom sheet, popover, menus |
| `surface-3` | `#FFFFFF` | `#212725` | dialog, toast, active segment in dark mode |
| `surface-inset` | `#EEF1F0` | `#070A09` | wells: segmented control track, search field, slider rail |
| `muted` / `secondary` / `accent` | `#EDF0EF` | `#191E1C` / `#212725` | quiet fills, hover rows, secondary buttons |
| `muted-foreground` | `#59635F` | `#9AA3A0` | secondary text, units, captions (AA on all surfaces) |
| `border` | `#E1E6E4` | `#242A28` | hairlines (dark cards **always** get `border`) |
| `border-strong` / `input` | `#CCD3D0` | `#323936` | input outlines, dividers that must be visible |
| `track` | `#E7EBE9` | `#252B29` | empty part of rings and progress bars |
| `overlay` | ink 40 % | black 60 % | scrim behind sheets and dialogs |

Light mode shows elevation with shadows on white. Dark mode shows it with lighter surface steps plus a
hairline border. Shadows barely read on near-black.

### Brand and actions

| Token | Light | Dark | Use |
|---|---|---|---|
| `brand` | `#1FC98E` | `#1FC98E` | signature mint: illustrations, Milo accents, marks |
| `primary` | `#1FC98E` Menta Mint | `#1FC98E` | **fill only**: primary buttons, selected states, FAB |
| `primary-foreground` | `#0B0F0E` ink | `#0B0F0E` | text and icons **on** mint. White on mint fails (2.1:1). |
| `primary-strong` | `#167957` Mint Deep | `#3DD4A0` | **mint as text**: links, highlighted values, active tab label/icon |
| `primary-soft` | `#E0F7EF` | `#113027` | selected rows, soft badges, hover of mint text buttons |
| `ring` | `#167957` | `#1FC98E` | focus ring (≥ 3:1 on every surface) |

> ⚠️ **`text-primary` is not allowed on light surfaces** (2.0:1 on paper). Use `text-primary-strong`.
> This matters most for shadcn's `link` variant and for active nav items.

### Status

| Token | Light | Dark | Notes |
|---|---|---|---|
| `success` (+`-foreground`, `-soft`) | `#167957` | `#3DD4A0` | = mint, used sparingly |
| `warning` (+…) | `#A95A06` | `#FBBF24` | system warnings (sync, offline), **not** for over-target |
| `info` (+…) | `#2A5BD7` | `#8AADFF` | hints |
| `destructive` (+…) | `#C8283E` crimson | `#F7636E` | real errors and destructive actions **only** |

`X` works as text on card and background. `X-foreground` goes on an `X` fill. `X-soft` is a tinted
background, and `X` text on it is AA.

### Nutrition semantics (data colors)

Each nutrient has three shades:

- `--x` is the **graphic fill** for rings, bars, dots, chart series and icons.
- `--x-soft` is a **tinted background** for chips, badges and highlighted rows.
- `--x-strong` is **colored text**, AA on card, background and `x-soft`.

| Key | Family | Light fill / strong | Dark fill / strong |
|---|---|---|---|
| `kcal` | mint (energy, relates to brand) | `#13A877` / `#167957` | `#1FC98E` / `#3DD4A0` |
| `protein` | blue | `#3F7EF0` / `#2A5BD7` | `#6B9BFF` / `#8AADFF` |
| `carbs` | amber | `#F5A524` / `#9E5C00` | `#F5B43C` / `#F7C35F` |
| `fat` | rosé | `#E5527A` / `#C02D52` | `#F27491` / `#F795AB` |
| `fiber` | lime green | `#7CB518` / `#4A770E` | `#95CC3A` / `#A8D660` |
| `water` | sky cyan | `#19A3E6` / `#06729C` | `#38BEEA` / `#5CCBF0` |
| `weight` | violet | `#8B5CF6` / `#6D3FE0` | `#A688FA` / `#B9A2FB` |
| `activity` | deep teal | `#0F766E` / `#0F766E` | `#14A3A3` / `#3CC4C1` |
| `over` | burnt orange (calm, not red) | `#DD6426` / `#B04E0C` | `#FF8A4C` / `#FFA170` |

How the palette was chosen:

- Macros follow the brand directions in `docs/brand/identity.md` §4 (protein blue, carbs amber, fat rosé),
  tuned for contrast.
- **Colorblind-aware.** Pairs were checked with deuteranopia, protanopia and tritanopia simulations (Machado 2009,
  OKLab ΔE). Protein, carbs and fat stay well apart under all three (ΔE ≥ 18). `activity` was moved to a
  deep teal so it separates from `kcal`, since the two appear together in the energy balance.
- **Known close pairs**, which are never shown without labels: fat↔kcal under deuteranopia, carbs↔over, protein↔weight.
  Because of this, **every data color comes with a label or number** (brand rule), and over-target also uses
  shape and text (see below).
- **Graphic contrast.** Fills reach 3:1 on cards (WCAG 1.4.11) except the light `carbs`, `fiber` and `water`. Amber,
  lime and sky cannot reach 3:1 without turning brown or olive. They are allowed because the value label and the
  track are always present. The test guards them at ≥ 2:1, and the dark variants reach ≥ 3:1.

### Expressing "over target"

Over target is **information, not an alarm** (brand rule, UX principle 8):

- Use the `over` tokens, **never** `destructive`, `warning`, red, warning icons or blinking.
- Always pair color with text. Formula: `"{n} {unit} über Ziel"` in `text-over-strong text-caption`
  (e.g. "6 g über Ziel", "120 kcal über Ziel").
- **Bars:** the fill stays in the macro color at 100 %. A short `bg-over` cap (12 px, `ring-2 ring-card`)
  sits at the right end.
- **Ring:** the kcal arc completes in `kcal`. The overflow continues as a **second lap** in `over`
  (thinner or with a 2° gap) so the overflow is visible by shape as well as color. The center number switches
  to "{n} kcal drüber" in `text-over-strong`.
- Charts: a target line in `chart-target` (dashed). Bars above target keep their series color, and only
  the part above the line may use `over` at 100 % opacity.

### Charts

| Token | Default series |
|---|---|
| `chart-1` | kcal |
| `chart-2` | protein |
| `chart-3` | carbs |
| `chart-4` | fat |
| `chart-5` | weight |
| `chart-grid` | grid lines (1 px, horizontal only) |
| `chart-axis` | tick labels (AA text) |
| `chart-target` | goal line, dashed `4 4` |

- Recharts: `stroke={chartColors.series[2]}` / `fill="var(--chart-2)"`. CSS variables work in SVG attributes, so
  dark mode is automatic.
- Series order is always **Protein → Kohlenhydrate → Fett** (UX principle 5).
- Line 2 px, rounded caps. Bars have rounded top corners (4 px) with ≥ 2 px gaps. Area fill is the series
  color at 12 % (light) or 20 % (dark) opacity. Axis text is `text-caption`, and numbers use `Intl.NumberFormat('de-DE')`.
- Tooltips: `bg-popover`, `shadow-lg`, `rounded-lg`, with tabular values.
- Never more than 5 series. Donuts only for the 3 macros. Always add a legend or direct labels.

## 4. Typography

**Font: Inter** (variable, `wght` + `opsz`), loaded with `next/font/google` in `layout.tsx` as `--font-inter`.
The optical-size axis gives large numbers the display cut automatically. **Geist Mono** is only for code
and debug surfaces (not preloaded).

Why Inter: it has best-in-class tabular figures (`tnum`), clean German glyphs (ä ö ü ß, „…“), it is neutral
and precise as the brand asks (`identity.md` §5), and the ui-ux-pro-max recommendation for precision UIs confirms it.

| Utility | Size / line-height / tracking / weight | Use |
|---|---|---|
| `text-display` | 40→48 px (clamp) / 1.04 / −0.035em / 700 | the hero number (ring center) |
| `text-title` | 28 / 1.15 / −0.022em / 650 | page title ("Heute") |
| `text-heading` | 20 / 1.3 / −0.012em / 600 | card and section heading |
| `text-headline` | 17 / 1.35 / −0.006em / 600 | list-row title, emphasized body |
| `text-body` | 16 / 1.5 / −0.003em / 400 | body (minimum for running text) |
| `text-body-sm` | 14 / 1.45 / 0 / 400 | secondary text, meta |
| `text-caption` | 12 / 1.35 / 0.005em / 500 | units, captions, axis labels (never smaller) |
| `text-overline` + `uppercase` | 12 / 1.2 / 0.06em / 600 | tiny section labels only |
| `text-stat` | 32 / 1.05 / −0.03em / 650 | KPI numbers (weight, streak) |
| `text-stat-sm` | 20 / 1.1 / −0.015em / 600 | macro values, totals |

Number utilities:

- `tabular` is `font-variant-numeric: tabular-nums`. Use it for **every** number that changes or is compared
  (lists, tables, timers, inputs).
- `numeric` adds `tnum` and optical sizing on top. Use it for stat and display numbers.
- Units: `<span class="text-stat numeric">1.620</span><span class="text-muted-foreground text-body-sm"> kcal</span>`.
- Format with `Intl.NumberFormat('de-DE')` ("1.620", "83,4").

Sentence case everywhere. No all-caps headings (overline is the only exception). At most two weights per card.

## 5. Layout, grid and spacing

- **Base unit 4 px** (Tailwind `--spacing: 0.25rem`). Rhythm is 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48.
- Component spacing tokens (responsive at `md` / 768 px):

| Utility | Mobile | ≥ md | Use |
|---|---|---|---|
| `px-gutter` | 16 | 24 | page side padding |
| `p-card` | 20 | 24 | card padding |
| `gap-section` | 24 | 32 | between cards and sections |
| `h-header` | 56 | 56 | app header |
| `h-bottom-nav` / `pb-bottom-nav` | 64 | 64 | bottom nav height (plus safe area) |

- Inside a card, use `gap-3` for related items, `gap-5` for groups, and a 1 px `border` divider between list rows.
- **Content width:** `max-w-content` (40 rem = 640 px) for the mobile-first single column (Today, Diary,
  Log, Settings) and `max-w-wide` (72 rem) for analytics grids.
- **Breakpoints:** mobile-first at 375 px, `sm` 640, `md` 768 (2-column cards possible), `lg` 1024 (sidebar
  replaces bottom nav), `xl` 1280. No horizontal scroll at 375 px.
- **Safe areas** (the viewport uses `viewportFit: "cover"`): `pt-safe`, `pb-safe`, `px-safe`, `mb-safe`,
  `top-safe`, `bottom-safe`, and the offset variants `pb-safe-offset-4` (inset + 1 rem) and
  `pb-safe-offset-bottom-nav` (inset + nav height). Every fixed bar, the FAB and bottom sheets must use them.

### Radius

| Utility | px | Use |
|---|---|---|
| `rounded-xs` | 6 | checkbox, tiny tags |
| `rounded-sm` | 10 | chips, badges, small buttons |
| `rounded-md` = `rounded-control` | 12 | buttons, inputs, segmented segments |
| `rounded-lg` | 16 | list tiles, toasts, popovers, tooltips |
| `rounded-xl` = `rounded-card` | **20** | cards |
| `rounded-2xl` | 24 | hero cards, dialogs |
| `rounded-3xl` = `rounded-sheet` | 28 | bottom sheet top corners |
| `rounded-full` | pill | FAB, avatar, progress bars, pills |

Nested radius is outer radius minus padding (e.g. a 20 px card with 8 px padding gets a 12 px inner tile).

## 6. Elevation

| Level | Light | Dark | Typical use |
|---|---|---|---|
| 0 | `bg-background` | `bg-background` | canvas |
| 1 | `bg-card shadow-sm` | `bg-card border` | cards |
| 2 | `bg-surface-2 shadow-md` | `bg-surface-2 border` | sticky header on scroll, popover, menus |
| 3 | `bg-surface-2 shadow-lg` | `bg-surface-2 border shadow-lg` | bottom sheet, FAB |
| 4 | `bg-surface-3 shadow-xl` | `bg-surface-3 border shadow-xl` | dialog, toast |

- The `shadow-xs … shadow-xl` utilities are **theme-aware**. In dark mode they turn into a top highlight plus a deep shadow.
- Pressed cards and inset wells use `bg-surface-inset` with no shadow.
- **Don't** stack two shadows on nested elements. Only the outermost surface gets a shadow.

## 7. Iconography

- **lucide-react only.** `strokeWidth={1.75}`. Sizes are 16 (inline with body-sm), 18 (buttons, list meta),
  20 (default), and 24 (bottom nav, header actions).
- Icons inherit `currentColor`. Color them with semantic text tokens (`text-muted-foreground`, `text-primary-strong`,
  `text-protein`).
- Decorative icons get `aria-hidden`. Icon-only buttons need an `aria-label` (German) and a 44 px hit area.
- No emoji as icons. No filled/outlined mix. Food is shown as icons or simple geometric pictograms (brand §6).

## 8. Motion

Tokens: `--duration-instant` 100 · `fast` 150 · `base` 200 (default for `transition`) · `slow` 300 ·
`slower` 500 · `spring` 550 ms. Easings: `ease-out` (entering), `ease-in` (exiting), `ease-in-out`,
`ease-emphasized`, and `ease-spring` (a CSS `linear()` spring with k=300, c=24, about 5 % overshoot).

| What | How |
|---|---|
| Hover and press color | `transition-colors` (200 ms ease-out) |
| Press feedback | `active:scale-[0.98]` or `spring.snappy` |
| Enter / exit | `animate-fade-in`, `animate-scale-in`, `animate-rise` (≤ 300 ms). Exit animations (`animate-fade-out`, `animate-scale-out`, `animate-slide-down`) take about 65 % of the enter time |
| Ring / bar fill | motion `spring.ring` (same curve as `ease-spring`). Animate `pathLength` or `scaleX`, **never `width`** |
| Bottom sheet | vaul default drag physics. Open ≈ `animate-slide-up` (300 ms), close 200 ms |
| List insert / remove | `animate-rise` for new items, collapse height with `spring.gentle` |
| Stagger | 30–50 ms per item, maximum 6 items |
| Celebration (goal reached, Milo) | `spring.bouncy` / `animate-pop`. This is the only place for real bounce |
| Skeleton | `skeleton` utility (shimmer) |

Rules:

- Animate only `transform` and `opacity` (and SVG `pathLength`). Animate 1–2 elements per view, and never loop
  anything except loaders.
- **Reduced motion:** the global CSS clamps all CSS animations and transitions to 0.01 ms, and
  `<MotionConfig reducedMotion="user">` (in `ThemeProvider`) disables transform animations in `motion`.
  The final state must be correct without animation.
- Theme switching disables transitions for one frame, so colors don't fade.

## 9. Accessibility rules

- **Contrast:** text ≥ 4.5:1 and large numbers or icons ≥ 3:1 in light **and** dark. Only use token pairs from the
  catalogue. Adding a new pair means adding it to `TEXT_PAIRS` in `tokens.test.ts`.
- **Focus:** the global `:focus-visible` style is a 2 px `--ring` outline with 2 px offset. Don't remove outlines
  without replacing them (`focus-ring` utility or `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`).
- **Touch targets:** at least 44 × 44 px (`min-h-11 min-w-11`), with ≥ 8 px between targets. Small visuals get an
  invisible hit area (padding or `before:absolute before:-inset-2`).
- **Color is never alone:** macros always have a label, over-target has text, and status has an icon plus text.
- **Semantics:** use native elements first. Segmented controls are `radiogroup` (see `ThemeToggle`). Progress uses
  `role="progressbar"` or `meter` with `aria-valuenow`, `aria-valuemax` and a German `aria-valuetext`
  ("1.620 von 2.300 kcal").
- **Text:** base 16 px, never under 12 px. Zoom is not disabled (no `maximumScale`).
- `lang="de"` is on `<html>`, and German is used in all aria labels.

## 10. Theme switching

- `ThemeProvider` (`src/components/theme/theme-provider.tsx`) wraps next-themes with `attribute="class"`,
  `defaultTheme="system"` and storage key `theme`. An inline script applies the class before paint, so there is no flash.
- `useTheme()` returns a typed `{ theme, resolvedTheme, setTheme }`.
- `ThemeToggle` is a Light/Dark/System segmented control (`iconOnly` for tight spaces). It belongs in
  Settings → Darstellung and may also sit in the desktop sidebar footer.
- `<meta name="theme-color">` follows the system scheme: paper `#F6F8F7` and ink `#0B0F0E`.
- `Toaster` (`src/components/theme/toaster.tsx`) is themed and mounted once in the root layout. Call
  `toast.success("Gespeichert")` from `sonner`.

## 11. Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| `bg-primary text-primary-foreground` (ink on mint) | white text on mint, or `text-primary` on light backgrounds |
| `text-primary-strong` for mint text and links | mint body text or large mint areas |
| `bg-protein-soft text-protein-strong` chips | `text-protein` for small text (the fill shade is not AA) |
| "6 g über Ziel" in `text-over-strong` + over cap | red, `destructive`, ⚠️ icons or shaking for over-target |
| `numeric` / `tabular` on every changing number | proportional digits that jump while counting |
| `rounded-card p-card shadow-sm` + `dark:border` | borders **and** strong shadows in light mode |
| `pb-safe-offset-bottom-nav` for scroll containers | content hidden under the bottom nav or home indicator |
| springs for progress, ≤ 300 ms for UI | animating `width`/`height`, endless decorative motion |
| icons at `strokeWidth={1.75}`, `aria-hidden` + label | emoji icons, icon-only buttons without a label |
| semantic tokens, `tokens.ts` in JS | raw hex, `bg-zinc-*`, `var(--mint-500)` in features |
| empty states with Milo + one sentence + one action | mock data or "Lorem" in product UI |
