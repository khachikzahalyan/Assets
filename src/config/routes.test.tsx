/**
 * Integration-style routing tests for AppRoutes.
 *
 * Strategy: mount <AppRoutes> inside a <MemoryRouter> with a chosen initial
 * entry, wrap in the same providers the other page tests use (I18nextProvider
 * + AuthContext.Provider).  Module-level vi.mock stubs the Firestore/Firebase
 * deps so the lazily-constructed default repos in the pages never touch the
 * network.
 *
 * Non-goals:
 *   – Exhaustive page-content tests (covered by dedicated page test files).
 *   – StubPage content tests (those routes are guarded elsewhere).
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import type { AuthStatus } from '@/contexts/AuthContext'
import type { Role } from '@/config/roles'
import { AppRoutes } from './routes'

// ── Firebase / repo mocks ──────────────────────────────────────────────────────
// Mirror exactly what EmployeesPage.test.tsx uses so all lazily-constructed
// default repos are satisfied without touching the network.

vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

vi.mock('@/lib/auth', () => ({
  completeEmailLinkIfPresent: vi.fn(async () => false),
  sendEmployeeLink:           vi.fn(),
  signInWithGoogle:           vi.fn(),
  signOutUser:                vi.fn(),
  subscribeToAuthState:       vi.fn(() => () => {}),
  fetchUserRole:              vi.fn(async () => null),
}))

// Stub all Firestore repository classes so their constructors never call db().
vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  return {
    ...actual,
    FirestoreEmployeeRepository: class {
      async listEmployees()          { return [] }
      async getEmployee()            { return null }
      async createEmployee()        { return { value: { id: 'e_1' } } }
      async updateEmployee()        { return }
      async setStatus()             { return }
    },
    FirestoreAssetRepository: class {
      async loadReferenceData()      { return { statuses: [], branches: [], departments: [], categories: [], employees: [] } }
      async listAssetsForEmployee()  { return [] }
      async loadSelfServiceRefData() { return { statuses: [], categories: [], branches: [], departments: [] } }
    },
    FirestoreAssignmentRepository: class {
      async listAssignmentsForEmployee() { return [] }
    },
    FirestoreUserRepository: class {
      async listPendingUsers() { return [] }
      async assignRole() { return { value: { id: 'u_1', email: 'x@x.com', displayName: 'X', role: 'super_admin', status: 'active', createdAt: null }, auditId: 'a_1' } }
    },
    FirestoreBranchRepository: class {
      async listBranches() { return [] }
      async getBranch()    { return null }
      async isNameTaken()  { return false }
      async countReferences() { return 0 }
      async createBranch() { return { value: { id: 'b_1', name: '', type: 'branch', city: null, address: null, createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async updateBranch() { return { value: { id: 'b_1', name: '', type: 'branch', city: null, address: null, createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async deleteBranch() { return { value: { id: 'b_1' }, auditId: 'a_1' } }
    },
  }
})

// Stub the storage helper used by MyActsPage and EmployeeDetailPage.
vi.mock('@/infra/storage', () => ({
  actScanUrl: vi.fn(async () => 'https://example.test/scan'),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeAuthValue(role: Role, status: AuthStatus = 'ready'): AuthContextValue {
  return {
    user: {
      id:          'u_test',
      name:        'Test User',
      email:       'test@example.test',
      role,
      initials:    'TU',
      avatarColor: 'bg-slate-600',
    },
    role,
    status,
    setRole: vi.fn(),
    signOut: vi.fn(),
  }
}

/**
 * Render <AppRoutes> at the given path with the given role.
 * MemoryRouter must surround <AppRoutes> because it contains its own <Routes>.
 */
function renderAt(path: string, role: Role) {
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={makeAuthValue(role)}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AppRoutes — promoted routes render real pages, not StubPage', () => {
  it('asset_admin at /employees renders the Employees page, not a stub', async () => {
    // Arrange + Act
    renderAt('/employees', 'asset_admin')

    // Assert — the Employees page empty-state text appears as main content.
    // This text is unique to EmployeesPage; StubPage never renders it.
    expect(await screen.findByText('Сотрудников пока нет')).toBeInTheDocument()

    // The stub EmptyState title "Раздел в разработке" is exclusive to StubPage —
    // the sidebar never renders it, so its absence confirms we are on the real page.
    expect(screen.queryByText('Раздел в разработке')).toBeNull()
  })

  it('employee at /my-assets renders the My Assets page, not a stub', async () => {
    // Arrange + Act
    renderAt('/my-assets', 'employee')

    // Assert — MyAssetsPage empty-state for no assigned assets.
    // This text is unique to MyAssetsPage; StubPage never renders it.
    expect(await screen.findByText(/не закреплены активы/i)).toBeInTheDocument()

    // The stub EmptyState title must be absent
    expect(screen.queryByText('Раздел в разработке')).toBeNull()
  })
})

describe('AppRoutes — cross-role redirects via RoleGate', () => {
  it('employee hitting /employees is bounced to /my-assets (employees-page content absent)', async () => {
    // Arrange + Act
    renderAt('/employees', 'employee')

    // Assert — RoleGate for /employees excludes 'employee', so it redirects to
    // /my-assets (defaultRouteForRole('employee') = 'my-assets').
    // The My Assets empty-state appears; the Employees empty-state does not.
    expect(await screen.findByText(/не закреплены активы/i)).toBeInTheDocument()
    expect(screen.queryByText('Сотрудников пока нет')).toBeNull()
  })

  it('asset_admin hitting /my-assets is bounced to /dashboard (my-assets content absent)', async () => {
    // Arrange + Act
    renderAt('/my-assets', 'asset_admin')

    // Assert — RoleGate for /my-assets only allows 'employee', so asset_admin is
    // redirected to /dashboard (defaultRouteForRole('asset_admin') = 'dashboard').
    // DashboardPage renders a <h1> heading "Дашборд" — use getByRole to scope
    // the assertion to the heading element, not sidebar/breadcrumb occurrences.
    expect(await screen.findByRole('heading', { name: 'Дашборд' })).toBeInTheDocument()
    expect(screen.queryByText(/не закреплены активы/i)).toBeNull()
  })
})
