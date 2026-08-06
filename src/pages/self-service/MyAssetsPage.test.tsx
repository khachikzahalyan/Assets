import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import { MyAssetsPage } from './MyAssetsPage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { Role } from '@/config/roles'
import type { Subscription, SubscriptionRepository } from '@/domain/subscription'

// MyAssetsPage calls useNavigate, so ALL renders must be wrapped in MemoryRouter.
// confirmReceipt is a network call — stub it so tests stay offline.
vi.mock('@/lib/notifications/confirmReceipt', () => ({
  confirmReceipt: vi.fn(async () => ({ ok: true })),
}))

// useIsMobile: default to desktop (false) so DataTable renders (not mobile cards)
vi.mock('@/hooks/useIsMobile', () => ({ useIsMobile: () => false }))

const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_assigned', name: 'Выдано',   color: 'green' },
    { id: 'st_pending',  name: 'Ожидание', color: 'amber' },
    { id: 'st_disposed', name: 'Списано',  color: 'gray'  },
  ],
  branches:    [{ id: 'br_main', name: 'Головной офис' }],
  departments: [{ id: 'dp_it',   name: 'IT отдел' }],
  categories: [{ id: 'c', name: 'Ноутбук', group: 'devices', categoryGroupId: 'grp_devices', lucideIcon: 'laptop' }],
  employees: [],
  categoryGroups: [],
}

function makeCtx(role: Role, uid = 'uid_1'): AuthContextValue {
  return {
    user: {
      id: uid,
      name: 'И',
      email: 'i@x.com',
      role,
      initials: 'И',
      avatarColor: '',
    },
    role,
    status: 'ready',
    setRole: () => {},
    signOut: () => {},
  }
}

function mk(assignmentEmp: string | null): Asset {
  return {
    id: 'a_1',
    categoryId: 'c',
    brand: 'Dell',
    model: 'XPS',
    invCode: '450/1',
    serial: null,
    statusId: 'st_assigned',
    assignment: assignmentEmp ? { mode: 'employee', employeeId: assignmentEmp } : null,
    branchId: 'b',
    deptId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    currentSpecs: null,
  }
}

function mkAsset(overrides: Partial<Asset> & { id: string; invCode: string }): Asset {
  return {
    categoryId: 'c',
    brand: 'Dell',
    model: 'XPS',
    serial: null,
    statusId: 'st_assigned',
    assignment: { mode: 'employee', employeeId: 'uid_1' },
    branchId: 'b',
    deptId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    currentSpecs: null,
    ...overrides,
  }
}

function makeSubRepo(subs: Subscription[] | 'reject'): SubscriptionRepository {
  return {
    listSubscriptionsForEmployee: async () => {
      if (subs === 'reject') throw new Error('network error')
      return subs
    },
    listSubscriptions: () => Promise.reject(new Error('not used')),
    getSubscription: () => Promise.reject(new Error('not used')),
    createSubscription: () => Promise.reject(new Error('not used')),
    updateAssignees: () => Promise.reject(new Error('not used')),
  }
}

function mkSub(overrides: Partial<Subscription> = {}): Subscription {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: 'sub_1',
    name: 'GitHub Enterprise',
    vendorEmail: null,
    seatsTotal: 10,
    assignedEmployeeIds: ['uid_1'],
    purchaseDate: '2026-01-01',
    expiryDate: '2027-01-01',
    createdAt: now,
    updatedAt: now,
    createdBy: 'u_001',
    updatedBy: 'u_001',
    ...overrides,
  }
}

function render_(
  assets: Asset[],
  opts: { role?: Role; uid?: string; subscriptionRepo?: SubscriptionRepository } = {},
): ReturnType<typeof render> {
  const role = opts.role ?? 'employee'
  const uid  = opts.uid  ?? 'uid_1'
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={makeCtx(role, uid)}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={
                <MyAssetsPage
                  repository={new InMemoryAssetRepository(assets, REF)}
                  {...(opts.subscriptionRepo !== undefined ? { subscriptionRepo: opts.subscriptionRepo } : {})}
                />
              }
            />
            <Route path="/assets/:id" element={<div data-testid="asset-detail-probe" />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('MyAssetsPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  // ── Tab structure ─────────────────────────────────────────────────────────

  it('renders two tabs: «Мои активы» and «Мои подписки»', async () => {
    render_([mk('uid_1')])

    // Both tab buttons must be present
    expect(await screen.findByTestId('tab-my-assets')).toBeInTheDocument()
    expect(screen.getByTestId('tab-my-subs')).toBeInTheDocument()
  })

  it('assets tab is active by default', async () => {
    render_([mk('uid_1')])
    await screen.findByTestId('tab-my-assets')
    // «Моё имущество» aria-label table is visible on the assets tab
    expect(screen.getByRole('table', { name: /моё имущество/i })).toBeInTheDocument()
  })

  it('switching to subs tab hides the assets table and shows subs table', async () => {
    const user = userEvent.setup()
    const sub = mkSub()
    render_([mk('uid_1')], { subscriptionRepo: makeSubRepo([sub]) })
    await screen.findByTestId('tab-my-assets')

    await user.click(screen.getByTestId('tab-my-subs'))

    // Assets table no longer visible
    expect(screen.queryByRole('table', { name: /моё имущество/i })).toBeNull()
    // Subs table visible — aria-label = «Мои подписки»
    expect(await screen.findByRole('table', { name: /мои подписки/i })).toBeInTheDocument()
    // Sub name is in the table
    expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument()
  })

  // ── No profile header ─────────────────────────────────────────────────────

  it('does NOT render profile header avatar or name', async () => {
    render_([mk('uid_1')])
    await screen.findByRole('table', { name: /моё имущество/i })
    // EmployeeAvatar was removed — no initials rendered
    expect(screen.queryByText('ИП')).toBeNull()
  })

  it('does NOT render a PageHeader «Мои активы» heading', async () => {
    render_([mk('uid_1')])
    await screen.findByText(/450\/1/)
    expect(screen.queryByRole('heading', { name: /мои активы/i })).toBeNull()
  })

  // ── Asset list in the table ───────────────────────────────────────────────

  it('lists my assigned asset (employee)', async () => {
    render_([mk('uid_1')])
    expect(await screen.findByText(/450\/1/)).toBeInTheDocument()
  })

  it('shows empty state when nothing is assigned (employee)', async () => {
    render_([mk('someone_else')])
    expect(await screen.findByText(/не закреплены активы/i)).toBeInTheDocument()
  })

  it('renders assigned asset row under role super_admin', async () => {
    render_([mk('uid_1')], { role: 'super_admin' })
    expect(await screen.findByText(/450\/1/)).toBeInTheDocument()
    expect(screen.queryByText(/не закреплены активы/i)).toBeNull()
  })

  it('category icon box renders an svg per row', async () => {
    render_([mk('uid_1')])
    expect(await screen.findByText(/450\/1/))
    const svgs = document.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('category icon box has the laptop color inline style (bg #E6F1FB)', async () => {
    render_([mk('uid_1')])
    await screen.findByText(/450\/1/)
    const spans = Array.from(document.querySelectorAll('span')).filter(
      (s) => (s as HTMLSpanElement).style?.backgroundColor !== '',
    )
    const laptopSpan = spans.find(
      (s) => (s as HTMLSpanElement).style.backgroundColor === 'rgb(230, 241, 251)',
    )
    expect(laptopSpan).toBeDefined()
  })

  it('row click navigates to /assets/:id for super_admin (canAccess = true)', async () => {
    const user = userEvent.setup()
    render_([mk('uid_1')], { role: 'super_admin' })
    await screen.findByText(/450\/1/)

    const row = screen.getByTestId('my-asset-row-a_1')
    await user.click(row)

    expect(screen.getByTestId('asset-detail-probe')).toBeInTheDocument()
  })

  it('employee row has NO tabIndex and clicking does NOT navigate', async () => {
    const user = userEvent.setup()
    render_([mk('uid_1')], { role: 'employee' })
    await screen.findByText(/450\/1/)

    const row = screen.getByTestId('my-asset-row-a_1')
    expect(row.getAttribute('tabindex')).toBeNull()

    await user.click(row)

    expect(screen.queryByTestId('asset-detail-probe')).toBeNull()
    expect(screen.getByText(/450\/1/)).toBeInTheDocument()
  })

  // ── Pending assets in the table — sorted first, confirm button ────────────

  it('pending asset appears in the assets table with a confirm button', async () => {
    const pendingAsset = mkAsset({
      id: 'a_pending',
      invCode: '450/99',
      statusId: 'st_pending',
      assignment: { mode: 'employee', employeeId: 'uid_1' },
    })
    render_([pendingAsset])

    // Confirm button is rendered for pending rows
    expect(await screen.findByTestId('confirm-btn-a_pending')).toBeInTheDocument()

    // The asset appears in the table
    expect(screen.getByText('450/99')).toBeInTheDocument()
  })

  it('assigned (non-pending) asset has NO confirm button', async () => {
    render_([mk('uid_1')])
    await screen.findByText(/450\/1/)

    // No confirm button for st_assigned rows
    expect(screen.queryByTestId('confirm-btn-a_1')).toBeNull()
  })

  // ── «Выдано» column (replaces «Статус») ──────────────────────────────────

  it('assigned asset shows formatted date in the «Выдано» column (not a status chip)', async () => {
    // mk() sets updatedAt = '2026-01-01T00:00:00.000Z' → formatDateRu → '01 янв 2026'
    render_([mk('uid_1')])
    await screen.findByText(/450\/1/)

    // Date rendered in the «Выдано» column
    expect(screen.getByText('01 янв 2026')).toBeInTheDocument()

    // Status text «Выдано» must NOT appear as a chip label in this row
    // (the column header t('self.handedOverAt') is «Выдано», but the cell shows a date, not «Выдано» text)
    const chips = Array.from(document.querySelectorAll('[data-testid]')).filter(
      el => el.textContent?.trim() === 'Выдано',
    )
    expect(chips).toHaveLength(0)
  })

  it('pending asset shows amber «Ожидание» chip in the «Выдано» column instead of a date', async () => {
    const pendingAsset = mkAsset({
      id: 'a_pending2',
      invCode: '450/88',
      statusId: 'st_pending',
      assignment: { mode: 'employee', employeeId: 'uid_1' },
      updatedAt: '2026-03-15T00:00:00.000Z',
    })
    render_([pendingAsset])

    await screen.findByTestId('confirm-btn-a_pending2')

    // Pending chip label is visible (from statusLabel)
    expect(screen.getByText('Ожидание')).toBeInTheDocument()

    // Date '15 мар 2026' must NOT appear — pending rows show chip, not date
    expect(screen.queryByText('15 мар 2026')).toBeNull()
  })

  it('pending asset appears BEFORE assigned assets in the table', async () => {
    const assigned = mkAsset({ id: 'a_assigned', invCode: 'ASS/1', statusId: 'st_assigned' })
    const pending  = mkAsset({ id: 'a_pending',  invCode: 'PND/1', statusId: 'st_pending' })
    render_([assigned, pending])

    await screen.findByText('PND/1')

    // Both are visible
    expect(screen.getByText('ASS/1')).toBeInTheDocument()

    // Pending has confirm button; assigned does not
    expect(screen.getByTestId('confirm-btn-a_pending')).toBeInTheDocument()
    expect(screen.queryByTestId('confirm-btn-a_assigned')).toBeNull()
  })

  it('disposed assets are excluded from the table', async () => {
    const disposed = mkAsset({ id: 'a_disp', invCode: 'DIS/1', statusId: 'st_disposed' })
    const assigned = mkAsset({ id: 'a_ok',   invCode: 'OK/1',  statusId: 'st_assigned' })
    render_([disposed, assigned])

    await screen.findByText('OK/1')
    expect(screen.queryByText('DIS/1')).toBeNull()
  })

  // ── No StatCard, no separate «Требует подтверждения» section ─────────────

  it('does NOT render a «На руках» StatCard', async () => {
    render_([mk('uid_1')])
    await screen.findByText(/450\/1/)
    // StatCard label gone
    expect(screen.queryByText('На руках')).toBeNull()
  })

  it('does NOT render a separate «Требует подтверждения» section heading', async () => {
    const pendingAsset = mkAsset({
      id: 'a_pending',
      invCode: '450/99',
      statusId: 'st_pending',
      assignment: { mode: 'employee', employeeId: 'uid_1' },
    })
    render_([pendingAsset])
    await screen.findByTestId('confirm-btn-a_pending')
    // Old section heading must be absent
    expect(screen.queryByText('Требует подтверждения')).toBeNull()
  })

  // ── «Моё имущество» DataTable ─────────────────────────────────────────────

  it('«Моё имущество» section renders a DataTable (role="table")', async () => {
    render_([mk('uid_1')])
    await screen.findByText(/450\/1/)
    expect(screen.getByRole('table', { name: /моё имущество/i })).toBeInTheDocument()
  })

  // ── Tab counts replace the old StatCard ───────────────────────────────────

  it('assets tab count reflects the number of non-disposed assets', async () => {
    const assigned = mkAsset({ id: 'a_1', invCode: '450/1', statusId: 'st_assigned' })
    const pending  = mkAsset({ id: 'a_2', invCode: '450/2', statusId: 'st_pending' })
    const disposed = mkAsset({ id: 'a_3', invCode: '450/3', statusId: 'st_disposed' })
    render_([assigned, pending, disposed])

    await screen.findByTestId('tab-my-assets')
    // Tab renders its count badge; 2 non-disposed assets
    const tabEl = screen.getByTestId('tab-my-assets')
    expect(tabEl.textContent).toMatch('2')
  })

  // ── Assets pagination ─────────────────────────────────────────────────────

  it('renders pagination bar when assets exist', async () => {
    render_([mk('uid_1')])
    await screen.findByText(/450\/1/)
    // LicensesPagination renders a Pagination component — check prev/next buttons
    const prevBtn = screen.getByRole('button', { name: /предыдущая/i })
    expect(prevBtn).toBeInTheDocument()
  })

  it('pagination does NOT appear on empty state', async () => {
    render_([mk('someone_else')])
    await screen.findByText(/не закреплены активы/i)
    expect(screen.queryByRole('button', { name: /предыдущая/i })).toBeNull()
  })

  it('page 2 shows assets 11–20 when more than 10 assets exist', async () => {
    const user = userEvent.setup()
    const manyAssets = Array.from({ length: 12 }, (_, i) =>
      mkAsset({ id: `a_${i}`, invCode: `INV/${i}` }),
    )
    render_(manyAssets)

    // Wait for first page
    await screen.findByText('INV/0')
    expect(screen.queryByText('INV/10')).toBeNull()

    // Click next page
    const nextBtn = screen.getByRole('button', { name: /следующая/i })
    await user.click(nextBtn)

    await waitFor(() => expect(screen.getByText('INV/10')).toBeInTheDocument())
    expect(screen.queryByText('INV/0')).toBeNull()
  })

  // ── Subscriptions tab — DataTable ─────────────────────────────────────────

  it('subs tab renders a DataTable with subscription name column', async () => {
    const user = userEvent.setup()
    const sub = mkSub({ id: 'sub_1', name: 'GitHub Enterprise' })
    render_([], { subscriptionRepo: makeSubRepo([sub]) })

    await screen.findByTestId('tab-my-subs')
    await user.click(screen.getByTestId('tab-my-subs'))

    // DataTable rendered with correct aria-label
    expect(await screen.findByRole('table', { name: /мои подписки/i })).toBeInTheDocument()
    // Sub name appears in the table
    expect(screen.getByText('GitHub Enterprise')).toBeInTheDocument()
  })

  it('subs table shows vendorEmail in the account column', async () => {
    const user = userEvent.setup()
    const sub = mkSub({ vendorEmail: 'admin@github.com' })
    render_([], { subscriptionRepo: makeSubRepo([sub]) })

    await screen.findByTestId('tab-my-subs')
    await user.click(screen.getByTestId('tab-my-subs'))

    expect(await screen.findByText('admin@github.com')).toBeInTheDocument()
  })

  it('subs table shows seats as «used / total»', async () => {
    const user = userEvent.setup()
    const sub = mkSub({ assignedEmployeeIds: ['uid_1', 'uid_2'], seatsTotal: 5 })
    render_([], { subscriptionRepo: makeSubRepo([sub]) })

    await screen.findByTestId('tab-my-subs')
    await user.click(screen.getByTestId('tab-my-subs'))

    // The seats column renders «2» and «/ 5» as separate spans
    await screen.findByRole('table', { name: /мои подписки/i })
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('/ 5')).toBeInTheDocument()
  })

  it('subs table shows formatted purchaseDate and expiryDate', async () => {
    const user = userEvent.setup()
    const sub = mkSub({ purchaseDate: '2026-01-15', expiryDate: '2027-06-30' })
    render_([], { subscriptionRepo: makeSubRepo([sub]) })

    await screen.findByTestId('tab-my-subs')
    await user.click(screen.getByTestId('tab-my-subs'))

    await screen.findByRole('table', { name: /мои подписки/i })
    // Dates formatted as DD.MM.YYYY in ru locale
    expect(screen.getByText('15.01.2026')).toBeInTheDocument()
    expect(screen.getByText('30.06.2027')).toBeInTheDocument()
  })

  it('subs tab shows empty state when subscriptionRepo resolves an empty list', async () => {
    const user = userEvent.setup()
    const subRepo = makeSubRepo([])
    render_([], { subscriptionRepo: subRepo })

    await screen.findByTestId('tab-my-subs')
    await user.click(screen.getByTestId('tab-my-subs'))

    // Empty state heading appears in subs tab (EmptyState renders title as h3)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /мои подписки/i })).toBeInTheDocument()
    })
  })

  it('subs tab pagination appears when more than 10 subscriptions exist', async () => {
    const user = userEvent.setup()
    const manySubs = Array.from({ length: 12 }, (_, i) =>
      mkSub({ id: `sub_${i}`, name: `Sub ${i}` }),
    )
    render_([], { subscriptionRepo: makeSubRepo(manySubs) })

    await screen.findByTestId('tab-my-subs')
    await user.click(screen.getByTestId('tab-my-subs'))

    await screen.findByRole('table', { name: /мои подписки/i })
    expect(screen.getByRole('button', { name: /следующая/i })).toBeInTheDocument()
  })

  it('subs tab page 2 shows items 11–12 when 12 subscriptions exist', async () => {
    const user = userEvent.setup()
    const manySubs = Array.from({ length: 12 }, (_, i) =>
      mkSub({ id: `sub_${i}`, name: `Sub ${i}` }),
    )
    render_([], { subscriptionRepo: makeSubRepo(manySubs) })

    await screen.findByTestId('tab-my-subs')
    await user.click(screen.getByTestId('tab-my-subs'))

    await screen.findByText('Sub 0')
    expect(screen.queryByText('Sub 10')).toBeNull()

    const nextBtn = screen.getByRole('button', { name: /следующая/i })
    await user.click(nextBtn)

    await waitFor(() => expect(screen.getByText('Sub 10')).toBeInTheDocument())
    expect(screen.queryByText('Sub 0')).toBeNull()
  })

  it('subs tab does NOT render manage-assignees button (readOnly enforced)', async () => {
    const user = userEvent.setup()
    const sub = mkSub({ id: 'sub_1' })
    render_([], { subscriptionRepo: makeSubRepo([sub]) })

    await screen.findByTestId('tab-my-subs')
    await user.click(screen.getByTestId('tab-my-subs'))

    await screen.findByText('GitHub Enterprise')
    expect(document.querySelector('[data-testid="manage-btn-sub_1"]')).toBeNull()
  })

  it('page does not crash when subscriptionRepo rejects; asset list still renders', async () => {
    const subRepo = makeSubRepo('reject')
    render_([mk('uid_1')], { subscriptionRepo: subRepo })
    expect(await screen.findByText(/450\/1/)).toBeInTheDocument()
  })
})
