import { describe, expect, it } from "vitest";
import { formatNumber, formatServings, parseGermanNumber, stepPrecision, stepValue } from "./number-utils";

describe("parseGermanNumber", () => {
  it.each([
    ["1,5", 1.5],
    ["0,25", 0.25],
    [",5", 0.5],
    ["12", 12],
    ["1.234,5", 1234.5],
    ["1.234.567", 1234567],
    ["1.5", 1.5],
    ["0.125", 0.125],
    ["1.500", 1500],
    ["12.5", 12.5],
    ["1,", 1],
    [" 72,4 ", 72.4],
    ["-3,5", -3.5],
  ])("parses %j → %d", (input, expected) => {
    expect(parseGermanNumber(input)).toBe(expected);
  });

  it.each(["", "-", ",", "abc", "1,2,3", "12a", "1.23,4", "1..2"])("rejects %j", (input) => {
    expect(parseGermanNumber(input)).toBeNull();
  });
});

describe("formatNumber", () => {
  it("formats German numbers", () => {
    expect(formatNumber(1234.5, { decimals: 1 })).toBe("1.234,5");
    expect(formatNumber(1234.56)).toBe("1.235");
    expect(formatNumber(72, { decimals: 1, fixed: true })).toBe("72,0");
    expect(formatNumber(1234, { grouping: false })).toBe("1234");
    expect(formatNumber(-0.2)).toBe("0");
    expect(formatNumber(Number.NaN)).toBe("–");
  });
});

describe("stepValue", () => {
  it("steps and snaps to the step grid", () => {
    expect(stepValue(1, 1, { step: 1 })).toBe(2);
    expect(stepValue(1.3, 1, { step: 0.25 })).toBe(1.5);
    expect(stepValue(1.3, -1, { step: 0.25 })).toBe(1.25);
    expect(stepValue(0.1, 1, { step: 0.1 })).toBe(0.2);
    expect(stepValue(0.2, 1, { step: 0.1 })).toBe(0.3);
  });

  it("clamps into min/max", () => {
    expect(stepValue(0.25, -1, { step: 0.25, min: 0.25 })).toBe(0.25);
    expect(stepValue(10, 1, { step: 1, max: 10 })).toBe(10);
  });

  it("knows step precision", () => {
    expect(stepPrecision(1)).toBe(0);
    expect(stepPrecision(0.25)).toBe(2);
    expect(stepPrecision(1e-7)).toBe(7);
  });
});

describe("formatServings", () => {
  it("uses fraction glyphs for common portions", () => {
    expect(formatServings(0.5)).toBe("½");
    expect(formatServings(1.25)).toBe("1¼");
    expect(formatServings(2.75)).toBe("2¾");
    expect(formatServings(2)).toBe("2");
    expect(formatServings(1.3)).toBe("1,3");
  });
});
