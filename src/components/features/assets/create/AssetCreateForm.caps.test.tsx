/**
 * AssetCreateForm — Category-drives-sections regression guard.
 *
 * Proves that the capability taxonomy (src/domain/asset/categoryCapabilities.ts)
 * controls which form sections are rendered when a category is selected:
 *
 *   Initial render → cat_computer is AUTO-SELECTED (first hasOemLicense category)
 *                  → ХАРАКТЕРИСТИКИ + Лицензия ОС + Серийный номер visible immediately
 *   cat_monitor   → no specs, no OEM license, but Серийный номер visible
 *   cat_desk      → Тип field visible; no specs, no OEM license, no Серийный номер
 *
 * Fixtures intentionally omit explicit capability flags on cat_computer and
 * cat_monitor so the test exercises the domain taxonomy fallback by id.
 * cat_desk carries hasTypeField:true because the parity suite fixture already
 * sets it that way and it makes the intent explicit; the taxonomy would derive
 * the same result from group:'furniture' anyway.
 *
 * cat_computer appears first in REF.categories and has hasOemLicense:true (via
 * taxonomy), so the form auto-selects it on mount — all dependent sections are
 * visible without any user interaction.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AssetCreateForm } from './AssetCreateForm'
import type { AssetReferenceData } from '@/domain/asset'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

/**
 * Reference data: three categories WITHOUT explicit flag overrides for OEM/specs/serial.
 * The form must derive the correct sections from the domain taxonomy by category id.
 *
 * cat_desk intentionally carries hasTypeField:true (mirroring the seeded doc) — the
 * taxonomy derives the same from group:'furniture' regardless.
 */
const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned', name: 'Выдано', color: 'emerald' },
  ],
  branches: [{ id: 'b_main', name: 'Головной офис' }],
  departments: [{ id: 'd1', name: 'IT' }],
  categoryGroups: [
    { id: 'grp_devices',   name: 'Устройства', lucideIcon: 'monitor-smartphone', order: 0 },
    { id: 'grp_furniture', name: 'Мебель',      lucideIcon: 'armchair',           order: 1 },
  ],
  categories: [
    // No explicit hasOemLicense / hasSpecs / requiresSerial — taxonomy must supply them
    { id: 'cat_computer', name: 'Компьютер', group: 'devices',   categoryGroupId: 'grp_devices',   lucideIcon: 'monitor' },
    { id: 'cat_monitor',  name: 'Монитор',   group: 'devices',   categoryGroupId: 'grp_devices',   lucideIcon: 'monitor' },
    // Furniture — hasTypeField from doc mirrors taxonomy; no other overrides
    { id: 'cat_desk',     name: 'Стол',      group: 'furniture', categoryGroupId: 'grp_furniture', lucideIcon: 'armchair', hasTypeField: true },
  ],
  employees: [{ id: 'e1', firstName: 'Иван', lastName: 'Петров', email: null }],
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

/**
 * Open the category combobox and click the option matching categoryName.
 * The dropdown renders in a portal so we scope to the listbox role.
 */
async function chooseCategory(categoryName: string) {
  fireEvent.click(screen.getByRole('combobox', { name: /Категория/i }))
  const listbox = await waitFor(() => screen.getByRole('listbox'), { timeout: 15000 })
  fireEvent.click(within(listbox).getByText(categoryName))
}

/**
 * Integration tests: default category auto-selection on mount.
 *
 * These tests verify the DoD requirement: on initial render (no user interaction),
 * with a repo whose categories include an OEM device category, the ЛИЦЕНЗИЯ ОС
 * section AND the ХАРАКТЕРИСТИКИ panel are present in the DOM.
 */
describe('AssetCreateForm — default category auto-selection on mount', () => {
  vi.setConfig({ testTimeout: 15000 })

  it('initial render: ЛИЦЕНЗИЯ ОС section AND ХАРАКТЕРИСТИКИ panel are present without user interaction', async () => {
    // REF.categories[0] is cat_computer (hasOemLicense:true via taxonomy) — the form
    // must auto-select it so both sections render on mount.
    setup()

    await waitFor(() => {
      expect(screen.getByText('Лицензия ОС')).toBeTruthy()
    })
    expect(screen.getByText('Характеристики')).toBeTruthy()
  })

  it('switching to a non-OEM category (Монитор) HIDES the license section', async () => {
    setup()
    // Wait for auto-select to render
    await waitFor(() => expect(screen.getByText('Лицензия ОС')).toBeTruthy())

    // Switch to monitor — non-OEM
    await chooseCategory('Монитор')

    await waitFor(() => {
      expect(screen.queryByText('Лицензия ОС')).toBeNull()
    })
    expect(screen.queryByText('Характеристики')).toBeNull()
  })

  it('switching to furniture (Стол) shows Тип field', async () => {
    setup()
    // Wait for auto-select to render
    await waitFor(() => expect(screen.getByText('Лицензия ОС')).toBeTruthy())

    // Switch to furniture group tab first (auto-select set group to 'devices', so
    // the picker would otherwise filter out furniture categories).
    fireEvent.click(screen.getByRole('tab', { name: /Мебель/i }))
    await chooseCategory('Стол')

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Стол, Кресло/i)).toBeTruthy()
    })
    expect(screen.queryByText('Лицензия ОС')).toBeNull()
    expect(screen.queryByText('Характеристики')).toBeNull()
  })
})

describe('AssetCreateForm — category-drives-sections (caps regression)', () => {
  vi.setConfig({ testTimeout: 15000 })

  // -------------------------------------------------------------------------
  // cat_computer: OEM desktop → specs + OS license + serial all visible
  // Verifies the auto-select behavior: cat_computer is pre-selected on mount
  // (first hasOemLicense category in REF), so all sections appear immediately
  // without any user interaction.
  // -------------------------------------------------------------------------
  it('cat_computer: ХАРАКТЕРИСТИКИ panel, Лицензия ОС section, and Серийный номер field are visible on initial render (auto-selected)', async () => {
    setup()

    // cat_computer is auto-selected on mount — all three sections must already be present
    // without any chooseCategory interaction.
    await waitFor(() => {
      expect(screen.getByText('Характеристики')).toBeTruthy()
    })

    // Лицензия ОС section header (t('osLicense.title'))
    expect(screen.getByText('Лицензия ОС')).toBeTruthy()

    // Серийный номер field label (t('form.serial'))
    expect(screen.getByLabelText(/Серийный номер/i)).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // Switching to cat_computer explicitly still shows all sections
  // -------------------------------------------------------------------------
  it('cat_computer: selecting cat_computer explicitly shows ХАРАКТЕРИСТИКИ panel, Лицензия ОС section, and Серийный номер field', async () => {
    setup()

    await chooseCategory('Компьютер')

    // ХАРАКТЕРИСТИКИ panel (SpecsPanel renders the literal heading)
    await waitFor(() => {
      expect(screen.getByText('Характеристики')).toBeTruthy()
    })

    // Лицензия ОС section header (t('osLicense.title'))
    expect(screen.getByText('Лицензия ОС')).toBeTruthy()

    // Серийный номер field label (t('form.serial'))
    expect(screen.getByLabelText(/Серийный номер/i)).toBeTruthy()
  })

  // -------------------------------------------------------------------------
  // cat_monitor: plain display device → serial visible, no specs, no OEM
  // -------------------------------------------------------------------------
  it('cat_monitor: shows Серийный номер, hides ХАРАКТЕРИСТИКИ panel and Лицензия ОС section', async () => {
    setup()

    await chooseCategory('Монитор')

    // Serial field must appear
    await waitFor(() => {
      expect(screen.getByLabelText(/Серийный номер/i)).toBeTruthy()
    })

    // Specs panel must NOT appear
    expect(screen.queryByText('Характеристики')).toBeNull()

    // OEM license section must NOT appear
    expect(screen.queryByText('Лицензия ОС')).toBeNull()
  })

  // -------------------------------------------------------------------------
  // cat_desk: furniture → Тип field visible; no specs, no license, no serial
  // -------------------------------------------------------------------------
  it('cat_desk: shows Тип field, hides ХАРАКТЕРИСТИКИ, Лицензия ОС, and Серийный номер', async () => {
    setup()

    // Auto-select sets group to 'devices'. Switch to furniture tab first so
    // the CategoryPicker shows furniture categories before choosing 'Стол'.
    fireEvent.click(screen.getByRole('tab', { name: /Мебель/i }))
    await chooseCategory('Стол')

    // Тип field must appear — query by placeholder text (t('placeholders.type') = "Например: Стол, Кресло")
    // getByLabelText is not used here because Field wraps inputs in an implicit <label> whose
    // accessible name includes the required-star span, making the exact /^Тип$/ regex non-matching.
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Стол, Кресло/i)).toBeTruthy()
    })

    // Specs panel must NOT appear
    expect(screen.queryByText('Характеристики')).toBeNull()

    // OEM license section must NOT appear
    expect(screen.queryByText('Лицензия ОС')).toBeNull()

    // Serial field must NOT appear
    expect(screen.queryByLabelText(/Серийный номер/i)).toBeNull()
  })
})
