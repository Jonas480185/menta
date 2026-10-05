import { describe, expect, it } from "vitest";
import { buildWeek, dayTone, weekStart } from "./week";

describe("weekStart", () => {
  it("returns the Monday of the ISO week", () => {
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(weekStart("2026-10-08")).toBe("2026-10-05"); // Thursday
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday
  });
});

describe("buildWeek", () => {
  it("returns Mon-Sun and merges logged rows", () => {
    const week = buildWeek("2026-10-07", [{ date: "2026-10-06", kcal: 1800, target: 2000 }], 2100);
    expect(week.map((d) => d.date)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(week[1]).toEqual({ date: "2026-10-06", kcal: 1800, target: 2000, logged: true });
    expect(week[0]).toEqual({ date: "2026-10-05", kcal: 0, target: 2100, logged: false });
  });

  it("falls back to the given target when a row has none", () => {
    const week = buildWeek("2026-10-05", [{ date: "2026-10-05", kcal: 500, target: null }], 1900);
    expect(week[0].target).toBe(1900);
  });
});

describe("dayTone", () => {
  it("classifies days", () => {
    expect(dayTone({ kcal: 0, target: 2000, logged: false })).toBe("empty");
    expect(dayTone({ kcal: 1000, target: 2000, logged: true })).toBe("under");
    expect(dayTone({ kcal: 1900, target: 2000, logged: true })).toBe("good");
    expect(dayTone({ kcal: 2100, target: 2000, logged: true })).toBe("good");
    expect(dayTone({ kcal: 2200, target: 2000, logged: true })).toBe("over");
    expect(dayTone({ kcal: 900, target: null, logged: true })).toBe("under");
  });
});
