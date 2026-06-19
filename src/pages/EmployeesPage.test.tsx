import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
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
      async loadReferenceData() { return { statuses: [], branches: [], departments: [], categories: [], employees: [] } }
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
    id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', position: null,
    branchId: null, departmentId: null, status: 'active', terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
  }
}

function renderPage(employees: Employee[], role: 'super_admin' | 'asset_admin' = 'asset_admin') {
  const repo = new InMemoryEmployeeRepository(employees)
  const refLoader = async () => ({ branches: [], departments: [] })
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(role)}>
        <MemoryRouter>
          <EmployeesPage repository={repo} loadRefData={refLoader} />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('EmployeesPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('renders an employee row', async () => {
    renderPage([emp()])
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
  })

  it('shows empty state when there are no employees', async () => {
    renderPage([])
    expect(await screen.findByText(/Сотрудников пока нет/)).toBeInTheDocument()
  })
})
