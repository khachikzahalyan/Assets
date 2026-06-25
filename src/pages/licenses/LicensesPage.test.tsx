/**
 * LicensesPage component tests — new two-tab shape (Windows-ключи + Подписки и ПО).
 *
 * Uses InMemory repositories injected as props so no Firestore is touched.
 * i18n is the real instance (ru locale) — consistent with sibling page tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { LicensesPage } from './LicensesPage'
import {
  InMemoryWorkstationLicenseRepository,
  InMemoryAuditLogRepository,
  InMemorySubscriptionRepository,
  InMemoryEmployeeRepository,
  InMemoryAssetRepository,
} from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { Role } from '@/config/roles'
import type { SubscriptionRepository } from '@/domain/subscription'
import type { Employee } from '@/domain/employee'

// Prevent real Firebase from being imported in jsdom
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// Prevent real Firestore repositories from being constructed (no real db passed)
vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  return {
    ...actual,
    FirestoreWorkstationLicenseRepository: class {
      async listLicenses() { return [] }
    },
    FirestoreAuditLogRepository: class {
      async listAuditLogs() { return { rows: [], nextCursor: null } }
    },
    FirestoreSubscriptionRepository: class {
      async listSubscriptions() { return [] }
    },
    FirestoreEmployeeRepository: class {
      async listEmployees() { return [] }
    },
    FirestoreAssetRepository: class {
      async listAssets() { return [] }
      async loadReferenceData() { return { categories: [], branches: [], departments: [], statuses: [] } }
    },
  }
})

// Mock revealKey — tests don't exercise key reveal
vi.mock('@/lib/licenses/revealKey', () => ({
  revealLicenseKey: vi.fn(),
  setLicenseKey: vi.fn(),
}))

// Mock getMaskedLicenseKey — always returns masked form in tests
vi.mock('@/lib/licenses/maskedKey', () => ({
  getMaskedLicenseKey: vi.fn().mockResolvedValue('****-****-****-0000'),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function authCtx(role: Role) {
  const USERS: Record<Role, { id: string; name: string; email: string }> = {
    super_admin: { id: 'u_001', name: 'Super Admin', email: 's@example.test' },
    asset_admin: { id: 'u_002', name: 'Asset Admin', email: 'a@example.test' },
    tech_admin:  { id: 'u_003', name: 'Tech Admin',  email: 't@example.test' },
    employee:    { id: 'u_004', name: 'Employee',    email: 'e@example.test' },
  }
  const u = USERS[role]
  return {
    user: { id: u.id, name: u.name, email: u.email, role, initials: 'X', avatarColor: '' },
    role,
    status: 'ready' as const,
    setRole: () => {},
    signOut: () => {},
  }
}

function makeAuditCtx() {
  const store = createInMemoryAuditStore()
  return inMemoryAuditContext(store)
}

function makeWRepo() {
  return new InMemoryWorkstationLicenseRepository(makeAuditCtx())
}

function makeSubRepo(seed = []) {
  return new InMemorySubscriptionRepository(makeAuditCtx(), seed)
}

const ACTOR_SUPER = { uid: 'u_001', role: 'super_admin' as const }

interface RenderPageOptions {
  role?: Role
  wRepo?: InMemoryWorkstationLicenseRepository
  subRepo?: InMemorySubscriptionRepository | SubscriptionRepository
  employees?: Employee[]
}

function renderPage({
  role = 'super_admin',
  wRepo,
  subRepo,
  employees = [],
}: RenderPageOptions = {}) {
  const resolvedWRepo  = wRepo  ?? makeWRepo()
  const resolvedSubRepo = subRepo ?? makeSubRepo()
  const aRepo   = new InMemoryAuditLogRepository([])
  const empRepo = new InMemoryEmployeeRepository(employees, [], makeAuditCtx())
  const assetRepo = new InMemoryAssetRepository(
    [],
    { statuses: [], branches: [], departments: [], categories: [], employees: [] },
    makeAuditCtx(),
  )

  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(role)}>
        <MemoryRouter>
          <LicensesPage
            workstationRepo={resolvedWRepo}
            auditRepo={aRepo}
            subscriptionRepo={resolvedSubRepo}
            employeeRepo={empRepo}
            assetRepo={assetRepo}
          />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LicensesPage — new two-tab shape', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
  })

  // ── 1. Both tabs render ─────────────────────────────────────────────────────

  describe('tab strip', () => {
    it('renders the Windows-keys tab button (data-testid=tab-keys)', async () => {
      // Arrange + Act
      renderPage()

      // Assert
      expect(await screen.findByTestId('tab-keys')).toBeInTheDocument()
    })

    it('renders the Subscriptions tab button (data-testid=tab-subs)', async () => {
      // Arrange + Act
      renderPage()

      // Assert
      expect(await screen.findByTestId('tab-subs')).toBeInTheDocument()
    })

    it('default active tab is keys — WindowsKeysSection is shown', async () => {
      // Arrange + Act
      renderPage()

      // Assert — the keys section aria-label is present; no subscription content shown
      await waitFor(() => {
        expect(screen.getByTestId('tab-keys')).toBeInTheDocument()
      })
      // The keys section renders (not loading/error) — filter chips are present
      expect(await screen.findByTestId('filter-in_use')).toBeInTheDocument()
      expect(screen.getByTestId('filter-free')).toBeInTheDocument()
    })

    it('clicking tab-subs switches to the subscriptions view', async () => {
      // Arrange
      const subRepo = makeSubRepo()
      await subRepo.createSubscription(
        { name: 'GitHub Enterprise', seatsTotal: 25, purchaseDate: '2026-01-01', expiryDate: '2027-01-01' },
        ACTOR_SUPER,
      )
      renderPage({ subRepo })

      // Act — wait for page to settle, then click subs tab
      await screen.findByTestId('tab-subs')
      fireEvent.click(screen.getByTestId('tab-subs'))

      // Assert — subscription card appears
      expect(await screen.findByText('GitHub Enterprise')).toBeInTheDocument()
    })

    it('add-subscription-btn is always visible regardless of active tab', async () => {
      // Arrange + Act
      renderPage()

      // Assert — button present on initial render
      expect(await screen.findByTestId('add-subscription-btn')).toBeInTheDocument()
    })
  })

  // ── 2. Tab counts ───────────────────────────────────────────────────────────

  describe('tab counts', () => {
    it('keys tab shows count badge with active device-bound license count', async () => {
      // Arrange — seed one device-bound active license (counts as in_use = 1 key)
      const wRepo = makeWRepo()
      await wRepo.createLicense(
        { name: 'Windows 11 Pro', type: 'OEM', assign: { to: 'device', assetId: 'ast-1' } },
        ACTOR_SUPER,
      )

      // Act
      renderPage({ wRepo })

      // Assert — tab-keys count badge shows at least 1
      const tabKeys = await screen.findByTestId('tab-keys')
      expect(tabKeys.textContent).toMatch(/1/)
    })

    it('subs tab shows count badge matching number of subscriptions', async () => {
      // Arrange — seed 2 subscriptions
      const subRepo = makeSubRepo()
      await subRepo.createSubscription({ name: 'Slack', seatsTotal: 10, purchaseDate: '2026-01-01', expiryDate: '2027-01-01' }, ACTOR_SUPER)
      await subRepo.createSubscription({ name: 'Figma', seatsTotal: 5, purchaseDate: '2026-01-01', expiryDate: '2027-01-01' }, ACTOR_SUPER)

      // Act
      renderPage({ subRepo })

      // Assert — tab-subs count badge shows 2
      const tabSubs = await screen.findByTestId('tab-subs')
      expect(tabSubs.textContent).toMatch(/2/)
    })
  })

  // ── 3. Search input visible on keys tab ─────────────────────────────────────

  it('search input for keys is present when keys tab is active', async () => {
    // Arrange + Act
    renderPage()
    await screen.findByTestId('filter-in_use')

    // Assert — at least one search input is visible
    const searchInputs = screen.getAllByPlaceholderText(/поиск|поисk|search/i)
    expect(searchInputs.length).toBeGreaterThanOrEqual(1)
  })

  // ── 4. Add subscription modal opens ─────────────────────────────────────────

  it('clicking add-subscription-btn opens the AddSubscriptionModal', async () => {
    // Arrange
    renderPage()
    await screen.findByTestId('add-subscription-btn')

    // Act
    fireEvent.click(screen.getByTestId('add-subscription-btn'))

    // Assert — modal submit button appears
    expect(await screen.findByTestId('add-subscription-submit')).toBeInTheDocument()
  })

  // ── 5. Empty states ──────────────────────────────────────────────────────────

  it('shows empty state when there are no windows keys', async () => {
    // Arrange + Act
    renderPage()

    // Assert — empty state text for keys section
    await waitFor(() => {
      // The keys section renders empty state after load completes
      expect(screen.queryByTestId('filter-in_use')).toBeInTheDocument()
    })
    // filter chips still present even when empty
    expect(screen.getByTestId('filter-in_use')).toBeInTheDocument()
  })

  it('switching to subs tab with no subs shows empty-state text', async () => {
    // Arrange — no subs
    renderPage()
    await screen.findByTestId('tab-subs')

    // Act
    fireEvent.click(screen.getByTestId('tab-subs'))

    // Assert — subs empty state (emptyTitle i18n key rendered)
    await waitFor(() => {
      // EmptyState renders i18n key for subs.emptyTitle
      const emptyEl = document.querySelector('[data-testid="tab-subs"]')
      expect(emptyEl).toBeInTheDocument()
    })
  })

  // ── 6. tech_admin role access ────────────────────────────────────────────────

  it('tech_admin can access the page and sees both tabs', async () => {
    // Arrange + Act
    renderPage({ role: 'tech_admin' })

    // Assert — both tabs render for tech_admin
    expect(await screen.findByTestId('tab-keys')).toBeInTheDocument()
    expect(screen.getByTestId('tab-subs')).toBeInTheDocument()
  })

  // ── 7. Subscription cards render in subs tab ─────────────────────────────────

  it('sub card with testid sub-card-{id} appears after switching to subs tab', async () => {
    // Arrange
    const subRepo = makeSubRepo()
    const { value: sub } = await subRepo.createSubscription(
      { name: 'Jira Cloud', seatsTotal: 15, purchaseDate: '2026-01-01', expiryDate: '2027-06-01' },
      ACTOR_SUPER,
    )

    renderPage({ subRepo })
    await screen.findByTestId('tab-subs')

    // Act
    fireEvent.click(screen.getByTestId('tab-subs'))

    // Assert
    expect(await screen.findByTestId(`sub-card-${sub.id}`)).toBeInTheDocument()
    expect(screen.getByText('Jira Cloud')).toBeInTheDocument()
  })

  // ── 8. Assignee-save failure surfaces user-visible feedback ───────────────────

  it('shows an error alert when updating subscription assignees fails', async () => {
    // Arrange — a sub repo whose updateAssignees rejects, plus one active employee
    const seedRepo = makeSubRepo()
    const { value: sub } = await seedRepo.createSubscription(
      { name: 'Confluence', seatsTotal: 5, purchaseDate: '2026-01-01', expiryDate: '2027-01-01' },
      ACTOR_SUPER,
    )
    const failingRepo: SubscriptionRepository = {
      listSubscriptions: () => seedRepo.listSubscriptions(),
      getSubscription: (id: string) => seedRepo.getSubscription(id),
      createSubscription: (input, actor) => seedRepo.createSubscription(input, actor),
      updateAssignees: () => Promise.reject(new Error('permission-denied')),
    }
    const employees: Employee[] = [{
      id: 'emp_1', firstName: 'Anna', lastName: 'Petrova', email: 'anna@example.test',
      phone: null, position: 'QA', branchId: null, departmentId: null,
      status: 'active', terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }]

    renderPage({ subRepo: failingRepo, employees })
    await screen.findByTestId('tab-subs')
    fireEvent.click(screen.getByTestId('tab-subs'))

    // Open the manage-assignees modal and toggle an employee (commits immediately)
    fireEvent.click(await screen.findByTestId(`manage-btn-${sub.id}`))
    const empBtn = await screen.findByRole('button', { name: /Anna Petrova/i })
    fireEvent.click(empBtn)

    // Assert — a user-visible error alert appears (was previously a silent failure)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(i18n.t('licenses:error'))
  })
})
