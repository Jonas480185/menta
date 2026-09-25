# Menta Visual Language: Key Surfaces

> Guidance for the UI screens (Today, Diary, Logging, Analytics, App Shell, Activity, Weight).
> Tokens and rules: [`design-system.md`](./design-system.md). Components: `docs/design/components.md`.
> Reference implementation of ring + macro bars: `src/app/(dev)/design/_components/nutrition-demo.tsx`.
> Everything below uses semantic utilities only. Sample numbers show formatting and are not product data.

Overall feel: a calm paper canvas, white cards floating on soft shadows (or ink with hairlines in dark mode),
one bold number per card, and mint only where progress or the primary action lives.

---

## 1. Today: calorie ring card

The hero of the app. It answers "Wie stehe ich heute da?" in under a second.

```
┌─────────────────────────────── rounded-card p-card bg-card shadow-sm (dark: border) ─┐
│  Kalorien                                         [Ziel ⌄]  ← text-heading / ghost btn │
│                                                                                       │
│                   ╭──────────╮          Gegessen      1.620   ← text-stat-sm numeric  │
│                 ╱    680     ╲         Aktivität     + 240   ← text-activity-strong  │
│                │  kcal übrig  │        Ziel          2.300                            │
│                 ╲            ╱                                                        │
│                   ╰──────────╯   ← ring 176–200 px, stroke 9–10 % of size              │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

- **Ring:** SVG, rotated −90° (starts at 12 o'clock), round caps. The track is `stroke-track` and the progress
  is `stroke-kcal`. Size is 176 px on mobile and 200 px at ≥ md. The stroke is about 10 % of the diameter.
- **Center:** the remaining kcal in `text-display numeric`, with "kcal übrig" below in `text-caption text-muted-foreground`.
  Only one big number, and "gegessen · Ziel" stays small (UX principle 1).
- **Over target:** the arc completes, and a second lap in `stroke-over` (1–2 px thinner, starting at 12 o'clock with
  a 2° gap) shows the surplus proportionally. The center reads "120" + "kcal drüber" in `text-over-strong`.
  No red, no icon, and no shake.
- **Motion:** animate `pathLength` from the previous value to the new one with `spring.ring` (motion). On first
  load, animate from 0 once per session. With reduced motion, the final value appears instantly.
- **Right column (≥ 360 px wide) or below (narrow):** a three-row equation with labels in `text-body-sm
  text-muted-foreground` and values right-aligned `numeric`. Activity kcal show a `+` in `text-activity-strong`.
- **A11y:** `role="meter"` (or `progressbar`) with `aria-valuenow`, `aria-valuemax` and
  `aria-valuetext="1.620 von 2.300 kcal, 680 übrig"`.
- **Empty state (nothing logged):** a full track, the center shows the goal ("2.300" "kcal Ziel"), plus a Milo
  line and one "Frühstück loggen" action.

## 2. Macro bars

Placed under the ring (same card or a sibling card) in the fixed order **Protein → Kohlenhydrate → Fett**.

```
● Protein                                     92 / 140 g
████████████████████░░░░░░░░░░░               ← h-2 rounded-full bg-track, fill bg-protein
● Fett                                        71 / 65 g
██████████████████████████████████▐█▌         ← fill 100 % + bg-over cap (ring-2 ring-card)
6 g über Ziel                                 ← text-caption text-over-strong
```

- Row: an 8 px dot (`size-2 rounded-full bg-protein`) + label in `text-body-sm font-medium`. On the right is the value
  in `font-semibold numeric`, then "/ 140 g" in `text-muted-foreground`.
- Bar: `h-2` (8 px) with `rounded-full bg-track overflow-hidden`. The fill is a full-width element with `origin-left`
  and `scaleX = min(value/goal, 1)`, animated with `spring.ring`. Never animate `width`.
- Over target: the fill stays at 100 % in the macro color, a 12 px `bg-over` cap sits at the right end, and the
  text line "{n} g über Ziel" appears below.
- Spacing is `gap-5` between macros and `gap-1.5` between a label row and its bar.
- Compact variant (meal card, food detail): three inline chips `bg-protein-soft text-protein-strong rounded-sm
  px-2.5 py-1 text-caption` reading "P 32 g", "K 45 g", "F 12 g".
- Optional fiber/water rows use the same pattern with `fiber` / `water`.

## 3. Meal cards (Today and Diary)

```
┌─ rounded-card bg-card shadow-sm (dark: border) ────────────────────────────┐
│  Frühstück                                   540 kcal   [+]  ← 44 px btn   │
│  P 32 · K 58 · F 18 g                        ← text-caption muted, tabular │
│ ─────────────────────────────────────────── border-t border-border ────── │
│  Haferflocken mit Beeren                               320 kcal           │
│  80 g · 1 Portion                                      ← body-sm muted    │
│ ─────────────────────────────────────────────────────────────────────── │
│  Skyr natur                                            220 kcal           │
│  250 g                                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

- Header row: meal name in `text-headline` and total kcal in `text-headline numeric`. The add button is a
  `rounded-full` 44 px icon button: `bg-primary-soft text-primary-strong`, icon `Plus` 20 px, `aria-label="Zu Frühstück hinzufügen"`.
- Entries: full-width rows with min height 56 px, `px-card py-3`, `hover:bg-accent`, `active:bg-muted`. Separate
  them with `border-t` (not gaps). The name is `text-body` with truncation, the portion is `text-body-sm text-muted-foreground`,
  and kcal sit right-aligned `tabular`.
- Swipe to delete (mobile) reveals a `bg-destructive text-destructive-foreground` action. Always offer the same action in
  the row menu (no swipe-only features). Undo goes through a toast.
- **Empty meal:** one muted line "Noch nichts eingetragen" plus the add button. No big illustration.
- New entry: `animate-rise` on the row and the ring updates. Deleted entry: height collapses with `spring.gentle`.

## 4. Bottom sheet (vaul)

Used for portion pickers, quick add, meal select and filters.

- Surface: `bg-surface-2` with `rounded-t-sheet` (28 px) and `shadow-xl`. Dark mode adds a top `border-t`.
- Grabber: `mx-auto mt-2 h-1.5 w-10 rounded-full bg-border-strong`, `aria-hidden`.
- Scrim: `bg-overlay`.
- Content: `px-gutter` with `pb-safe-offset-4`. The primary action is sticky at the bottom: full-width, 52 px high,
  `bg-primary text-primary-foreground rounded-md font-semibold`, on `bg-surface-2` with a top hairline.
- Heights: content-sized up to 90 dvh. Snap points only for long lists (search).
- Motion: open 300 ms `ease-out` (vaul default spring is OK), close 200 ms. Respect reduced motion.
- A11y: a title is required (`Drawer.Title`, may be visually hidden), focus is trapped, Esc closes and focus returns to the trigger.
- Desktop (≥ lg): render the same content as a centered dialog (`rounded-2xl bg-surface-3 shadow-xl max-w-md`).

## 5. Bottom navigation (App Shell)

`Heute · Tagebuch · (+) Loggen · Fortschritt · Profil`, visible below `lg`. At `lg` and up a sidebar replaces it.

```
┌──────────────────────────────────────────────────────────────┐ ← bg-surface-2/85 backdrop-blur-md
│   ⌂        ▤          ( + )         ◔         ◯             │   border-t border-border
│  Heute  Tagebuch               Fortschritt  Profil          │   h-bottom-nav + pb-safe
└──────────────────────────────────────────────────────────────┘
```

- Container: `fixed inset-x-0 bottom-0 z-30 border-t bg-surface-2/85 backdrop-blur-md pb-safe`, inner height
  `h-bottom-nav` (64 px). Page content needs `pb-safe-offset-bottom-nav` (plus extra spacing) so nothing is hidden.
- Items: each is at least 44 × 44 (full column width), with a 24 px icon (strokeWidth 1.75) and a label in `text-caption`.
  - Inactive: `text-muted-foreground`.
  - Active: `text-primary-strong` with icon strokeWidth 2 and `aria-current="page"`. Optionally add a 4 px `bg-primary`
    dot or a pill `bg-primary-soft` behind the icon (32 × 56, `rounded-full`), moved with `layoutId` + `spring.snappy`.
- Center **Loggen** is a 56 px `rounded-full bg-primary text-primary-foreground shadow-lg` with a `Plus` icon, raised
  about 12 px above the bar, and `aria-label="Essen loggen"`. It uses `active:scale-95` on press.
- No labels are hidden and there are no badges with counts (calm).
- Toasts float above the bar automatically (`Toaster` `mobileOffset`).

## 6. App header

- Height `h-header` (56 px) + `pt-safe`. Sticky, with `bg-background/80 backdrop-blur-md`. When scrolled it gets
  `border-b` (dark) or `shadow-xs` (light).
- The left side holds the page title in `text-title` (large) on Today and Diary, and it collapses to `text-headline`
  when scrolling. Date switcher: chevron buttons (44 px) + "Heute" / "Mi., 24. Sep." in `text-headline`.
- The right side holds at most 2 icon buttons.

## 7. Charts (Analytics, Weight)

- The card holds a title in `text-heading`, the period switcher (7T · 30T · 3M · 6M · 1J as a segmented control on
  `bg-surface-inset`), then the chart, then a one-line summary ("Ø 1.980 kcal · 6 von 7 Tagen im Ziel").
- **Headline number first:** the current value in `text-stat numeric` with its delta as a chip
  (`bg-primary-soft text-primary-strong` or neutral `bg-muted text-muted-foreground`; never red for gains or losses).
- Grid lines are horizontal only, `stroke="var(--chart-grid)"` 1 px. There are no vertical grid lines and no chart border.
- Axes: `var(--chart-axis)` ticks in 12 px tabular type, 3–5 y-ticks, and German short dates ("Mo", "24.9.").
- **Target line:** `var(--chart-target)` dashed `4 4` with an inline label "Ziel 2.300" at the right end.
- **kcal bars:** `var(--chart-1)` with rounded top 4 px. Days over the target keep the series color, and the part above the
  target line uses `var(--over)`. Today's bar is at full opacity and past days at 85 %.
- **Macro stack / donut:** protein → carbs → fat in `chart-2/3/4` with 2 px `var(--card)` separators and direct labels.
- **Weight:** raw entries are 4 px dots in `var(--weight)` at 40 % opacity. The trend line is a 2.5 px solid `var(--weight)`
  with an area fill of weight at 12 % (light) or 20 % (dark). The goal weight is a dashed `chart-target` line.
- Tooltip: `bg-popover text-popover-foreground rounded-lg shadow-lg border px-3 py-2` with values `tabular` and a
  colored dot per series.
- Draw-in: 500 ms `ease-out` on first render only. No animation on period switch beyond a 150 ms crossfade.
- Accessibility: each chart has an `aria-label` summary plus a visually hidden table or list of the values.

## 8. Food search and log rows

- The search field is 48 px high: `bg-surface-inset rounded-md` with no border, a leading `Search` icon 18 px, and
  a `text-body` placeholder in `text-muted-foreground`. Focus shows a ring.
- Result rows are at least 56 px high. The name is in `text-body`, and brand + serving in `text-body-sm text-muted-foreground`.
  On the right: kcal `tabular` with a "kcal" caption. Tapping the row opens the detail, and a separate 44 px `+` quick-add button sits next to it.
- Recent and favorite sections use `text-overline uppercase text-muted-foreground` headers.
- The multi-log collection bar sits above the bottom nav: `bg-surface-3 shadow-lg rounded-2xl` with count + kcal `numeric` and a
  primary "Fertig" button.

## 9. Milo placement

- Milo appears **at most once per screen**, in a card corner or an empty state, at 48–72 px. Speech is a small
  `bg-primary-soft text-foreground rounded-lg` bubble with one sentence.
- Milo never covers numbers, never animates in a loop (brand rule), and stays static under reduced motion.

## 10. Checklist for every screen

- [ ] 375 px without horizontal scroll, and checked in light **and** dark (styleguide `/design` for reference).
- [ ] Exactly one hero number per card, `numeric`, with the unit muted and smaller.
- [ ] Only semantic tokens (`bg-card`, `text-protein-strong`, …), with no hex and no palette classes.
- [ ] Mint text is `text-primary-strong`, and mint fills use `text-primary-foreground`.
- [ ] Over-target uses `over` + text, never `destructive`.
- [ ] All targets ≥ 44 px, focus is visible, and icon buttons have German `aria-label`s.
- [ ] Fixed bars and scroll ends use the safe-area utilities.
- [ ] Motion ≤ 300 ms (springs for progress), and the final state is correct with reduced motion.
