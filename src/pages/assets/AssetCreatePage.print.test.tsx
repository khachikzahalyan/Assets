/**
 * AssetCreatePage — draft-preview / commit-on-print integration test.
 *
 * Verifies the deferred-save flow:
 *   1. Submitting the single form opens the LabelPreviewDialog showing the DRAFT
 *      label (its invCode appears) but DOES NOT save — repo.createAsset is not
 *      called yet and window.print() is not fired.
 *   2. navigate('/assets') is NOT called — user stays on the create form.
 *   3. Clicking «Печать» inside the dialog COMMITS (repo.createAsset is called)
 *      and then fires window.print() to print the saved asset.
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

// Stub JsBarcode — jsdom has no SVG rendering; without this stub, Barcode128's
// useLayoutEffect would call JsBarcode against a jsdom SVG element (no getBBox),
// which can throw. The component already swallows the error, but the explicit
// stub makes the intent clear and avoids noise in the test output.
vi.mock('jsbarcode', () => ({ default: vi.fn() }))

// Spy on useNavigate so we can assert it is NOT called after create.
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

describe('AssetCreatePage — preview-after-create', () => {
  vi.setConfig({ testTimeout: 15000 })

  it('shows a draft preview without saving, then commits + prints on «Печать»', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    const store = createInMemoryAuditStore()
    const repo = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))
    const createSpy = vi.spyOn(repo, 'createAsset')

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

    // Assert: the LabelPreviewDialog is shown — wait for the dialog role to appear.
    // The dialog is rendered via createPortal into document.body.
    const dialog = await waitFor(() => screen.getByRole('dialog'))

    // Assert: the DRAFT label is shown (its invCode is rendered inside the dialog).
    expect(within(dialog).getByText('450/100')).toBeTruthy()

    // Assert: nothing has been saved yet — createAsset was NOT called on submit.
    expect(createSpy).not.toHaveBeenCalled()

    // Assert: navigate was NOT called with '/assets' — user stays on the create form.
    expect(navigateSpy).not.toHaveBeenCalledWith('/assets')

    // Assert: window.print was NOT auto-called on submit — only «Печать» triggers printing.
    expect(printSpy).not.toHaveBeenCalled()

    // Now click «Печать» inside the dialog → commit (createAsset) then print.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Печать наклейки' }))

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(printSpy).toHaveBeenCalled())

    createSpy.mockRestore()
    printSpy.mockRestore()
  })
})
