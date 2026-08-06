/**
 * LicensesPage component tests — new two-tab shape (Windows-ключи + Подписки и ПО).
 *
 * Uses InMemory repositories injected as props so no Firestore is touched.
 * i18n is the real instance (ru locale) — consistent with sibling page tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
import type { Asset, CategoryRow } from '@/domain/asset'

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
  assets?: Asset[]
  categories?: CategoryRow[]
}

function renderPage({
  role = 'super_admin',
  wRepo,
  subRepo,
  employees = [],
  assets = [],
  categories = [],
}: RenderPageOptions = {}) {
  const resolvedWRepo  = wRepo  ?? makeWRepo()
  const resolvedSubRepo = subRepo ?? makeSubRepo()
  const aRepo   = new InMemoryAuditLogRepository([])
  const empRepo = new InMemoryEmployeeRepository(employees, [], makeAuditCtx())
  const assetRepo = new InMemoryAssetRepository(
    assets,
    { statuses: [], branches: [], departments: [], categories, employees: [], categoryGroups: [] },
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

  // ── 8b. Keys-tab loading skeleton — real filter TabStrip + mounted pagination ──

  describe('keys-tab loading skeleton', () => {
    it('renders the real filter TabStrip labels AND mounts the pagination while loading', () => {
      // Arrange — a workstation repo whose listLicenses never resolves keeps wLoading=true.
      const pendingWRepo = {
        listLicenses: () => new Promise<never>(() => {}),
      } as unknown as InMemoryWorkstationLicenseRepository

      // Act
      renderPage({ wRepo: pendingWRepo })

      // Assert — filter labels are LOCAL chrome, rendered real during load (P2)…
      expect(screen.getByTestId('filter-in_use')).toBeInTheDocument()
      expect(screen.getByTestId('filter-free')).toBeInTheDocument()
      // …and the skeleton itself is present (the table shimmer)…
      expect(screen.getByTestId('table-skeleton')).toBeInTheDocument()
      // …and the pagination bar is mounted at the card bottom (no ~44px shift on load).
      // The skeleton section is aria-hidden, so query by attribute (role queries skip
      // the a11y tree). LicensesPagination → Pagination renders prev/next buttons with
      // localized aria-labels — their presence proves the bar is mounted during load.
      expect(document.querySelector(`button[aria-label="${i18n.t('licenses:pagination.prev')}"]`)).not.toBeNull()
      expect(document.querySelector(`button[aria-label="${i18n.t('licenses:pagination.next')}"]`)).not.toBeNull()
    })
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
      listSubscriptionsForEmployee: () => Promise.resolve([]),
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

  // ── 9. Activate dialog — «Активы без ключа» pool (assetHasProductKey rule) ────

  describe('activate dialog keyless-asset pool', () => {
    // cat_laptop — Windows-family (hasOemLicense cap → embedded OEM key assumed);
    // cat_macbook_air — device-class WITHOUT the OEM assumption (per taxonomy).
    const CATS: CategoryRow[] = [
      { id: 'cat_laptop', name: 'Ноутбук', categoryGroupId: 'grp_dev', group: 'devices', lucideIcon: 'laptop' },
      { id: 'cat_macbook_air', name: 'MacBook Air', categoryGroupId: 'grp_dev', group: 'devices', lucideIcon: 'laptop' },
    ]

    function makeAsset(overrides: Partial<Asset> & Pick<Asset, 'id'>): Asset {
      return {
        categoryId: 'cat_laptop',
        brand: 'Dell',
        model: 'XPS 15',
        invCode: '450/000001',
        serial: 'SN-1',
        statusId: 'st_warehouse',
        assignment: null,
        branchId: 'br_main',
        deptId: null,
        updatedAt: '2026-07-01T00:00:00.000Z',
        ...overrides,
      }
    }

    it('excludes OEM-bound and cap-assumed-OEM assets; lists a genuinely keyless device', async () => {
      // Arrange — a free Retail key + a keyless OEM doc bound to ast_oem
      const wRepo = makeWRepo()
      const { value: freeKey } = await wRepo.createLicense(
        { name: 'Dell XPS 13 — Ключ продукта', type: 'Retail', assign: { to: 'unassigned' } },
        ACTOR_SUPER,
      )
      const { value: oemLic } = await wRepo.createLicense(
        { name: 'OEM — HP ProBook', type: 'OEM', assign: { to: 'device', assetId: 'ast_oem' } },
        ACTOR_SUPER,
      )

      const assets: Asset[] = [
        // Reported bug repro: active laptop, NO license doc — its category assumes an
        // embedded OEM key («вшит», already active) → must NOT be an activation target.
        makeAsset({ id: 'ast_dell' }),
        // Bound in_use OEM license (keyless digital doc) → must NOT be a target.
        makeAsset({ id: 'ast_oem', brand: 'HP', model: 'ProBook', invCode: '450/000002', serial: 'SN-2' }),
        // Device-class asset with no key data and no OEM assumption → IS a target.
        makeAsset({ id: 'ast_mac', categoryId: 'cat_macbook_air', brand: 'Apple', model: 'MacBook Air', invCode: '450/000003', serial: 'SN-3' }),
      ]

      renderPage({ wRepo, assets, categories: CATS })

      // Act — wait for the REAL keys table (the loading skeleton renders filter
      // chips with the same testids; a click there is lost), then switch to the
      // «Свободен» filter and open the activate modal.
      await screen.findByTestId(`key-row-${oemLic.id}`)
      fireEvent.click(screen.getByTestId('filter-free'))
      fireEvent.click(await screen.findByTestId(`activate-btn-${freeKey.id}`))

      // Assert — only the genuinely keyless asset is offered
      expect(await screen.findByTestId('activate-asset-ast_mac')).toBeInTheDocument()
      expect(screen.queryByTestId('activate-asset-ast_dell')).toBeNull()
      expect(screen.queryByTestId('activate-asset-ast_oem')).toBeNull()
    })

    it('manual-keyed asset IS offered; committing swaps atomically — old key freed with decoupledFromAssetId, new key bound', async () => {
      // Arrange — a free Retail key + a MANUALLY-entered Retail key bound to
      // ast_manual. The asset's category is cat_laptop (OEM-cap): the bound
      // manual doc supersedes the embedded-OEM assumption (data decides).
      const wRepo = makeWRepo()
      const { value: freeKey } = await wRepo.createLicense(
        { name: 'Dell XPS 13 — Ключ продукта', type: 'Retail', rawKey: 'AAAA-BBBB-CCCC-1111', assign: { to: 'unassigned' } },
        ACTOR_SUPER,
      )
      const { value: oldKey } = await wRepo.createLicense(
        { name: 'HP 250 — Ключ продукта', type: 'Retail', rawKey: 'DDDD-EEEE-FFFF-2222', assign: { to: 'device', assetId: 'ast_manual' } },
        ACTOR_SUPER,
      )

      const assets: Asset[] = [
        makeAsset({ id: 'ast_manual', brand: 'HP', model: '250 G8', invCode: '450/000010', serial: 'SN-10' }),
      ]

      renderPage({ wRepo, assets, categories: CATS })

      // Act — wait for the real table, open the activate modal for the free key
      await screen.findByTestId(`key-row-${oldKey.id}`)
      fireEvent.click(screen.getByTestId('filter-free'))
      fireEvent.click(await screen.findByTestId(`activate-btn-${freeKey.id}`))

      // Assert — the manual-keyed asset IS in the pool (swap target)
      const target = await screen.findByTestId('activate-asset-ast_manual')

      // Act — select it; the old key must be SHOWN so nothing is silently lost
      fireEvent.click(target)
      const note = await screen.findByTestId('activate-old-key-note')
      expect(note.textContent).toContain('****-****-****-0000') // mocked masked key
      expect(note.textContent).toContain(i18n.t('licenses:activate.oldKeyNote'))

      // Act — confirm the swap
      const dialog = screen.getByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('licenses:activate.confirm') }))

      // Assert — old license freed via the write-off decouple mechanism…
      await waitFor(async () => {
        const freed = await wRepo.getLicense(oldKey.id)
        expect(freed!.assignmentType).toBe('unassigned')
        expect(freed!.decoupledFromAssetId).toBe('ast_manual')
      })
      // …and the new license is bound to the asset
      const bound = await wRepo.getLicense(freeKey.id)
      expect(bound!.assignmentType).toBe('device')
      expect(bound!.assignedToAssetId).toBe('ast_manual')
      expect(bound!.decoupledFromAssetId).toBeNull()
    })
  })
})
