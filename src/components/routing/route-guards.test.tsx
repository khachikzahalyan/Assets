import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import type { AuthStatus } from '@/contexts/AuthContext'
import type { Role } from '@/config/roles'
import { RequireAuth } from './RequireAuth'
import { RoleGate } from './RoleGate'

// ── Firebase mocks (transitive deps from AccessPendingPage) ────────
vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

vi.mock('@/lib/auth', () => ({
  completeEmailLinkIfPresent: vi.fn(async () => false),
  sendEmployeeLink: vi.fn(),
  signInWithGoogle: vi.fn(),
  signOutUser: vi.fn(),
  subscribeToAuthState: vi.fn(() => () => {}),
  fetchUserRole: vi.fn(async () => null),
}))

// ── Minimal AuthContext value factory ─────────────────────────────
function makeAuthValue(status: AuthStatus, role: Role = 'super_admin'): AuthContextValue {
  return {
    user: {
      id: 'u_test',
      name: 'Test User',
      email: 'test@example.com',
      role,
      initials: 'TU',
      avatarColor: 'bg-slate-600',
    },
    role,
    status,
    setRole: vi.fn(),
    signOut: vi.fn(),
  }
}

function Wrapper({
  authValue,
  children,
}: {
  authValue: AuthContextValue
  children: React.ReactNode
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </I18nextProvider>
  )
}

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ── RequireAuth ────────────────────────────────────────────────────
describe('RequireAuth', () => {
  it('renders the branded app loader (no redirect)', () => {
    render(
      <Wrapper authValue={makeAuthValue('loading')}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<div data-testid="inner">Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    )
    // Inner content not rendered
    expect(screen.queryByTestId('inner')).toBeNull()
    // Branded loader is present
    expect(screen.getByTestId('app-loader')).toBeInTheDocument()
  })

  it('status=signed-out redirects to /login', () => {
    render(
      <Wrapper authValue={makeAuthValue('signed-out')}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<div data-testid="inner">Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    )
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('inner')).toBeNull()
  })

  it('status=no-role renders the AccessPendingPage', () => {
    render(
      <Wrapper authValue={makeAuthValue('no-role')}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<div data-testid="inner">Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    )
    // AccessPendingPage renders the pending copy
    expect(screen.queryByTestId('inner')).toBeNull()
    // The page shows the title key translation
    expect(screen.getByText('Аккаунт не активирован')).toBeInTheDocument()
  })

  it('status=ready renders children via Outlet', () => {
    render(
      <Wrapper authValue={makeAuthValue('ready', 'super_admin')}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/dashboard" element={<div data-testid="inner">Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    )
    expect(screen.getByTestId('inner')).toBeInTheDocument()
  })
})

// ── RoleGate ───────────────────────────────────────────────────────
describe('RoleGate', () => {
  it('renders children when the user role is allowed', () => {
    render(
      <Wrapper authValue={makeAuthValue('ready', 'super_admin')}>
        <MemoryRouter initialEntries={['/categories']}>
          <Routes>
            {/* /my-assets is the destination for employee default route */}
            <Route path="/my-assets" element={<div data-testid="my-assets">My assets</div>} />
            <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
            <Route
              path="/categories"
              element={
                <RoleGate roles={['super_admin']}>
                  <div data-testid="categories-content">Categories</div>
                </RoleGate>
              }
            />
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    )
    expect(screen.getByTestId('categories-content')).toBeInTheDocument()
  })

  it('redirects away from /categories when role is tech_admin', () => {
    // tech_admin is not allowed on categories → should redirect to /dashboard
    render(
      <Wrapper authValue={makeAuthValue('ready', 'tech_admin')}>
        <MemoryRouter initialEntries={['/categories']}>
          <Routes>
            <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
            <Route path="/my-assets" element={<div data-testid="my-assets">My assets</div>} />
            <Route
              path="/categories"
              element={
                <RoleGate roles={['super_admin']}>
                  <div data-testid="categories-content">Categories</div>
                </RoleGate>
              }
            />
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    )
    // tech_admin's default route is /dashboard
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('categories-content')).toBeNull()
  })

  it('employee hitting /dashboard is redirected to /my-assets', () => {
    // routeRoles('dashboard') = [super_admin, asset_admin, tech_admin] — employee NOT included
    render(
      <Wrapper authValue={makeAuthValue('ready', 'employee')}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/my-assets" element={<div data-testid="my-assets">My assets</div>} />
            <Route
              path="/dashboard"
              element={
                <RoleGate roles={['super_admin', 'asset_admin', 'tech_admin']}>
                  <div data-testid="dashboard-content">Dashboard</div>
                </RoleGate>
              }
            />
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    )
    expect(screen.getByTestId('my-assets')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-content')).toBeNull()
  })

  it('admin hitting /my-assets is redirected to /dashboard', () => {
    // routeRoles('my-assets') = [employee] — super_admin NOT included
    render(
      <Wrapper authValue={makeAuthValue('ready', 'super_admin')}>
        <MemoryRouter initialEntries={['/my-assets']}>
          <Routes>
            <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
            <Route
              path="/my-assets"
              element={
                <RoleGate roles={['employee']}>
                  <div data-testid="my-assets-content">My assets</div>
                </RoleGate>
              }
            />
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    )
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('my-assets-content')).toBeNull()
  })

  it('asset_admin allowed on /employees renders content', () => {
    render(
      <Wrapper authValue={makeAuthValue('ready', 'asset_admin')}>
        <MemoryRouter initialEntries={['/employees']}>
          <Routes>
            <Route path="/dashboard" element={<div data-testid="dashboard">Dashboard</div>} />
            <Route
              path="/employees"
              element={
                <RoleGate roles={['super_admin', 'asset_admin']}>
                  <div data-testid="employees-content">Employees</div>
                </RoleGate>
              }
            />
          </Routes>
        </MemoryRouter>
      </Wrapper>,
    )
    expect(screen.getByTestId('employees-content')).toBeInTheDocument()
  })
})
