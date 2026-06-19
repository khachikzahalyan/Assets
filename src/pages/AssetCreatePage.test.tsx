import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
  employees: [{ id: 'e1', firstName: 'Иван', lastName: 'Петров' }],
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

describe('AssetCreatePage', () => {
  it('save is disabled until identity + a Quick Assignment recipient are provided', async () => {
    setup()
    await waitFor(() => screen.getByText(/Регистрация актива/i))
    const save = screen.getByRole('button', { name: /Сохранить/i })
    expect(save).toBeDisabled()
  })

  it('warehouse + filled identity creates with derived warehouse status and one audit entry', async () => {
    const { store, onCreated } = setup()
    await waitFor(() => screen.getByText(/Регистрация актива/i))

    // 1. Select the category (cat_laptop)
    // Field wraps in <label> so the <select> is accessible via its label text
    const categorySelect = screen.getByRole('combobox', { name: /Категория/i })
    fireEvent.change(categorySelect, { target: { value: 'cat_laptop' } })

    // 2. Fill brand
    await waitFor(() => screen.getByPlaceholderText(/Apple, Dell/i))
    const brandInput = screen.getByPlaceholderText(/Apple, Dell/i)
    fireEvent.change(brandInput, { target: { value: 'Dell' } })

    // 3. Fill model
    const modelInput = screen.getByPlaceholderText(/XPS 15, MacBook Pro/i)
    fireEvent.change(modelInput, { target: { value: 'XPS' } })

    // 4. Fill inventory code
    const invCodeInput = screen.getByPlaceholderText(/450\/100/i)
    fireEvent.change(invCodeInput, { target: { value: '450/100' } })

    // 5. Fill serial
    const serialInput = screen.getByPlaceholderText(/SN-XXXX/i)
    fireEvent.change(serialInput, { target: { value: 'SN-100' } })

    // 6. Click Склад (warehouse) QA button
    const warehouseBtn = screen.getByRole('button', { name: /Склад/i })
    fireEvent.click(warehouseBtn)

    // 7. Save button should now be enabled
    const save = screen.getByRole('button', { name: /Сохранить/i })
    await waitFor(() => expect(save).not.toBeDisabled())

    // 8. Click save
    fireEvent.click(save)

    // 9. Verify audit entry and callback
    await waitFor(() => {
      expect(store.logs).toHaveLength(1)
      expect(store.logs[0]!.action).toBe('created')
      expect(onCreated).toHaveBeenCalledTimes(1)
      expect(onCreated.mock.calls[0]![0].statusId).toBe('st_warehouse')
    })
  })
})
