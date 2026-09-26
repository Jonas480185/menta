import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { isWeightRange, rangeStart, slicePoints, thinPoints } from "./ranges";
import type { WeightTrendPoint } from "./types";

const today = "2026-09-26";
const pts = (n: number, firstData = 0): WeightTrendPoint[] =>
  Array.from({ length: n }, (_, i) => {
    const has = i >= firstData;
    return {
      date: addDays(today, i - n + 1),
      weightKg: has ? 80 : null,
      avg7: has ? 80 : null,
      trend: has ? 80 : null,
    };
  });

describe("ranges", () => {
  it("validates range ids", () => {
    expect(isWeightRange("3m")).toBe(true);
    expect(isWeightRange("2w")).toBe(false);
  });

  it("computes inclusive range starts", () => {
    expect(rangeStart("30d", today)).toBe(addDays(today, -29));
    expect(rangeStart("all", today)).toBeNull();
  });

  it("slices to the range and trims leading empty days for 'all'", () => {
    expect(slicePoints(pts(100), "30d", today)).toHaveLength(30);
    expect(slicePoints(pts(100, 40), "all", today)).toHaveLength(60);
    expect(slicePoints(pts(5, 10), "all", today)).toEqual([]);
  });

  it("thins long series but keeps first and last", () => {
    const long = pts(1000);
    const thin = thinPoints(long, 200);
    expect(thin.length).toBeLessThanOrEqual(202);
    expect(thin[0]).toBe(long[0]);
    expect(thin.at(-1)).toBe(long.at(-1));
    expect(thinPoints(pts(10), 200)).toHaveLength(10);
  });
});
