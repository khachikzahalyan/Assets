import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

const onAuthStateChanged = vi.fn()
const fetchUserRole = vi.fn(async () => 'asset_admin' as string | null)
/** Separate spy for fetchUserProfile so tests can override role AND employeeId independently. */
const fetchUserProfileSpy = vi.fn(async (_uid: string) => ({
  role: 'asset_admin' as string | null,
  employeeId: null as string | null,
}))
const claimSpy = vi.fn().mockResolvedValue(undefined)
const preassignSpy = vi.fn(async () => null as { role: string; employeeId: string } | null)
const linkSpy = vi.fn(async () => null as string | null)
vi.mock('@/lib/firebase', () => ({ auth: () => ({}) }))
vi.mock('@/lib/auth', () => ({
  fetchUserRole: (...a: unknown[]) => fetchUserRole(...(a as [])),
  // fetchUserProfile is now a standalone spy, allowing per-test control of both
  // role and employeeId (e.g. to simulate "already has employeeId" → no self-heal).
  fetchUserProfile: (...a: unknown[]) => fetchUserProfileSpy(...(a as [string])),
  linkEmployeeByEmail: (...a: unknown[]) => linkSpy(...(a as [])),
  signOutUser: vi.fn(),
  // AuthContext subscribes via this wrapper; route it to the spy so tests can
  // capture and drive the auth-state callback. Returns the unsubscribe fn.
  subscribeToAuthState: (cb: (u: unknown) => void) => onAuthStateChanged({}, cb),
  claimPendingUser: (...a: unknown[]) => claimSpy(...a),
  // $0 invited-role fallback: default returns null (no preassignment) so the
  // no-role tests still reach claimPendingUser; a test can override to assert the
  // preassigned-claim → ready path.
  claimPreassignedRole: (...a: unknown[]) => preassignSpy(...(a as [])),
}))

function Probe() {
  const { user, setRole } = useAuth()
  return (
    <div>
      <span data-testid="name">{user.name}</span>
      <button onClick={() => setRole('employee')}>to-employee</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    claimSpy.mockClear()
    linkSpy.mockClear()
    linkSpy.mockResolvedValue(null)
    preassignSpy.mockClear()
    preassignSpy.mockResolvedValue(null)
    fetchUserRole.mockReset()
    fetchUserRole.mockResolvedValue('asset_admin')
    fetchUserProfileSpy.mockReset()
    fetchUserProfileSpy.mockResolvedValue({ role: 'asset_admin', employeeId: null })
  })

  it('provides the super_admin mock user by default', () => {
    render(<AuthProvider initialRole="super_admin"><Probe /></AuthProvider>)
    expect(screen.getByTestId('name').textContent).toBe('Иван Петров')
  })
  it('setRole switches the active user', () => {
    render(<AuthProvider initialRole="super_admin"><Probe /></AuthProvider>)
    act(() => { screen.getByText('to-employee').click() })
    expect(screen.getByTestId('name').textContent).toBe('Сергей Иванов')
  })
  it('useAuth throws outside a provider', () => {
    function Bare() { useAuth(); return null }
    expect(() => render(<Bare />)).toThrow(/AuthProvider/)
  })

  it('real path: starts loading then resolves ready with role from users doc', async () => {
    // fetchUserProfileSpy default returns { role: 'asset_admin', employeeId: null }
    let cb: (u: unknown) => void = () => {}
    onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
    function StatusProbe() { const { status, role } = useAuth(); return <span data-testid="s">{status}:{role ?? '-'}</span> }
    render(<AuthProvider><StatusProbe /></AuthProvider>)
    expect(screen.getByTestId('s').textContent).toBe('loading:super_admin')
    await act(async () => { cb({ uid: 'u1', email: 'a@x', displayName: 'A' }) })
    expect(screen.getByTestId('s').textContent).toBe('ready:asset_admin')
  })

  it('self-heals the employee link when an employee account has no employeeId (pre-existing behavior)', async () => {
    fetchUserProfileSpy.mockResolvedValue({ role: 'employee', employeeId: null })
    linkSpy.mockResolvedValue('emp_doc_7')
    let cb: (u: unknown) => void = () => {}
    onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
    function IdProbe() { const { user, status } = useAuth(); return <span data-testid="s">{status}:{user.employeeId ?? '-'}</span> }
    render(<AuthProvider><IdProbe /></AuthProvider>)
    await act(async () => { cb({ uid: 'u1', email: 'poxos@x.io', displayName: 'P' }) })
    expect(linkSpy).toHaveBeenCalledWith('u1', 'poxos@x.io')
    expect(screen.getByTestId('s').textContent).toBe('ready:emp_doc_7')
  })

  it('self-heals the employee link for asset_admin with no employeeId (any-role behavior)', async () => {
    // Regression guard: the self-heal now fires for ANY role when employeeId is null.
    // Previously only role === 'employee' triggered it; now the condition is !employeeId.
    fetchUserProfileSpy.mockResolvedValue({ role: 'asset_admin', employeeId: null })
    linkSpy.mockResolvedValue('emp_admin_9')
    let cb: (u: unknown) => void = () => {}
    onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
    function IdProbe() { const { user, status } = useAuth(); return <span data-testid="s">{status}:{user.employeeId ?? '-'}</span> }
    render(<AuthProvider><IdProbe /></AuthProvider>)
    await act(async () => { cb({ uid: 'u1', email: 'a@x', displayName: 'A' }) })
    expect(linkSpy).toHaveBeenCalledWith('u1', 'a@x')
    expect(screen.getByTestId('s').textContent).toBe('ready:emp_admin_9')
  })

  it('self-heals the employee link for super_admin with no employeeId', async () => {
    fetchUserProfileSpy.mockResolvedValue({ role: 'super_admin', employeeId: null })
    linkSpy.mockResolvedValue('emp_sa_3')
    let cb: (u: unknown) => void = () => {}
    onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
    function IdProbe() { const { user } = useAuth(); return <span data-testid="s">{user.employeeId ?? '-'}</span> }
    render(<AuthProvider><IdProbe /></AuthProvider>)
    await act(async () => { cb({ uid: 'sa1', email: 'sa@x', displayName: 'SA' }) })
    expect(linkSpy).toHaveBeenCalledWith('sa1', 'sa@x')
    expect(screen.getByTestId('s').textContent).toBe('emp_sa_3')
  })

  it('does NOT call linkEmployeeByEmail when employeeId is already set', async () => {
    // Case B: profile returns a non-null employeeId → the `if (!employeeId)` guard
    // in AuthContext skips the self-heal entirely.
    fetchUserProfileSpy.mockResolvedValue({ role: 'asset_admin', employeeId: 'e_77' })
    let cb: (u: unknown) => void = () => {}
    onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
    function IdProbe() { const { user, status } = useAuth(); return <span data-testid="s">{status}:{user.employeeId ?? '-'}</span> }
    render(<AuthProvider><IdProbe /></AuthProvider>)
    await act(async () => { cb({ uid: 'u1', email: 'a@x', displayName: 'A' }) })
    expect(linkSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('s').textContent).toBe('ready:e_77')
  })

  it('fires claimPendingUser exactly once on the no-role branch', async () => {
    fetchUserProfileSpy.mockResolvedValue({ role: null, employeeId: null })
    let cb: (u: unknown) => void = () => {}
    onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
    function StatusProbe() { const { status } = useAuth(); return <span data-testid="s">{status}</span> }
    render(<AuthProvider><StatusProbe /></AuthProvider>)
    await act(async () => { cb({ uid: 'u9', email: 'p@x', displayName: 'P' }) })
    expect(screen.getByTestId('s').textContent).toBe('no-role')
    expect(claimSpy).toHaveBeenCalledTimes(1)
    expect(claimSpy.mock.calls[0]![0]).toMatchObject({ uid: 'u9' })
  })

  it('applies a preassigned role (invited fallback) → ready, WITHOUT the no-role claim', async () => {
    fetchUserProfileSpy.mockResolvedValue({ role: null, employeeId: null })
    preassignSpy.mockResolvedValue({ role: 'tech_admin', employeeId: 'emp_inv_3' })
    let cb: (u: unknown) => void = () => {}
    onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
    function ClaimProbe() { const { status, role, user } = useAuth(); return <span data-testid="s">{status}:{role ?? '-'}:{user.employeeId ?? '-'}</span> }
    render(<AuthProvider><ClaimProbe /></AuthProvider>)
    await act(async () => { cb({ uid: 'u9', email: 'inv@x', displayName: 'Inv' }) })
    expect(preassignSpy).toHaveBeenCalledWith('u9', 'inv@x', 'Inv')
    expect(screen.getByTestId('s').textContent).toBe('ready:tech_admin:emp_inv_3')
    expect(claimSpy).not.toHaveBeenCalled()
  })
})
