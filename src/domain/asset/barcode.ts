/**
 * Asset barcodes are EAN-13 numeric strings (13 digits, valid check digit).
 * Legacy assets keep their old 9-digit codes (rendered as Code 128);
 * newly created assets are assigned EAN-13 codes.
 */

/**
 * Computes the EAN-13 check digit for the first 12 digits.
 * Positions 1..12 left-to-right: odd positions ×1, even positions ×3;
 * check digit = (10 - sum % 10) % 10.
 */
export function ean13CheckDigit(digits12: string): string {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = digits12.charCodeAt(i) - 48
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return String((10 - (sum % 10)) % 10)
}

/** True iff `value` is exactly 13 digits and its 13th digit is the valid EAN-13 check digit. */
export function isValidEan13(value: string): boolean {
  return /^\d{13}$/.test(value) && value[12] === ean13CheckDigit(value.slice(0, 12))
}

/** A new asset barcode candidate: a valid EAN-13 with a non-zero first digit (e.g. "6291041500213"). */
export function generateBarcodeCandidate(): string {
  let digits = String(1 + Math.floor(Math.random() * 9))
  for (let i = 0; i < 11; i++) {
    digits += String(Math.floor(Math.random() * 10))
  }
  return digits + ean13CheckDigit(digits)
}

/**
 * Generates a unique barcode by probing `isTaken` until a free candidate is found.
 * Throws if no free value is found within `maxAttempts` (practically never — 900B space).
 */
export async function allocateUniqueBarcode(
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 10,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generateBarcodeCandidate()
    if (!(await isTaken(candidate))) return candidate
  }
  throw new Error('Could not allocate a unique barcode after multiple attempts')
}
