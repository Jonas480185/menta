import { addDays, type IsoDate } from "@/lib/dates";

/**
 * Weight trend math (pure). Daily scale readings are noisy (water, salt, digestion: ±1–2 kg),
 * so everything user-facing is built on a smoothed trend rather than single readings.
 *
 * Dates are ISO calendar days ("YYYY-MM-DD", the user's local day). Weights in kg.
 */

export interface WeightSample {
  date: IsoDate;
  weightKg: number;
}

export interface DatedValue {
  date: IsoDate;
  value: number;
}

const DAY_MS = 86_400_000;

/** Whole calendar days from `a` to `b` (b − a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Sorted by date, one sample per day (the last one wins), non-finite weights dropped. */
export function normalizeSamples(entries: readonly WeightSample[]): WeightSample[] {
  const byDate = new Map<IsoDate, number>();
  for (const e of entries) {
    if (Number.isFinite(e.weightKg)) byDate.set(e.date, e.weightKg);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, weightKg]) => ({ date, weightKg }));
}

// ── 7-day average ────────────────────────────────────────────────────────────

export const AVERAGE_WINDOW_DAYS = 7;

/**
 * Trailing 7-day average: for each date, the mean of all entries in [date − 6, date].
 * `dates` defaults to the entry dates. `null` when the window holds no entry.
 */
export function movingAverage7(
  entries: readonly WeightSample[],
  dates?: readonly IsoDate[],
): { date: IsoDate; value: number | null }[] {
  const samples = normalizeSamples(entries);
  const targets = dates ?? samples.map((s) => s.date);
  return targets.map((date) => {
    const from = addDays(date, -(AVERAGE_WINDOW_DAYS - 1));
    let sum = 0;
    let n = 0;
    for (const s of samples) {
      if (s.date >= from && s.date <= date) {
        sum += s.weightKg;
        n++;
      }
    }
    return { date, value: n > 0 ? sum / n : null };
  });
}

// ── Exponentially smoothed trend ─────────────────────────────────────────────

export const DEFAULT_TREND_ALPHA = 0.1;

export interface TrendOptions {
  /** Daily smoothing factor 0 < alpha ≤ 1 (default 0.1 ≈ Hacker's Diet). */
  alpha?: number;
  /** Carry the trend forward (flat) up to this day, e.g. the user's today. */
  until?: IsoDate;
}

/**
 * Exponentially smoothed trend, one value per calendar day from the first entry up to the
 * last entry (or `until`, if later). Gap-aware: after a gap of `g` days the next entry is
 * weighted with `1 − (1 − alpha)^g` – exactly what `g` daily updates would do – so weekly
 * weighers get a responsive trend and daily weighers a calm one. Days without an entry carry
 * the last trend value. The first entry seeds the trend.
 */
export function trendSeries(entries: readonly WeightSample[], options: TrendOptions = {}): DatedValue[] {
  const alpha = options.alpha ?? DEFAULT_TREND_ALPHA;
  if (!(alpha > 0 && alpha <= 1)) throw new RangeError(`alpha must be in (0, 1], got ${alpha}`);
  const samples = normalizeSamples(entries);
  if (samples.length === 0) return [];

  const out: DatedValue[] = [];
  let trend = samples[0].weightKg;
  let lastDate = samples[0].date;
  out.push({ date: lastDate, value: trend });

  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    for (let d = addDays(lastDate, 1); d < s.date; d = addDays(d, 1)) out.push({ date: d, value: trend });
    const gap = daysBetween(lastDate, s.date);
    const weight = 1 - Math.pow(1 - alpha, gap);
    trend = trend + weight * (s.weightKg - trend);
    out.push({ date: s.date, value: trend });
    lastDate = s.date;
  }

  if (options.until && options.until > lastDate) {
    for (let d = addDays(lastDate, 1); d <= options.until; d = addDays(d, 1)) out.push({ date: d, value: trend });
  }
  return out;
}

// ── Weekly rate ──────────────────────────────────────────────────────────────

/** The regression needs trend points covering at least this many calendar days … */
export const WEEKLY_RATE_MIN_DAYS = 14;
/** … and looks back at most this many calendar days. */
export const WEEKLY_RATE_MAX_DAYS = 28;
/** Minimum number of points inside the window. */
export const WEEKLY_RATE_MIN_POINTS = 3;

/**
 * Rate of change in kg/week: least-squares slope over the trend points of the last
 * 14–28 calendar days (ending at the latest point). Pass trend values on measured days
 * (carried-forward gap days would flatten the slope). Negative = decreasing.
 * `null` when the points cover fewer than 14 days or there are fewer than 3 points.
 */
export function weeklyRate(points: readonly DatedValue[]): number | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last = sorted[sorted.length - 1].date;
  const from = addDays(last, -(WEEKLY_RATE_MAX_DAYS - 1));
  const window = sorted.filter((p) => p.date >= from && Number.isFinite(p.value));
  if (window.length < WEEKLY_RATE_MIN_POINTS) return null;
  if (daysBetween(window[0].date, last) + 1 < WEEKLY_RATE_MIN_DAYS) return null;

  const xs = window.map((p) => daysBetween(window[0].date, p.date));
  const ys = window.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  return (num / den) * 7;
}

// ── Change ───────────────────────────────────────────────────────────────────

/**
 * Change of a dated series over `days`: latest value minus the value on (or the closest
 * before) `latest.date − days`. `asOf` limits "latest" to points on or before that day.
 * `null` when the series doesn't reach back far enough.
 */
export function weightChange(
  series: readonly DatedValue[],
  days: number,
  asOf?: IsoDate,
): number | null {
  const sorted = [...series]
    .filter((p) => Number.isFinite(p.value) && (asOf === undefined || p.date <= asOf))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (sorted.length === 0) return null;
  const latest = sorted[sorted.length - 1];
  const target = addDays(latest.date, -days);
  let base: DatedValue | undefined;
  for (const p of sorted) {
    if (p.date <= target) base = p;
    else break;
  }
  return base ? latest.value - base.value : null;
}
