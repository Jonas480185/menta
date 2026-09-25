import { addDays, isoWeekday, ISO_DATE_RE, type IsoDate } from "./dates";

/**
 * German display formatting – use these everywhere in the UI instead of ad-hoc toFixed()/toLocaleString().
 *
 * Conventions:
 * - Numbers: de-DE grouping/decimals ("1.620", "2,5"), real minus sign "−" (U+2212), never "-0".
 * - Number and unit are joined with a NO-BREAK SPACE (U+00A0) so "1.620 kcal" never wraps.
 *   Tests: compare with `NBSP` or normalize whitespace (Testing Library / Playwright do this by default).
 * - Missing/invalid numbers (null, undefined, NaN, ±Infinity) render as "–".
 * - Dates use fixed German tables (not Intl) so server and browser render identically
 *   (ICU versions differ, e.g. "Sep." vs "Sept.") – no hydration mismatches.
 * - Round only for display; never feed formatted values back into calculations.
 */

export const NBSP = "\u00A0";
export const MINUS = "\u2212";
/** Placeholder for missing values. */
export const EMPTY_VALUE = "–";

type Num = number | null | undefined;

export interface NumberFormatOptions {
  /** Default 0. */
  maxFractionDigits?: number;
  /** Default 0. */
  minFractionDigits?: number;
  /** Show "+" for positive values ("+250"). Zero stays "0". */
  signed?: boolean;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function numberFormatter(min: number, max: number, signed: boolean): Intl.NumberFormat {
  const key = `${min}|${max}|${signed}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: min,
      maximumFractionDigits: Math.max(min, max),
      signDisplay: signed ? "exceptZero" : "negative",
    });
    formatterCache.set(key, f);
  }
  return f;
}

function isFiniteNumber(value: Num): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 1620 → "1.620" · 2.46 {maxFractionDigits: 1} → "2,5" · −400 → "−400". */
export function formatNumber(value: Num, options: NumberFormatOptions = {}): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  const { maxFractionDigits = 0, minFractionDigits = 0, signed = false } = options;
  return numberFormatter(minFractionDigits, maxFractionDigits, signed).format(value).replace("-", MINUS);
}

function withUnit(formatted: string, unit: string): string {
  return `${formatted}${NBSP}${unit}`;
}

/** 1620.4 → "1.620 kcal". */
export function formatKcal(value: Num): string {
  return withUnit(formatNumber(value), "kcal");
}

/** −400 → "−400 kcal" · 250 → "+250 kcal" · 0 → "0 kcal". For deficits/surpluses and deltas. */
export function formatSignedKcal(value: Num): string {
  return withUnit(formatNumber(value, { signed: true }), "kcal");
}

/** Grams: whole numbers from 10 g, one decimal below ("142 g", "2,5 g", "0,3 g", "2 g"). */
export function formatGrams(value: Num): string {
  const digits = isFiniteNumber(value) && Math.abs(value) < 10 ? 1 : 0;
  return withUnit(formatNumber(value, { maxFractionDigits: digits }), "g");
}

/** Milligrams (micronutrients): < 1 → 2 decimals, < 10 → 1 decimal, else whole ("0,25 mg", "2,5 mg", "140 mg"). */
export function formatMg(value: Num): string {
  const abs = isFiniteNumber(value) ? Math.abs(value) : 0;
  const digits = abs < 1 ? 2 : abs < 10 ? 1 : 0;
  return withUnit(formatNumber(value, { maxFractionDigits: digits }), "mg");
}

/** 250 → "250 ml" · 1500 → "1.500 ml". */
export function formatMl(value: Num): string {
  return withUnit(formatNumber(value), "ml");
}

/** Millilitres shown as litres: 1500 → "1,5 l" · 2000 → "2 l" · 2250 → "2,25 l". */
export function formatLiters(ml: Num, options: { maxFractionDigits?: number } = {}): string {
  const liters = isFiniteNumber(ml) ? ml / 1000 : ml;
  return withUnit(formatNumber(liters, { maxFractionDigits: options.maxFractionDigits ?? 2 }), "l");
}

/** Body weight, always one decimal: 82.44 → "82,4 kg" · 82 → "82,0 kg". */
export function formatWeightKg(value: Num, options: { signed?: boolean } = {}): string {
  return withUnit(
    formatNumber(value, { minFractionDigits: 1, maxFractionDigits: 1, signed: options.signed }),
    "kg",
  );
}

/** Ratio (0–1) as percent: 0.25 → "25 %" · 1.234 → "123 %". */
export function formatPercent(ratio: Num, options: { maxFractionDigits?: number } = {}): string {
  const pct = isFiniteNumber(ratio) ? ratio * 100 : ratio;
  return withUnit(formatNumber(pct, { maxFractionDigits: options.maxFractionDigits ?? 0 }), "%");
}

// ── Dates ────────────────────────────────────────────────────────────────────

const WEEKDAYS_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const WEEKDAYS_SHORT = ["Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So."];
const MONTHS_LONG = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
const MONTHS_SHORT = [
  "Jan.",
  "Feb.",
  "März",
  "Apr.",
  "Mai",
  "Juni",
  "Juli",
  "Aug.",
  "Sep.",
  "Okt.",
  "Nov.",
  "Dez.",
];

function parts(date: IsoDate) {
  const d = date.slice(0, 10);
  if (!ISO_DATE_RE.test(d)) throw new RangeError(`Expected ISO date YYYY-MM-DD, got "${date}"`);
  const [year, month, day] = d.split("-").map(Number);
  return { iso: d, year, monthIndex: month - 1, day, weekdayIndex: isoWeekday(d) - 1 };
}

/** "Di." */
export function formatWeekdayShort(date: IsoDate): string {
  return WEEKDAYS_SHORT[parts(date).weekdayIndex];
}

/** "22. Sep." – compact, e.g. chart axes. Adds the year when `withYear` is true ("22. Sep. 2025"). */
export function formatDateShort(date: IsoDate, options: { withYear?: boolean } = {}): string {
  const p = parts(date);
  return `${p.day}. ${MONTHS_SHORT[p.monthIndex]}${options.withYear ? ` ${p.year}` : ""}`;
}

/** "Dienstag, 22. September 2026" · {weekday: false} → "22. September 2026". */
export function formatDateLong(date: IsoDate, options: { weekday?: boolean } = {}): string {
  const p = parts(date);
  const base = `${p.day}. ${MONTHS_LONG[p.monthIndex]} ${p.year}`;
  return options.weekday === false ? base : `${WEEKDAYS_LONG[p.weekdayIndex]}, ${base}`;
}

/**
 * Relative day label for headers and lists:
 * "Heute" · "Gestern" · "Morgen" · else "Mo., 22. Sep." (+ year if not in the current year).
 * `today` = the user's today (todayInTimezone(ctx.timezone)), passed in to stay pure.
 */
export function formatRelativeDay(date: IsoDate, today: IsoDate): string {
  const d = parts(date);
  const t = parts(today);
  if (d.iso === t.iso) return "Heute";
  if (d.iso === addDays(t.iso, -1)) return "Gestern";
  if (d.iso === addDays(t.iso, 1)) return "Morgen";
  return `${WEEKDAYS_SHORT[d.weekdayIndex]}, ${formatDateShort(d.iso, { withYear: d.year !== t.year })}`;
}

// ── Input parsing ────────────────────────────────────────────────────────────

/**
 * Parses user-typed decimals, accepting comma or point: "1,5" → 1.5 · "1.5" → 1.5 · " 250 " → 250 ·
 * "1.250,5" → 1250.5 · "1,250.5" → 1250.5 · "1.000.000" → 1000000 · "−2,5" → −2.5 · ",5" → 0.5.
 * Returns null for empty or invalid input ("", "abc", "1,2,3,4x").
 *
 * Rules: if both separators occur, the last one is the decimal separator; a separator that occurs
 * more than once is a thousands separator (groups of 3 digits required, "1.2.3" → null); a single
 * separator is always the decimal separator – so "1.500" is 1.5, not 1500.
 */
export function parseDecimalInput(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = input
    .trim()
    .replace(/[\s\u00A0\u202F']/g, "")
    .replace(/^[\u2212\u2013]/, "-");
  if (s === "" || s === "-" || s === "+") return null;

  const sign = /^[+-]/.test(s) ? s[0] : "";
  let body = sign ? s.slice(1) : s;
  const lastComma = body.lastIndexOf(",");
  const lastDot = body.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const group = decimal === "," ? "." : ",";
    const [intPart, fracPart, ...rest] = body.split(decimal);
    if (rest.length > 0 || !isGrouped(intPart, group)) return null;
    body = `${intPart.split(group).join("")}.${fracPart}`;
  } else {
    const sep = lastComma !== -1 ? "," : lastDot !== -1 ? "." : null;
    if (sep && body.split(sep).length > 2) {
      if (!isGrouped(body, sep)) return null;
      body = body.split(sep).join("");
    } else if (sep) {
      body = body.replace(sep, ".");
    }
  }
  s = sign + body;

  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "1.250.000" with group "." → valid thousands grouping. */
function isGrouped(value: string, group: string): boolean {
  const g = group === "." ? "\\." : group;
  return new RegExp(`^\\d{1,3}(${g}\\d{3})+$`).test(value);
}
