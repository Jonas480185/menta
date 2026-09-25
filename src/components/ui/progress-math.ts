/**
 * Pure math behind ProgressRing, MacroBar, MacroRings and CalorieBudget.
 * Framework-free and fully unit-tested (progress-math.test.ts).
 */

import { formatNumber } from "@/lib/format";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Coerces NaN / ±Infinity / negative input to a safe, non-negative finite number. */
export function sanitize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export interface Progress {
  /** value / max, unclamped (1.25 = 125 %). 0 when there is no target. */
  ratio: number;
  /** Rounded percentage of the target (unclamped), e.g. 125. */
  percent: number;
  /** Fill of the first lap, clamped to 0‥1. */
  fill: number;
  /** True when value exceeds a positive target. */
  isOver: boolean;
  /** Second-lap fill (0‥1): how far past the target, capped at one extra lap. */
  overflow: number;
  /** max − value (negative when over). */
  remaining: number;
  /** Amount above target (0 when not over). */
  overAmount: number;
}

/**
 * Progress of `value` against `max`. A missing / non-positive target yields an empty
 * progress (we never divide by zero and never flag "over" without a target).
 */
export function computeProgress(value: number, max: number): Progress {
  const v = sanitize(value);
  const m = sanitize(max);
  if (m === 0) {
    return { ratio: 0, percent: 0, fill: 0, isOver: false, overflow: 0, remaining: 0, overAmount: 0 };
  }
  const ratio = v / m;
  const isOver = v > m;
  return {
    ratio,
    percent: Math.round(ratio * 100),
    fill: clamp(ratio, 0, 1),
    isOver,
    overflow: isOver ? clamp(ratio - 1, 0, 1) : 0,
    remaining: m - v,
    overAmount: isOver ? v - m : 0,
  };
}

export interface RingGeometry {
  /** Centre coordinate (x = y) inside a `size × size` viewBox. */
  center: number;
  /** Radius of the stroke's centre line (stroke stays fully inside the viewBox). */
  radius: number;
  circumference: number;
}

export function ringGeometry(size: number, strokeWidth: number): RingGeometry {
  const center = size / 2;
  const radius = Math.max(0, (size - strokeWidth) / 2);
  return { center, radius, circumference: 2 * Math.PI * radius };
}

/** Visible arc length for a fraction (0‥1) of the circumference. */
export function arcLength(circumference: number, fraction: number): number {
  return circumference * clamp(fraction, 0, 1);
}

/** `stroke-dashoffset` that reveals `fraction` of a circle drawn with dasharray = circumference. */
export function dashOffset(circumference: number, fraction: number): number {
  return circumference - arcLength(circumference, fraction);
}

export interface DescribeProgressOptions {
  unit?: string;
  decimals?: number;
}

/**
 * German, screen-reader friendly summary used as `aria-valuetext`, e.g.
 * "1.450 von 2.000 kcal, 550 kcal übrig" / "2.300 von 2.000 kcal, 300 kcal über Ziel".
 */
export function describeProgress(
  value: number,
  max: number,
  { unit = "", decimals = 0 }: DescribeProgressOptions = {},
): string {
  const u = unit ? ` ${unit}` : "";
  const fmt = (n: number) => formatNumber(n, { maxFractionDigits: decimals });
  const p = computeProgress(value, max);
  if (sanitize(max) === 0) return `${fmt(sanitize(value))}${u}, kein Ziel festgelegt`;
  const head = `${fmt(sanitize(value))} von ${fmt(sanitize(max))}${u}`;
  if (p.isOver) return `${head}, ${fmt(p.overAmount)}${u} über Ziel`;
  if (p.remaining === 0) return `${head}, Ziel erreicht`;
  return `${head}, ${fmt(p.remaining)}${u} übrig`;
}
