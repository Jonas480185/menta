/**
 * German number parsing / formatting and stepping helpers used by NumberInput,
 * QuantityStepper and all nutrition visuals. Pure and unit-tested.
 */

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(minimumFractionDigits: number, maximumFractionDigits: number, grouping: boolean) {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}:${grouping}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("de-DE", {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping: grouping,
      signDisplay: "negative",
    });
    formatters.set(key, f);
  }
  return f;
}

export interface FormatNumberOptions {
  /** Maximum fraction digits (default 0 – nutrition values are shown as whole numbers). */
  decimals?: number;
  /** Force exactly `decimals` digits (e.g. weight "72,0"). */
  fixed?: boolean;
  /** Thousands separator "1.234" (default true). */
  grouping?: boolean;
}

/** Formats a number for German UI: `formatNumber(1234.5, { decimals: 1 })` → "1.234,5". */
export function formatNumber(value: number, options: FormatNumberOptions = {}): string {
  const { decimals = 0, fixed = false, grouping = true } = options;
  if (!Number.isFinite(value)) return "–";
  return getFormatter(fixed ? decimals : 0, decimals, grouping).format(value);
}

/**
 * Parses user input in German (or English) notation.
 *
 * - "1,5" → 1.5 · "1.234,5" → 1234.5 · "1.5" → 1.5 · "0.125" → 0.125
 * - A single dot followed by exactly three digits with a non-zero integer part is read
 *   as a German thousands separator: "1.500" → 1500.
 * - Whitespace (incl. NBSP) is ignored. Returns `null` for empty / invalid input.
 */
export function parseGermanNumber(input: string): number | null {
  let s = input.replace(/[\s\u00a0\u202f]/g, "");
  if (s === "" || s === "-" || s === "," || s === ".") return null;

  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;

  const commaCount = (s.match(/,/g) ?? []).length;
  const dotCount = (s.match(/\./g) ?? []).length;

  let normalized: string;
  if (commaCount > 1) return null;
  if (commaCount === 1) {
    // German: dots are thousands separators, the comma is the decimal mark.
    const [intPart, fracPart] = s.split(",");
    if (dotCount > 0 && !/^\d{1,3}(\.\d{3})+$/.test(intPart)) return null;
    normalized = `${intPart.replace(/\./g, "")}.${fracPart}`;
  } else if (dotCount > 1) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
    normalized = s.replace(/\./g, "");
  } else if (dotCount === 1) {
    const [intPart, fracPart] = s.split(".");
    const looksLikeThousands = /^[1-9]\d{0,2}$/.test(intPart) && /^\d{3}$/.test(fracPart);
    normalized = looksLikeThousands ? `${intPart}${fracPart}` : s;
  } else {
    normalized = s;
  }

  if (normalized.endsWith(".")) normalized = normalized.slice(0, -1);
  if (normalized.startsWith(".")) normalized = `0${normalized}`;
  if (normalized === "") return null;

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Number of decimal places of a step, e.g. 0.25 → 2, 1 → 0. */
export function stepPrecision(step: number): number {
  if (!Number.isFinite(step)) return 0;
  const s = String(step);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

/** Rounds away binary float noise (0.1 + 0.2) to the precision of `step`. */
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
export function stepValue(value: number, direction: 1 | -1, { step, min = -Infinity, max = Infinity }: StepOptions): number {
  const precision = stepPrecision(step);
  const base = Number.isFinite(value) ? value : 0;
  const grid = roundToPrecision(base / step, 6);
  const snapped = direction === 1 ? Math.floor(grid) + 1 : Math.ceil(grid) - 1;
  const next = roundToPrecision(snapped * step, precision);
  return Math.min(max, Math.max(min, next));
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
  return formatNumber(value, { decimals: 2 });
}
