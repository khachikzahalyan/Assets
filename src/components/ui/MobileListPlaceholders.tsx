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
 *   - Centered dashed horizontal rule — visual "empty row" indicator.
 *   - flexGrow:1 flexShrink:0 so slots distribute the remaining card height.
 *   - aria-hidden="true" and pointer-events-none — purely decorative.
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
          className="relative px-[14px] py-[7px] border-b border-border border-l-[3px] border-l-transparent pointer-events-none last:border-b-0"
        >
          {/* Invisible replica of the card's text column → identical row height */}
          <div className="opacity-0">
            <div className="text-[13px] font-bold leading-snug mb-[2px]">&nbsp;</div>
            <div className="text-[11px] leading-snug">&nbsp;</div>
          </div>
          <div className="absolute left-[14px] right-[14px] top-1/2 -translate-y-1/2 border-t border-dashed border-border/50" />
        </div>
      ))}
    </>
  )
}
