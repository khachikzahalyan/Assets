/**
 * Task 5 regression: /assets/new reads dynamic top-level category groups.
 *
 * Seeds a custom group «Самокат» (grp_samokat) with a subcategory «2-колёсная»
 * (cat_scooter2) whose behavior is 'devices' (serial required, no specs panel).
 *
 * Asserts:
 *  1. The «Самокат» tab renders from the dynamic categoryGroups list.
 *  2. Selecting the tab and opening the picker lists «2-колёсная».
 *  3. After picking «2-колёсная», the form shows Серийный номер (device-like)
 *     and hides the Характеристики panel (capability derived from group:'devices').
 *
 * Capabilities MUST be keyed on the subcategory's `group` (behavior), NOT on
 * `categoryGroupId`. Самокат (categoryGroupId: 'grp_samokat', group: 'devices')
 * → device-like capability set.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AssetCreateForm } from './AssetCreateForm'
import type { AssetReferenceData } from '@/domain/asset'

beforeAll(async () => { await i18n.changeLanguage('ru') })

const REF: AssetReferenceData = {
  statuses: [{ id: 'st_warehouse', name: 'На складе', color: 'gray' }],
  branches: [{ id: 'b_main', name: 'Головной офис' }],
  departments: [],
  employees: [],
  categoryGroups: [
    { id: 'grp_samokat', name: 'Самокат', lucideIcon: 'bike', order: 3 },
  ],
  categories: [
    {
      id: 'cat_scooter2',
      name: '2-колёсная',
      categoryGroupId: 'grp_samokat',
      /** behavior: 'devices' → serial required, no specs panel, no OEM license */
      group: 'devices',
      lucideIcon: 'bike',
      requiresSerial: true,
      hasSpecs: false,
    },
  ],
}

function setup() {
  render(
    <I18nextProvider i18n={i18n}>
      <AssetCreateForm
        referenceData={REF}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        submitting={false}
        error={null}
      />
    </I18nextProvider>,
  )
}

describe('AssetCreateForm — dynamic category groups (Task 5)', () => {
  vi.setConfig({ testTimeout: 15000 })

  it('«Самокат» tab renders from the dynamic categoryGroups prop', () => {
    setup()
    const tabs = screen.getAllByRole('tab')
    const names = tabs.map(t => t.textContent ?? '')
    expect(names.some(n => n.includes('Самокат'))).toBe(true)
    expect(tabs).toHaveLength(1)
  })

  it('selecting the «Самокат» tab and opening the picker lists «2-колёсная»', async () => {
    setup()

    // Tab may already be active (auto-selected on mount because cat_scooter2 has group:'devices').
    fireEvent.click(screen.getByRole('tab', { name: /Самокат/i }))

    fireEvent.click(screen.getByRole('combobox', { name: /Категория/i }))
    const listbox = await waitFor(() => screen.getByRole('listbox'), { timeout: 15000 })
    expect(within(listbox).getByText('2-колёсная')).toBeTruthy()
  })

  it('after picking «2-колёсная»: Серийный номер visible, Характеристики absent', async () => {
    setup()

    fireEvent.click(screen.getByRole('tab', { name: /Самокат/i }))
    fireEvent.click(screen.getByRole('combobox', { name: /Категория/i }))
    const listbox = await waitFor(() => screen.getByRole('listbox'), { timeout: 15000 })
    fireEvent.click(within(listbox).getByText('2-колёсная'))

    // Device-like: Серийный номер must appear (requiresSerial: true explicit)
    await waitFor(() => {
      expect(screen.getByLabelText(/Серийный номер/i)).toBeTruthy()
    })

    // No specs panel (hasSpecs: false explicit)
    expect(screen.queryByText('Характеристики')).toBeNull()

    // No OEM license section (unknown id + group:'devices' without explicit hasOemLicense)
    expect(screen.queryByText('Лицензия ОС')).toBeNull()
  })
})
