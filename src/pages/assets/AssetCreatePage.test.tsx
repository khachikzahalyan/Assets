import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AssetCreatePage } from './AssetCreatePage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'

// Prevent Firebase initialisation errors in test environment (no VITE_FIREBASE_* env vars).
vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned', name: 'Выдано', color: 'emerald' },
  ],
  branches: [{ id: 'b_main', name: 'Головной офис' }],
  departments: [{ id: 'd1', name: 'IT' }],
  categories: [
    { id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' },
  ],
  employees: [{ id: 'e1', firstName: 'Иван', lastName: 'Петров', email: null }],
}

function setup() {
  const store = createInMemoryAuditStore()
  const repo = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))
  const onCreated = vi.fn()
  render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider initialRole="asset_admin">
        <MemoryRouter>
          <AssetCreatePage repository={repo} onCreated={onCreated} />
        </MemoryRouter>
      </AuthProvider>
    </I18nextProvider>,
  )
  return { repo, store, onCreated }
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

describe('AssetCreatePage', () => {
  vi.setConfig({ testTimeout: 15000 })
  it('save is disabled until identity + a Quick Assignment recipient are provided', async () => {
    setup()
    await waitFor(() => screen.getByText(/Регистрация актива/i))
    const save = screen.getByRole('button', { name: /Создать актив/i })
    expect(save).toBeDisabled()
  })

  it('warehouse + filled identity creates with derived warehouse status and one audit entry', async () => {
    const { store, onCreated } = setup()
    await waitFor(() => screen.getByText(/Регистрация актива/i))

    // 1. Select the category (cat_laptop) via the combobox
    await chooseCategory('Ноутбук')

    // 2. Fill brand
    await waitFor(() => screen.getByPlaceholderText(/HPE/i))
    const brandInput = screen.getByPlaceholderText(/HPE/i)
    fireEvent.change(brandInput, { target: { value: 'Dell' } })

    // 3. Fill model
    const modelInput = screen.getByPlaceholderText(/ProLiant/i)
    fireEvent.change(modelInput, { target: { value: 'XPS' } })

    // 4. Fill inventory code
    const invCodeInput = screen.getByPlaceholderText(/460\/00007/)
    fireEvent.change(invCodeInput, { target: { value: '450/100' } })

    // 5. Fill serial — cat_laptop in this test has no requiresSerial field, but placeholder check
    // Note: cat_laptop in this test has no requiresSerial field, so it defaults via categoryCapabilities
    // requiresSerial defaults to !isFurniture = true, so serial field appears
    const serialInput = screen.getByPlaceholderText(/SN-…|SN-/)
    fireEvent.change(serialInput, { target: { value: 'SN-100' } })

    // 6. Warehouse is default QA — no click needed, but clicking is harmless
    const warehouseBtn = screen.getByRole('button', { name: /Склад/i })
    fireEvent.click(warehouseBtn)

    // 7. Save button should now be enabled
    const save = screen.getByRole('button', { name: /Создать актив/i })
    await waitFor(() => expect(save).not.toBeDisabled())

    // 8. Click Создать актив — this now opens a DRAFT preview; nothing is saved yet.
    fireEvent.click(save)

    // 9. The save is deferred until «Печать» is clicked inside the preview dialog.
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    expect(store.logs).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Печать наклейки' }))

    // 10. Now the asset is committed — verify audit entry and callback.
    await waitFor(() => {
      expect(store.logs).toHaveLength(1)
      expect(store.logs[0]!.action).toBe('created')
      expect(onCreated).toHaveBeenCalledTimes(1)
      expect(onCreated.mock.calls[0]![0].statusId).toBe('st_warehouse')
    })
  })
})
