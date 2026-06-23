/**
 * Task C4 — OEM key affordance tests for AssetCreateForm.
 *
 * Covers:
 *  - Selecting a hasOemLicense category shows the OEM key input + masked preview.
 *  - Typing a key and submitting yields CreateAssetInput with oemLicense: { rawKey }.
 *  - Selecting a non-OEM category hides the field and yields oemLicense: null.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AssetCreateForm } from './AssetCreateForm'
import type { AssetReferenceData, CreateAssetInput } from '@/domain/asset'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

/** Reference data: one OEM-capable category + one regular category. */
const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned', name: 'Выдано', color: 'emerald' },
  ],
  branches: [{ id: 'b_main', name: 'Головной офис' }],
  departments: [{ id: 'd1', name: 'IT' }],
  categories: [
    {
      id: 'cat_laptop',
      name: 'Ноутбук',
      group: 'devices',
      lucideIcon: 'laptop',
      hasOemLicense: true,
    },
    {
      id: 'cat_monitor',
      name: 'Монитор',
      group: 'devices',
      lucideIcon: 'monitor',
      hasOemLicense: false,
    },
  ],
  employees: [{ id: 'e1', firstName: 'Иван', lastName: 'Петров', email: null }],
}

function setup(onSubmit = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <AssetCreateForm
        referenceData={REF}
        onSubmit={onSubmit}
        submitting={false}
        error={null}
      />
    </I18nextProvider>,
  )
  return { onSubmit }
}

/**
 * Select a category from the combobox by clicking the trigger to open it,
 * then clicking the option by name inside the listbox (portal).
 */
async function chooseCategory(categoryName: string) {
  fireEvent.click(screen.getByRole('combobox', { name: /Категория/i }))
  const listbox = await waitFor(() => screen.getByRole('listbox'), { timeout: 15000 })
  const option = within(listbox).getByText(categoryName)
  fireEvent.click(option)
}

describe('AssetCreateForm — OEM key affordance (C4)', () => {
  vi.setConfig({ testTimeout: 15000 })
  it('oem-key-input: selecting a hasOemLicense category shows OEM key input with masked preview on type', async () => {
    setup()

    // cat_laptop is auto-selected on mount (first hasOemLicense category in REF).
    // The OEM key INPUT is not visible yet — it is only rendered when licenseMode === 'manual',
    // and the form starts in 'oem_digital' mode. So queryByLabelText returns null even
    // though the ЛИЦЕНЗИЯ ОС section heading is already present.
    expect(screen.queryByLabelText(/Лицензионный ключ OEM/i)).toBeNull()

    // Re-select cat_laptop explicitly (same category — resets dependent fields)
    await chooseCategory('Ноутбук')

    // Switch to Ручной ввод mode to reveal the key input
    await waitFor(() => expect(screen.getByRole('button', { name: /Ручной ввод/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Ручной ввод/i }))

    // OEM key input should now appear
    await waitFor(() => {
      expect(screen.getByLabelText(/Лицензионный ключ OEM/i)).toBeTruthy()
    })

    // Type a complete license key — masked preview should appear.
    // ProductKeyInput formats the value: YVWGF-BXNMC-HTQYQ-CPQ99-66QFC (already canonical)
    const oemInput = screen.getByLabelText(/Лицензионный ключ OEM/i)
    fireEvent.change(oemInput, { target: { value: 'YVWGF-BXNMC-HTQYQ-CPQ99-66QFC' } })

    // Masked preview should be visible.
    // maskLicenseKey('YVWGF-BXNMC-HTQYQ-CPQ99-66QFC'):
    //   25 alnum chars, keep last 4 = '6QFC' (string positions 25,26,27,28)
    //   → '*****-*****-*****-*****-*6QFC'
    await waitFor(() => {
      expect(screen.getByText('*****-*****-*****-*****-*6QFC')).toBeTruthy()
    })

    // Secure hint should also be visible
    expect(
      screen.getByText(/Ключ хранится в зашифрованном виде/i),
    ).toBeTruthy()
  })

  it('oem-key-input: typing a key and submitting yields oemLicense: { rawKey }', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    setup(onSubmit)

    // Select OEM-capable category
    await chooseCategory('Ноутбук')

    // Fill required identity fields
    await waitFor(() => screen.getByPlaceholderText(/HPE/i))
    fireEvent.change(screen.getByPlaceholderText(/HPE/i), { target: { value: 'Dell' } })
    fireEvent.change(screen.getByPlaceholderText(/ProLiant/i), { target: { value: 'XPS' } })
    fireEvent.change(screen.getByPlaceholderText(/460\/00007/), { target: { value: '450/5' } })
    fireEvent.change(screen.getByPlaceholderText(/SN-…|SN-/), { target: { value: 'SN-005' } })

    // Switch to Ручной ввод mode to reveal the key input
    await waitFor(() => expect(screen.getByRole('button', { name: /Ручной ввод/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Ручной ввод/i }))

    // Type OEM key
    await waitFor(() => screen.getByLabelText(/Лицензионный ключ OEM/i))
    fireEvent.change(screen.getByLabelText(/Лицензионный ключ OEM/i), {
      target: { value: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T' },
    })

    // Warehouse is already the default QA — no need to click
    // Wait for save button to be enabled
    const saveBtn = screen.getByRole('button', { name: /Создать актив/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())

    fireEvent.click(saveBtn)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted: CreateAssetInput = onSubmit.mock.calls[0]![0]
    expect(submitted.oemLicense).toEqual({ kind: 'manual', rawKey: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T' })
  })

  it('oem-key-input: selecting a non-OEM category hides the field and yields oemLicense: null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    setup(onSubmit)

    // Select non-OEM category (cat_monitor, hasOemLicense: false)
    await chooseCategory('Монитор')

    // OEM field must NOT be visible
    await waitFor(() => screen.getByPlaceholderText(/HPE/i))
    expect(screen.queryByLabelText(/Лицензионный ключ OEM/i)).toBeNull()

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText(/HPE/i), { target: { value: 'Samsung' } })
    fireEvent.change(screen.getByPlaceholderText(/ProLiant/i), { target: { value: 'LS27' } })
    fireEvent.change(screen.getByPlaceholderText(/460\/00007/), { target: { value: '800/1' } })
    fireEvent.change(screen.getByPlaceholderText(/SN-…|SN-/), { target: { value: 'SN-MON' } })
    // Warehouse is already the default QA

    const saveBtn = screen.getByRole('button', { name: /Создать актив/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())
    fireEvent.click(saveBtn)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted: CreateAssetInput = onSubmit.mock.calls[0]![0]
    // oemLicense must be null for a non-OEM category
    expect(submitted.oemLicense).toBeNull()
  })
})
