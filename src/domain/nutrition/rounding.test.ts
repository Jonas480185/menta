import { describe, expect, it } from "vitest";
import { roundGrams, roundKcal, roundMg, roundTo } from "./rounding";

describe("roundTo", () => {
  it.each([
    [1.005, 2, 1.01],
    [2.5, 0, 3],
    [-2.5, 0, -3],
    [0.05, 1, 0.1],
    [123.456, 1, 123.5],
    [-0.4, 0, 0],
  ])("roundTo(%s, %s) = %s", (v, d, r) => {
    expect(roundTo(v, d)).toBe(r);
  });

  it("never returns -0", () => {
    expect(Object.is(roundTo(-0.4), 0)).toBe(true);
    expect(Object.is(roundTo(-0), 0)).toBe(true);
  });

  it("passes non-finite values through", () => {
    expect(roundTo(Number.NaN)).toBeNaN();
    expect(roundTo(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("roundKcal", () => {
  it.each([
    [148.8, 149],
    [148.5, 149],
    [148.49, 148],
    [-309.5, -310],
    [0.3, 0],
  ])("%s → %s", (v, r) => {
    expect(roundKcal(v)).toBe(r);
  });
});

describe("roundGrams", () => {
  it.each([
    [2.46, 2.5],
    [9.94, 9.9],
    [9.96, 10],
    [10.4, 10],
    [142.5, 143],
    [-2.04, -2],
    [-12.6, -13],
  ])("%s → %s", (v, r) => {
    expect(roundGrams(v)).toBe(r);
  });
});

describe("roundMg", () => {
  it.each([
    [0.26, 0.3],
    [2.54, 2.5],
    [139.6, 140],
  ])("%s → %s", (v, r) => {
    expect(roundMg(v)).toBe(r);
  });
});

describe("rounding is for display only", () => {
  it("round(sum) can differ from sum(round): always round the aggregate", () => {
    const entries = [0.4, 0.4, 0.4];
    expect(roundKcal(entries.reduce((a, b) => a + b, 0))).toBe(1);
    expect(entries.map(roundKcal).reduce((a, b) => a + b, 0)).toBe(0);
  });
});
