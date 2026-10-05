import { describe, expect, it } from "vitest";
import {
  baseServing,
  formatAmountDe,
  formatServingLabel,
  parseAmount,
  parseQuantity,
  parseServing,
  toBasisUnits,
} from "./units";

describe("parseAmount", () => {
  it.each([
    ["1", 1],
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["1/2", 0.5],
    ["1 1/2", 1.5],
    ["3 / 4", 0.75],
  ])("%s → %d", (input, expected) => expect(parseAmount(input)).toBe(expected));

  it("rejects division by zero and garbage", () => {
    expect(parseAmount("1/0")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("parseServing: plain weights and volumes", () => {
  it.each([
    ["30 g", { label: "30 g", amount: 30, unit: "g", grams: 30 }],
    ["30g", { label: "30 g", amount: 30, unit: "g", grams: 30 }],
    ["42 gram", { label: "42 g", amount: 42, unit: "g", grams: 42 }],
    ["12,5 g", { label: "12,5 g", amount: 12.5, unit: "g", grams: 12.5 }],
    ["1 kg", { label: "1.000 g", amount: 1000, unit: "g", grams: 1000 }],
    ["10 g (10 Gramme)", { label: "10 g", amount: 10, unit: "g", grams: 10 }],
    ["1 égoutté (100 g)", { label: "100 g", amount: 100, unit: "g", grams: 100 }],
  ])("%s", (input, expected) => {
    expect(parseServing(input)).toEqual(expected);
  });

  it("parses ml for liquids", () => {
    expect(parseServing("250 ml", { basis: "ml" })).toEqual({
      label: "250 ml",
      amount: 250,
      unit: "ml",
      grams: 250,
    });
    expect(parseServing("0,5 l", { basis: "ml" })).toMatchObject({ unit: "ml", amount: 500, grams: 500 });
    expect(parseServing("33 cl", { basis: "ml" })).toMatchObject({ grams: 330 });
  });

  it("converts ml to g using density (default 1)", () => {
    expect(parseServing("100 ml")?.grams).toBe(100);
    expect(parseServing("100 ml", { densityGPerMl: 0.92 })?.grams).toBe(92);
    expect(parseServing("103 g", { basis: "ml", densityGPerMl: 1.03 })?.grams).toBe(100);
  });

  it("prefers metric over imperial units", () => {
    expect(parseServing("1 oz (28 g)")).toMatchObject({ unit: "g", grams: 28 });
    expect(parseServing("1 oz")?.grams).toBeCloseTo(28.35, 1);
    expect(parseServing("8 fl oz (240 ml)", { basis: "ml" })?.grams).toBe(240);
  });
});

describe("parseServing: counted units", () => {
  it.each([
    ["1 Stück (60 g)", { label: "1 Stück (60 g)", amount: 1, unit: "piece", grams: 60 }],
    ["2 Scheiben = 50g", { label: "2 Scheiben (50 g)", amount: 2, unit: "slice", grams: 50 }],
    ["1 Scheibe (45 g)", { label: "1 Scheibe (45 g)", amount: 1, unit: "slice", grams: 45 }],
    ["1 EL (15 ml)", { label: "1 EL (15 g)", amount: 1, unit: "tbsp", grams: 15 }],
    ["1 TL = 5 g", { label: "1 TL (5 g)", amount: 1, unit: "tsp", grams: 5 }],
    ["3 pieces (30 g)", { label: "3 Stück (30 g)", amount: 3, unit: "piece", grams: 30 }],
    ["1 bar (40g)", { label: "1 Riegel (40 g)", amount: 1, unit: "piece", grams: 40 }],
    ["1 Cube (6.52 g)", { label: "1 Würfel (6,5 g)", amount: 1, unit: "piece", grams: 6.52 }],
    ["2 cookies (28 g)", { label: "2 Kekse (28 g)", amount: 2, unit: "piece", grams: 28 }],
    ["1 portion (27.5 g)", { label: "1 Portion (27,5 g)", amount: 1, unit: "serving", grams: 27.5 }],
    ["30 g (1 portion)", { label: "1 Portion (30 g)", amount: 1, unit: "serving", grams: 30 }],
    ["Portion (125 g)", { label: "1 Portion (125 g)", amount: 1, unit: "serving", grams: 125 }],
    ["1 Becher (150 g)", { label: "1 Becher (150 g)", amount: 1, unit: "package", grams: 150 }],
    ["1 Packung = 200 g", { label: "1 Packung (200 g)", amount: 1, unit: "package", grams: 200 }],
    ["1 Ei (60 g)", { label: "1 Ei (60 g)", amount: 1, unit: "piece", grams: 60 }],
    ["2 Eier (120 g)", { label: "2 Eier (120 g)", amount: 2, unit: "piece", grams: 120 }],
    ["1 Handvoll (30 g)", { label: "1 Handvoll (30 g)", amount: 1, unit: "serving", grams: 30 }],
  ])("%s", (input, expected) => {
    expect(parseServing(input)).toEqual(expected);
  });

  it("parses containers for liquids", () => {
    expect(parseServing("1 Glass (250 ml)", { basis: "ml" })).toEqual({
      label: "1 Glas (250 ml)",
      amount: 1,
      unit: "glass",
      grams: 250,
    });
    expect(parseServing("1 Flasche (500 ml)", { basis: "ml" })).toMatchObject({ unit: "bottle", grams: 500 });
    expect(parseServing("1 can (330 ml)", { basis: "ml" })).toMatchObject({
      unit: "can",
      label: "1 Dose (330 ml)",
      grams: 330,
    });
    expect(parseServing("1 cup (240 ml)", { basis: "ml" })).toMatchObject({ unit: "cup", label: "1 Tasse (240 ml)" });
  });

  it("handles unicode and ascii fractions", () => {
    expect(parseServing("½ Packung", { packageSize: 250 })).toEqual({
      label: "½ Packung (125 g)",
      amount: 0.5,
      unit: "package",
      grams: 125,
    });
    expect(parseServing("1½ Scheiben (60 g)")).toMatchObject({ amount: 1.5, label: "1½ Scheiben (60 g)" });
    expect(parseServing("1/4 Tafel (25 g)")).toMatchObject({ amount: 0.25, unit: "piece", label: "¼ Tafel (25 g)" });
  });

  it("uses default household volumes only for liquids or known density", () => {
    expect(parseServing("1 EL", { basis: "ml" })).toMatchObject({ unit: "tbsp", grams: 15 });
    expect(parseServing("2 TL", { basis: "ml" })).toMatchObject({ unit: "tsp", grams: 10 });
    expect(parseServing("1 Glas", { basis: "ml" })).toMatchObject({ unit: "glass", grams: 200 });
    expect(parseServing("1 EL", { densityGPerMl: 0.92 })?.grams).toBeCloseTo(13.8);
    expect(parseServing("1 EL")).toBeNull();
  });

  it("returns null when no amount can be derived", () => {
    expect(parseServing("½ Packung")).toBeNull();
    expect(parseServing("1 Stück")).toBeNull();
    expect(parseServing("1 CONTAINER")).toBeNull();
    expect(parseServing("")).toBeNull();
    expect(parseServing("lecker")).toBeNull();
    expect(parseServing("0 g")).toBeNull();
    expect(parseServing("20000 g")).toBeNull();
  });

  it("keeps a provided label", () => {
    expect(parseServing("1 Stück (180 g)", { label: "1 Stück (mittel)" })).toMatchObject({
      label: "1 Stück (mittel)",
      grams: 180,
    });
  });
});

describe("parseQuantity", () => {
  it.each([
    ["500g", { total: 500, unit: "g", count: 1, unitSize: 500 }],
    ["1 l", { total: 1000, unit: "ml", count: 1, unitSize: 1000 }],
    ["70 cl", { total: 700, unit: "ml", count: 1, unitSize: 700 }],
    ["0.5 kg", { total: 500, unit: "g", count: 1, unitSize: 500 }],
    ["100 g ℮", { total: 100, unit: "g", count: 1, unitSize: 100 }],
    ["1 Liter", { total: 1000, unit: "ml", count: 1, unitSize: 1000 }],
    ["6 x 1,5 l", { total: 9000, unit: "ml", count: 6, unitSize: 1500 }],
    ["4x125g", { total: 500, unit: "g", count: 4, unitSize: 125 }],
    ["330 mL", { total: 330, unit: "ml", count: 1, unitSize: 330 }],
  ])("%s", (input, expected) => {
    expect(parseQuantity(input)).toEqual(expected);
  });

  it.each([null, undefined, "", "Packung", "12 Stück"])("returns null for %j", (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe("formatting", () => {
  it.each([
    [0.5, "½"],
    [0.25, "¼"],
    [1.5, "1½"],
    [2, "2"],
    [1.2, "1,2"],
  ])("formatAmountDe(%d) → %s", (n, s) => expect(formatAmountDe(n)).toBe(s));

  it("builds German labels with notes and plural forms", () => {
    expect(formatServingLabel({ amount: 1, unit: "piece", grams: 180, note: "mittel" })).toBe(
      "1 Stück (mittel, 180 g)",
    );
    expect(formatServingLabel({ amount: 2, unit: "glass", grams: 400, basis: "ml" })).toBe("2 Gläser (400 ml)");
    expect(formatServingLabel({ amount: 1, unit: "tbsp" })).toBe("1 EL");
  });

  it("base serving and unit conversion", () => {
    expect(baseServing("ml")).toEqual({ label: "100 ml", amount: 100, unit: "ml", grams: 100 });
    expect(toBasisUnits(100, "ml", "g", 1.03)).toBeCloseTo(103);
    expect(toBasisUnits(100, "g", "g")).toBe(100);
  });
});
