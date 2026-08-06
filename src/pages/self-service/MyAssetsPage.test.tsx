import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import { MyAssetsPage } from './MyAssetsPage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { Role } from '@/config/roles'

// MyAssetsPage calls useNavigate, so ALL renders must be wrapped in MemoryRouter.
// confirmReceipt is a network call — stub it so tests stay offline.
vi.mock('@/lib/notifications/confirmReceipt', () => ({
  confirmReceipt: vi.fn(async () => ({ ok: true })),
}))

// REF has employees: [] — MyAssetsPage calls loadSelfServiceRefData() which returns
// statuses, categories, branches, and departments (no employees field).
const REF: AssetReferenceData = {
  statuses: [{ id: 'st_assigned', name: 'Выдано', color: 'green' }],
  branches: [], departments: [],
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

/**
 * Render MyAssetsPage wrapped in all required providers.
 * Uses a <Routes> with a probe route at /assets/:id so navigation can be verified.
 */
function render_(
  assets: Asset[],
  opts: { role?: Role; uid?: string } = {},
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
              element={<MyAssetsPage repository={new InMemoryAssetRepository(assets, REF)} />}
            />
            {/* Probe route: lets us assert navigation happened without a real page */}
            <Route path="/assets/:id" element={<div data-testid="asset-detail-probe" />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('MyAssetsPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  // ── existing tests (must stay green) ──────────────────────────────────────

  it('lists my assigned asset (employee)', async () => {
    // Arrange + Act
    render_([mk('uid_1')])

    // Assert
    expect(await screen.findByText(/450\/1/)).toBeInTheDocument()
  })

  it('shows empty state when nothing is assigned (employee)', async () => {
    // Arrange + Act
    render_([mk('someone_else')])

    // Assert
    expect(await screen.findByText(/не закреплены активы/i)).toBeInTheDocument()
  })

  // ── new tests ──────────────────────────────────────────────────────────────

  it('renders assigned asset row under role super_admin', async () => {
    // Arrange: asset assigned to 'uid_1'; super_admin user has id 'uid_1'
    // Act
    render_([mk('uid_1')], { role: 'super_admin' })

    // Assert — page works for admin roles, not just employee
    expect(await screen.findByText(/450\/1/)).toBeInTheDocument()
    expect(screen.queryByText(/не закреплены активы/i)).toBeNull()
  })

  it('category icon box renders an svg per row', async () => {
    // Arrange + Act — REF category has lucideIcon 'laptop'; resolveCategoryColor('c','laptop')
    // returns { bg: '#E6F1FB', ... } which is applied as inline style.
    render_([mk('uid_1')])

    // Assert — the icon box span encloses an svg (Icon component renders an SVG)
    expect(await screen.findByText(/450\/1/))
    const svgs = document.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('category icon box has the laptop color inline style (bg #E6F1FB)', async () => {
    // Arrange + Act
    render_([mk('uid_1')])
    await screen.findByText(/450\/1/)

    // Assert — the icon box span should carry backgroundColor from resolveCategoryColor.
    // ICON_COLOR['laptop'] = { bg: '#E6F1FB', icon: '#185FA5' }.
    // jsdom normalises #E6F1FB → rgb(230, 241, 251).
    const spans = Array.from(document.querySelectorAll('span')).filter(
      (s) => (s as HTMLSpanElement).style?.backgroundColor !== '',
    )
    const laptopSpan = spans.find(
      (s) => (s as HTMLSpanElement).style.backgroundColor === 'rgb(230, 241, 251)',
    )
    expect(laptopSpan).toBeDefined()
  })

  it('row click navigates to /assets/:id for super_admin (canAccess = true)', async () => {
    // Arrange
    const user = userEvent.setup()
    render_([mk('uid_1')], { role: 'super_admin' })
    await screen.findByText(/450\/1/)

    // Act — click the clickable row div (role="button")
    const rowBtn = screen.getByRole('button', { name: /Dell XPS/i })
    await user.click(rowBtn)

    // Assert — the probe route at /assets/a_1 was rendered
    expect(screen.getByTestId('asset-detail-probe')).toBeInTheDocument()
  })

  it('employee row has NO role="button" and clicking does NOT navigate', async () => {
    // Arrange
    const user = userEvent.setup()
    render_([mk('uid_1')], { role: 'employee' })
    await screen.findByText(/450\/1/)

    // Assert — no role="button" on the row div (canAccess(employee, 'assets') = false)
    expect(screen.queryByRole('button', { name: /Dell XPS/i })).toBeNull()

    // Act — click somewhere in the row area (the li element)
    const li = screen.getByText(/450\/1/).closest('li')!
    await user.click(li)

    // Assert — probe route not rendered; still on my-assets page
    expect(screen.queryByTestId('asset-detail-probe')).toBeNull()
    expect(screen.getByText(/450\/1/)).toBeInTheDocument()
  })
})
