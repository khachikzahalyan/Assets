import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

const onAuthStateChanged = vi.fn()
const fetchUserRole = vi.fn(async () => 'asset_admin' as string | null)
const claimSpy = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/firebase', () => ({ auth: () => ({}) }))
vi.mock('@/lib/auth', () => ({
  fetchUserRole: (...a: unknown[]) => fetchUserRole(...(a as [])),
  signOutUser: vi.fn(),
  // AuthContext subscribes via this wrapper; route it to the spy so tests can
  // capture and drive the auth-state callback. Returns the unsubscribe fn.
  subscribeToAuthState: (cb: (u: unknown) => void) => onAuthStateChanged({}, cb),
  claimPendingUser: (...a: unknown[]) => claimSpy(...a),
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
    fetchUserRole.mockReset()
    fetchUserRole.mockResolvedValue('asset_admin')
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
    let cb: (u: unknown) => void = () => {}
    onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
    function StatusProbe() { const { status, role } = useAuth(); return <span data-testid="s">{status}:{role ?? '-'}</span> }
    render(<AuthProvider><StatusProbe /></AuthProvider>)
    expect(screen.getByTestId('s').textContent).toBe('loading:super_admin')
    await act(async () => { cb({ uid: 'u1', email: 'a@x', displayName: 'A' }) })
    expect(screen.getByTestId('s').textContent).toBe('ready:asset_admin')
  })

  it('fires claimPendingUser exactly once on the no-role branch', async () => {
    fetchUserRole.mockResolvedValue(null)
    let cb: (u: unknown) => void = () => {}
    onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
    function StatusProbe() { const { status } = useAuth(); return <span data-testid="s">{status}</span> }
    render(<AuthProvider><StatusProbe /></AuthProvider>)
    await act(async () => { cb({ uid: 'u9', email: 'p@x', displayName: 'P' }) })
    expect(screen.getByTestId('s').textContent).toBe('no-role')
    expect(claimSpy).toHaveBeenCalledTimes(1)
    expect(claimSpy.mock.calls[0]![0]).toMatchObject({ uid: 'u9' })
  })
})
