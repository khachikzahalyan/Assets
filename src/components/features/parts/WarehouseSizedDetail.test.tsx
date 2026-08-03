/**
 * WarehouseSizedDetail — install flow for sized categories (SSD / HDD / M.2 / ОЗУ).
 *
 * The component now mirrors the Cooler/PSU design (shared history section + a single
 * «Установить» action) instead of an inline per-size list. Because sized categories
 * have multiple sizes, «Установить» opens a size-picker sheet; picking a size hands
 * off to onInstall (which the page turns into the InstallModal). A single in-stock
 * size skips the picker and installs directly.
 *
 * react-i18next is mocked so t('key') returns the key string.
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

import type { Part } from '@/domain/part/types'
import { WarehouseSizedDetail } from './WarehouseSizedDetail'

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

/** Shared history props — empty log is fine for install-flow tests. */
const historyProps = {
  movements: [],
  skuIds: new Set<string>(),
  parts: [] as Part[],
  remainingAfterMap: {},
}

describe('WarehouseSizedDetail', () => {
  it('(a) no in-stock variants: «Установить» action is not shown', () => {
    const skus = [
      makeSku({ id: 'sku_512', variantId: '512gb', variantLabel: '512 ГБ' }),
      makeSku({ id: 'sku_1tb', variantId: '1tb', variantLabel: '1 ТБ' }),
    ]
    render(
      <WarehouseSizedDetail
        categoryId="ssd"
        skus={skus}
        stockMap={{ sku_512: { onHand: 0, broken: 0 }, sku_1tb: { onHand: 0, broken: 0 } }}
        onInstall={vi.fn()}
        {...historyProps}
      />,
    )
    expect(screen.queryByRole('button', { name: 'actions.install' })).not.toBeInTheDocument()
  })

  it('(b) single in-stock variant: «Установить» installs it directly (no picker)', async () => {
    const user = userEvent.setup()
    const onInstall = vi.fn()
    const skus = [
      makeSku({ id: 'sku_512', variantId: '512gb', variantLabel: '512 ГБ' }),
      makeSku({ id: 'sku_1tb', variantId: '1tb', variantLabel: '1 ТБ' }),
    ]
    render(
      <WarehouseSizedDetail
        categoryId="ssd"
        skus={skus}
        stockMap={{ sku_512: { onHand: 0, broken: 0 }, sku_1tb: { onHand: 2, broken: 0 } }}
        onInstall={onInstall}
        {...historyProps}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'actions.install' }))

    // Picker did NOT open; onInstall called directly with the in-stock SKU.
    expect(screen.queryByText('warehouse.pickSizeTitle')).not.toBeInTheDocument()
    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(onInstall.mock.calls[0]![0].id).toBe('sku_1tb')
  })

  it('(c) multiple in-stock variants: «Установить» opens picker; choosing a size calls onInstall', async () => {
    const user = userEvent.setup()
    const onInstall = vi.fn()
    const skus = [
      makeSku({ id: 'sku_256', variantId: '256gb', variantLabel: '256 ГБ' }),
      makeSku({ id: 'sku_2tb', variantId: '2tb', variantLabel: '2 ТБ' }),
      makeSku({ id: 'sku_512', variantId: '512gb', variantLabel: '512 ГБ' }),
    ]
    render(
      <WarehouseSizedDetail
        categoryId="ssd"
        skus={skus}
        stockMap={{
          sku_256: { onHand: 5, broken: 0 },
          sku_2tb: { onHand: 3, broken: 0 },
          sku_512: { onHand: 0, broken: 0 }, // out of stock — must not appear in picker
        }}
        onInstall={onInstall}
        {...historyProps}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'actions.install' }))

    // Picker opened, only in-stock sizes listed.
    expect(screen.getByText('warehouse.pickSizeTitle')).toBeInTheDocument()
    expect(screen.getByText('256 ГБ')).toBeInTheDocument()
    expect(screen.getByText('2 ТБ')).toBeInTheDocument()
    expect(screen.queryByText('512 ГБ')).not.toBeInTheDocument()

    await user.click(screen.getByText('2 ТБ'))
    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(onInstall.mock.calls[0]![0].id).toBe('sku_2tb')
  })
})
