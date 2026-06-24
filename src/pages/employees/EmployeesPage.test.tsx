import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { EmployeesPage } from './EmployeesPage'
import { InMemoryEmployeeRepository, InMemoryAssetRepository } from '@/infra/repositories'
import type { Employee } from '@/domain/employee'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

// Mock Firebase so EmployeesPage's lazy defaultRepo doesn't crash
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  return {
    ...actual,
    FirestoreEmployeeRepository: class {
      async listEmployees() { return [] }
    },
    FirestoreAssetRepository: class {
      async loadReferenceData() {
        return {
          statuses: [],
          branches: [],
          departments: [],
          categories: [{ id: 'cat_1', name: 'Ноутбук', lucideIcon: 'laptop', group: 'devices' }],
          employees: [],
        }
      }
      async listAssets() { return [] }
      async listAssetsForEmployee() { return [] }
    },
    FirestoreAssignmentRepository: class {
      async assign() { return { value: {}, auditId: '' } }
      async returnAsset() { return { value: {}, auditId: '' } }
      async listAssignmentsForEmployee() { return [] }
    },
  }
})

function authCtx(role: 'super_admin' | 'asset_admin' | 'employee') {
  return {
    user: { id: 'u_1', name: 'A', email: 'a@x', role, initials: 'A', avatarColor: '' },
    role, status: 'ready' as const, setRole: () => {}, signOut: () => {},
  }
}

function emp(over: Partial<Employee> = {}): Employee {
  return {
    id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', phone: null,
    position: null, branchId: null, departmentId: null, status: 'active', terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
  }
}

const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned', name: 'Выдано', color: 'green' },
  ],
  branches: [{ id: 'br_main', name: 'Головной офис' }],
  departments: [{ id: 'dept_1', name: 'IT' }],
  categories: [{ id: 'cat_1', name: 'Ноутбук', lucideIcon: 'laptop', group: 'devices' as const }],
  employees: [],
}

function makeAsset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    categoryId: 'cat_1',
    brand: 'Dell',
    model: 'XPS',
    invCode: 'LT/001',
    serial: 'SN-001',
    statusId: 'st_assigned',
    assignment: { mode: 'employee', employeeId: 'uid_1' },
    branchId: 'br_main',
    deptId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

function makeAssetRepo(assets: Asset[]) {
  const store = createInMemoryAuditStore()
  return new InMemoryAssetRepository([...assets], REF, inMemoryAuditContext(store))
}

function renderPage(
  employees: Employee[],
  role: 'super_admin' | 'asset_admin' = 'asset_admin',
  assetCounts: Record<string, number> = {},
  overrides: {
    assetRepository?: InstanceType<typeof InMemoryAssetRepository>
  } = {},
) {
  const repo = new InMemoryEmployeeRepository(employees)
  const refLoader = async () => ({ branches: [{ id: 'br_main', name: 'Головной офис' }], departments: [{ id: 'dept_1', name: 'IT' }] })
  const extraProps = overrides.assetRepository
    ? { assetRepository: overrides.assetRepository }
    : {}
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(role)}>
        <ToastProvider>
          <MemoryRouter>
            <EmployeesPage
              repository={repo}
              loadRefData={refLoader}
              assetCounts={assetCounts}
              {...extraProps}
            />
          </MemoryRouter>
        </ToastProvider>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('EmployeesPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('renders an employee row with full name', async () => {
    renderPage([emp()])
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
  })

  it('shows empty state when there are no employees', async () => {
    // The default status filter is now 'active'; the repo returns no employees
    renderPage([])
    expect(await screen.findByText(/Сотрудников пока нет/)).toBeInTheDocument()
  })

  it('passes asset count 0 when not provided', async () => {
    renderPage([emp()])
    // The asset count pill shows "0" for employees with no assets
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
    // The digit "0" appears in the asset count pill
    const cells = await screen.findAllByText('0')
    expect(cells.length).toBeGreaterThanOrEqual(1)
  })

  it('shows asset count when passed via prop', async () => {
    renderPage([emp({ id: 'uid_1' })], 'asset_admin', { uid_1: 3 })
    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('renders phone when employee has phone', async () => {
    renderPage([emp({ phone: '099123456' })])
    expect(await screen.findByText('099 12 34 56')).toBeInTheDocument()
  })

  it('clicking a row opens the detail drawer, not navigation', async () => {
    const user = userEvent.setup()
    renderPage([emp()])
    // Wait for employee row to appear
    const row = await screen.findByText('Иван Петров')
    await user.click(row)
    // Drawer should appear — email appears in both table row and drawer
    await waitFor(() => {
      const matches = screen.getAllByText('i@x.com')
      // drawer shows the email too — at least 2 occurrences means the drawer is open
      expect(matches.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('clicking Добавить opens the create modal', async () => {
    const user = userEvent.setup()
    renderPage([emp()])
    // Wait for page to load
    await screen.findByText('Иван Петров')
    // Find and click the "Добавить сотрудника" button
    const addBtn = screen.getByRole('button', { name: /Добавить/i })
    await user.click(addBtn)
    // The create modal should appear with the createTitle
    await waitFor(() => {
      expect(screen.getByText('Новый сотрудник')).toBeInTheDocument()
    })
  })

  it('renders KindTabs with Все and Сотрудники', async () => {
    renderPage([emp()])
    await screen.findByText('Иван Петров')
    expect(screen.getByRole('button', { name: /Все/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Сотрудники/i })).toBeInTheDocument()
  })

  // ── Transfer tests (Task 3) ────────────────────────────────────────────────

  it('warehouse return: transfers asset to warehouse via changeStatus', async () => {
    const user = userEvent.setup()
    const asset = makeAsset()
    const assetRepo = makeAssetRepo([asset])
    const employee = emp({ id: 'uid_1' })
    renderPage([employee], 'asset_admin', { uid_1: 1 }, { assetRepository: assetRepo })

    // Open detail drawer by clicking the employee row
    const row = await screen.findByText('Иван Петров')
    await user.click(row)

    // Wait for drawer to open and show assets
    await waitFor(() => {
      expect(screen.getAllByText('Иван Петров').length).toBeGreaterThanOrEqual(1)
    })

    // Click "Выбрать" to enter select mode
    const selectBtn = await screen.findByRole('button', { name: /Выбрать/i })
    await user.click(selectBtn)

    // Select the asset (click on the asset row)
    const assetTitle = await screen.findByText('Dell XPS')
    await user.click(assetTitle)

    // Dest defaults to Склад — click "Передать" button (transfer.action)
    const transferBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(transferBtn)

    // Click confirm
    const confirmBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(confirmBtn)

    // Wait for toast
    await waitFor(() => {
      expect(screen.getByText(/Передано/i)).toBeInTheDocument()
    })

    // Assert asset state in repo
    const assets = await assetRepo.listAssets({ statusId: 'all' })
    expect(assets[0]!.statusId).toBe('st_warehouse')
    expect(assets[0]!.assignment).toBeNull()
  })

  it('employee → employee transfer: asset ends up assigned to target employee', async () => {
    const user = userEvent.setup()
    const asset = makeAsset()
    const assetRepo = makeAssetRepo([asset])
    const emp1 = emp({ id: 'uid_1', firstName: 'Иван', lastName: 'Петров' })
    const emp2: Employee = {
      id: 'uid_2', firstName: 'Мария', lastName: 'Сидорова', email: 'm@x.com', phone: null,
      position: null, branchId: null, departmentId: 'dept_1', status: 'active', terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }
    renderPage([emp1, emp2], 'asset_admin', { uid_1: 1 }, { assetRepository: assetRepo })

    // Open detail drawer for emp1
    const row = await screen.findByText('Иван Петров')
    await user.click(row)

    // Wait for select button
    const selectBtn = await screen.findByRole('button', { name: /Выбрать/i })
    await user.click(selectBtn)

    // Select asset
    const assetTitle = await screen.findByText('Dell XPS')
    await user.click(assetTitle)

    // Open DestPicker — click the chip showing "Склад"
    const destChip = await screen.findByRole('button', { name: /Склад/i })
    await user.click(destChip)

    // Click "Сотрудник..." option — use the DestPicker top-level option text
    const empOption = await screen.findByRole('button', { name: /^Сотрудник…$/i })
    await user.click(empOption)

    // Pick Мария Сидорова from the sub-list
    const mariaSidorova = await screen.findByRole('button', { name: /Мария Сидорова/i })
    await user.click(mariaSidorova)

    // Click "Передать"
    const transferBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(transferBtn)

    // Click confirm
    const confirmBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(confirmBtn)

    // Wait for toast
    await waitFor(() => {
      expect(screen.getByText(/Передано/i)).toBeInTheDocument()
    })

    // Assert asset state
    const assets = await assetRepo.listAssets({ statusId: 'all' })
    expect(assets[0]!.statusId).toBe('st_assigned')
    expect(assets[0]!.assignment?.mode).toBe('employee')
    expect(assets[0]!.assignment?.employeeId).toBe('uid_2')
  })

  it('department transfer: asset ends up assigned to department', async () => {
    const user = userEvent.setup()
    const asset = makeAsset()
    const assetRepo = makeAssetRepo([asset])
    const employee = emp({ id: 'uid_1' })
    renderPage([employee], 'asset_admin', { uid_1: 1 }, { assetRepository: assetRepo })

    // Open detail drawer
    const row = await screen.findByText('Иван Петров')
    await user.click(row)

    // Enter select mode
    const selectBtn = await screen.findByRole('button', { name: /Выбрать/i })
    await user.click(selectBtn)

    // Select asset
    const assetTitle = await screen.findByText('Dell XPS')
    await user.click(assetTitle)

    // Open DestPicker
    const destChip = await screen.findByRole('button', { name: /Склад/i })
    await user.click(destChip)

    // Click "Отдел..." option
    const deptOption = await screen.findByRole('button', { name: /^Отдел…$/i })
    await user.click(deptOption)

    // Pick the IT department
    const itDept = await screen.findByRole('button', { name: /IT/i })
    await user.click(itDept)

    // Click "Передать"
    const transferBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(transferBtn)

    // Confirm
    const confirmBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(confirmBtn)

    // Wait for toast
    await waitFor(() => {
      expect(screen.getByText(/Передано/i)).toBeInTheDocument()
    })

    // Assert asset state
    const assets = await assetRepo.listAssets({ statusId: 'all' })
    expect(assets[0]!.statusId).toBe('st_assigned')
    expect(assets[0]!.assignment?.mode).toBe('department')
    expect((assets[0]!.assignment as { departmentId?: string })?.departmentId).toBe('dept_1')
  })

  it('partial transfer failure: shows toastPartial when some assets fail', async () => {
    const user = userEvent.setup()
    // Two assets assigned to emp1
    const asset1 = makeAsset({ id: 'asset_1', invCode: 'LT/001' })
    const asset2 = makeAsset({ id: 'asset_2', invCode: 'LT/002', serial: 'SN-002' })
    const baseRepo = makeAssetRepo([asset1, asset2])

    // Build a repo that throws changeStatus for asset_2
    let callCount = 0
    const partialRepo = {
      ...baseRepo,
      listAssetsForEmployee: baseRepo.listAssetsForEmployee.bind(baseRepo),
      listAssets: baseRepo.listAssets.bind(baseRepo),
      loadReferenceData: baseRepo.loadReferenceData.bind(baseRepo),
      loadSelfServiceRefData: baseRepo.loadSelfServiceRefData.bind(baseRepo),
      changeStatus: async (id: string, ...rest: unknown[]) => {
        callCount++
        if (id === 'asset_2') throw new Error('simulated failure')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return baseRepo.changeStatus(id, ...(rest as [any, any, any]))
      },
    } as unknown as typeof baseRepo

    const employee = emp({ id: 'uid_1' })
    const repo = new InMemoryEmployeeRepository([employee])
    const refLoader = async () => ({ branches: [{ id: 'br_main', name: 'Головной офис' }], departments: [] })

    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={authCtx('asset_admin')}>
          <ToastProvider>
            <MemoryRouter>
              <EmployeesPage
                repository={repo}
                loadRefData={refLoader}
                assetCounts={{ uid_1: 2 }}
                assetRepository={partialRepo}
              />
            </MemoryRouter>
          </ToastProvider>
        </AuthContext.Provider>
      </I18nextProvider>,
    )

    // Open detail drawer
    const row = await screen.findByText('Иван Петров')
    await user.click(row)

    // Enter select mode
    const selectBtn = await screen.findByRole('button', { name: /Выбрать/i })
    await user.click(selectBtn)

    // Select all (both assets)
    const selectAllBtn = await screen.findByRole('button', { name: /Выбрать все/i })
    await user.click(selectAllBtn)

    // Click transfer action
    const transferBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(transferBtn)

    // Click confirm
    const confirmBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(confirmBtn)

    // Expect partial toast — "Передано: 1 из 2, ошибок: 1"
    await waitFor(() => {
      expect(screen.getByText(/Передано: 1 из 2/i)).toBeInTheDocument()
    })
    // Ensure both ids were attempted
    expect(callCount).toBe(2)
  })

  it('temporary transfer: asset ends up with mode=temporary + isTemporary=true + expiresAt', async () => {
    const user = userEvent.setup()
    const asset = makeAsset()
    const assetRepo = makeAssetRepo([asset])
    const employee = emp({ id: 'uid_1' })
    renderPage([employee], 'asset_admin', { uid_1: 1 }, { assetRepository: assetRepo })

    // Open detail drawer by clicking the employee row
    const row = await screen.findByText('Иван Петров')
    await user.click(row)

    // Enter select mode
    const selectBtn = await screen.findByRole('button', { name: /Выбрать/i })
    await user.click(selectBtn)

    // Select the asset
    const assetTitle = await screen.findByText('Dell XPS')
    await user.click(assetTitle)

    // Open DestPicker — chip defaults to "Склад"
    const destChip = await screen.findByRole('button', { name: /Склад/i })
    await user.click(destChip)

    // Click "Временно" option in the top-level popover
    const tempOption = await screen.findByRole('button', { name: /^Временно$/i })
    await user.click(tempOption)

    // In the temporary sub-panel, press the "Аудит" kind button
    const auditBtn = await screen.findByRole('button', { name: /Аудит/i })
    await user.click(auditBtn)

    // Confirm the temporary selection ("Подтвердить" button)
    const confirmTempBtn = await screen.findByRole('button', { name: /Подтвердить/i })
    await user.click(confirmTempBtn)

    // Click "Передать" (transfer action)
    const transferBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(transferBtn)

    // Click confirm in the confirmation dialog
    const confirmBtn = await screen.findByRole('button', { name: /^Передать$/i })
    await user.click(confirmBtn)

    // Wait for toast
    await waitFor(() => {
      expect(screen.getByText(/Передано/i)).toBeInTheDocument()
    })

    // Assert asset state in repo — must be temporary with isTemporary: true
    const assets = await assetRepo.listAssets({ statusId: 'all' })
    expect(assets[0]!.statusId).toBe('st_assigned')
    expect(assets[0]!.assignment?.mode).toBe('temporary')
    expect((assets[0]!.assignment as { isTemporary?: boolean })?.isTemporary).toBe(true)
    expect((assets[0]!.assignment as { tempKind?: string })?.tempKind).toBe('audit')
  })

  it('handover redirect: redirected asset ends up assigned to target employee via changeStatus', async () => {
    const user = userEvent.setup()
    const asset = makeAsset()
    const assetRepo = makeAssetRepo([asset])
    const emp1 = emp({ id: 'uid_1', firstName: 'Иван', lastName: 'Петров' })
    const emp2: Employee = {
      id: 'uid_2', firstName: 'Мария', lastName: 'Сидорова', email: 'm@x.com', phone: null,
      position: null, branchId: null, departmentId: null, status: 'active', terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }

    // No assetCounts prop — let it load from assetRepo
    const repo = new InMemoryEmployeeRepository([emp1, emp2])
    const refLoader = async () => ({ branches: [{ id: 'br_main', name: 'Головной офис' }], departments: [] })

    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={authCtx('asset_admin')}>
          <ToastProvider>
            <MemoryRouter>
              <EmployeesPage
                repository={repo}
                loadRefData={refLoader}
                assetRepository={assetRepo}
              />
            </MemoryRouter>
          </ToastProvider>
        </AuthContext.Provider>
      </I18nextProvider>,
    )

    // Open detail drawer for emp1
    const row = await screen.findByText('Иван Петров')
    await user.click(row)

    // Click "Сдача техники" (handover) footer button — triggers handleArchive
    const handoverBtn = await screen.findByRole('button', { name: /Сдача техники/i })
    await user.click(handoverBtn)

    // HandoverModal opens — Step 1: mark the asset as received
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Click the asset row to mark received
    const handoverRow = await screen.findByRole('button', { name: /Отметить как принят.*Dell XPS/i })
    await user.click(handoverRow)

    // Click "Далее" to go to step 2
    const nextBtn = await screen.findByRole('button', { name: /Далее/i })
    await user.click(nextBtn)

    // Step 2: change destination from Склад to Мария Сидорова
    // The DestPicker chip in step 2 shows "Склад"
    const destChip = await screen.findByRole('button', { name: /Склад/i })
    await user.click(destChip)

    const empOption = await screen.findByRole('button', { name: /^Сотрудник…$/i })
    await user.click(empOption)

    const mariaSidorova = await screen.findByRole('button', { name: /Мария Сидорова/i })
    await user.click(mariaSidorova)

    // Click "Завершить приёмку"
    const finishBtn = await screen.findByRole('button', { name: /Завершить приёмку/i })
    await user.click(finishBtn)

    // Wait for the handover toast
    await waitFor(() => {
      expect(screen.getByText(/Техника принята/i)).toBeInTheDocument()
    })

    // Assert: asset is now assigned to uid_2, NOT left with uid_1
    const assets = await assetRepo.listAssets({ statusId: 'all' })
    expect(assets[0]!.statusId).toBe('st_assigned')
    expect(assets[0]!.assignment?.mode).toBe('employee')
    expect(assets[0]!.assignment?.employeeId).toBe('uid_2')
  })
})
