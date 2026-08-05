/**
 * WarehouseMobileDetail — install flow for single-position categories (PSU / Cooler)
 * and models categories (GPU) when routed through the component.
 *
 * Bug fixed: with multiple in-stock SKUs the component used to take the FIRST match
 * and install it immediately. Now:
 *   0 in-stock → no «Установить» button
 *   1 in-stock → tap installs directly (no picker)
 *   2+ in-stock → tap opens MobileSheet picker; choosing a row calls onInstall with
 *                 the chosen SKU and closes the sheet
 *
 * react-i18next is mocked so t('key') returns the key string verbatim.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import type { Part, PartStock } from '@/domain/part/types'
import { WarehouseMobileDetail } from './WarehouseMobileDetail'

const makeSku = (overrides: Partial<Part> = {}): Part => ({
  id: 'sku_default',
  name: 'Default SKU',
  category: 'cooler',
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

/** Shared history props — empty log is fine for install-flow tests. */
const historyProps = {
  movements: [],
  skuIds: new Set<string>(),
  parts: [] as Part[],
  remainingAfterMap: {},
}

/** Helper: build stockOf function from a simple id→PartStock map. */
const makeStockOf =
  (map: Record<string, PartStock>) =>
  (skuId: string): PartStock =>
    map[skuId] ?? { onHand: 0, broken: 0 }

describe('WarehouseMobileDetail', () => {
  it('(a) 0 in-stock SKUs: «Установить» button is not shown', () => {
    const skus = [
      makeSku({ id: 'sku_a', name: 'Cooler A' }),
      makeSku({ id: 'sku_b', name: 'Cooler B' }),
    ]
    render(
      <WarehouseMobileDetail
        catId="cooler"
        skus={skus}
        stockOf={makeStockOf({ sku_a: { onHand: 0, broken: 0 }, sku_b: { onHand: 0, broken: 0 } })}
        catMeta={undefined}
        onInstall={vi.fn()}
        {...historyProps}
      />,
    )
    expect(screen.queryByRole('button', { name: 'actions.install' })).not.toBeInTheDocument()
  })

  it('(b) exactly 1 in-stock SKU: tap installs directly without opening picker', async () => {
    const user = userEvent.setup()
    const onInstall = vi.fn()
    const skus = [
      makeSku({ id: 'sku_a', name: 'Cooler A' }),
      makeSku({ id: 'sku_b', name: 'Cooler B' }),
    ]
    render(
      <WarehouseMobileDetail
        catId="cooler"
        skus={skus}
        stockOf={makeStockOf({ sku_a: { onHand: 0, broken: 0 }, sku_b: { onHand: 3, broken: 0 } })}
        catMeta={undefined}
        onInstall={onInstall}
        {...historyProps}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'actions.install' }))

    // Picker must NOT have opened.
    expect(screen.queryByText('warehouse.pickSkuTitle')).not.toBeInTheDocument()
    // onInstall called immediately with the ONE in-stock SKU.
    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(onInstall.mock.calls[0]![0].id).toBe('sku_b')
  })

  it('(c) 2+ in-stock SKUs: tap opens sheet with BOTH names and stock counts; onInstall NOT called yet', async () => {
    const user = userEvent.setup()
    const onInstall = vi.fn()
    const skus = [
      makeSku({ id: 'sku_3010', name: 'GeForce RTX 3010' }),
      makeSku({ id: 'sku_5040', name: 'GeForce RTX 5040' }),
      makeSku({ id: 'sku_empty', name: 'GeForce RTX 9000' }),
    ]
    render(
      <WarehouseMobileDetail
        catId="gpu"
        skus={skus}
        stockOf={makeStockOf({
          sku_3010: { onHand: 2, broken: 0 },
          sku_5040: { onHand: 1, broken: 0 },
          sku_empty: { onHand: 0, broken: 0 },
        })}
        catMeta={undefined}
        onInstall={onInstall}
        {...historyProps}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'actions.install' }))

    // Picker sheet must be visible.
    expect(screen.getByText('warehouse.pickSkuTitle')).toBeInTheDocument()
    // Both in-stock SKUs appear by name.
    expect(screen.getByText('GeForce RTX 3010')).toBeInTheDocument()
    expect(screen.getByText('GeForce RTX 5040')).toBeInTheDocument()
    // The out-of-stock SKU must NOT appear.
    expect(screen.queryByText('GeForce RTX 9000')).not.toBeInTheDocument()
    // onInstall not called yet.
    expect(onInstall).not.toHaveBeenCalled()
  })

  it('(d) picking the SECOND SKU row calls onInstall with that exact SKU and closes the sheet', async () => {
    const user = userEvent.setup()
    const onInstall = vi.fn()
    const skus = [
      makeSku({ id: 'sku_3010', name: 'GeForce RTX 3010' }),
      makeSku({ id: 'sku_5040', name: 'GeForce RTX 5040' }),
    ]
    render(
      <WarehouseMobileDetail
        catId="gpu"
        skus={skus}
        stockOf={makeStockOf({
          sku_3010: { onHand: 2, broken: 0 },
          sku_5040: { onHand: 1, broken: 0 },
        })}
        catMeta={undefined}
        onInstall={onInstall}
        {...historyProps}
      />,
    )

    // Open picker.
    await user.click(screen.getByRole('button', { name: 'actions.install' }))
    expect(screen.getByText('warehouse.pickSkuTitle')).toBeInTheDocument()

    // Pick the second SKU.
    await user.click(screen.getByText('GeForce RTX 5040'))

    // onInstall called with the correct SKU.
    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(onInstall.mock.calls[0]![0].id).toBe('sku_5040')
    // Sheet closed.
    expect(screen.queryByText('warehouse.pickSkuTitle')).not.toBeInTheDocument()
  })

  it('(e) extraHeaderAction node renders in the header alongside the install button', () => {
    const skus = [makeSku({ id: 'sku_a', name: 'GPU A' })]
    const extraAction = <button type="button">Добавить видеокарту</button>
    render(
      <WarehouseMobileDetail
        catId="gpu"
        skus={skus}
        stockOf={makeStockOf({ sku_a: { onHand: 2, broken: 0 } })}
        catMeta={undefined}
        onInstall={vi.fn()}
        extraHeaderAction={extraAction}
        {...historyProps}
      />,
    )
    // The extra action is rendered.
    expect(screen.getByRole('button', { name: 'Добавить видеокарту' })).toBeInTheDocument()
    // The install button is also present (1 in-stock).
    expect(screen.getByRole('button', { name: 'actions.install' })).toBeInTheDocument()
  })
})
