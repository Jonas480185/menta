import { describe, expect, it } from "vitest";
import {
  EMPTY_VALUE,
  MINUS,
  NBSP,
  formatDateLong,
  formatDateShort,
  formatGrams,
  formatKcal,
  formatLiters,
  formatMg,
  formatMl,
  formatNumber,
  formatPercent,
  formatRelativeDay,
  formatSignedKcal,
  formatWeekdayShort,
  formatWeightKg,
  parseDecimalInput,
} from "./format";

/** Make expectations readable: "1.620 kcal" with a normal space → NBSP; "-" → real minus. */
const u = (s: string) => s.replace(/ /g, NBSP);

describe("formatNumber", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [999, "999"],
    [1620, "1.620"],
    [1620.6, "1.621"],
    [12345678, "12.345.678"],
    [-400, `${MINUS}400`],
  ])("%s → %s", (n, expected) => {
    expect(formatNumber(n)).toBe(expected);
  });

  it("respects fraction digit options", () => {
    expect(formatNumber(2.46, { maxFractionDigits: 1 })).toBe("2,5");
    expect(formatNumber(2, { maxFractionDigits: 1 })).toBe("2");
    expect(formatNumber(2, { minFractionDigits: 1, maxFractionDigits: 1 })).toBe("2,0");
    expect(formatNumber(1234.5678, { maxFractionDigits: 2 })).toBe("1.234,57");
  });

  it("never renders negative zero", () => {
    expect(formatNumber(-0)).toBe("0");
    expect(formatNumber(-0.4)).toBe("0");
    expect(formatNumber(-0.04, { maxFractionDigits: 1 })).toBe("0");
  });

  it("supports explicit signs", () => {
    expect(formatNumber(250, { signed: true })).toBe("+250");
    expect(formatNumber(-250, { signed: true })).toBe(`${MINUS}250`);
    expect(formatNumber(0, { signed: true })).toBe("0");
    expect(formatNumber(0.2, { signed: true })).toBe("0");
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "renders %s as placeholder",
    (value) => {
      expect(formatNumber(value)).toBe(EMPTY_VALUE);
    },
  );
});

describe("unit formatters", () => {
  it("formatKcal", () => {
    expect(formatKcal(1620)).toBe(u("1.620 kcal"));
    expect(formatKcal(1620.4)).toBe(u("1.620 kcal"));
    expect(formatKcal(0)).toBe(u("0 kcal"));
    expect(formatKcal(null)).toBe(u("– kcal"));
  });

  it("joins number and unit with a no-break space", () => {
    expect(formatKcal(1620)).toBe("1.620 kcal");
  });

  it("formatSignedKcal uses a real minus sign", () => {
    expect(formatSignedKcal(-400)).toBe(u("−400 kcal"));
    expect(formatSignedKcal(-400)).not.toContain("-");
    expect(formatSignedKcal(250)).toBe(u("+250 kcal"));
    expect(formatSignedKcal(0)).toBe(u("0 kcal"));
    expect(formatSignedKcal(-1234.6)).toBe(u("−1.235 kcal"));
  });

  it.each([
    [142, "142 g"],
    [142.6, "143 g"],
    [10, "10 g"],
    [9.96, "10 g"],
    [2.5, "2,5 g"],
    [2.54, "2,5 g"],
    [2, "2 g"],
    [0.3, "0,3 g"],
    [0.04, "0 g"],
    [1250, "1.250 g"],
    [-2.5, "−2,5 g"],
  ])("formatGrams(%s) → %s", (n, expected) => {
    expect(formatGrams(n)).toBe(u(expected));
  });

  it.each([
    [0.25, "0,25 mg"],
    [0.004, "0 mg"],
    [2.54, "2,5 mg"],
    [140.4, "140 mg"],
    [2400, "2.400 mg"],
  ])("formatMg(%s) → %s", (n, expected) => {
    expect(formatMg(n)).toBe(u(expected));
  });

  it("formatMl / formatLiters", () => {
    expect(formatMl(250)).toBe(u("250 ml"));
    expect(formatMl(1500)).toBe(u("1.500 ml"));
    expect(formatLiters(1500)).toBe(u("1,5 l"));
    expect(formatLiters(2000)).toBe(u("2 l"));
    expect(formatLiters(2250)).toBe(u("2,25 l"));
    expect(formatLiters(2250, { maxFractionDigits: 1 })).toBe(u("2,3 l"));
    expect(formatLiters(undefined)).toBe(u("– l"));
  });

  it("formatWeightKg always shows one decimal", () => {
    expect(formatWeightKg(82.4)).toBe(u("82,4 kg"));
    expect(formatWeightKg(82.44)).toBe(u("82,4 kg"));
    expect(formatWeightKg(82)).toBe(u("82,0 kg"));
    expect(formatWeightKg(104.25)).toBe(u("104,3 kg"));
    expect(formatWeightKg(-0.4, { signed: true })).toBe(u("−0,4 kg"));
    expect(formatWeightKg(0.4, { signed: true })).toBe(u("+0,4 kg"));
  });

  it("formatPercent takes a ratio", () => {
    expect(formatPercent(0.25)).toBe(u("25 %"));
    expect(formatPercent(1.234)).toBe(u("123 %"));
    expect(formatPercent(0.125, { maxFractionDigits: 1 })).toBe(u("12,5 %"));
    expect(formatPercent(0)).toBe(u("0 %"));
    expect(formatPercent(Number.NaN)).toBe(u("– %"));
  });
});

describe("date formatters", () => {
  // 2026-09-22 is a Tuesday, 2025-09-22 a Monday.
  it("formatRelativeDay", () => {
    const today = "2026-09-22";
    expect(formatRelativeDay("2026-09-22", today)).toBe("Heute");
    expect(formatRelativeDay("2026-09-21", today)).toBe("Gestern");
    expect(formatRelativeDay("2026-09-23", today)).toBe("Morgen");
    expect(formatRelativeDay("2026-09-20", today)).toBe("So., 20. Sep.");
    expect(formatRelativeDay("2026-09-24", today)).toBe("Do., 24. Sep.");
    expect(formatRelativeDay("2025-09-22", today)).toBe("Mo., 22. Sep. 2025");
  });

  it("formatRelativeDay handles month and year boundaries", () => {
    expect(formatRelativeDay("2025-12-31", "2026-01-01")).toBe("Gestern");
    expect(formatRelativeDay("2026-03-01", "2026-02-28")).toBe("Morgen");
    expect(formatRelativeDay("2024-02-29", "2024-03-01")).toBe("Gestern");
    expect(formatRelativeDay("2026-03-03", "2026-02-28")).toBe("Di., 3. März");
  });

  it("formatDateLong", () => {
    expect(formatDateLong("2026-09-22")).toBe("Dienstag, 22. September 2026");
    expect(formatDateLong("2026-03-01")).toBe("Sonntag, 1. März 2026");
    expect(formatDateLong("2026-09-22", { weekday: false })).toBe("22. September 2026");
  });

  it("formatDateShort / formatWeekdayShort", () => {
    expect(formatDateShort("2026-01-05")).toBe("5. Jan.");
    expect(formatDateShort("2026-06-15")).toBe("15. Juni");
    expect(formatDateShort("2026-12-24", { withYear: true })).toBe("24. Dez. 2026");
    expect(formatWeekdayShort("2026-09-27")).toBe("So.");
    expect(formatWeekdayShort("2026-09-21")).toBe("Mo.");
  });

  it("accepts timestamps by using their date part", () => {
    expect(formatDateShort("2026-09-22T23:59:00Z")).toBe("22. Sep.");
  });

  it("throws on invalid dates (programmer error)", () => {
    expect(() => formatDateLong("22.09.2026")).toThrow(RangeError);
  });

  it("all 12 months are mapped", () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      formatDateShort(`2026-${String(i + 1).padStart(2, "0")}-01`),
    );
    expect(months).toEqual([
      "1. Jan.",
      "1. Feb.",
      "1. März",
      "1. Apr.",
      "1. Mai",
      "1. Juni",
      "1. Juli",
      "1. Aug.",
      "1. Sep.",
      "1. Okt.",
      "1. Nov.",
      "1. Dez.",
    ]);
  });
});

describe("parseDecimalInput", () => {
  it.each([
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["250", 250],
    [" 250 ", 250],
    ["0,25", 0.25],
    [",5", 0.5],
    [".5", 0.5],
    ["5,", 5],
    ["-2,5", -2.5],
    ["−2,5", -2.5],
    ["+3", 3],
    ["1.250,5", 1250.5],
    ["1,250.5", 1250.5],
    ["1.000.000", 1000000],
    ["1,000,000", 1000000],
    ["1 500", 1500],
    ["1 500,5", 1500.5],
    ["1.500", 1.5],
    ["007", 7],
  ])("%j → %s", (input, expected) => {
    expect(parseDecimalInput(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "-",
    "abc",
    "1,2,3,4x",
    "1.2.3",
    "1,5,5.0",
    "1.250,5,1",
    "12a",
    "1e5",
    "Infinity",
    "NaN",
  ])("%j → null", (input) => {
    expect(parseDecimalInput(input)).toBeNull();
  });

  it("handles null/undefined", () => {
    expect(parseDecimalInput(null)).toBeNull();
    expect(parseDecimalInput(undefined)).toBeNull();
  });

  it("round-trips formatted numbers", () => {
    expect(parseDecimalInput(formatNumber(1234.5, { maxFractionDigits: 1 }))).toBe(1234.5);
    expect(parseDecimalInput(formatNumber(-2.5, { maxFractionDigits: 1 }))).toBe(-2.5);
  });
});
