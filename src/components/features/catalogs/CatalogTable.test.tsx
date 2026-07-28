import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CatalogTable, type CatalogColumn } from './CatalogTable'

// Force the mobile branch — jsdom matchMedia defaults to desktop.
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => true }))

interface Row { id: string; name: string }

const columns: CatalogColumn<Row>[] = [
  { key: 'name', header: 'Name', render: r => <span>{r.name}</span> },
]

const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
]

/**
 * Mobile fill contract (owner rule: catalog lists must look identical to the
 * assets/employees/licenses etalon — always 10 cells, pagination pinned):
 * real rows stretch (flexGrow) and dashed placeholder slots pad the list to
 * minRows. Regression pin — this contract was silently dropped once before.
 */
describe('CatalogTable mobile fill contract', () => {
  it('pads the list to minRows with placeholder slots and stretches real rows', () => {
    const { container } = render(
      <CatalogTable<Row>
        rows={rows} columns={columns} canMutate={false}
        onEdit={() => {}} onDelete={() => {}} minRows={10}
      />,
    )

    expect(screen.getAllByTestId('catalog-card-placeholder')).toHaveLength(7)

    const list = container.firstElementChild as HTMLElement
    expect(list.className).toContain('grow')
    // Every child (3 real rows + 7 placeholders) participates in the stretch
    for (const child of Array.from(list.children) as HTMLElement[]) {
      expect(child.style.flexGrow).toBe('1')
      expect(child.style.flexShrink).toBe('0')
    }
  })

  it('renders no placeholders when minRows is already met', () => {
    render(
      <CatalogTable<Row>
        rows={rows} columns={columns} canMutate={false}
        onEdit={() => {}} onDelete={() => {}} minRows={3}
      />,
    )
    expect(screen.queryByTestId('catalog-card-placeholder')).toBeNull()
  })
})
