export interface MobileListPlaceholdersProps {
  /** Number of placeholder slots to render. Values ≤ 0 render nothing. */
  count: number
  /** data-testid applied to every placeholder div (for test assertions). */
  dataTestId: string
}

/**
 * Filler placeholder slots for mobile card lists.
 *
 * Pads the list to a fixed row count (e.g. PAGE_SIZE) so the pagination bar
 * stays pinned at a constant position even when the page has fewer real rows.
 *
 * Each slot:
 *   - Invisible replica of a real row's two text lines → identical row height.
 *   - flexGrow:1 flexShrink:0 so slots distribute the remaining card height.
 *   - aria-hidden="true" and pointer-events-none — purely decorative.
 *
 * Owner request: NO dashed guide lines or per-slot separators (they read as
 * unfinished «- - -»). The last real row already carries its own border-b to
 * close the list, so the fillers stay completely blank — a clean empty area
 * down to the pagination bar.
 */
export function MobileListPlaceholders({ count, dataTestId }: MobileListPlaceholdersProps) {
  if (count <= 0) return null
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`__mlph_${i}`}
          aria-hidden="true"
          data-testid={dataTestId}
          style={{ flexGrow: 1, flexShrink: 0 }}
          className="px-3.5 py-[0.4375rem] border-l-[3px] border-l-transparent pointer-events-none"
        >
          {/* Invisible replica of the card's text column → identical row height */}
          <div className="opacity-0">
            <div className="text-13 font-bold leading-snug mb-0.5">&nbsp;</div>
            <div className="text-11 leading-snug">&nbsp;</div>
          </div>
        </div>
      ))}
    </>
  )
}
