import { describe, expect, it } from "vitest";
import { demoShiftDays } from "./shift";

describe("demoShiftDays", () => {
  it.each([
    ["2026-10-05", "2026-10-05", 0],
    ["2026-10-04", "2026-10-05", 1],
    ["2026-09-28", "2026-10-05", 7],
    ["2026-10-24", "2026-10-26", 2], // across the DST switch
    ["2026-12-31", "2027-01-01", 1],
    ["2026-10-06", "2026-10-05", 0], // never moves backwards
    [null, "2026-10-05", 0],
  ] as const)("last %s, today %s → %i", (last, today, days) => {
    expect(demoShiftDays(last, today)).toBe(days);
  });
});
