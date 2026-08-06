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
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { InMemoryDashboardRepository } from '@/infra/repositories'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { EmployeeForStats } from '@/domain/dashboard'
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
  fetchUserProfile: vi.fn().mockResolvedValue({ role: 'super_admin', employeeId: null }),
  signOutUser: vi.fn().mockResolvedValue(undefined),
  subscribeToAuthState: vi.fn(() => () => {}),
  claimPendingUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/infra/repositories', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/infra/repositories')>()
  class FirestoreDashboardRepositoryStub {
    constructor() {}
    loadAssetStats() { return Promise.resolve(undefined as never) }
    loadWorkstationLicenseStats() { return Promise.resolve({ total: 0, free: 0, inUse: 0, retired: 0 }) }
    loadPeopleStats() { return Promise.resolve({ employeeCount: 0, activeEmployeeIds: [] }) }
    loadRecentEvents() { return Promise.resolve([]) }
    loadRecentPartInstalls() { return Promise.resolve([]) }
    loadDomainCounts() { return Promise.resolve({ counts: { partsUnits: 0, branches: 0, departments: 0, subscriptions: 0 }, partNames: {} }) }
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
    { id: 'cat_laptop', name: 'Laptop', group: 'devices',   categoryGroupId: 'grp_devices',   lucideIcon: 'laptop' },
    { id: 'cat_router', name: 'Router', group: 'network',   categoryGroupId: 'grp_network',   lucideIcon: 'router' },
    { id: 'cat_desk',   name: 'Desk',   group: 'furniture', categoryGroupId: 'grp_furniture', lucideIcon: 'table-2' },
  ],
  employees:      [],
  categoryGroups: [],
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

// 42 active employees (same intent as the previous employeeCount: 42 seed)
const employees42: EmployeeForStats[] = Array.from({ length: 42 }, (_, i) => ({
  id: `emp_seed_${i + 1}`,
  status: 'active' as const,
}))

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
    employees: employees42,
    auditLogs: [],
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
      loadAssetStats:              () => new Promise(() => {}),
      loadWorkstationLicenseStats: () => new Promise(() => {}),
      loadPeopleStats:             () => new Promise(() => {}),
      loadRecentEvents:            () => new Promise(() => {}),
      loadRecentPartInstalls:      () => new Promise(() => {}),
      loadDomainCounts:            () => new Promise(() => {}),
    }
    // @ts-expect-error — intentionally partial stub for loading test
    renderPage('super_admin', slowRepo)
    // Page renders its container div while loading (space-y-4 on mobile, lg:space-y-5 on desktop)
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })
})

describe('DashboardPage super_admin', () => {
  it('shows total-assets KPI value (4 seeded assets)', async () => {
    renderPage('super_admin')
    await waitFor(() => expect(within(screen.getByTestId('section-total-assets')).getByText('4')).toBeInTheDocument())
  })

  it('shows workstation license tile', async () => {
    renderPage('super_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-licenses')).toBeInTheDocument(),
    )
  })

  it('shows people/employees tile', async () => {
    renderPage('super_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-people')).toBeInTheDocument(),
    )
  })
})

describe('DashboardPage asset_admin', () => {
  it('shows total-assets KPI value', async () => {
    renderPage('asset_admin')
    await waitFor(() => expect(within(screen.getByTestId('section-total-assets')).getByText('4')).toBeInTheDocument())
  })

  it('shows people/employees tile', async () => {
    renderPage('asset_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-people')).toBeInTheDocument(),
    )
  })

  it('shows workstation license tile (KPI summary is complete for every admin)', async () => {
    renderPage('asset_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-licenses')).toBeInTheDocument(),
    )
  })
})

describe('DashboardPage error handling', () => {
  it('shows error banner AND still renders loaded sections when a section rejects (tech_admin)', async () => {
    // Build a repo where loadWorkstationLicenseStats rejects; assets still loads fine.
    const partialRepo = makeRepo()
    partialRepo.loadWorkstationLicenseStats = () => Promise.reject(new Error('network error'))

    renderPage('tech_admin', partialRepo)

    // Wait for loading to finish — total-assets KPI (value "4") must still be visible
    await waitFor(() => expect(within(screen.getByTestId('section-total-assets')).getByText('4')).toBeInTheDocument())

    // Error banner must be present and wired to reload
    expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
  })
})

describe('DashboardPage tech_admin', () => {
  it('shows total-assets KPI value', async () => {
    renderPage('tech_admin')
    await waitFor(() => expect(within(screen.getByTestId('section-total-assets')).getByText('4')).toBeInTheDocument())
  })

  it('shows workstation license tile', async () => {
    renderPage('tech_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-licenses')).toBeInTheDocument(),
    )
  })

  it('shows people/employees tile (KPI summary is complete for every admin)', async () => {
    renderPage('tech_admin')
    await waitFor(() =>
      expect(screen.getByTestId('section-people')).toBeInTheDocument(),
    )
  })
})

// ── Domain boxes grid (ROW 2) ───────────────────────────────────────────────────

describe('DashboardPage domain boxes', () => {
  /**
   * DOM order reflects the new 5-row layout:
   *   Row 3: assets, parts
   *   Row 4: employees, subscriptions, branches
   *   Row 5: departments (slim strip)
   */
  const EXPECTED_ORDER = [
    'assets', 'parts', 'employees', 'subscriptions', 'branches', 'departments',
  ]

  it('renders all 6 domain boxes in the fixed order', async () => {
    renderPage('super_admin')
    await waitFor(() =>
      expect(screen.getByTestId('domain-box-assets')).toBeInTheDocument(),
    )
    const boxes = Array.from(
      document.querySelectorAll('[data-testid^="domain-box-"]'),
    ).map(el => el.getAttribute('data-testid')!.replace('domain-box-', ''))
    expect(boxes).toEqual(EXPECTED_ORDER)
  })

  it('does NOT render the boxes grid when the event window fails to load', async () => {
    const repo = makeRepo()
    repo.loadRecentEvents = () => Promise.reject(new Error('audit window failed'))

    renderPage('super_admin', repo)

    // KPI row still loads (asset stats resolved) …
    await waitFor(() =>
      expect(screen.getByTestId('section-total-assets')).toBeInTheDocument(),
    )
    // … but with boxes === null the whole grid is absent.
    expect(screen.queryByTestId('domain-box-assets')).toBeNull()
    // Degraded fetch surfaces the error banner too.
    expect(screen.getByTestId('dashboard-error')).toBeInTheDocument()
  })

  it('renders the «view all subscriptions» link for super_admin but hides it for asset_admin', async () => {
    const { unmount } = renderPage('super_admin')
    await waitFor(() =>
      expect(screen.getByTestId('domain-box-subscriptions')).toBeInTheDocument(),
    )
    const saBox = screen.getByTestId('domain-box-subscriptions')
    expect(
      within(saBox).getAllByRole('link').some(l => l.getAttribute('href') === '/licenses'),
    ).toBe(true)
    unmount()

    renderPage('asset_admin')
    await waitFor(() =>
      expect(screen.getByTestId('domain-box-subscriptions')).toBeInTheDocument(),
    )
    const aaBox = screen.getByTestId('domain-box-subscriptions')
    // asset_admin can't reach /licenses → no view-all link at all.
    expect(within(aaBox).queryByRole('link')).toBeNull()
  })

  it('renders the subscriptions box without crashing when count is null (degraded)', async () => {
    // In the new design, the subscriptions domain box (variant='standard') does NOT
    // render a hero total number — so there is no '—' in the box body.
    // This test verifies the box renders at all (no crash) when the count is null.
    const repo = makeRepo()
    repo.loadDomainCounts = () => Promise.resolve({
      counts: { partsUnits: 0, branches: 2, departments: 0, subscriptions: null },
      partNames: {},
    })

    renderPage('super_admin', repo)

    await waitFor(() =>
      expect(screen.getByTestId('domain-box-subscriptions')).toBeInTheDocument(),
    )
    // Box is present and the title is rendered (not crashing on null count).
    const subsBox = screen.getByTestId('domain-box-subscriptions')
    expect(subsBox).toBeInTheDocument()
  })
})

// ── Written-off tile (section-written-off, accent='rose') ─────────────────────

describe('DashboardPage written-off tile', () => {
  // (a) tile renders with correct count for super_admin
  it('shows value "1" for section-written-off — seed has exactly 1 disposed asset (a_4)', async () => {
    // Arrange — default makeRepo() has a_4 with st_disposed
    renderPage('super_admin')

    // Act / Assert
    await waitFor(() =>
      expect(within(screen.getByTestId('section-written-off')).getByText('1')).toBeInTheDocument(),
    )
  })

  // (b) tile label matches the ru translation key kpi.writtenOff = «Списанные активы»
  it('renders the ru label «Списанные активы» for the written-off tile', async () => {
    // Arrange — i18n forced to 'ru' in beforeAll
    renderPage('super_admin')

    // Act / Assert
    await waitFor(() =>
      expect(screen.getByTestId('section-written-off')).toBeInTheDocument(),
    )
    expect(within(screen.getByTestId('section-written-off')).getByText('Списанные активы')).toBeInTheDocument()
  })

  // (c) counter reacts: extra disposed asset → tile shows 2; total-assets still counts it
  it('shows "2" when repo has 2 disposed assets, and section-total-assets shows "5"', async () => {
    // Arrange — local repo with an additional disposed asset (a_5)
    const extendedRepo = new InMemoryDashboardRepository({
      assets: [
        makeAsset('a_1', 'st_assigned',  'cat_laptop', 'br_1'),
        makeAsset('a_2', 'st_warehouse', 'cat_laptop', 'br_1'),
        makeAsset('a_3', 'st_repair',    'cat_router', 'br_2'),
        makeAsset('a_4', 'st_disposed',  'cat_desk',   'br_2'),
        makeAsset('a_5', 'st_disposed',  'cat_laptop', 'br_1'),  // extra disposed
      ],
      ref,
      workstationLicenses: [],
      employees: employees42,
      auditLogs: [],
    })

    renderPage('super_admin', extendedRepo)

    // Act / Assert — written-off tile shows 2
    await waitFor(() =>
      expect(within(screen.getByTestId('section-written-off')).getByText('2')).toBeInTheDocument(),
    )
    // Disposed assets are included in the grand total (5 assets total)
    expect(within(screen.getByTestId('section-total-assets')).getByText('5')).toBeInTheDocument()
  })
})
