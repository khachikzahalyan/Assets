/**
 * DashboardPage integration test.
 *
 * Wrapper: AuthProvider initialRole + I18nextProvider + MemoryRouter — same
 * pattern as dashboard-components.test.tsx and auth-context.test.tsx.
 *
 * Strategy: inject an InMemoryDashboardRepository via the `repo` prop so no
 * Firestore calls are made. Mock @/lib/firebase so db() doesn't crash when
 * the page builds the defaultRepo useMemo, and mock FirestoreDashboardRepository
 * so its constructor is a no-op (the injected repo prop wins anyway).
 *
 * All presence/absence assertions use data-testid attributes added to
 * DashboardPage sections for robustness against un-seeded translation keys.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { InMemoryDashboardRepository } from '@/infra/repositories'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import { DashboardPage } from './DashboardPage'

// ── Firebase mocks ────────────────────────────────────────────────────────────
// db() in the page's useMemo must not throw; FirestoreDashboardRepository
// must not make any real network calls (injected repo wins in every test).

vi.mock('@/lib/firebase', () => ({
  db: () => ({}),
  auth: () => ({}),
  storage: () => ({}),
  app: () => ({}),
  functions: () => ({}),
}))

vi.mock('@/lib/auth', () => ({
  fetchUserRole: vi.fn().mockResolvedValue('super_admin'),
  signOutUser: vi.fn().mockResolvedValue(undefined),
  subscribeToAuthState: vi.fn(() => () => {}),
  claimPendingUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/infra/repositories', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/infra/repositories')>()
  class FirestoreDashboardRepositoryStub {
    constructor() {}
    loadAssetStats() { return Promise.resolve(real.InMemoryDashboardRepository
      ? undefined as never : undefined as never) }
    loadAssignmentActivity() { return Promise.resolve([]) }
    loadWorkstationLicenseStats() { return Promise.resolve({ total: 0, free: 0, inUse: 0, retired: 0 }) }
    loadServerLicenseCount() { return Promise.resolve(0) }
    loadPeopleStats() { return Promise.resolve({ employeeCount: 0, pendingUsersCount: null }) }
    loadRecentAudit() { return Promise.resolve([]) }
  }
  return {
    ...real,
    FirestoreDashboardRepository: FirestoreDashboardRepositoryStub,
  }
})

// ── Test seed ─────────────────────────────────────────────────────────────────

function makeAsset(id: string, statusId: string, categoryId: string, branchId: string): Asset {
  return {
    id, categoryId, brand: 'B', model: 'M', invCode: `INV/${id}`, serial: null,
    statusId, assignment: null, branchId, deptId: null,
    updatedAt: '2026-06-01T00:00:00.000Z', currentSpecs: null,
  }
}

const ref: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе',  color: 'gray' },
    { id: 'st_assigned',  name: 'Выдано',     color: 'green' },
    { id: 'st_repair',    name: 'В ремонте',  color: 'orange' },
    { id: 'st_disposed',  name: 'Списано',    color: 'red' },
  ],
  branches:    [{ id: 'br_1', name: 'HQ' }, { id: 'br_2', name: 'West' }],
  departments: [],
  categories: [
    { id: 'cat_laptop', name: 'Laptop',  group: 'devices',   lucideIcon: 'laptop' },
    { id: 'cat_router', name: 'Router',  group: 'network',   lucideIcon: 'router' },
    { id: 'cat_desk',   name: 'Desk',    group: 'furniture', lucideIcon: 'table-2' },
  ],
  employees: [],
}

function makeLicense(id: string, lifecycle: 'active' | 'retired', assignment: 'employee' | 'device' | 'unassigned'): WorkstationLicense {
  return {
    id, name: id, vendor: null, type: 'Default', isReusable: true,
    assignmentType: assignment, assignedToEmployeeId: null, assignedToAssetId: null,
    assignedAt: null, assignedBy: null, lifecycleStatus: lifecycle,
    retiredAt: null, retiredWithAssetId: null, expiresAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'u', updatedBy: 'u',
  }
}

const auditLogs: AuditLog[] = [
  {
    id: 'au_3', entityType: 'assignment', entityId: 'as_3', action: 'returned',
    actorUid: 'u_1', actorRole: 'asset_admin', before: null, after: { assetId: 'a_2' },
    comment: null, at: '2026-06-10T00:00:00.000Z',
  },
  {
    id: 'au_2', entityType: 'assignment', entityId: 'as_2', action: 'assigned',
    actorUid: 'u_1', actorRole: 'asset_admin', before: null, after: { assetId: 'a_1' },
    comment: null, at: '2026-06-09T00:00:00.000Z',
  },
  {
    id: 'au_1', entityType: 'asset', entityId: 'a_1', action: 'created',
    actorUid: 'u_1', actorRole: 'asset_admin', before: null, after: null,
    comment: null, at: '2026-06-08T00:00:00.000Z',
  },
]

function makeRepo() {
  return new InMemoryDashboardRepository({
    assets: [
      makeAsset('a_1', 'st_assigned',  'cat_laptop', 'br_1'),
      makeAsset('a_2', 'st_warehouse', 'cat_laptop', 'br_1'),
      makeAsset('a_3', 'st_repair',    'cat_router', 'br_2'),
      makeAsset('a_4', 'st_disposed',  'cat_desk',   'br_2'),
    ],
    ref,
    workstationLicenses: [
      makeLicense('l_1', 'active',  'unassigned'),
      makeLicense('l_2', 'active',  'device'),
      makeLicense('l_3', 'retired', 'unassigned'),
    ],
    serverLicenseCount: 7,
    employeeCount: 42,
    pendingUsersCount: 3,
    auditLogs,
  })
}

// ── Render helper ─────────────────────────────────────────────────────────────

type Role = 'super_admin' | 'asset_admin' | 'tech_admin' | 'employee'

function renderPage(role: Role, repo = makeRepo()) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider initialRole={role}>
        <MemoryRouter>
          <DashboardPage repo={repo} />
        </MemoryRouter>
      </AuthProvider>
    </I18nextProvider>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

describe('DashboardPage loading state', () => {
  it('renders the page container while loading', () => {
    // Use a repo that never resolves to hold the loading state
    const slowRepo = {
      loadAssetStats:            () => new Promise(() => {}),
      loadAssignmentActivity:    () => new Promise(() => {}),
      loadWorkstationLicenseStats: () => new Promise(() => {}),
      loadServerLicenseCount:    () => new Promise(() => {}),
      loadPeopleStats:           () => new Promise(() => {}),
      loadRecentAudit:           () => new Promise(() => {}),
    }
    // @ts-expect-error — intentionally partial stub for loading test
    renderPage('super_admin', slowRepo)
    // Page renders its container div while loading
    expect(document.querySelector('.space-y-5')).toBeInTheDocument()
  })
})

describe('DashboardPage super_admin', () => {
  it('shows total-assets KPI value (4 seeded assets)', async () => {
    renderPage('super_admin')
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
  })

  it('shows workstation license tile', async () => {
    renderPage('super_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-licenses')).toBeInTheDocument(),
    )
  })

  it('shows server-licenses KPI', async () => {
    renderPage('super_admin')
    await waitFor(() =>
      expect(screen.getByTestId('kpi-server-licenses')).toBeInTheDocument(),
    )
  })

  it('shows people/employees tile', async () => {
    renderPage('super_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-people')).toBeInTheDocument(),
    )
  })

  it('shows recent-audit list', async () => {
    renderPage('super_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-recent-audit')).toBeInTheDocument(),
    )
  })
})

describe('DashboardPage asset_admin', () => {
  it('shows total-assets KPI value', async () => {
    renderPage('asset_admin')
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
  })

  it('shows people/employees tile', async () => {
    renderPage('asset_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-people')).toBeInTheDocument(),
    )
  })

  it('does NOT show workstation license tile', async () => {
    renderPage('asset_admin')
    // wait for data to load (total-assets 4 visible)
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
    expect(screen.queryByTestId('section-licenses')).not.toBeInTheDocument()
  })

  it('does NOT show server-licenses KPI', async () => {
    renderPage('asset_admin')
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
    expect(screen.queryByTestId('kpi-server-licenses')).not.toBeInTheDocument()
  })

  it('does NOT show recent-audit list', async () => {
    renderPage('asset_admin')
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
    expect(screen.queryByTestId('section-recent-audit')).not.toBeInTheDocument()
  })
})

describe('DashboardPage error handling', () => {
  it('shows error banner AND still renders loaded sections when a section rejects (tech_admin)', async () => {
    // Build a repo where loadWorkstationLicenseStats rejects; assets still loads fine.
    const partialRepo = makeRepo()
    partialRepo.loadWorkstationLicenseStats = () => Promise.reject(new Error('network error'))

    renderPage('tech_admin', partialRepo)

    // Wait for loading to finish — total-assets KPI (value "4") must still be visible
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())

    // Error banner must be present and wired to reload
    expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
  })
})

describe('DashboardPage tech_admin', () => {
  it('shows total-assets KPI value', async () => {
    renderPage('tech_admin')
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
  })

  it('shows workstation license tile', async () => {
    renderPage('tech_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-licenses')).toBeInTheDocument(),
    )
  })

  it('does NOT show people/employees tile', async () => {
    renderPage('tech_admin')
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
    expect(screen.queryByTestId('section-people')).not.toBeInTheDocument()
  })

  it('does NOT show server-licenses KPI', async () => {
    renderPage('tech_admin')
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
    expect(screen.queryByTestId('kpi-server-licenses')).not.toBeInTheDocument()
  })

  it('does NOT show recent-audit list', async () => {
    renderPage('tech_admin')
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
    expect(screen.queryByTestId('section-recent-audit')).not.toBeInTheDocument()
  })
})
