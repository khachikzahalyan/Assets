/**
 * Task D7 — Free-OEM-pool picker tests for AssetCreateForm.
 *
 * Covers:
 *  1. Picker branch: selecting a free OEM license from the pool submits { existingLicenseId }.
 *  2. Raw-key branch still works when a licenseRepository is present.
 *  3. Mutual exclusivity: picker then raw key → payload has ONLY rawKey (no existingLicenseId).
 *  4. Filter correctness: only OEM + unassigned + active licenses appear in the picker.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AssetCreateForm } from './AssetCreateForm'
import type { AssetReferenceData, CreateAssetInput } from '@/domain/asset'
import { InMemoryWorkstationLicenseRepository } from '@/infra/repositories/inMemoryWorkstationLicenseRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

/** Shared reference data identical to the oem.test conventions. */
const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned', name: 'Выдано', color: 'emerald' },
  ],
  branches: [{ id: 'b_main', name: 'Головной офис' }],
  departments: [{ id: 'd1', name: 'IT' }],
  categoryGroups: [
    { id: 'grp_devices', name: 'Устройства', lucideIcon: 'monitor-smartphone', order: 0 },
  ],
  categories: [
    {
      id: 'cat_laptop',
      name: 'Ноутбук',
      group: 'devices',
      categoryGroupId: 'grp_devices',
      lucideIcon: 'laptop',
      hasOemLicense: true,
    },
    {
      id: 'cat_monitor',
      name: 'Монитор',
      group: 'devices',
      categoryGroupId: 'grp_devices',
      lucideIcon: 'monitor',
      hasOemLicense: false,
    },
  ],
  employees: [{ id: 'e1', firstName: 'Иван', lastName: 'Петров', email: null }],
}

const ACTOR = { uid: 'test-actor', role: 'asset_admin' as const }

/** Factory: fresh in-memory license repo with its own audit store. */
function makeRepo() {
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  return new InMemoryWorkstationLicenseRepository(ctx)
}

/** Fill identity + warehouse Quick Assignment so Save becomes enabled. */
async function fillIdentityAndWarehouse() {
  await waitFor(() => screen.getByPlaceholderText(/HPE/i))
  fireEvent.change(screen.getByPlaceholderText(/HPE/i), { target: { value: 'Dell' } })
  fireEvent.change(screen.getByPlaceholderText(/ProLiant/i), { target: { value: 'XPS 15' } })
  fireEvent.change(screen.getByPlaceholderText(/460\/00007/), { target: { value: '450/99' } })
  fireEvent.change(screen.getByPlaceholderText(/SN-…|SN-/), { target: { value: 'SN-PKR1' } })
  // Warehouse is already the default QA — no click needed
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

describe('AssetCreateForm — free-OEM-pool picker (D7)', () => {
  vi.setConfig({ testTimeout: 15000 })
  // ---------------------------------------------------------------------------
  // Test 1: picker branch — selecting a free OEM license yields { existingLicenseId }
  // ---------------------------------------------------------------------------
  it('picker-branch: selecting a free OEM license submits oemLicense: { existingLicenseId }', async () => {
    // Arrange
    const repo = makeRepo()
    const { value: freeOem } = await repo.createLicense(
      { name: 'Windows 11 Pro OEM', vendor: 'Microsoft', type: 'OEM' },
      ACTOR,
    )
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <I18nextProvider i18n={i18n}>
        <AssetCreateForm
          referenceData={REF}
          onSubmit={onSubmit}
          submitting={false}
          error={null}
          licenseRepository={repo}
        />
      </I18nextProvider>,
    )

    // cat_laptop is auto-selected on mount (first hasOemLicense category in REF).
    // No chooseCategory needed — the OEM section is already present.
    // Wait for the mode cards to appear.
    await waitFor(() => expect(screen.getByRole('button', { name: /Ключ/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Ключ/i }))

    // Wait for pool to load and picker to appear
    await waitFor(() =>
      expect(screen.getByLabelText(/Существующая свободная лицензия/i)).toBeTruthy(),
    )

    // Pick the free OEM license from the pool Select
    const pickerSelect = screen.getByLabelText(/Существующая свободная лицензия/i)
    fireEvent.change(pickerSelect, { target: { value: freeOem.id } })

    // Fill identity + warehouse
    await fillIdentityAndWarehouse()

    // Wait for Save to become enabled
    const saveBtn = screen.getByRole('button', { name: /Создать актив/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())

    fireEvent.click(saveBtn)

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted: CreateAssetInput = onSubmit.mock.calls[0]![0]
    expect(submitted.oemLicense).toEqual({ existingLicenseId: freeOem.id })
    expect((submitted.oemLicense as Record<string, unknown>)['rawKey']).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // Test 2: raw-key branch still works when licenseRepository is present
  // ---------------------------------------------------------------------------
  it('raw-key branch: typing a raw key (no picker selection) submits oemLicense: { rawKey }', async () => {
    // Arrange
    const repo = makeRepo()
    await repo.createLicense(
      { name: 'Windows 11 Pro OEM', vendor: 'Microsoft', type: 'OEM' },
      ACTOR,
    )
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <I18nextProvider i18n={i18n}>
        <AssetCreateForm
          referenceData={REF}
          onSubmit={onSubmit}
          submitting={false}
          error={null}
          licenseRepository={repo}
        />
      </I18nextProvider>,
    )

    // Act — select OEM-capable category
    await chooseCategory('Ноутбук')

    // Switch to Ключ (manual) mode to reveal the key input
    await waitFor(() => expect(screen.getByRole('button', { name: /Ключ/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Ключ/i }))

    // Wait for OEM raw-key input to appear
    await waitFor(() =>
      expect(screen.getByLabelText(/Лицензионный ключ OEM/i)).toBeTruthy(),
    )

    // Do NOT pick from dropdown — type a raw key directly
    const rawKeyInput = screen.getByLabelText(/Лицензионный ключ OEM/i)
    fireEvent.change(rawKeyInput, { target: { value: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T' } })

    // Fill identity + warehouse
    await fillIdentityAndWarehouse()

    const saveBtn = screen.getByRole('button', { name: /Создать актив/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())

    fireEvent.click(saveBtn)

    // Assert
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted: CreateAssetInput = onSubmit.mock.calls[0]![0]
    expect(submitted.oemLicense).toEqual({ kind: 'manual', rawKey: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T' })
    expect((submitted.oemLicense as Record<string, unknown>)['existingLicenseId']).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // Test 3: mutual exclusivity — picker then raw key → final payload is rawKey only
  // ---------------------------------------------------------------------------
  it('mutual-exclusivity: picking then typing raw key yields only rawKey in payload', async () => {
    // Arrange
    const repo = makeRepo()
    const { value: freeOem } = await repo.createLicense(
      { name: 'Windows 11 Pro OEM', vendor: 'Microsoft', type: 'OEM' },
      ACTOR,
    )
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <I18nextProvider i18n={i18n}>
        <AssetCreateForm
          referenceData={REF}
          onSubmit={onSubmit}
          submitting={false}
          error={null}
          licenseRepository={repo}
        />
      </I18nextProvider>,
    )

    // Act — select OEM-capable category
    await chooseCategory('Ноутбук')

    // Switch to Ключ (manual) mode to reveal the pool picker
    await waitFor(() => expect(screen.getByRole('button', { name: /Ключ/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Ключ/i }))

    // Wait for picker
    await waitFor(() =>
      expect(screen.getByLabelText(/Существующая свободная лицензия/i)).toBeTruthy(),
    )

    // First: pick the pool license
    const pickerSelect = screen.getByLabelText(/Существующая свободная лицензия/i)
    fireEvent.change(pickerSelect, { target: { value: freeOem.id } })

    // Then: type a raw key — should clear the picker (mutual exclusivity).
    // Use a complete 25-alnum key so ProductKeyInput marks it as complete and save is enabled.
    const rawKeyInput = screen.getByLabelText(/Лицензионный ключ OEM/i)

    // The raw-key input is disabled while a pool license is picked; it clears oemPickId on change
    // Simulate: clear picker first so raw input becomes enabled (real user flow),
    // or fire the change on the raw input to trigger mutual-exclusivity logic.
    // The implementation gates: `if (v) setOemPickId('')` inside raw-key onChange.
    // We fire the change directly to prove the behavior.
    fireEvent.change(rawKeyInput, { target: { value: 'YVWGF-BXNMC-HTQYQ-CPQ99-66QFC' } })

    // Fill identity + warehouse
    await fillIdentityAndWarehouse()

    const saveBtn = screen.getByRole('button', { name: /Создать актив/i })
    await waitFor(() => expect(saveBtn).not.toBeDisabled())

    fireEvent.click(saveBtn)

    // Assert — payload should have ONLY rawKey, never both fields
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted: CreateAssetInput = onSubmit.mock.calls[0]![0]
    const oem = submitted.oemLicense as Record<string, unknown> | null

    // Must be exactly one shape — never both keys present simultaneously
    const hasRaw = oem !== null && 'rawKey' in oem
    const hasExisting = oem !== null && 'existingLicenseId' in oem
    expect(hasRaw && hasExisting).toBe(false)

    // The implementation's rule: typing in raw key clears picker → manual rawKey wins
    // ProductKeyInput formats the key: 'YVWGF-BXNMC-HTQYQ-CPQ99-66QFC' stays canonical
    expect(oem).toEqual({ kind: 'manual', rawKey: 'YVWGF-BXNMC-HTQYQ-CPQ99-66QFC' })
  })

  // ---------------------------------------------------------------------------
  // Test 4: filter correctness — only free OEM licenses appear in the picker
  // ---------------------------------------------------------------------------
  it('filter: picker lists only OEM + unassigned + active licenses', async () => {
    // Arrange: seed three licenses; only ONE qualifies for the picker
    const repo = makeRepo()

    // Qualifies: OEM, unassigned, active (created unassigned by default)
    const { value: qualifies } = await repo.createLicense(
      { name: 'Windows 11 Pro OEM', vendor: 'Microsoft', type: 'OEM' },
      ACTOR,
    )

    // Excluded: non-OEM (Subscription), unassigned, active
    await repo.createLicense(
      { name: 'Microsoft 365 Subscription', vendor: 'Microsoft', type: 'Subscription' },
      ACTOR,
    )

    // Excluded: OEM but assigned to a device
    const { value: assignedOem } = await repo.createLicense(
      { name: 'Windows 10 OEM Assigned', vendor: 'Microsoft', type: 'OEM' },
      ACTOR,
    )
    await repo.assignLicense(assignedOem.id, { to: 'device', assetId: 'asset-x' }, ACTOR)

    render(
      <I18nextProvider i18n={i18n}>
        <AssetCreateForm
          referenceData={REF}
          onSubmit={vi.fn()}
          submitting={false}
          error={null}
          licenseRepository={repo}
        />
      </I18nextProvider>,
    )

    // cat_laptop is auto-selected on mount — no chooseCategory needed.
    // Wait for the mode cards to appear (pool load has started).
    await waitFor(() => expect(screen.getByRole('button', { name: /Ключ/i })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Ключ/i }))

    // Wait for picker Select to be rendered and pool to load
    await waitFor(() =>
      expect(screen.getByLabelText(/Существующая свободная лицензия/i)).toBeTruthy(),
    )

    // Wait for the qualifying license option to appear in the picker
    await waitFor(() => {
      const pickerSelect = screen.getByLabelText(/Существующая свободная лицензия/i) as HTMLSelectElement
      const optionValues = Array.from(pickerSelect.options).map(o => o.value)
      // At least the qualifying OEM license should be listed
      expect(optionValues).toContain(qualifies.id)
    })

    // Assert: the picker select should have exactly 2 options:
    // 1 placeholder ("— Ввести ключ вручную —") + 1 qualifying OEM license
    const pickerSelect = screen.getByLabelText(/Существующая свободная лицензия/i) as HTMLSelectElement
    const nonPlaceholderOptions = Array.from(pickerSelect.options).filter(o => o.value !== '')
    expect(nonPlaceholderOptions).toHaveLength(1)
    expect(nonPlaceholderOptions[0]!.value).toBe(qualifies.id)

    // Confirm the excluded licenses are NOT in the picker
    const optionValues = Array.from(pickerSelect.options).map(o => o.value)
    expect(optionValues).not.toContain(assignedOem.id)
  })
})
