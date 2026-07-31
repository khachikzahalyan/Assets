import { render, screen } from '@testing-library/react'
import { TableSkeleton } from './TableSkeleton'

describe('TableSkeleton', () => {
  it('root has data-testid="table-skeleton"', () => {
    render(<TableSkeleton />)
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument()
  })

  it('renders exactly rows skeleton rows (default 10)', () => {
    render(<TableSkeleton rows={10} columns={6} />)
    const rows = screen.getAllByTestId('table-skeleton-row')
    expect(rows.length).toBe(10)
  })

  it('renders the exact custom rows count', () => {
    render(<TableSkeleton rows={5} columns={4} />)
    const rows = screen.getAllByTestId('table-skeleton-row')
    expect(rows.length).toBe(5)
  })

  it('contains elements with class anim-skeleton', () => {
    const { container } = render(<TableSkeleton rows={10} columns={6} />)
    const shimmerEls = container.querySelectorAll('.anim-skeleton')
    expect(shimmerEls.length).toBeGreaterThan(0)
  })

  it('firstColWide=true still renders the correct number of rows', () => {
    render(<TableSkeleton rows={10} columns={6} firstColWide />)
    const rows = screen.getAllByTestId('table-skeleton-row')
    expect(rows.length).toBe(10)
  })

  it('firstColWide=true renders icon tile + text bars in the first cell', () => {
    render(<TableSkeleton rows={3} columns={3} firstColWide />)
    // The first cell of each row has an icon tile (w-9 = 36px) + 2 text bars
    // Each row's first cell contains 3 anim-skeleton elements
    const rows = screen.getAllByTestId('table-skeleton-row')
    const firstRow = rows[0]
    // The first cell should have at least 3 shimmer blocks (icon + 2 texts)
    const shimmerEls = firstRow?.querySelectorAll('.anim-skeleton') ?? []
    expect(shimmerEls.length).toBeGreaterThanOrEqual(3)
  })

  it('firstColIcon=true renders a small ~13×13 icon stub in the first cell (not the wide text bar)', () => {
    const { container } = render(<TableSkeleton rows={3} columns={4} firstColIcon />)
    const rows = container.querySelectorAll('[data-testid="table-skeleton-row"]')
    rows.forEach(row => {
      const firstCell = row.children[0] as HTMLElement | undefined
      expect(firstCell).toBeDefined()
      // Exactly one shimmer block, sized 13×13 (the icon stub) — no 70% text bar.
      const shimmers = firstCell?.querySelectorAll('.anim-skeleton') ?? []
      expect(shimmers.length).toBe(1)
      const stub = shimmers[0] as HTMLElement
      expect(stub.style.width).toBe('13px')
      expect(stub.style.height).toBe('13px')
    })
  })

  it('firstColIcon still renders the correct number of rows and preserves other cells', () => {
    render(<TableSkeleton rows={5} columns={4} firstColIcon />)
    const rows = screen.getAllByTestId('table-skeleton-row')
    expect(rows.length).toBe(5)
    rows.forEach(row => {
      // 4 cells total; non-first cells keep their generic text bars.
      expect(row.children.length).toBe(4)
    })
  })

  it('firstColWide takes precedence over firstColIcon (icon+text-bars, not the 13px stub)', () => {
    const { container } = render(<TableSkeleton rows={2} columns={3} firstColWide firstColIcon />)
    const rows = container.querySelectorAll('[data-testid="table-skeleton-row"]')
    const firstCell = rows[0]?.children[0] as HTMLElement | undefined
    const shimmers = firstCell?.querySelectorAll('.anim-skeleton') ?? []
    // firstColWide renders 3 shimmer blocks (icon tile + 2 text bars).
    expect(shimmers.length).toBe(3)
  })

  it('root has aria-hidden="true"', () => {
    render(<TableSkeleton />)
    const root = screen.getByTestId('table-skeleton')
    expect(root).toHaveAttribute('aria-hidden', 'true')
  })

  it('lastColAction: last cell in each body row contains no .anim-skeleton element', () => {
    const ASSETS_GRID = 'minmax(15rem,2.4fr) minmax(8.125rem,1fr) minmax(6.25rem,0.85fr) minmax(9.375rem,1.2fr) minmax(6.875rem,1fr) minmax(6.25rem,0.9fr) 3.5rem'
    const { container } = render(
      <TableSkeleton
        rows={3}
        columns={7}
        firstColWide
        lastColAction
        gridTemplate={ASSETS_GRID}
      />,
    )
    const rows = container.querySelectorAll('[data-testid="table-skeleton-row"]')
    // Check every body row: last direct child cell must have zero .anim-skeleton elements
    rows.forEach(row => {
      const cells = row.children
      const lastCell = cells[cells.length - 1]
      expect(lastCell).toBeDefined()
      const shimmersInLast = lastCell?.querySelectorAll('.anim-skeleton') ?? []
      expect(shimmersInLast.length).toBe(0)
    })
  })

  it('lastColAction: each body row still has the correct total cell count (7)', () => {
    const ASSETS_GRID = 'minmax(15rem,2.4fr) minmax(8.125rem,1fr) minmax(6.25rem,0.85fr) minmax(9.375rem,1.2fr) minmax(6.875rem,1fr) minmax(6.25rem,0.9fr) 3.5rem'
    const { container } = render(
      <TableSkeleton
        rows={2}
        columns={7}
        firstColWide
        lastColAction
        gridTemplate={ASSETS_GRID}
      />,
    )
    const rows = container.querySelectorAll('[data-testid="table-skeleton-row"]')
    rows.forEach(row => {
      expect(row.children.length).toBe(7)
    })
  })

  it('gridTemplate prop is applied to the header element inline style', () => {
    const ASSETS_GRID = 'minmax(15rem,2.4fr) minmax(8.125rem,1fr) minmax(6.25rem,0.85fr) minmax(9.375rem,1.2fr) minmax(6.875rem,1fr) minmax(6.25rem,0.9fr) 3.5rem'
    const { container } = render(
      <TableSkeleton
        rows={1}
        columns={7}
        lastColAction
        gridTemplate={ASSETS_GRID}
      />,
    )
    // The header band is the first child div of the root
    const root = container.querySelector('[data-testid="table-skeleton"]')
    const headerBand = root?.children[0] as HTMLElement | undefined
    expect(headerBand).toBeDefined()
    expect(headerBand?.style.gridTemplateColumns).toBe(ASSETS_GRID)
  })

  it('gridTemplate prop is applied to EVERY body row inline style (matches the header)', () => {
    // Guards against header/body track drift — the body grid MUST equal the
    // passed gridTemplate so cells align under their headers with zero shift.
    const ASSETS_GRID = 'minmax(15rem,2.4fr) minmax(8.125rem,1fr) minmax(6.25rem,0.85fr) minmax(9.375rem,1.2fr) minmax(6.875rem,1fr) minmax(6.25rem,0.9fr) 3.5rem'
    render(
      <TableSkeleton
        rows={4}
        columns={7}
        lastColAction
        gridTemplate={ASSETS_GRID}
      />,
    )
    const bodyRows = screen.getAllByTestId('table-skeleton-row')
    expect(bodyRows.length).toBe(4)
    bodyRows.forEach(row => {
      expect((row as HTMLElement).style.gridTemplateColumns).toBe(ASSETS_GRID)
    })
  })
})
