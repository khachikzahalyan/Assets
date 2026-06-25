import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AssetCreateForm } from './AssetCreateForm'
import type { AssetReferenceData, CreateAssetInput } from '@/domain/asset'

beforeAll(async () => { await i18n.changeLanguage('ru') })

const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned', name: 'Выдано', color: 'green' },
  ],
  branches: [{ id: 'b_main', name: 'Головной офис' }],
  departments: [{ id: 'd1', name: 'IT' }],
  categories: [
    { id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop', hasOemLicense: true, hasSpecs: true, requiresSerial: true },
    { id: 'cat_router', name: 'Маршрутизатор', group: 'network', lucideIcon: 'router', requiresSerial: true },
    { id: 'cat_desk', name: 'Стол', group: 'furniture', lucideIcon: 'armchair', hasTypeField: true, requiresSerial: false },
  ],
  employees: [{ id: 'e1', firstName: 'Иван', lastName: 'Петров', email: null }],
}

function setup(extra: Partial<React.ComponentProps<typeof AssetCreateForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onSubmitBatch = vi.fn().mockResolvedValue(undefined)
  render(
    <I18nextProvider i18n={i18n}>
      <AssetCreateForm referenceData={REF} onSubmit={onSubmit} onSubmitBatch={onSubmitBatch} submitting={false} error={null} {...extra} />
    </I18nextProvider>,
  )
  return { onSubmit, onSubmitBatch }
}

/**
 * Select a category from the combobox by clicking the trigger to open it,
 * then clicking the option whose text matches the category name.
 * Uses the listbox role scoped to the portal so it never conflicts with the trigger.
 */
async function chooseCategory(categoryName: string) {
  // Open the combobox
  fireEvent.click(screen.getByRole('combobox', { name: /Категория/i }))
  // Wait for the listbox to appear (portal renders to body)
  const listbox = await waitFor(() => screen.getByRole('listbox'), { timeout: 15000 })
  // Click the option by text inside the listbox
  const option = within(listbox).getByText(categoryName)
  fireEvent.click(option)
}

describe('AssetCreateForm parity', () => {
  vi.setConfig({ testTimeout: 15000 })

  it('renders the three group tabs with counts', () => {
    setup()
    const tabs = screen.getAllByRole('tab')
    const names = tabs.map(t => t.textContent || '')
    expect(names.some(n => n.includes('Устройства') && !n.includes('Сетевые'))).toBe(true)
    expect(names.some(n => n.includes('Сетевые уст.'))).toBe(true)
    expect(names.some(n => n.includes('Мебель'))).toBe(true)
    expect(tabs).toHaveLength(3)
  })

  it('single-mode laptop save produces a full CreateAssetInput with warehouse assignment', async () => {
    const { onSubmit } = setup()
    await chooseCategory('Ноутбук')
    await waitFor(() => screen.getByPlaceholderText(/HPE/i))
    fireEvent.change(screen.getByPlaceholderText(/HPE/i), { target: { value: 'Dell' } })
    fireEvent.change(screen.getByPlaceholderText(/ProLiant/i), { target: { value: 'XPS 15' } })
    fireEvent.change(screen.getByPlaceholderText(/460\/00007/), { target: { value: '450/77' } })
    fireEvent.change(screen.getByPlaceholderText(/SN-…|SN-/), { target: { value: 'SN-77' } })
    // Switch to digital OEM mode (no key required) so the save button is enabled
    fireEvent.click(screen.getByRole('button', { name: /Цифровая/i }))
    fireEvent.click(screen.getByRole('button', { name: /Склад/i }))

    const saveBtn = screen.getByRole('button', { name: /Создать актив|Сохранить/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())
    fireEvent.click(saveBtn)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const input: CreateAssetInput = onSubmit.mock.calls[0]![0]
    expect(input.categoryId).toBe('cat_laptop')
    expect(input.brand).toBe('Dell')
    expect(input.invCode).toBe('450/77')
    expect(input.serial).toBe('SN-77')
    expect(input.assignment).toBeNull()
    expect(input.branchId).toBe('b_main')
    expect(input.condition).toBe('new')
    expect(input.purchaseDate).toBeTruthy()
    expect(input.warrantyEndsAt).toBeTruthy()
  })

  it('toggling to Б/У clears purchase + warranty from the payload', async () => {
    const { onSubmit } = setup()
    await chooseCategory('Ноутбук')
    await waitFor(() => screen.getByPlaceholderText(/HPE/i))
    fireEvent.change(screen.getByPlaceholderText(/HPE/i), { target: { value: 'Dell' } })
    fireEvent.change(screen.getByPlaceholderText(/ProLiant/i), { target: { value: 'XPS' } })
    fireEvent.change(screen.getByPlaceholderText(/460\/00007/), { target: { value: '450/78' } })
    fireEvent.change(screen.getByPlaceholderText(/SN-…|SN-/), { target: { value: 'SN-78' } })
    // Switch to digital OEM mode (no key required) so the save button is enabled
    fireEvent.click(screen.getByRole('button', { name: /Цифровая/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Б\/У$/i }))
    fireEvent.click(screen.getByRole('button', { name: /Склад/i }))

    const saveBtn = screen.getByRole('button', { name: /Создать актив|Сохранить/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())
    fireEvent.click(saveBtn)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const input: CreateAssetInput = onSubmit.mock.calls[0]![0]
    expect(input.condition).toBe('used')
    expect(input.purchaseDate).toBeNull()
    expect(input.warrantyEndsAt).toBeNull()
  })

  it('furniture renders Тип (no Brand/Model/Serial) and saves type', async () => {
    const { onSubmit } = setup()
    // Auto-select sets group to 'devices'. Switch to furniture tab first so
    // the CategoryPicker shows furniture categories before choosing 'Стол'.
    fireEvent.click(screen.getByRole('tab', { name: /Мебель/i }))
    await chooseCategory('Стол')
    await waitFor(() => screen.getByPlaceholderText(/Стол, Кресло/i))
    expect(screen.queryByPlaceholderText(/HPE/i)).toBeNull()
    expect(screen.queryByPlaceholderText(/SN-…|SN-/)).toBeNull()
    fireEvent.change(screen.getByPlaceholderText(/Стол, Кресло/i), { target: { value: 'Стол письменный' } })
    fireEvent.change(screen.getByPlaceholderText(/460\/00007/), { target: { value: '470/12' } })
    fireEvent.click(screen.getByRole('button', { name: /Склад/i }))

    const saveBtn = screen.getByRole('button', { name: /Создать актив|Сохранить/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())
    fireEvent.click(saveBtn)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const input: CreateAssetInput = onSubmit.mock.calls[0]![0]
    expect(input.type).toBe('Стол письменный')
    expect(input.brand).toBeNull()
    expect(input.serial).toBeNull()
  })

  it('group mode submits a batch of CreateAssetInput rows sharing fields', async () => {
    const { onSubmitBatch } = setup()
    // Switch to group mode
    fireEvent.click(screen.getByRole('button', { name: /^Группа$/i }))
    await chooseCategory('Ноутбук')
    await waitFor(() => screen.getByPlaceholderText(/HPE/i))
    fireEvent.change(screen.getByPlaceholderText(/HPE/i), { target: { value: 'Dell' } })
    fireEvent.change(screen.getByPlaceholderText(/ProLiant/i), { target: { value: 'Latitude' } })

    // Quantity defaults to 10; reduce to 2 for the test by typing into Количество
    const qty = screen.getByRole('spinbutton')
    fireEvent.change(qty, { target: { value: '2' } })

    // Confirm two rows via the stepper
    const inv = () => screen.getByPlaceholderText('460/00007')
    const ser = () => screen.getByPlaceholderText('SN-…')
    fireEvent.change(inv(), { target: { value: '460/00100' } })
    fireEvent.change(ser(), { target: { value: 'SN-A' } })
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить/i }))
    fireEvent.change(ser(), { target: { value: 'SN-B' } })
    fireEvent.click(screen.getByRole('button', { name: /Подтвердить/i }))

    const saveBtn = screen.getByRole('button', { name: /Создать 2/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())
    fireEvent.click(saveBtn)

    await waitFor(() => expect(onSubmitBatch).toHaveBeenCalledTimes(1))
    const inputs: CreateAssetInput[] = onSubmitBatch.mock.calls[0]![0]
    expect(inputs).toHaveLength(2)
    expect(inputs.map(i => i.invCode)).toEqual(['460/00100', '460/00101'])
    expect(inputs.map(i => i.serial)).toEqual(['SN-A', 'SN-B'])
    expect(inputs.every(i => i.brand === 'Dell' && i.model === 'Latitude' && i.assignment === null)).toBe(true)
  })

  it('network device hides Branch/Department quick-assign modes', async () => {
    setup()
    // Auto-select sets group to 'devices'. Switch to network tab first so
    // the CategoryPicker shows network categories before choosing 'Маршрутизатор'.
    fireEvent.click(screen.getByRole('tab', { name: /Сетевые уст\./i }))
    await chooseCategory('Маршрутизатор')
    await waitFor(() => screen.getByPlaceholderText(/HPE/i))
    expect(screen.getByRole('button', { name: /Склад/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Филиал$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Отдел$/i })).toBeNull()
  })
})
