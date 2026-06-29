/** A new asset barcode: a 9-digit numeric string, first digit 1-9 (e.g. "100309088"). */
export function generateBarcodeCandidate(): string {
  const n = 100_000_000 + Math.floor(Math.random() * 900_000_000)
  return String(n)
}

/**
 * Generates a unique barcode by probing `isTaken` until a free candidate is found.
 * Throws if no free value is found within `maxAttempts` (practically never — 900M space).
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
