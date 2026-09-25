import { describe, expect, it } from "vitest";

import { parseDecimalInput } from "@/lib/format";

import { formatDraft, formatServings, stepPrecision, stepValue } from "./number-utils";

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

describe("formatDraft", () => {
  it("formats without grouping so drafts round-trip through parseDecimalInput", () => {
    expect(formatDraft(1500, 0)).toBe("1500");
    expect(formatDraft(72.45, 2)).toBe("72,45");
    expect(formatDraft(72.45, 1)).toBe("72,5");
    expect(formatDraft(null, 1)).toBe("");
    for (const n of [1500, 1234.5, 0.25, 72.4, -3.5]) {
      expect(parseDecimalInput(formatDraft(n, 2))).toBe(n);
    }
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
