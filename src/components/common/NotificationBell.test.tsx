import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { NotificationBell } from './NotificationBell'
import { InMemoryNotificationRepository } from '@/infra/repositories'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { AppNotification } from '@/domain/notification'

vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// Mutable flag so individual tests can flip mobile on/off.
let _mockIsMobile = false
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => _mockIsMobile,
}))

beforeAll(async () => { await i18n.changeLanguage('ru') })

type AdminRole = 'super_admin' | 'asset_admin' | 'tech_admin'
function authCtx(role: AdminRole) {
  return {
    user: { id: 'u_admin', name: 'Admin', email: 'a@x', role, initials: 'A', avatarColor: '' },
    role, status: 'ready' as const, setRole: () => {}, signOut: () => {},
  }
}

const base: Asset = {
  id: 'a0', categoryId: 'cat_laptop', brand: 'Dell', model: 'Latitude',
  invCode: '450/001', serial: null, statusId: 'st_assigned',
  assignment: null, branchId: 'br-1', deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}
function temp(id: string, expiresAt: string, tempKind: 'audit' | 'intern', invCode: string): Asset {
  return { ...base, id, invCode, assignment: { mode: 'temporary', isTemporary: true, tempKind, expiresAt } }
}
const EMPTY_REF: AssetReferenceData = { statuses: [], branches: [], departments: [], categories: [], employees: [], categoryGroups: [] }
function stubRepo(assets: Asset[]): AssetRepository {
  return {
    listAssets: vi.fn().mockResolvedValue(assets),
    loadReferenceData: vi.fn().mockResolvedValue(EMPTY_REF),
    listAssetsForEmployee: vi.fn().mockResolvedValue([]),
    loadSelfServiceRefData: vi.fn().mockResolvedValue({ statuses: [], categories: [], branches: [], departments: [] }),
    findByInvCode: vi.fn().mockResolvedValue(null),
  }
}
function renderBell(
  repo: AssetRepository,
  onSelect = vi.fn(),
  opts: { role?: AdminRole; notifRepo?: InMemoryNotificationRepository; onSelectRoles?: () => void } = {},
) {
  const notifRepo = opts.notifRepo ?? new InMemoryNotificationRepository([])
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(opts.role ?? 'super_admin')}>
        <NotificationBell
          repository={repo}
          notificationRepository={notifRepo}
          onSelect={onSelect}
          {...(opts.onSelectRoles ? { onSelectRoles: opts.onSelectRoles } : {})}
        />
      </AuthContext.Provider>
    </I18nextProvider>,
  )
  return { onSelect, notifRepo }
}

const NOW_ISO = new Date().toISOString()
function receiptEvent(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'ev_receipt', type: 'receipt_confirmed', audience: 'admins',
    createdAt: NOW_ISO, readBy: [],
    assetId: 'a_conf', assetTitle: 'Dell XPS', invCode: '450/777', employeeName: 'Анна Смирнова',
    ...over,
  }
}
function roleEvent(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'ev_role', type: 'role_activated', audience: 'super_admin',
    createdAt: NOW_ISO, readBy: [],
    userUid: 'u_9', userName: 'Пето Петян', userEmail: 'p@x', roleId: 'employee',
    ...over,
  }
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('NotificationBell', () => {
  it('shows a badge with the dueSoon+overdue count (active excluded)', async () => {
    const repo = stubRepo([
      temp('overdue1', '2000-01-01', 'intern', '450/002'),
      temp('active1', '2999-01-01', 'audit', '450/003'),
    ])
    renderBell(repo)
    await waitFor(() => expect(screen.getByTestId('bell-badge')).toHaveTextContent('1'))
  })

  it('renders no badge when there are zero holds', async () => {
    const repo = stubRepo([])
    renderBell(repo)
    await waitFor(() => expect(repo.listAssets).toHaveBeenCalled())
    expect(screen.queryByTestId('bell-badge')).toBeNull()
  })

  it('opens the panel and shows the empty state when no holds', async () => {
    const repo = stubRepo([])
    renderBell(repo)
    await waitFor(() => expect(repo.listAssets).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    expect(await screen.findByText('Нет уведомлений')).toBeInTheDocument()
  })

  it('while loading with no items, shows skeleton rows and NOT the empty state', async () => {
    // A repo whose listAssets never resolves keeps loading=true with zero items.
    const repo: AssetRepository = {
      listAssets: vi.fn().mockReturnValue(new Promise<Asset[]>(() => {})),
      loadReferenceData: vi.fn().mockResolvedValue(EMPTY_REF),
      listAssetsForEmployee: vi.fn().mockResolvedValue([]),
      loadSelfServiceRefData: vi.fn().mockResolvedValue({ statuses: [], categories: [], branches: [], departments: [] }),
      findByInvCode: vi.fn().mockResolvedValue(null),
    }
    renderBell(repo)
    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))

    // Skeleton is present; the «всё прочитано» empty-state text must NOT flash.
    expect(await screen.findByTestId('bell-loading')).toBeInTheDocument()
    expect(screen.queryByText('Нет уведомлений')).toBeNull()
  })

  it('after load resolves, the skeleton is replaced by real notification items', async () => {
    // Controllable deferred so we can observe the loading→loaded transition.
    let resolveList: (a: Asset[]) => void = () => {}
    const pending = new Promise<Asset[]>((res) => { resolveList = res })
    const repo: AssetRepository = {
      listAssets: vi.fn().mockReturnValue(pending),
      loadReferenceData: vi.fn().mockResolvedValue(EMPTY_REF),
      listAssetsForEmployee: vi.fn().mockResolvedValue([]),
      loadSelfServiceRefData: vi.fn().mockResolvedValue({ statuses: [], categories: [], branches: [], departments: [] }),
      findByInvCode: vi.fn().mockResolvedValue(null),
    }
    renderBell(repo)
    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    expect(await screen.findByTestId('bell-loading')).toBeInTheDocument()

    // Resolve with one overdue hold → skeleton gone, real item present.
    resolveList([temp('late1', '2000-01-01', 'audit', '450/006')])
    const items = await screen.findAllByTestId('bell-item')
    expect(items).toHaveLength(1)
    expect(screen.queryByTestId('bell-loading')).toBeNull()
  })

  it('lists overdue before dueSoon and calls onSelect with the assetId', async () => {
    const today = new Date()
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 7)
    const repo = stubRepo([
      temp('soon1', iso(tomorrow), 'intern', '450/004'),
      temp('late1', iso(lastWeek), 'audit', '450/005'),
    ])
    const { onSelect } = renderBell(repo)
    await waitFor(() => expect(screen.getByTestId('bell-badge')).toHaveTextContent('2'))
    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    const items = await screen.findAllByTestId('bell-item')
    expect(items).toHaveLength(2)
    fireEvent.click(items[0]!) // overdue first → late1
    expect(onSelect).toHaveBeenCalledWith('late1')
  })

  // ── Persistent events (/notifications) — receipt confirmed / role activated ──

  it('badge counts unread events; super_admin sees receipt AND role events', async () => {
    const notifRepo = new InMemoryNotificationRepository([receiptEvent(), roleEvent()])
    renderBell(stubRepo([]), vi.fn(), { role: 'super_admin', notifRepo })
    await waitFor(() => expect(screen.getByTestId('bell-badge')).toHaveTextContent('2'))

    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    const rows = await screen.findAllByTestId('bell-event')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('Анна Смирнова')).toBeInTheDocument()
    expect(screen.getByText('Пето Петян')).toBeInTheDocument()
  })

  it('asset_admin does NOT see role_activated events (audience super_admin)', async () => {
    const notifRepo = new InMemoryNotificationRepository([receiptEvent(), roleEvent()])
    renderBell(stubRepo([]), vi.fn(), { role: 'asset_admin', notifRepo })
    await waitFor(() => expect(screen.getByTestId('bell-badge')).toHaveTextContent('1'))

    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    const rows = await screen.findAllByTestId('bell-event')
    expect(rows).toHaveLength(1)
    expect(screen.queryByText('Пето Петян')).toBeNull()
  })

  it('opening the bell marks visible events as read (readBy gets the uid, badge clears)', async () => {
    const notifRepo = new InMemoryNotificationRepository([receiptEvent()])
    renderBell(stubRepo([]), vi.fn(), { role: 'super_admin', notifRepo })
    await waitFor(() => expect(screen.getByTestId('bell-badge')).toHaveTextContent('1'))

    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    await screen.findAllByTestId('bell-event')

    await waitFor(() => {
      expect(notifRepo.docs[0]!.readBy).toContain('u_admin')
    })
    expect(screen.queryByTestId('bell-badge')).toBeNull()
  })

  it('already-read events show no badge but still render in the list', async () => {
    const notifRepo = new InMemoryNotificationRepository([receiptEvent({ readBy: ['u_admin'] })])
    renderBell(stubRepo([]), vi.fn(), { role: 'super_admin', notifRepo })
    await waitFor(() => expect(notifRepo).toBeTruthy())
    expect(screen.queryByTestId('bell-badge')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    expect(await screen.findAllByTestId('bell-event')).toHaveLength(1)
  })

  it('click on a receipt event opens the asset; click on a role event opens roles', async () => {
    const onSelect = vi.fn()
    const onSelectRoles = vi.fn()
    const notifRepo = new InMemoryNotificationRepository([receiptEvent(), roleEvent()])
    renderBell(stubRepo([]), onSelect, { role: 'super_admin', notifRepo, onSelectRoles })
    await waitFor(() => expect(screen.getByTestId('bell-badge')).toHaveTextContent('2'))

    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    let rows = await screen.findAllByTestId('bell-event')
    // Newest-first ordering is by createdAt; both share NOW_ISO so use text lookup.
    const receiptRow = rows.find(r => r.textContent?.includes('Анна Смирнова'))!
    fireEvent.click(receiptRow)
    expect(onSelect).toHaveBeenCalledWith('a_conf')

    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    rows = await screen.findAllByTestId('bell-event')
    const roleRow = rows.find(r => r.textContent?.includes('Пето Петян'))!
    fireEvent.click(roleRow)
    expect(onSelectRoles).toHaveBeenCalled()
  })

  it('events older than 30 days are not shown', async () => {
    const old = new Date(Date.now() - 40 * 86_400_000).toISOString()
    const notifRepo = new InMemoryNotificationRepository([receiptEvent({ createdAt: old })])
    renderBell(stubRepo([]), vi.fn(), { role: 'super_admin', notifRepo })
    await waitFor(() => expect(notifRepo).toBeTruthy())
    expect(screen.queryByTestId('bell-badge')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    expect(await screen.findByText('Нет уведомлений')).toBeInTheDocument()
  })
})

describe('NotificationBell — popover positioning via useIsMobile', () => {
  beforeEach(() => { _mockIsMobile = false })

  it('at viewport ≤767px (mobile) the popover receives left/right/bottom positioning', async () => {
    _mockIsMobile = true
    // Stub getBoundingClientRect so desktop path doesn't interfere if ever reached.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { top: 50, bottom: 70, left: 900, right: 940, width: 40, height: 20, x: 900, y: 50, toJSON: () => {} } as DOMRect,
    )
    const repo = stubRepo([])
    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={authCtx('super_admin')}>
          <NotificationBell
            repository={repo}
            notificationRepository={new InMemoryNotificationRepository([])}
            onSelect={vi.fn()}
          />
        </AuthContext.Provider>
      </I18nextProvider>,
    )
    await waitFor(() => expect(repo.listAssets).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))

    // After opening, the popover portal should have mobile inline styles:
    // left: 8px, right: 8px, bottom: 8px, width: 'auto'
    await waitFor(() => {
      const popover = document.body.querySelector<HTMLElement>('[style*="position: fixed"]')
      expect(popover).not.toBeNull()
      const style = popover!.style
      expect(style.left).toBe('8px')
      expect(style.right).toBe('8px')
      expect(style.bottom).toBe('8px')
      expect(style.width).toBe('auto')
      expect(style.top).toBe('')
    })
    vi.restoreAllMocks()
  })

  it('at viewport ≥768px (desktop) the popover receives top/right/width:340px positioning', async () => {
    _mockIsMobile = false
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      { top: 50, bottom: 70, left: 860, right: 900, width: 40, height: 20, x: 860, y: 50, toJSON: () => {} } as DOMRect,
    )
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 })

    const repo = stubRepo([])
    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={authCtx('super_admin')}>
          <NotificationBell
            repository={repo}
            notificationRepository={new InMemoryNotificationRepository([])}
            onSelect={vi.fn()}
          />
        </AuthContext.Provider>
      </I18nextProvider>,
    )
    await waitFor(() => expect(repo.listAssets).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Уведомления' }))

    // After opening, the popover portal should have desktop inline styles:
    // top: rect.bottom + 6, right: window.innerWidth - rect.right, width: 340px
    await waitFor(() => {
      const popover = document.body.querySelector<HTMLElement>('[style*="position: fixed"]')
      expect(popover).not.toBeNull()
      const style = popover!.style
      expect(style.top).toBe('76px')     // bottom(70) + 6
      expect(style.right).toBe('380px')  // innerWidth(1280) - rect.right(900)
      expect(style.width).toBe('340px')
      expect(style.bottom).toBe('')
    })
    vi.restoreAllMocks()
  })
})
