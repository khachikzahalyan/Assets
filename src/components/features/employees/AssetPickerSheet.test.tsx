/**
 * AssetPickerSheet unit tests.
 * Uses EmployeeModalShell which portals to document.body.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AssetPickerSheet } from './AssetPickerSheet'
import type { AssetPickerSheetProps, PickerStockRow } from './AssetPickerSheet'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

const EMP: AssetPickerSheetProps['emp'] = {
  id: 'emp_1',
  firstName: 'Иван',
  lastName: 'Иванов',
  position: 'Менеджер',
  departmentName: 'IT',
  branchName: 'Головной офис',
}

const STOCK: PickerStockRow[] = [
  { id: 'a1', title: 'MacBook Pro 14', invCode: 'COMP/001', cat: 'Ноутбук', icon: 'laptop', group: 'devices' },
  { id: 'a2', title: 'MacBook Air 13', invCode: 'COMP/002', cat: 'Ноутбук', icon: 'laptop', group: 'devices' },
  { id: 'a3', title: 'Dell Monitor 27', invCode: 'MON/001', cat: 'Монитор', icon: 'monitor', group: 'devices' },
  { id: 'a4', title: 'Cisco Router', invCode: 'NET/001', cat: 'Роутер', icon: 'router', group: 'network' },
  { id: 'a5', title: 'Офисное кресло', invCode: 'FURN/001', cat: 'Кресло', icon: 'armchair', group: 'furniture' },
]

function renderSheet(overrides: Partial<AssetPickerSheetProps> = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn()
  const onClose = overrides.onClose ?? vi.fn()
  const props: AssetPickerSheetProps = {
    open: overrides.open ?? true,
    emp: overrides.emp !== undefined ? overrides.emp : EMP,
    stock: overrides.stock ?? STOCK,
    onConfirm,
    onClose,
  }
  render(
    <I18nextProvider i18n={i18n}>
      <AssetPickerSheet {...props} />
    </I18nextProvider>,
  )
  return { onConfirm, onClose }
}

describe('AssetPickerSheet — group step (step 1)', () => {
  it('shows 3 group cards', () => {
    renderSheet()
    const body = document.body
    expect(within(body).getByText('Устройства')).toBeInTheDocument()
    expect(within(body).getByText('Сетевые устройства')).toBeInTheDocument()
    expect(within(body).getByText('Мебель')).toBeInTheDocument()
  })

  it('shows correct stock counts per group derived from stock prop', () => {
    renderSheet()
    const body = document.body
    // devices: 3 items, network: 1, furniture: 1
    // The count text is "N на складе"
    expect(within(body).getByText('3 на складе')).toBeInTheDocument()
    // There are 2 groups with 1 item (network and furniture)
    const oneInStock = within(body).getAllByText('1 на складе')
    expect(oneInStock.length).toBe(2)
  })

  it('navigates to category step on group click', () => {
    renderSheet()
    fireEvent.click(within(document.body).getByText('Устройства'))
    // Should show subcategories
    expect(within(document.body).getByText('Ноутбук')).toBeInTheDocument()
    expect(within(document.body).getByText('Монитор')).toBeInTheDocument()
  })
})

describe('AssetPickerSheet — category → items step', () => {
  function goToItemsStep() {
    renderSheet()
    fireEvent.click(within(document.body).getByText('Устройства'))
    fireEvent.click(within(document.body).getByText('Ноутбук'))
  }

  it('shows items in selected category', () => {
    goToItemsStep()
    expect(within(document.body).getByText('MacBook Pro 14')).toBeInTheDocument()
    expect(within(document.body).getByText('MacBook Air 13')).toBeInTheDocument()
  })

  it('toggling an item adds it to cart (cart pill appears)', () => {
    goToItemsStep()
    const itemBtn = within(document.body).getByText('MacBook Pro 14').closest('button')
    if (!itemBtn) throw new Error('Item button not found')
    fireEvent.click(itemBtn)
    // Cart pill should appear with count 1
    expect(within(document.body).getByText(/Корзина/)).toBeInTheDocument()
  })

  it('toggling the same item twice removes it from cart', () => {
    goToItemsStep()
    const btn = within(document.body).getByText('MacBook Pro 14').closest('button')
    if (!btn) throw new Error('Item button not found')
    fireEvent.click(btn)
    fireEvent.click(btn)
    // Cart pill should not show (count 0)
    const cartPill = within(document.body).queryByText(/Корзина \d/)
    expect(cartPill).toBeNull()
  })
})

describe('AssetPickerSheet — review step', () => {
  function goToReviewStep() {
    renderSheet()
    fireEvent.click(within(document.body).getByText('Устройства'))
    fireEvent.click(within(document.body).getByText('Ноутбук'))
    // Select one item
    const itemBtn = within(document.body).getByText('MacBook Pro 14').closest('button')
    if (!itemBtn) throw new Error('Item button not found')
    fireEvent.click(itemBtn)
    // Click Готово to go to review
    const doneBtn = within(document.body).getByText(/Готово/).closest('button')
    if (!doneBtn) throw new Error('Done button not found')
    fireEvent.click(doneBtn)
    return { selectedId: 'a1' }
  }

  it('review step shows selected rows', () => {
    goToReviewStep()
    expect(within(document.body).getByText('MacBook Pro 14')).toBeInTheDocument()
  })

  it('Подтвердить calls onConfirm with selected ids', () => {
    const { onConfirm } = renderSheet()
    fireEvent.click(within(document.body).getByText('Устройства'))
    fireEvent.click(within(document.body).getByText('Ноутбук'))
    const itemBtn = within(document.body).getByText('MacBook Pro 14').closest('button')
    if (!itemBtn) throw new Error('Item button not found')
    fireEvent.click(itemBtn)
    const doneBtn = within(document.body).getByText(/Готово/).closest('button')
    if (!doneBtn) throw new Error('Done button not found')
    fireEvent.click(doneBtn)
    const confirmBtn = within(document.body).getByText(/Подтвердить/).closest('button')
    if (!confirmBtn) throw new Error('Confirm button not found')
    fireEvent.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledWith(['a1'])
  })
})

describe('AssetPickerSheet — cancel with cart overlay', () => {
  it('shows confirm overlay when cancelling with non-empty cart', () => {
    renderSheet()
    fireEvent.click(within(document.body).getByText('Устройства'))
    fireEvent.click(within(document.body).getByText('Ноутбук'))
    const itemBtn = within(document.body).getByText('MacBook Pro 14').closest('button')
    if (!itemBtn) throw new Error('Item button not found')
    fireEvent.click(itemBtn)
    // Click Отмена
    const cancelBtns = within(document.body).getAllByText('Отмена')
    const cancelEl0 = cancelBtns[0]
    if (!cancelEl0) throw new Error('Cancel element not found')
    const firstCancel = cancelEl0.closest('button')
    if (!firstCancel) throw new Error('Cancel button not found')
    fireEvent.click(firstCancel)
    // Should show the confirm overlay
    expect(within(document.body).getByText('Отменить выбор?')).toBeInTheDocument()
  })

  it('clicking Да, отменить in overlay calls onClose', () => {
    const { onClose } = renderSheet()
    fireEvent.click(within(document.body).getByText('Устройства'))
    fireEvent.click(within(document.body).getByText('Ноутбук'))
    const itemBtn = within(document.body).getByText('MacBook Pro 14').closest('button')
    if (!itemBtn) throw new Error('Item button not found')
    fireEvent.click(itemBtn)
    const cancelBtns = within(document.body).getAllByText('Отмена')
    const cancelEl0 = cancelBtns[0]
    if (!cancelEl0) throw new Error('Cancel element not found')
    const firstCancel = cancelEl0.closest('button')
    if (!firstCancel) throw new Error('Cancel button not found')
    fireEvent.click(firstCancel)
    const confirmBtn = within(document.body).getByText('Да, отменить').closest('button')
    if (!confirmBtn) throw new Error('Confirm cancel button not found')
    fireEvent.click(confirmBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('cancelling with empty cart closes immediately without overlay', () => {
    const { onClose } = renderSheet()
    // Don't add anything to cart, just click Отмена
    const cancelBtns = within(document.body).getAllByText('Отмена')
    const cancelEl0 = cancelBtns[0]
    if (!cancelEl0) throw new Error('Cancel element not found')
    const firstCancel = cancelEl0.closest('button')
    if (!firstCancel) throw new Error('Cancel button not found')
    fireEvent.click(firstCancel)
    expect(onClose).toHaveBeenCalledOnce()
    expect(within(document.body).queryByText('Отменить выбор?')).toBeNull()
  })
})
