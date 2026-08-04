import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  /** CSS grid track, e.g. '1fr', '200px', 'minmax(0,2fr)'. */
  width: string
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  /** Extra class names appended to the columnheader cell. */
  headerClassName?: string
  /** Extra class names appended to every body cell in this column. */
  cellClassName?: string
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /**
   * Minimum row count. Placeholder rows fill the gap so the table footprint
   * stays constant. Defaults to rows.length (no placeholders).
   */
  minRows?: number
  /** Extra class names applied to a specific row. */
  rowClassName?: (row: T) => string
  /**
   * data-testid value applied to each row element.
   * Preserves test-id contracts when row content is driven by column definitions.
   */
  getRowDataTestId?: (row: T) => string
  /** ARIA label for the table region. */
  'aria-label'?: string
  /**
   * Rendered when rows is empty instead of the table structure.
   * When omitted and rows is empty, an empty body is rendered (no placeholder lines).
   */
  emptyState?: ReactNode
  /**
   * When provided, called for each data row after it renders.
   * If the return value is non-null/undefined, an expansion panel is shown immediately
   * below that row. The panel does NOT carry role="row", keeping getAllByRole('row')
   * counts stable. Callers control which rows are expanded via their own state.
   */
  renderRowExpanded?: (row: T) => ReactNode
  /**
   * data-testid applied to every placeholder row (the filler divs rendered when
   * rows.length < minRows). Useful for asserting placeholder counts in tests.
   */
  placeholderTestId?: string
  /**
   * Row key that should scroll into view and briefly highlight (~2.5s orange
   * ring) — the /assets "focus after create/scan" behaviour. Re-triggers when
   * the value changes.
   */
  focusRowKey?: string
  /**
   * Opt into the full-height fill contract (owner reconfirmed 2026-08-04;
   * supersedes the 2026-08-03 natural-height decision):
   *
   * - The role="table" root takes flex:1 1 0 so it absorbs the available card
   *   height and the paginator stays pinned to the card bottom.
   * - Every real row AND every placeholder row gets flex:1 1 0, so the 10 slots
   *   (minRows=PAGE_SIZE=10) evenly distribute the available height — no dead zone
   *   between the last row and the paginator, no bloated rows at large viewports.
   * - minHeight:3.625rem (rem floor, scales with root; ≈58px at 1920 ref) is the
   *   low-viewport safety net: on short viewports rows bottom out at the floor and
   *   the rowgroup scrolls rather than crushing rows.
   *
   * REQUIRES a bounded-height flex-column parent (ListCard Zone 2 or equivalent)
   * — without one the table collapses to 0, which is why this is opt-in.
   */
  fillHeight?: boolean
}

// ── Component ───────────────────────────────────────────────────────────────────

/**
 * Generic CSS-grid ARIA table that matches the /assets table visual style exactly.
 *
 * Style spec:
 * - Sticky 2.75rem header (44px @1920 ref), bg var(--color-bg), bottom-border var(--color-border)
 * - Column headers: 12px uppercase, tracking-[0.09em], font-semibold, text-text-tertiary
 * - First column paddingLeft:20; non-first columns px-3
 * - Rows: border-t border-border, orange hover rgba(249,115,22,0.08)
 * - Rows: display:grid, minHeight:3.625rem; flex:1 1 0 only under fillHeight (even distribution contract)
 * - Placeholder rows: border rgba(42,47,54,0.35), dashed center guide line
 * - Keyboard: Enter/Space fires onRowClick; rows tabIndex=0 when clickable
 * - ARIA: role="table" / "rowgroup" / "row" / "columnheader" / "cell"
 *
 * gridTemplateColumns is built by joining columns[].width with spaces.
 * Designed for both height-constrained (ListCard) and content-driven (section) contexts.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  minRows,
  rowClassName,
  getRowDataTestId,
  'aria-label': ariaLabel,
  emptyState,
  renderRowExpanded,
  placeholderTestId,
  focusRowKey,
  fillHeight = false,
}: DataTableProps<T>) {
  const gridTemplateColumns = columns.map(c => c.width).join(' ')
  const placeholderCount = Math.max(0, (minRows ?? rows.length) - rows.length)

  // ── Focus-row behaviour: scroll into view + transient highlight ring ──────
  const focusedRowEl = useRef<HTMLDivElement | null>(null)
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  useEffect(() => {
    if (focusRowKey === undefined) return
    focusedRowEl.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setHighlightKey(focusRowKey)
    const timer = setTimeout(() => setHighlightKey(null), 2500)
    return () => clearTimeout(timer)
  }, [focusRowKey])

  if (emptyState !== undefined && rows.length === 0) {
    return <>{emptyState}</>
  }

  return (
    <div
      role="table"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        // fillHeight only:
        // - height:100% is LOAD-BEARING, not belt-and-suspenders: /assets and
        //   /employees pass the table through a BLOCK h-full wrapper (not a flex
        //   parent), where flex:1 1 0 is inert. Without it the root collapses to
        //   header height and the basis-0 rowgroup renders 0px tall — with the
        //   overflow-y:auto below that clips every row (empty-table bug,
        //   2026-08-04; verified in real Chromium). In flex parents the flex
        //   basis wins over height, so both contexts resolve correctly.
        // - overflow-x:auto is the horizontal escape hatch for the narrow-desktop
        //   band (768–830px) where rem minmax column floors exceed the card width.
        //   NOT applied without fillHeight: content-driven tables need an ancestor
        //   scroller for their sticky header, and overflow-x here would make the
        //   root the sticky containing block (header would stop sticking).
        ...(fillHeight ? { flex: '1 1 0', minHeight: 0, height: '100%', overflowX: 'auto' } : {}),
      }}
    >
      {/* ── Sticky header rowgroup ─────────────────────────────────────────── */}
      <div
        role="rowgroup"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          // min-width so the header widens with the body under the fillHeight
          // horizontal escape hatch and both scroll in lockstep.
          ...(fillHeight ? { minWidth: 'fit-content' } : {}),
        }}
      >
        <div
          role="row"
          style={{ display: 'grid', gridTemplateColumns, alignItems: 'center', height: '2.75rem' }}
        >
          {columns.map((col, idx) => (
            <div
              key={col.key}
              role="columnheader"
              className={[
                'text-12 uppercase tracking-[0.09em] font-semibold text-text-tertiary',
                idx > 0 ? 'px-3' : '',
                col.align === 'right'  ? 'text-right'  : '',
                col.align === 'center' ? 'text-center' : '',
                col.headerClassName ?? '',
              ].filter(Boolean).join(' ')}
              style={idx === 0 ? { paddingLeft: '1.25rem' } : undefined}
            >
              {col.header}
            </div>
          ))}
        </div>
      </div>

      {/* ── Body rowgroup ─────────────────────────────────────────────────── */}
      {/* Without fillHeight: content-driven height. flex:1/height:100% would
          collapse the table to 0 when there is no bounded-height parent (e.g.
          CatalogTable without a ListCard Zone 2), so fill behaviour is opt-in.
          Under fillHeight: the rowgroup gets flex:1 1 0 and each row (real +
          placeholder) also gets flex:1 1 0, distributing available height evenly
          across the 10 slots. The rowgroup is also the scroll owner: on short
          viewports, when 10 rem floors don't fit, it scrolls vertically instead
          of letting ListCard Zone 2's overflow-hidden clip the bottom rows. */}
      <div
        role="rowgroup"
        style={{
          display: 'flex',
          flexDirection: 'column',
          ...(fillHeight ? { flex: '1 1 0', minHeight: 0, overflowY: 'auto', minWidth: 'fit-content' } : {}),
        }}
      >
        {rows.map(row => {
          const key = getRowKey(row)
          const isClickable = onRowClick !== undefined
          const isHighlighted = highlightKey !== null && key === highlightKey
          const expandedContent = renderRowExpanded ? renderRowExpanded(row) : null
          return (
            <Fragment key={key}>
              <div
                role="row"
                ref={focusRowKey !== undefined && key === focusRowKey
                  ? (el) => { focusedRowEl.current = el }
                  : undefined}
                tabIndex={isClickable ? 0 : undefined}
                data-testid={getRowDataTestId?.(row)}
                onClick={isClickable ? () => onRowClick(row) : undefined}
                onKeyDown={isClickable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onRowClick(row)
                  }
                } : undefined}
                className={[
                  'border-t border-border group',
                  'transition-[background-color,box-shadow] duration-200',
                  isHighlighted
                    ? 'bg-[rgba(249,115,22,0.05)] ring-2 ring-inset ring-[rgba(249,115,22,0.45)]'
                    : '',
                  isClickable
                    ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(249,115,22,0.40)]'
                    : '',
                  isClickable && !isHighlighted ? 'hover:bg-[rgba(249,115,22,0.08)]' : '',
                  rowClassName?.(row) ?? '',
                ].filter(Boolean).join(' ')}
                style={{
                  display: 'grid',
                  gridTemplateColumns,
                  alignItems: 'center',
                  // Under fillHeight rows flex-stretch to evenly divide the available
                  // height; the rem floor is the low-viewport safety (the rowgroup
                  // scrolls when 10 floors don't fit).
                  minHeight: '3.625rem',
                  ...(fillHeight ? { flex: '1 1 0' } : {}),
                }}
              >
                {columns.map((col, idx) => (
                  <div
                    key={col.key}
                    role="cell"
                    className={[
                      'py-3',
                      idx > 0 ? 'px-3' : '',
                      col.align === 'right'  ? 'text-right'  : '',
                      col.align === 'center' ? 'text-center' : '',
                      col.cellClassName ?? '',
                    ].filter(Boolean).join(' ')}
                    style={idx === 0 ? { paddingLeft: '1.25rem' } : undefined}
                  >
                    {col.cell(row)}
                  </div>
                ))}
              </div>
              {expandedContent != null && (
                <div
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    background: 'var(--color-surface-sunken)',
                  }}
                >
                  {expandedContent}
                </div>
              )}
            </Fragment>
          )
        })}

        {/* Placeholder rows — maintain fixed footprint when rows.length < minRows.
            MUST NOT have role="row" so getAllByRole('row') counts stay correct.
            aria-hidden, pointer-events:none.
            Owner request: NO dashed guide lines (they read as unfinished «- - -»
            that don't reach the edges). Only the FIRST filler carries a full-width
            border to cleanly close the table body under the last real row; the
            rest are blank space down to the pagination — a clean empty fill. */}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div
            key={`__ph_${i}`}
            aria-hidden="true"
            data-testid={placeholderTestId}
            style={{
              minHeight: '3.625rem',
              ...(fillHeight ? { flex: '1 1 0' } : {}),
              ...(i === 0 ? { borderTop: '1px solid var(--color-border)' } : {}),
              pointerEvents: 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}
