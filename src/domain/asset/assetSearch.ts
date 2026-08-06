/**
 * Pure text-search predicate for Asset list filtering.
 * NO Firebase, NO React — safe to call from adapters, hooks, and pages alike.
 *
 * Used by:
 *   - firestoreAssetRepository.listAssets (infra layer, server-fetched rows)
 *   - AssetsPage (UI layer, client-side memo after removing search from SWR key)
 */

/**
 * Returns true when the asset matches the given search string.
 *
 * Semantics:
 *   - Trims and lowercases `search` before comparing.
 *   - Empty (or whitespace-only) `search` always returns true.
 *   - Joins non-null/non-empty fields [invCode, brand, model, serial] with a
 *     space, lowercases the result, and checks `.includes(search)`.
 *   - Identical to the inline filter previously in firestoreAssetRepository
 *     (lines 161-166) so behaviour is byte-identical before/after extraction.
 */
export function matchesAssetSearch(
  a: Pick<{ invCode: string; brand: string | null; model: string | null; serial: string | null },
         'invCode' | 'brand' | 'model' | 'serial'>,
  search: string,
): boolean {
  const s = search.trim().toLowerCase()
  if (!s) return true
  return [a.invCode, a.brand, a.model, a.serial]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(s)
}
