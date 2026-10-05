import { describe, expect, it } from "vitest";
import {
  barcodeLookupVariants,
  cleanBarcodeInput,
  gtinCheckDigit,
  isValidGtin,
  normalizeBarcode,
  parseBarcode,
} from "./barcode";

describe("gtinCheckDigit", () => {
  it.each([
    ["400041702500", 5], // Ritter Sport Marzipan (EAN-13)
    ["544900000099", 6], // Coca-Cola 0,33 l
    ["4089624", 3], // EAN-8
    ["04900002891", 1], // UPC-A
    ["0000000000000", 0],
  ])("%s → %i", (body, digit) => {
    expect(gtinCheckDigit(body)).toBe(digit);
  });

  it("rejects non-digit bodies", () => {
    expect(() => gtinCheckDigit("12a")).toThrow();
  });
});

describe("isValidGtin", () => {
  it.each(["4000417025005", "5449000000996", "40896243", "049000028911", "00049000028911"])(
    "%s is valid",
    (code) => expect(isValidGtin(code)).toBe(true),
  );
  it.each(["4000417025006", "1234567", "123456789", "abc", "", "400041702500512"])(
    "%s is invalid",
    (code) => expect(isValidGtin(code)).toBe(false),
  );
});

describe("parseBarcode", () => {
  it("keeps EAN-13 as is", () => {
    expect(parseBarcode("4000417025005")).toEqual({
      code: "4000417025005",
      format: "ean13",
      gtin14: "04000417025005",
      checksumValid: true,
    });
  });

  it("pads UPC-A to 13 digits", () => {
    const p = parseBarcode("049000028911");
    expect(p?.code).toBe("0049000028911");
    expect(p?.format).toBe("upca");
  });

  it("collapses zero-padded EAN-8 back to 8 digits", () => {
    expect(parseBarcode("0000040896243")?.code).toBe("40896243");
    expect(parseBarcode("00000040896243")?.format).toBe("ean8");
    expect(parseBarcode("40896243")?.code).toBe("40896243");
  });

  it("keeps GTIN-14 with an indicator digit", () => {
    const p = parseBarcode("14000417025002");
    expect(p?.format).toBe("gtin14");
    expect(p?.code).toBe("14000417025002");
    expect(p?.checksumValid).toBe(true);
  });

  it("strips whitespace and dashes", () => {
    expect(cleanBarcodeInput(" 4 000417-025005 ")).toBe("4000417025005");
    expect(parseBarcode(" 4 000417-025005 ")?.code).toBe("4000417025005");
  });

  it("treats 9-11 digit inputs as GTINs that lost leading zeros", () => {
    expect(parseBarcode("49000028911")?.code).toBe("0049000028911");
  });

  it("reports invalid checksums instead of rejecting", () => {
    expect(parseBarcode("4000417025006")?.checksumValid).toBe(false);
  });

  it.each(["", "1234567", "123456789012345", "00000000", "abc"])("rejects %j", (input) => {
    expect(parseBarcode(input)).toBeNull();
  });
});

describe("normalizeBarcode", () => {
  it("returns the canonical code", () => {
    expect(normalizeBarcode("0049000028911")).toBe("0049000028911");
    expect(normalizeBarcode("049000028911")).toBe("0049000028911");
    expect(normalizeBarcode("00000040896243")).toBe("40896243");
  });

  it("rejects wrong check digits by default", () => {
    expect(normalizeBarcode("4000417025006")).toBeNull();
    expect(normalizeBarcode("4000417025006", { requireValidChecksum: false })).toBe("4000417025006");
  });
});

describe("barcodeLookupVariants", () => {
  it("lists all spellings, canonical first", () => {
    expect(barcodeLookupVariants("049000028911")).toEqual([
      "0049000028911",
      "049000028911",
      "49000028911",
      "00049000028911",
    ]);
  });

  it("includes padded forms for EAN-8", () => {
    const v = barcodeLookupVariants("40896243");
    expect(v[0]).toBe("40896243");
    expect(v).toContain("0000040896243");
    expect(v).toContain("00000040896243");
  });

  it("returns [] for garbage", () => {
    expect(barcodeLookupVariants("abc")).toEqual([]);
  });
});
