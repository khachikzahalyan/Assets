/**
 * AssetCreatePage — print-after-create integration test.
 *
 * Verifies that after a successful single-asset create:
 *   1. window.print() is called (LabelPrintHost rendered and triggered print).
 *   2. navigate('/assets') is called once the print dialog returns.
 *
 * Navigation is stubbed via a vi.mock on useNavigate so we can assert without
 * needing an actual MemoryRouter history change.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AssetCreatePage } from './AssetCreatePage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'

// Prevent Firebase initialisation errors — no VITE_FIREBASE_* env vars in tests.
vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

// Spy on useNavigate so we can assert calls without an actual router change.
// The variable is declared at module scope so the factory closure captures it.
const navigateSpy = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>()
  return { ...mod, useNavigate: () => navigateSpy }
})

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

afterEach(() => {
  navigateSpy.mockClear()
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

/** Opens the category combobox and selects an option by visible text. */
async function chooseCategory(categoryName: string) {
  fireEvent.click(screen.getByRole('combobox', { name: /Категория/i }))
  const listbox = await waitFor(() => screen.getByRole('listbox'), { timeout: 15000 })
  const option = within(listbox).getByText(categoryName)
  fireEvent.click(option)
}

describe('AssetCreatePage — print-after-create', () => {
  vi.setConfig({ testTimeout: 15000 })

  it('calls window.print and then navigates to /assets after single-asset create', async () => {
    // Spy on window.print — LabelPrintHost calls this in useLayoutEffect.
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    const store = createInMemoryAuditStore()
    // InMemoryAssetRepository.createAsset calls allocateUniqueBarcode, so the
    // returned asset will have a non-null barcode — LabelPrintHost will render it.
    const repo = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))

    render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider initialRole="asset_admin">
          <MemoryRouter>
            <AssetCreatePage repository={repo} />
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    )

    // Wait for the form to load (reference data resolved).
    await waitFor(() => screen.getByText(/Регистрация актива/i))

    // 1. Select category via combobox.
    await chooseCategory('Ноутбук')

    // 2. Fill brand.
    await waitFor(() => screen.getByPlaceholderText(/HPE/i))
    fireEvent.change(screen.getByPlaceholderText(/HPE/i), { target: { value: 'Dell' } })

    // 3. Fill model.
    fireEvent.change(screen.getByPlaceholderText(/ProLiant/i), { target: { value: 'XPS' } })

    // 4. Fill inventory code.
    fireEvent.change(screen.getByPlaceholderText(/460\/00007/), { target: { value: '450/100' } })

    // 5. Fill serial number.
    fireEvent.change(screen.getByPlaceholderText(/SN-…|SN-/), { target: { value: 'SN-100' } })

    // 6. Wait for save button to become enabled, then submit.
    const save = screen.getByRole('button', { name: /Создать актив/i })
    await waitFor(() => expect(save).not.toBeDisabled())
    fireEvent.click(save)

    // Assert: LabelPrintHost fires window.print() in useLayoutEffect.
    await waitFor(() => expect(printSpy).toHaveBeenCalled())

    // Assert: onAfterPrint (fired by LabelPrintHost via setTimeout 0) calls navigate.
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/assets'))

    printSpy.mockRestore()
  })
})
