import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { EmployeesPage } from './EmployeesPage'
import { InMemoryEmployeeRepository } from '@/infra/repositories'
import type { Employee } from '@/domain/employee'

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

function renderPage(
  employees: Employee[],
  role: 'super_admin' | 'asset_admin' = 'asset_admin',
  assetCounts: Record<string, number> = {},
) {
  const repo = new InMemoryEmployeeRepository(employees)
  const refLoader = async () => ({ branches: [], departments: [] })
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(role)}>
        <ToastProvider>
          <MemoryRouter>
            <EmployeesPage repository={repo} loadRefData={refLoader} assetCounts={assetCounts} />
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
})
