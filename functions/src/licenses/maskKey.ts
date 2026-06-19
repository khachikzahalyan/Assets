/**
 * maskKey.ts
 *
 * License key masking for Cloud Functions.
 * Mirrors the algorithm in src/lib/audit/maskSecrets.ts but returns a plain
 * string (the functions package has no branded-type dependency on the app src).
 *
 * Algorithm:
 *   - Collect indices of all alphanumeric characters in the raw string.
 *   - Preserve the last 4 alphanumeric characters ONLY IF the key has STRICTLY
 *     MORE THAN 4 alphanumeric characters; otherwise mask ALL of them.
 *   - Replace every masked alphanumeric character with '*'.
 *   - Non-alphanumeric characters (dashes, spaces, etc.) keep their positions.
 *
 * Examples:
 *   'XCVF-7TR5-9HJK-5592'  ->  '****-****-****-5592'
 *   'ABCD1234'              ->  '****1234'
 *   'AB'                    ->  '**'   (short key — fully masked)
 *   'ABCD'                  ->  '****' (exactly 4 alnum — fully masked)
 *   'AB-CD'                 ->  '**-**' (4 alnum with separator — fully masked)
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

  // Preserve last 4 alnum chars ONLY when there are strictly more than 4;
  // if there are 4 or fewer, mask them all (keepCount = 0).
  const keepCount = alnumIndices.length > 4 ? 4 : 0
  const keepSet = new Set(alnumIndices.slice(alnumIndices.length - keepCount))

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
