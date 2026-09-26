/**
 * Display rounding. NEVER round before storing or before summing – round the final aggregate
 * (the sum of rounded entry values can differ from the rounded day total).
 * All helpers round half away from zero (so −2.5 → −3 like 2.5 → 3) and never return −0.
 */

/** Rounds to `digits` decimals, half away from zero, without −0. */
export function roundTo(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value;
  const f = 10 ** digits;
  // EPSILON nudge counters binary representation (1.005 * 100 = 100.49999…).
  const r = (Math.sign(value) * Math.round(Math.abs(value) * f * (1 + Number.EPSILON))) / f;
  return r === 0 ? 0 : r;
}

/** kcal for display: whole numbers. */
export function roundKcal(kcal: number): number {
  return roundTo(kcal, 0);
}

/** Grams for display: one decimal below 10 g, whole grams from 10 g (same rule as `formatGrams`). */
export function roundGrams(grams: number): number {
  return Math.abs(grams) < 10 ? roundTo(grams, 1) : roundTo(grams, 0);
}

/** Milligrams for display: one decimal below 10 mg, whole mg above. */
export function roundMg(mg: number): number {
  return Math.abs(mg) < 10 ? roundTo(mg, 1) : roundTo(mg, 0);
}
