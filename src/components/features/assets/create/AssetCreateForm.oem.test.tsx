/**
 * Task C4 — OEM key affordance tests for AssetCreateForm.
 *
 * Covers:
 *  - Selecting a hasOemLicense category shows the OEM key input + masked preview.
 *  - Typing a key and submitting yields CreateAssetInput with oemLicense: { rawKey }.
 *  - Selecting a non-OEM category hides the field and yields oemLicense: null.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
        ref={REF}
        onSubmit={onSubmit}
        submitting={false}
        error={null}
      />
    </I18nextProvider>,
  )
  return { onSubmit }
}

describe('AssetCreateForm — OEM key affordance (C4)', () => {
  it('oem-key-input: selecting a hasOemLicense category shows OEM key input with masked preview on type', async () => {
    setup()

    // OEM section should NOT be visible before category selection
    expect(screen.queryByLabelText(/Лицензионный ключ OEM/i)).toBeNull()

    // Select cat_laptop (hasOemLicense: true)
    const categorySelect = screen.getByRole('combobox', { name: /Категория/i })
    fireEvent.change(categorySelect, { target: { value: 'cat_laptop' } })

    // OEM key input should now appear
    await waitFor(() => {
      expect(screen.getByLabelText(/Лицензионный ключ OEM/i)).toBeTruthy()
    })

    // Type a license key — masked preview should appear
    const oemInput = screen.getByLabelText(/Лицензионный ключ OEM/i)
    fireEvent.change(oemInput, { target: { value: 'ABCD-1234-EFGH-5678' } })

    // Masked preview should be visible
    await waitFor(() => {
      // The mask format: keep last 4 alnum, mask the rest
      // ABCD-1234-EFGH-5678 → 14 alnum chars → keep last 4 (5678) → ****-****-****-5678
      expect(screen.getByText('****-****-****-5678')).toBeTruthy()
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
    const categorySelect = screen.getByRole('combobox', { name: /Категория/i })
    fireEvent.change(categorySelect, { target: { value: 'cat_laptop' } })

    // Fill required identity fields
    await waitFor(() => screen.getByPlaceholderText(/Apple, Dell/i))
    fireEvent.change(screen.getByPlaceholderText(/Apple, Dell/i), { target: { value: 'Dell' } })
    fireEvent.change(screen.getByPlaceholderText(/XPS 15, MacBook Pro/i), { target: { value: 'XPS' } })
    fireEvent.change(screen.getByPlaceholderText(/450\/100/i), { target: { value: '450/5' } })
    fireEvent.change(screen.getByPlaceholderText(/SN-XXXX/i), { target: { value: 'SN-005' } })

    // Type OEM key
    await waitFor(() => screen.getByLabelText(/Лицензионный ключ OEM/i))
    fireEvent.change(screen.getByLabelText(/Лицензионный ключ OEM/i), {
      target: { value: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T' },
    })

    // Select warehouse QA
    fireEvent.click(screen.getByRole('button', { name: /Склад/i }))

    // Wait for save button to be enabled
    const saveBtn = screen.getByRole('button', { name: /Сохранить/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())

    fireEvent.click(saveBtn)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted: CreateAssetInput = onSubmit.mock.calls[0]![0]
    expect(submitted.oemLicense).toEqual({ rawKey: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T' })
  })

  it('oem-key-input: selecting a non-OEM category hides the field and yields oemLicense: null', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    setup(onSubmit)

    // Select non-OEM category (cat_monitor, hasOemLicense: false)
    const categorySelect = screen.getByRole('combobox', { name: /Категория/i })
    fireEvent.change(categorySelect, { target: { value: 'cat_monitor' } })

    // OEM field must NOT be visible
    await waitFor(() => screen.getByPlaceholderText(/Apple, Dell/i))
    expect(screen.queryByLabelText(/Лицензионный ключ OEM/i)).toBeNull()

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText(/Apple, Dell/i), { target: { value: 'Samsung' } })
    fireEvent.change(screen.getByPlaceholderText(/XPS 15, MacBook Pro/i), { target: { value: 'LS27' } })
    fireEvent.change(screen.getByPlaceholderText(/450\/100/i), { target: { value: '800/1' } })
    fireEvent.change(screen.getByPlaceholderText(/SN-XXXX/i), { target: { value: 'SN-MON' } })
    fireEvent.click(screen.getByRole('button', { name: /Склад/i }))

    const saveBtn = screen.getByRole('button', { name: /Сохранить/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())
    fireEvent.click(saveBtn)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted: CreateAssetInput = onSubmit.mock.calls[0]![0]
    // oemLicense must be null for a non-OEM category
    expect(submitted.oemLicense).toBeNull()
  })
})
