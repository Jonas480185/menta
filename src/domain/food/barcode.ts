/**
 * Barcode (GTIN) normalization: pure, framework-free.
 *
 * Supported: EAN-8 (GTIN-8), UPC-A (GTIN-12), EAN-13 (GTIN-13), GTIN-14.
 * All of them are the same number space once left-padded to 14 digits, so
 * "049000028911" (UPC-A), "0049000028911" (EAN-13 with leading zero) and
 * "00049000028911" (GTIN-14) are the same product.
 *
 * Canonical form (what we store in `foods.barcode` and use as OFF source id):
 * - GTIN-8 range  (14-digit form starts with 000000) → 8 digits
 * - GTIN-12/13    (14-digit form starts with 0)      → 13 digits (UPC-A gets a leading 0)
 * - GTIN-14       (indicator digit 1-9)              → 14 digits
 *
 * This matches how Open Food Facts keys its products (it also left-pads UPC-A to 13 digits).
 */

export type BarcodeFormat = "ean8" | "upca" | "ean13" | "gtin14";

export interface ParsedBarcode {
  /** Canonical code, see module docs. */
  code: string;
  /** Format of the canonical code ("upca" only when the input was a 12-digit UPC-A). */
  format: BarcodeFormat;
  /** Left-padded 14-digit GTIN. */
  gtin14: string;
  /** Whether the GS1 check digit is correct. */
  checksumValid: boolean;
}

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** Strips everything except digits (spaces, dashes, dots are common in manual input). */
export function cleanBarcodeInput(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Computes the GS1 check digit for a GTIN body (all digits except the check digit).
 * Weights alternate 3,1,3,… starting from the rightmost body digit.
 */
export function gtinCheckDigit(body: string): number {
  if (!/^\d+$/.test(body)) throw new Error(`Invalid GTIN body: ${body}`);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = body.charCodeAt(body.length - 1 - i) - 48;
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** True if `code` is an 8/12/13/14-digit GTIN with a valid check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || !GTIN_LENGTHS.has(code.length)) return false;
  return gtinCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * Parses any user/provider barcode input. Returns null for inputs that cannot be a GTIN
 * (non-digits only, fewer than 8 or more than 14 digits, all zeros).
 * Inputs with 9-11 digits are treated as GTIN-13s that lost leading zeros (seen in
 * spreadsheets / CSV dumps).
 */
export function parseBarcode(input: string): ParsedBarcode | null {
  const digits = cleanBarcodeInput(input);
  if (digits.length < 8 || digits.length > 14) return null;
  if (/^0+$/.test(digits)) return null;

  const gtin14 = digits.padStart(14, "0");
  const checksumValid = gtinCheckDigit(gtin14.slice(0, 13)) === Number(gtin14[13]);

  let code: string;
  let format: BarcodeFormat;
  if (gtin14.startsWith("000000")) {
    code = gtin14.slice(6);
    format = "ean8";
  } else if (gtin14.startsWith("0")) {
    code = gtin14.slice(1);
    format = digits.length === 12 ? "upca" : "ean13";
  } else {
    code = gtin14;
    format = "gtin14";
  }
  return { code, format, gtin14, checksumValid };
}

export interface NormalizeBarcodeOptions {
  /** Reject codes with a wrong check digit (default true). */
  requireValidChecksum?: boolean;
}

/**
 * Canonical barcode or null. Use this before storing or looking up barcodes.
 *
 * normalizeBarcode("4 000417 025005") → "4000417025005"
 * normalizeBarcode("049000028911")    → "0049000028911"
 * normalizeBarcode("00000040896243")  → "40896243"
 */
export function normalizeBarcode(input: string, opts: NormalizeBarcodeOptions = {}): string | null {
  const parsed = parseBarcode(input);
  if (!parsed) return null;
  if ((opts.requireValidChecksum ?? true) && !parsed.checksumValid) return null;
  return parsed.code;
}

/**
 * All spellings under which the same product may be stored upstream or in our DB
 * (canonical first). Useful for `WHERE barcode IN (...)` lookups.
 */
export function barcodeLookupVariants(input: string): string[] {
  const parsed = parseBarcode(input);
  if (!parsed) return [];
  const variants = new Set<string>([parsed.code]);
  const stripped = parsed.gtin14.replace(/^0+/, "");
  if (parsed.format !== "gtin14") {
    // 13-digit and 12-digit (UPC-A) spellings
    variants.add(parsed.gtin14.slice(1));
    if (parsed.gtin14.startsWith("00")) variants.add(parsed.gtin14.slice(2));
  }
  if (stripped.length >= 8) variants.add(stripped);
  variants.add(parsed.gtin14);
  return [...variants];
}
