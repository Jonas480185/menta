/**
 * Stepping and serving helpers for NumberInput / QuantityStepper. Pure and unit-tested.
 * Display formatting and input parsing live in `@/lib/format` (`formatNumber`,
 * `parseDecimalInput`) – this module only adds what the input controls need on top.
 */

import { formatNumber } from "@/lib/format";

/** Number of decimal places of a step, e.g. 0.25 → 2, 1 → 0. */
export function stepPrecision(step: number): number {
  if (!Number.isFinite(step)) return 0;
  const s = String(step);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

/** Rounds away binary float noise (0.1 + 0.2) to `precision` decimals. */
export function roundToPrecision(value: number, precision: number): number {
  const f = 10 ** precision;
  return Math.round(value * f) / f;
}

export interface StepOptions {
  step: number;
  min?: number;
  max?: number;
}

/**
 * Moves `value` one step up/down, snapping to the step grid (1,3 + 0,25 → 1,5) and
 * clamping into [min, max].
 */
export function stepValue(
  value: number,
  direction: 1 | -1,
  { step, min = -Infinity, max = Infinity }: StepOptions,
): number {
  const precision = stepPrecision(step);
  const base = Number.isFinite(value) ? value : 0;
  const grid = roundToPrecision(base / step, 6);
  const snapped = direction === 1 ? Math.floor(grid) + 1 : Math.ceil(grid) - 1;
  const next = roundToPrecision(snapped * step, precision);
  return Math.min(max, Math.max(min, next));
}

const draftFormatters = new Map<number, Intl.NumberFormat>();

/**
 * Editable representation of a number: German decimal comma, **no** thousands separator
 * (so it round-trips through `parseDecimalInput`, which reads a single "." as decimal).
 * 1500 → "1500" · 72.45 (2) → "72,45" · null → "".
 */
export function formatDraft(value: number | null | undefined, maxFractionDigits: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  let f = draftFormatters.get(maxFractionDigits);
  if (!f) {
    f = new Intl.NumberFormat("de-DE", {
      maximumFractionDigits: maxFractionDigits,
      useGrouping: false,
      signDisplay: "negative",
    });
    draftFormatters.set(maxFractionDigits, f);
  }
  return f.format(value);
}

const FRACTION_GLYPHS: Record<string, string> = {
  "0.25": "¼",
  "0.5": "½",
  "0.75": "¾",
  "0.333": "⅓",
  "0.667": "⅔",
};

/**
 * Formats serving counts with vulgar fractions where they read better:
 * 0.5 → "½", 1.25 → "1¼", 2 → "2", 1.3 → "1,3".
 */
export function formatServings(value: number): string {
  if (!Number.isFinite(value)) return "–";
  const whole = Math.trunc(value);
  const frac = roundToPrecision(Math.abs(value - whole), 3);
  if (frac === 0) return formatNumber(whole);
  const glyph = FRACTION_GLYPHS[String(frac)];
  if (glyph) return whole === 0 ? glyph : `${formatNumber(whole)}${glyph}`;
  return formatNumber(value, { maxFractionDigits: 2 });
}
