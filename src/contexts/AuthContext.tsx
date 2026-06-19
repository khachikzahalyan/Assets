import { createContext, useContext, useState, useMemo, useCallback, useEffect, type ReactNode } from 'react'
import type { Role } from '@/config/roles'
import { fetchUserRole, signOutUser, subscribeToAuthState, claimPendingUser } from '@/lib/auth'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: Role
  initials: string
  avatarColor: string
}

/**
 * Auth resolution state, surfaced to the router-level guard (<RequireAuth>, later task):
 *   loading    — onAuthStateChanged has not yet reported.
 *   signed-out — no Firebase user.
 *   no-role    — signed in, but users/{uid} has no valid role (access pending).
 *   ready      — signed in with a valid role; user/role are real.
 */
export type AuthStatus = 'loading' | 'signed-out' | 'no-role' | 'ready'

export interface AuthContextValue {
  user: AuthUser
  role: Role
  status: AuthStatus
  setRole: (r: Role) => void
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

/**
 * MOCK identities — used in two situations only:
 *  1. When `initialRole` is provided (tests / dev seam): the active user IS one
 *     of these, and the dev role switcher swaps between them.
 *  2. As a SAFE PLACEHOLDER on the real path while status !== 'ready'. The
 *     placeholder is NEVER rendered: <RequireAuth> gates the app tree on
 *     status === 'ready', so `user`/`role` can stay non-null for consumers
 *     without ever exposing fake identity to a real user.
 */
const MOCK_USERS: Record<Role, AuthUser> = {
  super_admin: { id: 'u_001', name: 'Иван Петров',    email: 'i.petrov@example.com',   role: 'super_admin', initials: 'ИП', avatarColor: 'bg-[#F97316]' },
  asset_admin: { id: 'u_002', name: 'Анна Сидорова',  email: 'a.sidorova@example.com', role: 'asset_admin', initials: 'АС', avatarColor: 'bg-emerald-500' },
  tech_admin:  { id: 'u_003', name: 'Дмитрий Козлов', email: 'd.kozlov@example.com',   role: 'tech_admin',  initials: 'ДК', avatarColor: 'bg-sky-500' },
  employee:    { id: 'u_004', name: 'Сергей Иванов',  email: 's.ivanov@example.com',   role: 'employee',    initials: 'СИ', avatarColor: 'bg-slate-600' },
}

/** Deterministic avatar palette, keyed off a stable string (uid/email). */
const AVATAR_COLORS = ['bg-[#F97316]', 'bg-emerald-500', 'bg-sky-500', 'bg-indigo-500', 'bg-rose-500', 'bg-slate-600']
function avatarColorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  const idx = Math.abs(hash) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx] ?? 'bg-slate-600'
}

/** Derive up-to-two-letter initials from a display name, falling back to the email. */
function initialsFrom(name: string | null | undefined, email: string): string {
  const source = (name && name.trim()) || email || '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? ''
    const b = parts[1]?.[0] ?? ''
    return (a + b).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

interface FirebaseUserShape {
  uid: string
  email: string | null
  displayName: string | null
}

function toAuthUser(fb: FirebaseUserShape, role: Role): AuthUser {
  const email = fb.email ?? ''
  return {
    id: fb.uid,
    name: (fb.displayName && fb.displayName.trim()) || email || fb.uid,
    email,
    role,
    initials: initialsFrom(fb.displayName, email),
    avatarColor: avatarColorFor(fb.uid || email),
  }
}

/**
 * AuthProvider — resolves identity above the router.
 *
 * `initialRole` is the test/dev seam:
 *  - PROVIDED  → Firebase is skipped entirely. status is permanently 'ready',
 *    user/role come from MOCK_USERS, and setRole swaps the mock (dev switcher).
 *  - ABSENT    → production path. Subscribes to onAuthStateChanged, reads the
 *    server-trusted role from users/{uid}, and drives `status`.
 */
export function AuthProvider({ children, initialRole }: { children: ReactNode; initialRole?: Role }) {
  // --- Mock path (initialRole provided) -------------------------------------
  if (initialRole !== undefined) {
    return <MockAuthProvider initialRole={initialRole}>{children}</MockAuthProvider>
  }
  // --- Real path ------------------------------------------------------------
  return <RealAuthProvider>{children}</RealAuthProvider>
}

function MockAuthProvider({ children, initialRole }: { children: ReactNode; initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole)
  const signOut = useCallback(() => {
    if (import.meta.env.DEV) console.info('[auth] signOut (mock)')
  }, [])
  const value = useMemo<AuthContextValue>(
    () => ({ user: { ...MOCK_USERS[role], role }, role, status: 'ready', setRole, signOut }),
    [role, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function RealAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)
  // DEV-only role override for the dev switcher against a real signed-in user.
  const [roleOverride, setRoleOverride] = useState<Role | null>(null)

  useEffect(() => {
    let active = true
    const unsub = subscribeToAuthState((fbUser) => {
      if (!fbUser) {
        if (!active) return
        setUser(null)
        setRoleOverride(null)
        setStatus('signed-out')
        return
      }
      const shape: FirebaseUserShape = {
        uid: fbUser.uid,
        email: fbUser.email ?? null,
        displayName: fbUser.displayName ?? null,
      }
      void (async () => {
        try {
          const role = await fetchUserRole(shape.uid)
          if (!active) return
          if (role === null) {
            // Signed in but no role doc — expose identity so AccessPending can
            // show who is signed in, but role stays a placeholder (never shown).
            setUser({ ...toAuthUser(shape, 'employee'), role: 'employee' })
            setStatus('no-role')
            void claimPendingUser({ uid: shape.uid, email: shape.email, displayName: shape.displayName })
            return
          }
          setUser(toAuthUser(shape, role))
          setStatus('ready')
        } catch {
          // Treat a role-lookup failure as no-role (fail-closed); never crash auth.
          if (!active) return
          setUser({ ...toAuthUser(shape, 'employee'), role: 'employee' })
          setStatus('no-role')
        }
      })()
    })
    return () => {
      active = false
      unsub()
    }
  }, [])

  const setRole = useCallback((r: Role) => {
    if (import.meta.env.DEV) {
      setRoleOverride(r)
      return
    }
    console.info('[auth] setRole is a no-op in production')
  }, [])

  const signOut = useCallback(() => {
    void signOutUser().catch(() => {
      if (import.meta.env.DEV) console.info('[auth] signOut failed')
    })
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    // Effective role: DEV override (if signed in) wins, else the resolved role.
    const baseRole: Role = user?.role ?? 'super_admin'
    const effectiveRole: Role =
      import.meta.env.DEV && roleOverride !== null && status === 'ready' ? roleOverride : baseRole
    // Placeholder user when not ready — never rendered (RequireAuth gates on status).
    const effectiveUser: AuthUser = user
      ? { ...user, role: effectiveRole }
      : { ...MOCK_USERS[effectiveRole], role: effectiveRole }
    return { user: effectiveUser, role: effectiveRole, status, setRole, signOut }
  }, [user, roleOverride, status, setRole, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
