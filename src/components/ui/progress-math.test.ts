import { describe, expect, it } from "vitest";
import {
  arcLength,
  clamp,
  computeProgress,
  dashOffset,
  describeProgress,
  ringGeometry,
  sanitize,
} from "./progress-math";

describe("progress-math", () => {
  it("clamps and sanitizes", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(sanitize(Number.NaN)).toBe(0);
    expect(sanitize(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitize(-3)).toBe(0);
    expect(sanitize(3)).toBe(3);
  });

  it("computes progress under target", () => {
    const p = computeProgress(1450, 2000);
    expect(p.fill).toBeCloseTo(0.725);
    expect(p.percent).toBe(73);
    expect(p.isOver).toBe(false);
    expect(p.overflow).toBe(0);
    expect(p.remaining).toBe(550);
    expect(p.overAmount).toBe(0);
  });

  it("treats exactly on target as not over", () => {
    const p = computeProgress(2000, 2000);
    expect(p.fill).toBe(1);
    expect(p.isOver).toBe(false);
  });

  it("computes overflow as a second lap, capped at one extra lap", () => {
    const p = computeProgress(2500, 2000);
    expect(p.isOver).toBe(true);
    expect(p.fill).toBe(1);
    expect(p.overflow).toBeCloseTo(0.25);
    expect(p.overAmount).toBe(500);
    expect(p.remaining).toBe(-500);
    expect(computeProgress(9000, 2000).overflow).toBe(1);
  });

  it("never divides by zero without a target", () => {
    const p = computeProgress(300, 0);
    expect(p).toMatchObject({ ratio: 0, fill: 0, isOver: false, overflow: 0 });
  });

  it("computes ring geometry and dash offsets", () => {
    const g = ringGeometry(120, 12);
    expect(g.center).toBe(60);
    expect(g.radius).toBe(54);
    expect(g.circumference).toBeCloseTo(2 * Math.PI * 54);
    expect(arcLength(100, 0.25)).toBe(25);
    expect(arcLength(100, 2)).toBe(100);
    expect(dashOffset(100, 0.25)).toBe(75);
    expect(dashOffset(100, 0)).toBe(100);
    expect(dashOffset(100, -1)).toBe(100);
  });

  it("describes progress in German", () => {
    expect(describeProgress(1450, 2000, { unit: "kcal" })).toBe("1.450 von 2.000 kcal, 550 kcal übrig");
    expect(describeProgress(2300, 2000, { unit: "kcal" })).toBe("2.300 von 2.000 kcal, 300 kcal über Ziel");
    expect(describeProgress(140, 140, { unit: "g" })).toBe("140 von 140 g, Ziel erreicht");
    expect(describeProgress(12.5, 0, { unit: "g", decimals: 1 })).toBe("12,5 g, kein Ziel festgelegt");
  });
});
