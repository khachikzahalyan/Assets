/**
 * maskSecrets.ts
 *
 * Key masking utilities for the license module.
 * License keys MUST be masked before any value reaches audit_logs.
 *
 * Mask format (non-negotiable):
 *   - Collect all alphanumeric characters in the raw string.
 *   - Preserve the LAST up-to-4 of those characters in their original positions
 *     ONLY IF the key has STRICTLY MORE THAN 4 alphanumeric characters.
 *   - If the key has 4 OR FEWER alphanumeric characters, mask ALL of them.
 *   - Replace every masked alphanumeric character with '*'.
 *   - All non-alphanumeric characters (dashes, spaces, etc.) keep their positions.
 *
 * Examples:
 *   'XCVF-7TR5-9HJK-5592'  ->  '****-****-****-5592'
 *   'ABCD1234'              ->  '****1234'
 *   'AAAA BBBB-CCCC'        ->  '**** ****-CCCC'
 *   'AB'                    ->  '**'   (short key — fully masked)
 *   'ABCD'                  ->  '****' (exactly 4 alnum — fully masked)
 *   'AB-CD'                 ->  '**-**' (4 alnum with separator — fully masked)
 *   ''                      ->  ''
 */

// ---------------------------------------------------------------------------
// Branded type — a raw `string` is NOT assignable to MaskedKey.
// ---------------------------------------------------------------------------

declare const MaskedKeyBrand: unique symbol
export type MaskedKey = string & { readonly [MaskedKeyBrand]: true }

// ---------------------------------------------------------------------------
// maskLicenseKey
// ---------------------------------------------------------------------------

/**
 * Mask a license key string according to the AMS mask format.
 * Returns a branded MaskedKey so type-safe callers cannot accidentally
 * pass a raw key where a masked key is expected.
 */
export function maskLicenseKey(raw: string): MaskedKey {
  if (raw.length === 0) {
    return '' as MaskedKey
  }

  // Collect the indices (into `raw`) of every alphanumeric character.
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

  // Rebuild the string character by character.
  let result = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (/[a-zA-Z0-9]/.test(ch)) {
      result += keepSet.has(i) ? ch : '*'
    } else {
      result += ch
    }
  }

  return result as MaskedKey
}

// ---------------------------------------------------------------------------
// sanitizeLicenseAuditPayload
// ---------------------------------------------------------------------------

/**
 * Recursive belt-and-braces sanitizer.
 * Walk any object/array structure and replace the value of any property
 * literally named `key` (when the value is a string) with its masked form.
 *
 * This defends against raw license keys leaking via `unknown`-typed paths
 * that bypass the branded-type check at compile time.
 */
export function sanitizeLicenseAuditPayload<T>(payload: T): T {
  if (payload === null || typeof payload !== 'object') {
    // Primitives and null pass through unchanged.
    return payload
  }

  if (Array.isArray(payload)) {
    return payload.map(
      (item: unknown) => sanitizeLicenseAuditPayload(item),
    ) as unknown as T
  }

  // Plain object — shallow-clone and recurse.
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (k === 'key' && typeof v === 'string') {
      result[k] = maskLicenseKey(v)
    } else {
      result[k] = sanitizeLicenseAuditPayload(v)
    }
  }
  return result as unknown as T
}
