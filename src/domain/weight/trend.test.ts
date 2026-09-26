import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  daysBetween,
  movingAverage7,
  normalizeSamples,
  trendSeries,
  weeklyRate,
  weightChange,
  WEEKLY_RATE_MIN_DAYS,
  type DatedValue,
} from "./trend";

const d = (offset: number) => addDays("2026-09-01", offset);

describe("normalizeSamples", () => {
  it("sorts, dedupes by day (last wins) and drops non-finite values", () => {
    expect(
      normalizeSamples([
        { date: d(2), weightKg: 80 },
        { date: d(0), weightKg: 81 },
        { date: d(2), weightKg: 79.5 },
        { date: d(1), weightKg: Number.NaN },
      ]),
    ).toEqual([
      { date: d(0), weightKg: 81 },
      { date: d(2), weightKg: 79.5 },
    ]);
  });
});

describe("daysBetween", () => {
  it("counts calendar days across DST and month ends", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    expect(daysBetween("2026-03-01", "2026-02-28")).toBe(-1);
  });
});

describe("movingAverage7", () => {
  it("averages entries of the trailing 7 calendar days", () => {
    const entries = [
      { date: d(0), weightKg: 80 },
      { date: d(3), weightKg: 82 },
      { date: d(6), weightKg: 84 },
      { date: d(7), weightKg: 86 },
    ];
    const avg = movingAverage7(entries);
    expect(avg.map((p) => p.value)).toEqual([80, 81, 82, (82 + 84 + 86) / 3]);
  });

  it("returns null for dates without entries in the window", () => {
    const avg = movingAverage7([{ date: d(0), weightKg: 80 }], [d(-1), d(6), d(7)]);
    expect(avg).toEqual([
      { date: d(-1), value: null },
      { date: d(6), value: 80 },
      { date: d(7), value: null },
    ]);
  });
});

describe("trendSeries", () => {
  it("returns [] without entries and validates alpha", () => {
    expect(trendSeries([])).toEqual([]);
    expect(() => trendSeries([], { alpha: 0 })).toThrow(RangeError);
    expect(() => trendSeries([], { alpha: 1.5 })).toThrow(RangeError);
  });

  it("seeds with the first entry and smooths daily with alpha", () => {
    const t = trendSeries(
      [
        { date: d(0), weightKg: 80 },
        { date: d(1), weightKg: 90 },
      ],
      { alpha: 0.1 },
    );
    expect(t[0].value).toBe(80);
    expect(t[1].value).toBeCloseTo(81, 10);
  });

  it("fills gap days with the carried trend and weights the next entry by the gap", () => {
    const t = trendSeries(
      [
        { date: d(0), weightKg: 80 },
        { date: d(7), weightKg: 90 },
      ],
      { alpha: 0.1 },
    );
    expect(t).toHaveLength(8);
    expect(t.slice(1, 7).every((p) => p.value === 80)).toBe(true);
    // Same as seven daily updates towards 90.
    expect(t[7].value).toBeCloseTo(80 + (1 - 0.9 ** 7) * 10, 10);
  });

  it("is less volatile than the raw values", () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({ date: d(i), weightKg: 80 + (i % 2 ? 1 : -1) }));
    const values = trendSeries(entries).map((p) => p.value);
    expect(Math.max(...values.slice(10)) - Math.min(...values.slice(10))).toBeLessThan(0.5);
  });

  it("carries the trend forward until the given day", () => {
    const t = trendSeries([{ date: d(0), weightKg: 80 }], { until: d(3) });
    expect(t.map((p) => p.date)).toEqual([d(0), d(1), d(2), d(3)]);
    expect(t.every((p) => p.value === 80)).toBe(true);
  });
});

describe("weeklyRate", () => {
  const line = (days: number, perDay: number, start = 0): DatedValue[] =>
    Array.from({ length: days }, (_, i) => ({ date: d(start + i), value: 90 + perDay * (start + i) }));

  it("returns the least-squares slope in kg/week", () => {
    expect(weeklyRate(line(21, -0.1))).toBeCloseTo(-0.7, 10);
    expect(weeklyRate(line(14, 0.05))).toBeCloseTo(0.35, 10);
  });

  it("needs at least 14 days of data and 3 points", () => {
    expect(weeklyRate(line(WEEKLY_RATE_MIN_DAYS - 1, -0.1))).toBeNull();
    expect(weeklyRate([])).toBeNull();
    expect(
      weeklyRate([
        { date: d(0), value: 90 },
        { date: d(20), value: 88 },
      ]),
    ).toBeNull();
  });

  it("only looks at the last 28 days", () => {
    const old = line(30, 0.5); // steep gain long ago
    expect(weeklyRate([...old, ...line(28, -0.1, 40)])).toBeCloseTo(-0.7, 10);
  });

  it("handles sparse weekly points", () => {
    const pts = [0, 7, 14, 21].map((i) => ({ date: d(i), value: 80 - i * 0.05 }));
    expect(weeklyRate(pts)).toBeCloseTo(-0.35, 10);
  });
});

describe("weightChange", () => {
  const series: DatedValue[] = Array.from({ length: 31 }, (_, i) => ({ date: d(i), value: 90 - i * 0.1 }));

  it("compares the latest value with the value `days` earlier", () => {
    expect(weightChange(series, 7)).toBeCloseTo(-0.7, 10);
    expect(weightChange(series, 30)).toBeCloseTo(-3, 10);
  });

  it("uses the closest earlier point when the exact day is missing", () => {
    const sparse = [
      { date: d(0), value: 80 },
      { date: d(5), value: 81 },
      { date: d(10), value: 79 },
    ];
    expect(weightChange(sparse, 7)).toBe(-1); // d(3) → closest before is d(0)
  });

  it("returns null when history is too short and respects asOf", () => {
    expect(weightChange(series, 60)).toBeNull();
    expect(weightChange([], 7)).toBeNull();
    expect(weightChange(series, 7, d(10))).toBeCloseTo(-0.7, 10);
  });
});
