import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { AssetDetailPage } from './AssetDetailPage'
import { InMemoryAssetRepository, InMemoryAssignmentRepository, type MailEntry } from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { Asset, AssetReferenceData } from '@/domain/asset'

// Prevent Firebase initialisation errors in test environment (no VITE_FIREBASE_* env vars).
vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

// Prevent storage upload calls in tests
vi.mock('@/infra/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/storage')>()
  return {
    ...actual,
    uploadActScan: vi.fn().mockResolvedValue('acts/a_1/scan.pdf'),
    actScanUrl: vi.fn().mockResolvedValue('https://example.com/scan.pdf'),
  }
})

function refData(): AssetReferenceData {
  return {
    statuses: [
      { id: 'st_warehouse', name: 'На складе', color: 'gray' },
      { id: 'st_assigned', name: 'Выдано', color: 'green' },
    ],
    branches: [{ id: 'br_main', name: 'Главный' }, { id: 'br_2', name: 'Филиал 2' }],
    departments: [],
    categories: [{ id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' }],
    employees: [{ id: 'e_1', firstName: 'Иван', lastName: 'Петров', email: null }],
  }
}

function mkAsset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'a_1', categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS', invCode: '450/1',
    serial: 'SN', statusId: 'st_warehouse', assignment: null, branchId: 'br_main', deptId: null,
    updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null,
    ...over,
  }
}

interface RenderResult {
  assets: Asset[]
  mail: MailEntry[]
  store: ReturnType<typeof createInMemoryAuditStore>
}

function renderPage(
  assets: Asset[],
  mail: MailEntry[],
  role: 'super_admin' | 'asset_admin' | 'tech_admin' | 'employee' = 'asset_admin',
): RenderResult {
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  const assetRepo = new InMemoryAssetRepository(assets, refData(), ctx)
  const asnRepo = new InMemoryAssignmentRepository(assets, mail, ctx)
  const auth = {
    user: { id: 'u_1', name: 'A', email: 'a@example.test', role, initials: 'A', avatarColor: '' },
    role,
    status: 'ready' as const,
    setRole: () => {},
    signOut: () => {},
  }
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/assets/a_1']}>
          <Routes>
            <Route
              path="/assets/:id"
              element={<AssetDetailPage repository={assetRepo} assignmentRepository={asnRepo} />}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
  return { assets, mail, store }
}

describe('AssetDetailPage assignment flow', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  // ---------------------------------------------------------------------------
  // Existing shallow test — kept for regression
  // ---------------------------------------------------------------------------
  it('shows an Assign action for a warehouse asset and opens the form', async () => {
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    renderPage(assets, mail)
    // Wait for the page to load and the Assign button to appear
    const assignBtn = await screen.findByRole('button', { name: /Назначить/ })
    expect(assignBtn).toBeTruthy()
    // Click the assign button to open the form
    await userEvent.click(assignBtn)
    // The form should now be visible — Branch mode button should be present
    const branchBtn = await screen.findByRole('button', { name: 'Филиал' })
    expect(branchBtn).toBeTruthy()
    // Asset is still in warehouse (form just opened, no submit yet)
    await waitFor(() => expect(assets[0]!.statusId).toBe('st_warehouse'))
  })

  // ---------------------------------------------------------------------------
  // 1. ASSIGN TO BRANCH — happy path
  // ---------------------------------------------------------------------------
  it('assign to branch: updates asset to st_assigned with branch assignment and writes one audit entry', async () => {
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    const { store } = renderPage(assets, mail)

    // Open the form — initially only one "Назначить" button exists (LifecycleActions)
    await userEvent.click(await screen.findByRole('button', { name: /Назначить/ }))

    // Switch to branch mode
    const branchBtn = await screen.findByRole('button', { name: 'Филиал' })
    await userEvent.click(branchBtn)

    // Pick a branch from the native <select>
    const branchSelect = await screen.findByDisplayValue('Выберите филиал')
    await userEvent.selectOptions(branchSelect, 'br_2')

    // After opening the form the LifecycleActions "Назначить" button is hidden
    // (canAssign && !assigning → false), so only the AssignmentForm submit is present.
    // getAllByRole still works — we take the last element defensively.
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /Назначить/ })
      expect(btns.length).toBeGreaterThanOrEqual(1)
    })
    const assignBtns = screen.getAllByRole('button', { name: /Назначить/ })
    // The form submit button is the last (and only) one in DOM order once the form is open
    const formSubmit = assignBtns[assignBtns.length - 1]!
    await userEvent.click(formSubmit)

    // (a) Shared assets array updated
    await waitFor(() => {
      expect(assets[0]!.statusId).toBe('st_assigned')
      expect(assets[0]!.assignment).toEqual({ mode: 'branch', branchId: 'br_2' })
    })

    // (b) Assignment history panel renders the branch name and "active" chip
    await waitFor(() => {
      expect(screen.getByText('Филиал 2')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText('Активно')).toBeInTheDocument()
    })

    // (c) Exactly one audit entry with action 'assigned'
    expect(store.logs.filter(l => l.action === 'assigned')).toHaveLength(1)
  })

  // ---------------------------------------------------------------------------
  // 2. ASSIGN TO EMPLOYEE — no email on EmployeeRow → no mail enqueued
  // ---------------------------------------------------------------------------
  it('assign to employee: updates asset with employee assignment and does NOT enqueue mail (EmployeeRow has no email)', async () => {
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    const { store } = renderPage(assets, mail)

    // Open the form
    await userEvent.click(await screen.findByRole('button', { name: /Назначить/ }))

    // Employee mode is default — just pick an employee
    const employeeSelect = await screen.findByDisplayValue('Выберите сотрудника')
    await userEvent.selectOptions(employeeSelect, 'e_1')

    // LifecycleActions "Назначить" is hidden while form is open; only form submit is visible.
    const assignBtns = screen.getAllByRole('button', { name: /Назначить/ })
    const formSubmit = assignBtns[assignBtns.length - 1]!
    await userEvent.click(formSubmit)

    // Asset updated to st_assigned with employee mode
    await waitFor(() => {
      expect(assets[0]!.statusId).toBe('st_assigned')
      expect(assets[0]!.assignment).toEqual({ mode: 'employee', employeeId: 'e_1' })
    })

    // No mail enqueued — EmployeeRow has no email field
    expect(mail).toHaveLength(0)

    // One audit entry with action 'assigned'
    expect(store.logs.filter(l => l.action === 'assigned')).toHaveLength(1)

    // Employee name appears in history
    await waitFor(() => {
      expect(screen.getByText('Иван Петров')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 3. RETURN flow
  // ---------------------------------------------------------------------------
  it('return: marks asset back to st_warehouse, clears assignment, history row shows "ended"', async () => {
    // Start from a warehouse asset; assign first, then return via UI
    const assets = [mkAsset()]
    const mail: MailEntry[] = []
    const { store } = renderPage(assets, mail)

    // --- Assign phase ---
    // Open the form (single "Назначить" button at this point)
    await userEvent.click(await screen.findByRole('button', { name: /Назначить/ }))
    // Switch to branch mode
    await userEvent.click(await screen.findByRole('button', { name: 'Филиал' }))
    // Pick the branch
    const branchSelect = await screen.findByDisplayValue('Выберите филиал')
    await userEvent.selectOptions(branchSelect, 'br_main')
    // LifecycleActions "Назначить" is hidden while form is open; pick last (form submit).
    const assignBtns = screen.getAllByRole('button', { name: /Назначить/ })
    await userEvent.click(assignBtns[assignBtns.length - 1]!)

    // Wait for assignment to complete (page reloads, form dismissed)
    await waitFor(() => expect(assets[0]!.statusId).toBe('st_assigned'))

    // --- Return phase ---
    // LifecycleActions now shows the "Вернуть" button (isAssigned=true)
    const returnBtn = await screen.findByRole('button', { name: /Вернуть/ })
    await userEvent.click(returnBtn)

    // (a) Asset back to warehouse, assignment cleared
    await waitFor(() => {
      expect(assets[0]!.statusId).toBe('st_warehouse')
      expect(assets[0]!.assignment).toBeNull()
    })

    // (b) Audit entry with action 'returned'
    expect(store.logs.filter(l => l.action === 'returned')).toHaveLength(1)

    // (c) History row shows "Завершено" chip (endedAt is now set)
    await waitFor(() => {
      expect(screen.getByText('Завершено')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. ROLE GATING — tech_admin cannot see the Assign button
  // ---------------------------------------------------------------------------
  it('tech_admin sees no Assign button for a warehouse asset', async () => {
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    renderPage(assets, mail, 'tech_admin')

    // Wait for page to fully load — tech_admin can see "Отправить в ремонт" (canRepair=true)
    await screen.findByRole('button', { name: /Отправить в ремонт/ })

    // Assign button must NOT be present (canAssign=false for tech_admin)
    expect(screen.queryByRole('button', { name: /Назначить/ })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5. FILE VALIDATION — AssignmentForm (isolated component test)
// ---------------------------------------------------------------------------
describe('AssignmentForm file validation', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('shows fileBadType error and keeps submit disabled when a non-image/pdf file is attached', async () => {
    // Render the page so AssignmentForm is accessible via the full integration harness
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    renderPage(assets, mail)

    // Open the form (single "Назначить" button at this point)
    await userEvent.click(await screen.findByRole('button', { name: /Назначить/ }))

    // Pick an employee so the form would be submittable BUT FOR the bad file
    const employeeSelect = await screen.findByDisplayValue('Выберите сотрудника')
    await userEvent.selectOptions(employeeSelect, 'e_1')

    // Attach a bad-type file (text/plain is not allowed).
    // Use fireEvent.change to directly trigger the input's onChange since jsdom
    // does not always fire the change event via userEvent.upload for file inputs
    // that use a plain <input type="file"> (not a click-triggered picker).
    const badFile = new File(['hello'], 'document.txt', { type: 'text/plain' })
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(fileInput).not.toBeNull()

    // fireEvent.change with a files list triggers React's synthetic onChange
    fireEvent.change(fileInput!, { target: { files: [badFile] } })

    // Error message appears (role="alert" on the <p> in AssignmentForm)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Допустимы только JPEG, PNG, PDF')
    })

    // The form submit button (only "Назначить" in DOM once form is open) must be disabled
    const allAssignBtns = screen.getAllByRole('button', { name: /Назначить/ })
    const formSubmitBtn = allAssignBtns[allAssignBtns.length - 1]!
    expect(formSubmitBtn).toBeDisabled()
  })
})
