/**
 * maskKey.ts
 *
 * License key masking for Cloud Functions.
 * Mirrors the algorithm in src/lib/audit/maskSecrets.ts but returns a plain
 * string (the functions package has no branded-type dependency on the app src).
 *
 * Algorithm:
 *   - Collect indices of all alphanumeric characters in the raw string.
 *   - If there are 4 or fewer alphanumeric characters, return the key as-is.
 *   - Otherwise preserve the LAST up-to-4 alphanumeric characters unchanged.
 *   - Replace every other alphanumeric character with '*'.
 *   - Non-alphanumeric characters (dashes, spaces, etc.) keep their positions.
 *
 * Examples:
 *   'XCVF-7TR5-9HJK-5592'  ->  '****-****-****-5592'
 *   'ABCD1234'              ->  '****1234'
 *   'AB'                    ->  'AB'
 *   ''                      ->  ''
 */
export function maskKey(raw: string): string {
  if (raw.length === 0) return ''

  const alnumIndices: number[] = []
  for (let i = 0; i < raw.length; i++) {
    if (/[a-zA-Z0-9]/.test(raw[i]!)) {
      alnumIndices.push(i)
    }
  }

  // 4 or fewer alphanumeric chars → nothing masked
  if (alnumIndices.length <= 4) return raw

  const keepSet = new Set(alnumIndices.slice(-4))

  let result = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (/[a-zA-Z0-9]/.test(ch)) {
      result += keepSet.has(i) ? ch : '*'
    } else {
      result += ch
    }
  }
  return result
}
