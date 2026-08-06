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
//
// Pages migrated from `new Firestore*Repository(db())` to shared factory getters
// (getSharedAssetRepository, getSharedAssignmentRepository, etc.) exported from
// src/infra/repositories/factories.ts.  The mock therefore overrides BOTH the
// class exports (harmless, kept for completeness) AND the factory-getter exports
// so pages that call `getSharedXxxRepository()` receive stub instances instead of
// real Firestore-backed ones.  getSharedDashboardRepository is intentionally NOT
// overridden — test 4 relies on the real (broken) dashboard repo to produce the
// `dashboard-error` testid that confirms the redirect to /dashboard landed.

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
  fetchUserProfile:           vi.fn(async () => ({ role: null, employeeId: null })),
}))

// Stub all Firestore repository classes AND shared factory getters so pages that
// call getSharedXxxRepository() receive stubs instead of real Firestore classes.
vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')

  // ── Stub class definitions (hoisted inside the factory) ──────────────────
  class StubEmployeeRepo {
    async listEmployees()        { return [] }
    async listFormerEmployees()  { return [] }
    async getEmployee()          { return null }
    async createEmployee()       { return { value: { id: 'e_1' } } }
    async updateEmployee()       { return }
    async setStatus()            { return }
    async countSuperAdmins()     { return 1 }
  }

  class StubAssetRepo {
    async loadReferenceData()      { return { statuses: [], branches: [], departments: [], categories: [], employees: [], categoryGroups: [] } }
    async listAssets()             { return [] }
    async listAssetsForEmployee()  { return [] }
    async loadSelfServiceRefData() { return { statuses: [], categories: [], branches: [], departments: [] } }
    async changeStatus()           { return }
  }

  class StubAssignmentRepo {
    async listAssignmentsForEmployee() { return [] }
    async getActScanUrl()              { return 'https://example.test/scan' }
  }

  class StubUserRepo {
    async listPendingUsers() { return [] }
    async assignRole()       { return { value: { id: 'u_1', email: 'x@example.test', displayName: 'X', role: 'super_admin', status: 'active', createdAt: null }, auditId: 'a_1' } }
    async countSuperAdmins() { return 1 }
  }

  class StubDashboardRepo {
    async loadSummary() { return { totalAssets: 0, assignedAssets: 0, pendingAssets: 0, writtenOffAssets: 0 } }
    async loadRecentActivity() { return [] }
  }

  // Singleton stub instances — must be stable references so hook dependency
  // arrays (useMemo/useCallback) see the same object across renders and do not
  // trigger infinite re-render loops.
  const stubAssetRepo      = new StubAssetRepo()
  const stubAssignmentRepo = new StubAssignmentRepo()
  const stubEmployeeRepo   = new StubEmployeeRepo()
  const stubUserRepo       = new StubUserRepo()
  const stubDashboardRepo  = new StubDashboardRepo()

  return {
    ...actual,

    // ── Class overrides (kept for any code that still news them up) ──────────
    FirestoreEmployeeRepository: StubEmployeeRepo,
    FirestoreAssetRepository:    StubAssetRepo,
    FirestoreAssignmentRepository: StubAssignmentRepo,
    FirestoreUserRepository:     StubUserRepo,

    FirestoreBranchRepository: class {
      async listBranches()     { return [] }
      async getBranch()        { return null }
      async isNameTaken()      { return false }
      async countReferences()  { return 0 }
      async createBranch()     { return { value: { id: 'b_1', name: '', type: 'branch', city: null, address: null, createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async updateBranch()     { return { value: { id: 'b_1', name: '', type: 'branch', city: null, address: null, createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async deleteBranch()     { return { value: { id: 'b_1' }, auditId: 'a_1' } }
    },
    FirestoreDepartmentRepository: class {
      async listDepartments()  { return [] }
      async getDepartment()    { return null }
      async isNameTaken()      { return false }
      async countReferences()  { return 0 }
      async createDepartment() { return { value: { id: 'dp_1', name: '', createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async updateDepartment() { return { value: { id: 'dp_1', name: '', createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async deleteDepartment() { return { value: { id: 'dp_1' }, auditId: 'a_1' } }
    },
    FirestoreCategoryRepository: class {
      async listCategories()   { return [] }
      async getCategory()      { return null }
      async isNameTaken()      { return false }
      async isPrefixTaken()    { return false }
      async countReferences()  { return 0 }
      async createCategory()   { return { value: { id: 'cat_1', name: '', group: 'devices', prefix: '', hasSpecs: false, lucideIcon: 'package', createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async updateCategory()   { return { value: { id: 'cat_1', name: '', group: 'devices', prefix: '', hasSpecs: false, lucideIcon: 'package', createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async deleteCategory()   { return { value: { id: 'cat_1' }, auditId: 'a_1' } }
    },
    FirestoreAssetStatusRepository: class {
      async listAssetStatuses() { return [] }
      async getAssetStatus()    { return null }
      async isNameTaken()       { return false }
      async countReferences()   { return 0 }
      async createAssetStatus() { return { value: { id: 'st_1', name: '', color: 'gray', isFinal: false, isSystem: false, sortOrder: 0, createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async updateAssetStatus() { return { value: { id: 'st_1', name: '', color: 'gray', isFinal: false, isSystem: false, sortOrder: 0, createdAt: '', updatedAt: '' }, auditId: 'a_1' } }
      async deleteAssetStatus() { return { value: { id: 'st_1' }, auditId: 'a_1' } }
    },

    // ── Factory-getter overrides: pages call these instead of constructors ───
    // Stable singleton instances are REQUIRED: hooks compare the repo reference
    // in useMemo/useCallback dependency arrays. A new instance on every call would
    // break referential equality and trigger an infinite re-render loop.
    // The _cache in factories.ts is bypassed because the entire module is replaced
    // by this mock, so we replicate the singleton pattern manually here.
    getSharedAssetRepository:              () => stubAssetRepo,
    getSharedAssetRepositoryWithLicenses:  () => stubAssetRepo,
    getSharedAssignmentRepository:         () => stubAssignmentRepo,
    getSharedEmployeeRepository:           () => stubEmployeeRepo,
    getSharedEmployeeRepositoryWithGuard:  () => stubEmployeeRepo,
    getSharedUserRepository:               () => stubUserRepo,
    getSharedDashboardRepository:          () => stubDashboardRepo,
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
    expect(await screen.findByText('Сотрудников пока нет', undefined, { timeout: 5000 })).toBeInTheDocument()

    // The stub EmptyState title "Раздел в разработке" is exclusive to StubPage —
    // the sidebar never renders it, so its absence confirms we are on the real page.
    expect(screen.queryByText('Раздел в разработке')).toBeNull()
  })

  it('employee at /my-assets renders the My Assets page, not a stub', async () => {
    // Arrange + Act
    renderAt('/my-assets', 'employee')

    // Assert — MyAssetsPage empty-state for no assigned assets.
    // This text is unique to MyAssetsPage; StubPage never renders it.
    expect(await screen.findByText(/не закреплены активы/i, undefined, { timeout: 5000 })).toBeInTheDocument()

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
    expect(await screen.findByText(/не закреплены активы/i, undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByText('Сотрудников пока нет')).toBeNull()
  })

  it('asset_admin at /my-assets renders MyAssetsPage (my-assets now open to all roles)', async () => {
    // Arrange + Act
    renderAt('/my-assets', 'asset_admin')

    // Assert — MY_ASSETS_ALLOW now includes asset_admin, so RoleGate no longer
    // redirects. MyAssetsPage mounts and shows its empty state (no assets assigned
    // to the stub user). The stub asset repo returns [] for listAssetsForEmployee.
    expect(await screen.findByText(/не закреплены активы/i, undefined, { timeout: 5000 })).toBeInTheDocument()

    // Dashboard content must be absent — we did NOT navigate away.
    expect(screen.queryByTestId('dashboard-error')).toBeNull()
  })
})
