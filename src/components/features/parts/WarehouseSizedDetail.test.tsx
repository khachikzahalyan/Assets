/**
 * WarehouseSizedDetail — unit tests for in-stock filtering + empty state.
 *
 * SEAM CHOICE: component is pure (no Firebase, no hooks) — render directly with props.
 * react-i18next is mocked at module level so t('key') returns the key string, allowing
 * assertions on translation keys without a real locale file.
 *
 * Stock comes via the stockMap prop keyed by sku id ({ onHand, broken }).
 * The Part doc's own onHand field is NOT used by this component.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── i18n mock — must be declared before the component is imported ──────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import type { Part } from '@/domain/part/types'
import { WarehouseSizedDetail } from './WarehouseSizedDetail'

// ── Fixture helpers ───────────────────────────────────────────────────────
const makeSku = (overrides: Partial<Part> = {}): Part => ({
  id: 'sku_default',
  name: 'Default SKU',
  category: 'ssd',
  unit: 'шт',
  onHand: 0,
  broken: 0,
  lowStockThreshold: 3,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  createdBy: 'u1',
  updatedBy: 'u1',
  ...overrides,
})

// ── Tests ─────────────────────────────────────────────────────────────────
describe('WarehouseSizedDetail', () => {
  it('(a) zero-stock category: shows noStock empty state, renders no size row labels', () => {
    const skus = [
      makeSku({ id: 'sku_512', variantId: '512gb', variantLabel: '512 ГБ', category: 'ssd' }),
      makeSku({ id: 'sku_1tb', variantId: '1tb', variantLabel: '1 ТБ', category: 'ssd' }),
    ]
    const stockMap = {
      sku_512: { onHand: 0, broken: 0 },
      sku_1tb: { onHand: 0, broken: 0 },
    }

    render(
      <WarehouseSizedDetail
        categoryId="ssd"
        skus={skus}
        stockMap={stockMap}
        onInstall={vi.fn()}
      />,
    )

    // EmptyState title rendered (key returned by mock t())
    // sizeLabel also uses 'warehouse.noStock' when totalOnHand === 0, so there can be 2 matches
    const noStockEls = screen.getAllByText('warehouse.noStock')
    expect(noStockEls.length).toBeGreaterThanOrEqual(1)

    // Empty state is a quiet placeholder card — no instructional hint text
    expect(screen.queryByText('warehouse.noneAvailableHint')).not.toBeInTheDocument()

    // Size row labels must NOT be visible
    expect(screen.queryByText('512 ГБ')).not.toBeInTheDocument()
    expect(screen.queryByText('1 ТБ')).not.toBeInTheDocument()
  })

  it('(b) mixed stock: only in-stock rows rendered, header count matches in-stock count', () => {
    const skus = [
      makeSku({ id: 'sku_64', variantId: '64gb', variantLabel: '64 ГБ', category: 'ssd' }),
      makeSku({ id: 'sku_128', variantId: '128gb', variantLabel: '128 ГБ', category: 'ssd' }),
      makeSku({ id: 'sku_256', variantId: '256gb', variantLabel: '256 ГБ', category: 'ssd' }),
      makeSku({ id: 'sku_512', variantId: '512gb', variantLabel: '512 ГБ', category: 'ssd' }),
      makeSku({ id: 'sku_1tb', variantId: '1tb', variantLabel: '1 ТБ', category: 'ssd' }),
      makeSku({ id: 'sku_2tb', variantId: '2tb', variantLabel: '2 ТБ', category: 'ssd' }),
      makeSku({ id: 'sku_3tb', variantId: '3tb', variantLabel: '3 ТБ', category: 'ssd' }),
      makeSku({ id: 'sku_4tb', variantId: '4tb', variantLabel: '4 ТБ', category: 'ssd' }),
      makeSku({ id: 'sku_5tb', variantId: '5tb', variantLabel: '5 ТБ', category: 'ssd' }),
    ]
    // Only 512gb and 1tb are in stock
    const stockMap: Record<string, { onHand: number; broken: number }> = {
      sku_64:  { onHand: 0, broken: 0 },
      sku_128: { onHand: 0, broken: 0 },
      sku_256: { onHand: 0, broken: 0 },
      sku_512: { onHand: 3, broken: 0 },
      sku_1tb: { onHand: 2, broken: 0 },
      sku_2tb: { onHand: 0, broken: 0 },
      sku_3tb: { onHand: 0, broken: 0 },
      sku_4tb: { onHand: 0, broken: 0 },
      sku_5tb: { onHand: 0, broken: 0 },
    }

    render(
      <WarehouseSizedDetail
        categoryId="ssd"
        skus={skus}
        stockMap={stockMap}
        onInstall={vi.fn()}
      />,
    )

    // In-stock rows are rendered
    expect(screen.getByText('512 ГБ')).toBeInTheDocument()
    expect(screen.getByText('1 ТБ')).toBeInTheDocument()

    // Zero-stock rows are hidden
    expect(screen.queryByText('64 ГБ')).not.toBeInTheDocument()
    expect(screen.queryByText('128 ГБ')).not.toBeInTheDocument()
    expect(screen.queryByText('256 ГБ')).not.toBeInTheDocument()
    expect(screen.queryByText('2 ТБ')).not.toBeInTheDocument()
    expect(screen.queryByText('3 ТБ')).not.toBeInTheDocument()
    expect(screen.queryByText('4 ТБ')).not.toBeInTheDocument()
    expect(screen.queryByText('5 ТБ')).not.toBeInTheDocument()

    // Header subtitle shows "2 размера" (hardcoded pluralization, 2 in-stock SKUs)
    expect(screen.getByText('2 размера')).toBeInTheDocument()

    // Empty state must NOT be shown
    expect(screen.queryByText('warehouse.noneAvailableHint')).not.toBeInTheDocument()
  })

  it('(c) RAM with DDR4 stock: DDR toggle renders, rows visible', () => {
    const ramSkus = [
      makeSku({
        id: 'ram_8gb_ddr4', variantId: '8gb', variantLabel: '8 ГБ',
        category: 'ram', ddr: 'DDR4',
      }),
      makeSku({
        id: 'ram_16gb_ddr4', variantId: '16gb', variantLabel: '16 ГБ',
        category: 'ram', ddr: 'DDR4',
      }),
    ]
    const stockMap = {
      ram_8gb_ddr4:  { onHand: 5, broken: 0 },
      ram_16gb_ddr4: { onHand: 3, broken: 0 },
    }

    render(
      <WarehouseSizedDetail
        categoryId="ram"
        skus={ramSkus}
        stockMap={stockMap}
        onInstall={vi.fn()}
      />,
    )

    // DDR toggle buttons are present (category has stock)
    expect(screen.getByText('DDR3')).toBeInTheDocument()
    expect(screen.getByText('DDR4')).toBeInTheDocument()
    expect(screen.getByText('DDR5')).toBeInTheDocument()

    // DDR4 selected by default — its rows are visible
    expect(screen.getByText('8 ГБ')).toBeInTheDocument()
    expect(screen.getByText('16 ГБ')).toBeInTheDocument()

    // Empty state must NOT be shown
    expect(screen.queryByText('warehouse.noneAvailableHint')).not.toBeInTheDocument()
  })

  it('(d) RAM: category has stock but selected DDR gen has none → noStock message, toggle stays', async () => {
    const user = userEvent.setup()
    const ramSkus = [
      makeSku({
        id: 'ram_8gb_ddr4', variantId: '8gb', variantLabel: '8 ГБ',
        category: 'ram', ddr: 'DDR4',
      }),
    ]
    const stockMap = {
      ram_8gb_ddr4: { onHand: 4, broken: 0 },
    }

    render(
      <WarehouseSizedDetail
        categoryId="ram"
        skus={ramSkus}
        stockMap={stockMap}
        onInstall={vi.fn()}
      />,
    )

    // Switch to DDR3 (no stock for DDR3)
    await user.click(screen.getByText('DDR3'))

    // Toggle must remain (totalOnHand > 0 across whole category)
    expect(screen.getByText('DDR3')).toBeInTheDocument()
    expect(screen.getByText('DDR4')).toBeInTheDocument()
    expect(screen.getByText('DDR5')).toBeInTheDocument()

    // noStock message shown in the rows area (small centred text)
    // t('warehouse.noStock') returns 'warehouse.noStock'
    const noStockEls = screen.getAllByText('warehouse.noStock')
    expect(noStockEls.length).toBeGreaterThanOrEqual(1)

    // No DDR4 row visible after switching to DDR3
    expect(screen.queryByText('8 ГБ')).not.toBeInTheDocument()
  })
})
