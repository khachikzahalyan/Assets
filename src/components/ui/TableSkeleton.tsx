export interface TableSkeletonProps {
  /** Number of body rows to render. Default 10. */
  rows?: number
  /**
   * Number of column cells to render in each row. Default 6.
   * When `gridTemplate` is set, this MUST equal the number of tracks in the
   * template — the component does not attempt to parse the template string.
   */
  columns?: number
  /**
   * When true the first cell shows an icon tile + two stacked text bars
   * (mirrors the asset / employee name cell). Default false.
   */
  firstColWide?: boolean
  /**
   * When true the first cell shows a small ~13×13 icon-sized shimmer stub
   * instead of the default 70%-width text bar. Mirrors a narrow icon-only first
   * column (e.g. AuditTable's 36px chevron cell), whose real content is a 13px
   * chevron — the default text bar would be clipped by the 20px left padding.
   * Ignored when `firstColWide` is set. Default false.
   */
  firstColIcon?: boolean
  /**
   * Explicit CSS `gridTemplateColumns` value. When provided, the header and
   * body rows use this string verbatim instead of the default
   * `repeat(N, minmax(0, 1fr))`. Lets the skeleton match the real table's
   * GRID_COLS constant exactly.
   *
   * **Important:** when this is set, `columns` MUST equal the track count in
   * the template; mismatches produce misaligned cells.
   */
  gridTemplate?: string
  /**
   * When true, the final column renders no shimmer bar (the cell wrapper is
   * still present, preserving grid alignment). Use for the narrow 56px action
   * column present in AssetsTable and EmployeesTable. Default false.
   */
  lastColAction?: boolean
  /**
   * Real column captions. Column headers are local i18n chrome, not collection
   * data — render them for real instead of shimmering (owner rule: chrome
   * renders instantly, only async data shimmers). Length MUST equal `columns`;
   * use '' for caption-less cells (e.g. the action column).
   */
  headers?: string[]
}

/** Width percentages for the header shimmer bars — varies per column for realism. */
const HEADER_WIDTHS = ['55%', '42%', '38%', '44%', '36%', '40%', '34%', '46%']

/** Width percentages for body cell shimmer bars (non-wide cols). */
const BODY_WIDTHS = ['70%', '55%', '60%', '50%', '65%', '45%', '55%', '60%']

/**
 * Table-shaped skeleton that visually matches the full-height AssetsTable /
 * EmployeesTable layout: sticky 44px header + flex-1 body with rows that are
 * each flex:1 1 0; minHeight:58px — exactly the same footprint as the real
 * table when placed inside the ListCard Zone 2 fill region.
 */
export function TableSkeleton({
  rows = 10,
  columns = 6,
  firstColWide = false,
  firstColIcon = false,
  gridTemplate,
  lastColAction = false,
  headers,
}: TableSkeletonProps) {
  const effectiveGrid = gridTemplate ?? `repeat(${columns}, minmax(0, 1fr))`

  return (
    <div
      data-testid="table-skeleton"
      aria-hidden="true"
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
    >
      {/* ── Header band ── */}
      <div
        style={{
          flexShrink: 0,
          height: 44,
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          display: 'grid',
          gridTemplateColumns: effectiveGrid,
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        {Array.from({ length: columns }).map((_, colIdx) => {
          const isLast = lastColAction && colIdx === columns - 1
          const pl = colIdx === 0 ? 20 : 12
          const caption = headers?.[colIdx] ?? ''
          return (
            <div
              key={colIdx}
              style={{ paddingLeft: pl, paddingRight: 12 }}
            >
              {headers ? (
                /* Real caption — same typography as DataTable / AssetsTable headers */
                caption !== '' && (
                  <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
                    {caption}
                  </span>
                )
              ) : (
                !isLast && (
                  <div
                    className="anim-skeleton rounded"
                    style={{
                      height: 10,
                      width: HEADER_WIDTHS[colIdx % HEADER_WIDTHS.length],
                    }}
                  />
                )
              )}
            </div>
          )
        })}
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0 }}>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            data-testid="table-skeleton-row"
            style={{
              flex: '1 1 0',
              minHeight: 58,
              borderTop: '1px solid var(--color-border)',
              display: 'grid',
              gridTemplateColumns: effectiveGrid,
              alignItems: 'center',
            }}
          >
            {Array.from({ length: columns }).map((_, colIdx) => {
              const isFirst = colIdx === 0
              const isLast = lastColAction && colIdx === columns - 1
              const pl = isFirst ? 20 : 12
              const pr = 12

              if (isFirst && firstColWide) {
                /* Asset / employee name cell: icon tile + two text bars */
                return (
                  <div
                    key={colIdx}
                    style={{
                      paddingLeft: pl,
                      paddingRight: pr,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {/* Icon tile shimmer */}
                    <div
                      className="anim-skeleton rounded-md flex-shrink-0"
                      style={{ width: 36, height: 36 }}
                    />
                    {/* Two stacked text bars */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div
                        className="anim-skeleton rounded"
                        style={{ height: 11, width: '55%' }}
                      />
                      <div
                        className="anim-skeleton rounded"
                        style={{ height: 9, width: '75%' }}
                      />
                    </div>
                  </div>
                )
              }

              if (isFirst && firstColIcon) {
                /* Narrow icon-only first column (e.g. AuditTable 36px chevron):
                   a small ~13×13 icon-sized stub instead of the clipped text bar. */
                return (
                  <div key={colIdx} style={{ paddingLeft: pl, paddingRight: pr }}>
                    <div
                      className="anim-skeleton rounded"
                      style={{ width: 13, height: 13 }}
                    />
                  </div>
                )
              }

              if (isLast) {
                /* Action column stub: empty cell, no shimmer bar */
                return (
                  <div key={colIdx} style={{ paddingLeft: pl, paddingRight: pr }} />
                )
              }

              /* Generic cell: single shimmer bar */
              return (
                <div key={colIdx} style={{ paddingLeft: pl, paddingRight: pr }}>
                  <div
                    className="anim-skeleton rounded"
                    style={{
                      height: 10,
                      width: BODY_WIDTHS[colIdx % BODY_WIDTHS.length],
                    }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
