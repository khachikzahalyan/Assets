/**
 * DataTable fillHeight contract test (owner spec 2026-08-04).
 *
 * Asserts that under fillHeight=true every real body row AND every placeholder
 * row gets flex:1 1 0 (jsdom serialises the basis with "px": "1 1 0px") so
 * 10 slots evenly distribute the available card height. Without fillHeight, no
 * flex is added but the minHeight rem floor is always present on rows.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataTable, type DataTableColumn } from './DataTable'

// ── Minimal fixture ───────────────────────────────────────────────────────────

type Row = { id: string; label: string }

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'label', header: 'Label', width: '1fr', cell: r => r.label },
]

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: `r${i}`, label: `Row ${i}` }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns all role="row" elements that are NOT the header (i.e. body rows). */
function getBodyRows(): HTMLElement[] {
  // getAllByRole('row') returns header + body rows.
  // The header row contains role="columnheader" children; body rows contain role="cell".
  return screen
    .getAllByRole('row')
    .filter(el => el.querySelector('[role="cell"]') !== null)
}

function getPlaceholders(testId: string): NodeListOf<Element> {
  return document.querySelectorAll(`[data-testid="${testId}"]`)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DataTable fillHeight contract', () => {
  it('fillHeight=true: body rows have flex:"1 1 0px" and minHeight:"3.625rem"', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        fillHeight
        placeholderTestId="ph"
        aria-label="test table"
      />,
    )

    const bodyRows = getBodyRows()
    expect(bodyRows).toHaveLength(3)

    for (const row of bodyRows) {
      // jsdom serialises '1 1 0' shorthand with px-suffixed basis
      expect(row.style.flex).toBe('1 1 0px')
      expect(row.style.minHeight).toBe('3.625rem')
    }

    unmount()
  })

  it('fillHeight=true: placeholders have flex:"1 1 0px" and minHeight:"3.625rem"', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        fillHeight
        placeholderTestId="ph"
        aria-label="test table"
      />,
    )

    const placeholders = getPlaceholders('ph')
    // 10 minRows − 3 real rows = 7 placeholders
    expect(placeholders).toHaveLength(7)

    for (const ph of placeholders) {
      expect((ph as HTMLElement).style.flex).toBe('1 1 0px')
      expect((ph as HTMLElement).style.minHeight).toBe('3.625rem')
    }

    unmount()
  })

  it('fillHeight=true: placeholder count is exactly minRows − rows.length', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        fillHeight
        placeholderTestId="ph-count"
        aria-label="test table"
      />,
    )

    expect(getPlaceholders('ph-count')).toHaveLength(7)
    unmount()
  })

  it('fillHeight=false: body rows have NO flex, minHeight still present', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        placeholderTestId="ph-nofill"
        aria-label="test table"
      />,
    )

    const bodyRows = getBodyRows()
    expect(bodyRows).toHaveLength(3)

    for (const row of bodyRows) {
      expect(row.style.flex).toBe('')
      expect(row.style.minHeight).toBe('3.625rem')
    }

    unmount()
  })

  it('fillHeight=false: placeholders have NO flex, minHeight still present', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        placeholderTestId="ph-nofill2"
        aria-label="test table"
      />,
    )

    const placeholders = getPlaceholders('ph-nofill2')
    expect(placeholders).toHaveLength(7)

    for (const ph of placeholders) {
      expect((ph as HTMLElement).style.flex).toBe('')
      expect((ph as HTMLElement).style.minHeight).toBe('3.625rem')
    }

    unmount()
  })

  it('fillHeight=true: body rowgroup is the scroll owner (overflow-y auto)', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        fillHeight
        placeholderTestId="ph-scroll"
        aria-label="test table"
      />,
    )

    // getAllByRole('rowgroup') → [header rowgroup, body rowgroup]
    const rowgroups = screen.getAllByRole('rowgroup')
    expect(rowgroups).toHaveLength(2)
    const body = rowgroups[1]!
    // Low-viewport safety: when 10 × 3.625rem floors don't fit, the body
    // rowgroup scrolls instead of clipping rows under ListCard's overflow-hidden.
    expect(body.style.overflowY).toBe('auto')

    unmount()
  })

  it('fillHeight=false: body rowgroup has no overflow (content-driven height)', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        placeholderTestId="ph-noscroll"
        aria-label="test table"
      />,
    )

    const rowgroups = screen.getAllByRole('rowgroup')
    const body = rowgroups[1]!
    expect(body.style.overflowY).toBe('')

    unmount()
  })

  it('fillHeight=true: root scrolls horizontally when column mins exceed width', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        fillHeight
        placeholderTestId="ph-ox"
        aria-label="test table ox"
      />,
    )

    // Tablet band (768–830px): grid tracks with rem minmax floors overflow the
    // card width; the root scrolls horizontally instead of ListCard clipping
    // the trailing actions column. Rowgroups widen to their grid min-content
    // so header and body scroll in lockstep.
    const tableRoot = screen.getByRole('table', { name: 'test table ox' })
    expect(tableRoot.style.overflowX).toBe('auto')
    for (const rg of screen.getAllByRole('rowgroup')) {
      expect(rg.style.minWidth).toBe('fit-content')
    }

    unmount()
  })

  it('fillHeight=false: root has NO overflow-x (keeps page-scroll sticky header)', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        placeholderTestId="ph-no-ox"
        aria-label="test table no ox"
      />,
    )

    // Content-driven tables rely on an ANCESTOR scroller for their sticky
    // header; the root must not become a scroll container there.
    const tableRoot = screen.getByRole('table', { name: 'test table no ox' })
    expect(tableRoot.style.overflowX).toBe('')
    for (const rg of screen.getAllByRole('rowgroup')) {
      expect(rg.style.minWidth).toBe('')
    }

    unmount()
  })

  it('fillHeight=true: role="table" root has flex:"1 1 0px" and minHeight:"0px"', () => {
    const { unmount } = render(
      <DataTable
        columns={COLUMNS}
        rows={makeRows(3)}
        getRowKey={r => r.id}
        minRows={10}
        fillHeight
        placeholderTestId="ph-root"
        aria-label="test table root"
      />,
    )

    const tableRoot = screen.getByRole('table', { name: 'test table root' })
    // fillHeight spreads { flex: '1 1 0', minHeight: 0, height: '100%' } onto the root
    expect(tableRoot.style.flex).toBe('1 1 0px')
    // jsdom normalises numeric 0 to '0px'
    expect(['0px', '0']).toContain(tableRoot.style.minHeight)
    // height:100% is LOAD-BEARING: /assets and /employees pass the table through
    // a BLOCK h-full wrapper (not a flex parent), where flex:1 1 0 is inert.
    // Without an explicit height the root collapses to header height and the
    // basis-0 rowgroup renders 0px tall — with overflow-y:auto that clips every
    // row (empty-table bug, 2026-08-04). Verified in real Chromium.
    expect(tableRoot.style.height).toBe('100%')

    unmount()
  })
})
