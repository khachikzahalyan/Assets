# Auth + Route Guards + First Security Rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock AuthProvider with real Firebase auth (Google OAuth for admins + passwordless email-link for employees), enforce access via `<RequireAuth>` + `<RoleGate>` route guards, and ship the first deny-by-default `firestore.rules` / `storage.rules` plus a `beforeCreate` Cloud Function enforcing the OAuth allowed-domain list from `/settings/auth` — all covered by emulator-backed rules tests.

**Architecture:** `AuthProvider` resolves auth state above the router. While resolving it renders a loading state; when resolved it exposes a non-null `user`/`role` to the app tree (so existing consumers never see null) and renders the login page when signed out. Role is server-trusted: read from `users/{uid}.role` via `getDoc`. Route guards reuse the `allow` arrays already in `src/config/nav.ts` as the single source of truth so nav gating and access control can't diverge. Rules read the same `users/{uid}.role` doc via `get()`; the `beforeCreate` function reads `/settings/auth.allowedEmailDomains` (no hardcoded domain).

**Tech Stack:** React 19, Vite 6, react-router-dom 7, Firebase SDK v12 (modular), `@firebase/rules-unit-testing`, Firebase emulators, Cloud Functions v2 (Auth blocking trigger), Vitest.

---

## Decisions locked (owner accepted "pick sensible defaults; don't block")

- **D-A1 — Interface stability:** `AuthContextValue` keeps `{ user, role, setRole, signOut }` with non-null `user`/`role`. Loading + signed-out branches render ABOVE the app tree, so no consumer (`AppShell`, `Sidebar`, `ProfileMenu`) sees null. Zero churn.
- **D-A2 — `initialRole` test/dev seam:** `AuthProvider` keeps the optional `initialRole` prop. When provided (all existing tests, Storybook-like dev), it seeds a mock authenticated user and SKIPS Firebase entirely. When absent (production `App.tsx`), it wires `onAuthStateChanged`. Every existing test passes unchanged.
- **D-A3 — Role source:** server-trusted `users/{uid}.role` via `getDoc`. No custom claims in MVP (rules read the same doc; keeps one source of truth).
- **D-A4 — Dev role switcher:** `setRole` is functional only when `import.meta.env.DEV`. In production it is a logged no-op. Owner accepted D3 (dev-only switcher).
- **D-A5 — Login routing:** unauthenticated users see `/login` (admins: Google button; employees: email-link form). `signInWithEmailLink` completion is handled on app load (`isSignInWithEmailLink`).
- **D-A6 — First-login user doc:** when an authenticated Firebase user has NO `users/{uid}` doc, treat as `role: null` → render an "access pending" screen (NOT auto-provision). Provisioning users + roles is a Super Admin action in a later plan. The `beforeCreate` function gates account CREATION by domain; the app gates ACCESS by the presence of a role doc.
- **D-A7 — Functions runtime:** Cloud Functions v2, Node 20, TypeScript, in `functions/` workspace with its own `package.json` + `tsconfig.json`. `beforeCreate` = `beforeUserCreated` blocking trigger (firebase-functions v2 `identity`).
- **D-A8 — Rules test runner:** new `firebase.json` emulator config + `npm run test:rules` using `firebase emulators:exec`. Separate CI job `rules-test` so the existing build job is unaffected.
- **D-A9 — Storage rules:** deny-by-default now. Granular `acts/{assetId}/*` write rules ship with the assignment feature (Phase 1, later plan). This plan establishes the locked-down baseline only.

---

## File Structure

**Frontend (react-ui-engineer + firebase-engineer):**
- Modify: `src/contexts/AuthContext.tsx` — real auth state machine, keep interface + `initialRole` seam.
- Create: `src/lib/auth/index.ts` — auth helper functions (Google sign-in w/ domain hint, email-link send/complete, sign-out, fetch role doc).
- Create: `src/components/routing/RequireAuth.tsx` — redirect to `/login` if signed out; "access pending" if no role.
- Create: `src/components/routing/RoleGate.tsx` — render children if `role ∈ allow`, else redirect to default route.
- Create: `src/components/routing/index.ts` — barrel.
- Create: `src/config/access.ts` — `routeRoles(routeId)` derived from `nav.ts` `allow` arrays (single source of truth).
- Create: `src/pages/LoginPage.tsx` — Google button + email-link form + email-link completion.
- Create: `src/pages/AccessPendingPage.tsx` — authenticated but no role doc.
- Modify: `src/pages/index.ts` — export new pages.
- Modify: `src/config/routes.tsx` — `/login` public; everything else inside `<RequireAuth>`; per-route `<RoleGate>`.
- Modify: `src/components/common/ProfileMenu.tsx` — guard `setRole` block behind `import.meta.env.DEV`.

**Backend (firebase-engineer):**
- Create: `firebase.json` — emulator + rules + functions config.
- Create: `.firebaserc` — placeholder project alias (operator fills real id).
- Create: `firestore.rules` — deny-by-default + helpers + audit immutability.
- Create: `storage.rules` — deny-by-default.
- Create: `firestore.indexes.json` — empty index set (`{ "indexes": [], "fieldOverrides": [] }`).
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/.gitignore`.
- Create: `functions/src/index.ts` — exports.
- Create: `functions/src/auth/beforeCreate.ts` — domain enforcement from `/settings/auth`.

**Tests (test-engineer):**
- Create: `tests/rules/firestore.rules.test.ts` — role matrix + audit immutability + settings access.
- Create: `tests/rules/storage.rules.test.ts` — deny-by-default.
- Create: `tests/rules/helpers.ts` — emulator test env setup.
- Modify: `src/contexts/auth-context.test.tsx` — add real-auth-path coverage (mock firebase/auth + firestore).
- Create: `src/components/routing/route-guards.test.tsx` — RequireAuth + RoleGate behavior.
- Modify: `package.json` — add `test:rules` script + functions workspace scripts.
- Modify: `.github/workflows/ci.yml` — add `rules-test` job.

---

## Task 1 — Access map derived from nav config (domain-modeler / react-ui-engineer)

**Files:**
- Create: `src/config/access.ts`
- Test: `src/config/access.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { routeRoles, canAccess } from './access'

describe('access map', () => {
  it('derives roles for an admin route from nav allow arrays', () => {
    expect(routeRoles('categories')).toEqual(['super_admin'])
  })
  it('assets is allowed for the three admin roles', () => {
    expect(routeRoles('assets').sort()).toEqual(['asset_admin', 'super_admin', 'tech_admin'])
  })
  it('employee routes allow only employee', () => {
    expect(routeRoles('my-assets')).toEqual(['employee'])
  })
  it('canAccess respects the matrix', () => {
    expect(canAccess('super_admin', 'categories')).toBe(true)
    expect(canAccess('tech_admin', 'categories')).toBe(false)
    expect(canAccess('employee', 'my-assets')).toBe(true)
  })
  it('profile is reachable by employee', () => {
    expect(canAccess('employee', 'profile')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test → FAIL** (`npm test -- --run src/config/access.test.ts`), expect "routeRoles is not a function".

- [ ] **Step 3: Implement**

```ts
import type { Role } from './roles'
import type { RouteId } from './nav'
import { ADMIN_NAV, EMPLOYEE_NAV } from './nav'

/** Flattened route→allowed-roles map, derived from nav config so nav gating and
 *  route access control can never diverge. */
const ROUTE_ROLES: Record<string, Role[]> = (() => {
  const map: Record<string, Role[]> = {}
  for (const group of [...ADMIN_NAV, ...EMPLOYEE_NAV]) {
    for (const item of group.items) map[item.id] = item.allow
  }
  // dashboard is also the admin landing; profile is employee self-service.
  return map
})()

export function routeRoles(routeId: RouteId): Role[] {
  return ROUTE_ROLES[routeId] ?? []
}

export function canAccess(role: Role, routeId: RouteId): boolean {
  return routeRoles(routeId).includes(role)
}
```

- [ ] **Step 4: Run test → PASS.**
- [ ] **Step 5: Commit** `feat(access): derive route→role map from nav config`

---

## Task 2 — Auth helper library (firebase-engineer)

**Files:**
- Modify: `src/lib/auth/index.ts`
- Test: `src/lib/auth/auth-helpers.test.ts`

Helpers wrap `firebase/auth` so components/pages never import the SDK directly (repository discipline). All read role from `users/{uid}` via `firebase/firestore`.

- [ ] **Step 1: Write the failing test** (mock the SDK)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithPopup = vi.fn()
const sendSignInLinkToEmail = vi.fn()
const signInWithEmailLink = vi.fn()
const isSignInWithEmailLink = vi.fn()
const getDoc = vi.fn()

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class { setCustomParameters() {} },
  signInWithPopup: (...a: unknown[]) => signInWithPopup(...a),
  sendSignInLinkToEmail: (...a: unknown[]) => sendSignInLinkToEmail(...a),
  signInWithEmailLink: (...a: unknown[]) => signInWithEmailLink(...a),
  isSignInWithEmailLink: (...a: unknown[]) => isSignInWithEmailLink(...a),
  signOut: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: (...a: unknown[]) => getDoc(...a),
}))
vi.mock('@/lib/firebase', () => ({ auth: () => ({}), db: () => ({}) }))

import { fetchUserRole, sendEmployeeLink, completeEmailLinkIfPresent } from './index'

beforeEach(() => { vi.clearAllMocks() })

describe('auth helpers', () => {
  it('fetchUserRole returns role from users/{uid} doc', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: 'asset_admin' }) })
    expect(await fetchUserRole('uid1')).toBe('asset_admin')
  })
  it('fetchUserRole returns null when no doc', async () => {
    getDoc.mockResolvedValue({ exists: () => false })
    expect(await fetchUserRole('uid1')).toBeNull()
  })
  it('sendEmployeeLink stores email and calls SDK', async () => {
    sendSignInLinkToEmail.mockResolvedValue(undefined)
    await sendEmployeeLink('s@example.com')
    expect(sendSignInLinkToEmail).toHaveBeenCalled()
    expect(window.localStorage.getItem('ams:emailForSignIn')).toBe('s@example.com')
  })
  it('completeEmailLinkIfPresent is a no-op when not an email link', async () => {
    isSignInWithEmailLink.mockReturnValue(false)
    const r = await completeEmailLinkIfPresent()
    expect(r).toBe(false)
    expect(signInWithEmailLink).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test → FAIL** ("fetchUserRole is not exported").

- [ ] **Step 3: Implement** `src/lib/auth/index.ts`

```ts
import {
  GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail,
  signInWithEmailLink, isSignInWithEmailLink, signOut as fbSignOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { Role } from '@/config/roles'

const EMAIL_KEY = 'ams:emailForSignIn'
const ROLE_IDS_SET = new Set<Role>(['super_admin', 'asset_admin', 'tech_admin', 'employee'])

/** Server-trusted role lookup: reads users/{uid}.role. Returns null if no doc or invalid role. */
export async function fetchUserRole(uid: string): Promise<Role | null> {
  const snap = await getDoc(doc(db(), 'users', uid))
  if (!snap.exists()) return null
  const role = (snap.data() as { role?: string }).role
  return role && ROLE_IDS_SET.has(role as Role) ? (role as Role) : null
}

/** Admin sign-in. Domain enforcement happens server-side in the beforeCreate function;
 *  this is the client entry point. */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithPopup(auth(), provider)
}

function actionCodeSettings() {
  return { url: window.location.origin + '/login', handleCodeInApp: true }
}

/** Employee passwordless: send the magic link, remember the email locally for completion. */
export async function sendEmployeeLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth(), email, actionCodeSettings())
  window.localStorage.setItem(EMAIL_KEY, email)
}

/** On app load: if the current URL is an email sign-in link, complete it. Returns true if signed in. */
export async function completeEmailLinkIfPresent(): Promise<boolean> {
  if (!isSignInWithEmailLink(auth(), window.location.href)) return false
  let email = window.localStorage.getItem(EMAIL_KEY)
  if (!email) email = window.prompt('Подтвердите ваш email для входа') ?? ''
  if (!email) return false
  await signInWithEmailLink(auth(), email, window.location.href)
  window.localStorage.removeItem(EMAIL_KEY)
  return true
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth())
}
```

- [ ] **Step 4: Run test → PASS.**
- [ ] **Step 5: Commit** `feat(auth): add Firebase auth helper library`

---

## Task 3 — Real AuthProvider (firebase-engineer)

**Files:**
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/contexts/auth-context.test.tsx`

Interface unchanged. New behavior: when `initialRole` is absent, subscribe to `onAuthStateChanged`, fetch the role doc, and expose `status: 'loading' | 'signed-out' | 'no-role' | 'ready'` for the router-level branch. Keep `user`/`role` non-null in `'ready'`.

- [ ] **Step 1: Update test** — keep all 3 existing tests (they pass `initialRole`, so the mock path is exercised and stays green), add a real-path test:

```ts
// add to existing auth-context.test.tsx (existing 3 tests untouched)
import { vi } from 'vitest'
const onAuthStateChanged = vi.fn()
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (...a: unknown[]) => onAuthStateChanged(...a) }))
vi.mock('@/lib/firebase', () => ({ auth: () => ({}) }))
vi.mock('@/lib/auth', () => ({ fetchUserRole: vi.fn(async () => 'asset_admin'), signOutUser: vi.fn() }))

it('real path: starts loading then resolves ready with role from users doc', async () => {
  let cb: (u: unknown) => void = () => {}
  onAuthStateChanged.mockImplementation((_a, c) => { cb = c; return () => {} })
  function Probe() { const { status, role } = useAuth() as any; return <span data-testid="s">{status}:{role ?? '-'}</span> }
  render(<AuthProvider><Probe /></AuthProvider>)
  expect(screen.getByTestId('s').textContent).toBe('loading:-')
  await act(async () => { cb({ uid: 'u1', email: 'a@x', displayName: 'A' }) })
  expect(screen.getByTestId('s').textContent).toBe('ready:asset_admin')
})
```

- [ ] **Step 2: Run test → FAIL** ("status is undefined" on real path).

- [ ] **Step 3: Implement** — extend `AuthContextValue` with `status` (optional in type to keep consumers stable; `'ready'` when `initialRole` given). Subscribe in `useEffect`, derive `AuthUser` from the Firebase user + role doc, compute initials/avatarColor. `setRole` mutates a DEV-only override.

```ts
// AuthContextValue gains: status: AuthStatus  (always present)
// AuthStatus = 'loading' | 'signed-out' | 'no-role' | 'ready'
// initialRole present  → status='ready', user=MOCK_USERS[role] (existing behavior)
// initialRole absent   → onAuthStateChanged drives status; fetchUserRole sets role
```

(Full implementation written by firebase-engineer per the contract above; existing MOCK path preserved verbatim.)

- [ ] **Step 4: Run all context tests → PASS** (`npm test -- --run src/contexts`).
- [ ] **Step 5: Commit** `feat(auth): real onAuthStateChanged provider with stable interface`

---

## Task 4 — Login + AccessPending pages (react-ui-engineer)

**Files:**
- Create: `src/pages/LoginPage.tsx`, `src/pages/AccessPendingPage.tsx`
- Modify: `src/pages/index.ts`
- Test: `src/pages/login-page.test.tsx`

Login page: AMS brand header, Google button (calls `signInWithGoogle`), divider, employee email-link form (calls `sendEmployeeLink`, shows "проверьте почту" confirmation). On mount, calls `completeEmailLinkIfPresent`. All strings via `t()` (i18n-engineer adds keys in Task 8). Error → inline banner.

- [ ] **Step 1: Write a smoke + interaction test** (mock `@/lib/auth`): renders Google button + email input; submitting a valid email calls `sendEmployeeLink`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement both pages** using existing `ui` primitives (`Button`, `Input`, `Field`, `SectionCard`, `ErrorState`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(auth): login + access-pending pages`

---

## Task 5 — Route guards (react-ui-engineer)

**Files:**
- Create: `src/components/routing/RequireAuth.tsx`, `RoleGate.tsx`, `index.ts`
- Modify: `src/config/routes.tsx`
- Modify: `src/components/common/ProfileMenu.tsx` (guard setRole behind DEV)
- Test: `src/components/routing/route-guards.test.tsx`

`RequireAuth`: reads `status` — `loading`→LoadingState, `signed-out`→`<Navigate to="/login">`, `no-role`→`<AccessPendingPage>`, `ready`→children. `RoleGate roles={Role[]}`: `canAccess`? children : `<Navigate to={defaultRouteForRole(role)} replace>`. routes.tsx: `/login` outside the shell+guard; shell routes wrapped in `<RequireAuth>`; each feature route wrapped `<RoleGate roles={routeRoles(id)}>`.

- [ ] **Step 1: Test** — render router at `/categories` with role `tech_admin` → redirected to `/dashboard`; with `super_admin` → renders. Signed-out at `/dashboard` → `/login`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement guards + rewire routes; gate ProfileMenu setRole block behind `import.meta.env.DEV`.**
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(routing): RequireAuth + RoleGate enforced access control`

---

## Task 6 — Firestore + Storage rules (firebase-engineer)

**Files:**
- Create: `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc`

`firestore.rules` (v2): deny-by-default; `isSignedIn()`; `role()` via `get(/users/$(uid)).data.role`; helpers `isSuperAdmin()`, `isAssetAdmin()`, `isAdmin()`. Per §5 baseline: `/users` read self|super, write self (field whitelist excluding `role`) | super full; `/assets|/branches|/employees|/departments` read any signed-in, write super|asset_admin; `/asset_statuses|/categories` read any signed-in, write super; `/assignments` read signed-in, create asset|super, update only `endedAt`+`transferComment`, no delete; `/audit_logs` read scoped, **`allow update, delete: if false`**; `/settings` read+write super only. `storage.rules`: deny all (baseline). `firebase.json`: rules paths + emulators (auth:9099, firestore:8080, storage:9199, functions:5001).

- [ ] **Step 1:** (rules are tested in Task 7 — TDD pairing). Write the rules files per the contract above.
- [ ] **Step 2: Validate syntax** `npx firebase emulators:exec --only firestore "echo ok"` (boots, parses rules).
- [ ] **Step 3: Commit** `feat(rules): deny-by-default firestore + storage rules with audit immutability`

---

## Task 7 — Rules tests on the emulator (test-engineer)

**Files:**
- Create: `tests/rules/helpers.ts`, `tests/rules/firestore.rules.test.ts`, `tests/rules/storage.rules.test.ts`
- Modify: `package.json` (add `test:rules`)

Use `@firebase/rules-unit-testing` `initializeTestEnvironment`. Seed `users/{uid}` docs per role with `withSecurityRulesDisabled`. Assertions:
- audit immutability: any user (incl. super) `updateDoc`/`deleteDoc` on `audit_logs/x` → `assertFails`; create allowed per rule.
- role matrix: `tech_admin` write to `categories` → fail; `super_admin` → succeed. `asset_admin` write `assets` → succeed; `employee` write `assets` → fail. `/settings` read by non-super → fail.
- storage: any write → fail (baseline).

- [ ] **Step 1: Write `helpers.ts`** (initializeTestEnvironment reading `firestore.rules` + `storage.rules`, host/port from firebase.json).
- [ ] **Step 2: Write the rules tests** (full assertions above — concrete `assertFails`/`assertSucceeds`).
- [ ] **Step 3: Add script** `"test:rules": "firebase emulators:exec --only firestore,storage \"vitest run tests/rules\""`.
- [ ] **Step 4: Run → PASS** (`npm run test:rules`).
- [ ] **Step 5: Commit** `test(rules): emulator role-matrix + audit-immutability + storage coverage`

---

## Task 8 — beforeCreate Cloud Function (firebase-engineer)

**Files:**
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/.gitignore`, `functions/src/index.ts`, `functions/src/auth/beforeCreate.ts`
- Test: `functions/src/auth/beforeCreate.test.ts`

`beforeUserCreated` (v2, firebase-functions): read `/settings/auth.allowedEmailDomains` via Admin SDK; if the new user's email domain ∉ list → throw `HttpsError`/`auth/blocking` rejection. NO hardcoded domain. Empty/missing list → reject all (fail-closed) and log a warning.

- [ ] **Step 1: Test** — unit test the pure `isDomainAllowed(email, domains)` helper + a mocked handler test (Admin SDK `getDoc` mocked) verifying reject-on-missing-list and allow-on-match.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** function + helper; export from `functions/src/index.ts`.
- [ ] **Step 4: Run → PASS** (`cd functions && npm test`). Build: `cd functions && npm run build`.
- [ ] **Step 5: Commit** `feat(functions): beforeCreate OAuth domain enforcement from settings`

---

## Task 9 — Wire App + CI + verify (firebase-engineer / devops via react-ui-engineer)

**Files:**
- Modify: `src/config/routes.tsx` (login completion already in LoginPage), confirm `/login` public.
- Modify: `.github/workflows/ci.yml` — add `rules-test` job (`firebase emulators:exec` for rules) + functions build.
- Modify: `package.json` — `"build:functions": "cd functions && npm ci && npm run build"`.

- [ ] **Step 1:** Add CI `rules-test` job (Node 20, `npm ci`, `npm run test:rules`) and functions build step.
- [ ] **Step 2: Full local verify:**
  - `npm run typecheck` → clean
  - `npm test -- --run` → all green
  - `npm run test:rules` → green
  - `cd functions && npm run build` → clean
  - `npm run build` → clean
- [ ] **Step 3: Commit** `ci: add rules-test job + functions build`

---

## Self-Review

- **Spec coverage:** (1) Real AuthProvider → T3 + T2. (2) Google + email-link flows + login page → T2 + T4. (3) RequireAuth + RoleGate from role matrix → T1 + T5. (4) firestore/storage rules + audit immutability + beforeCreate from settings → T6 + T8. (5) emulator rules TDD + security-reviewer gate → T7 + review phase. All covered.
- **Interface stability:** T3 keeps `AuthContextValue` shape + `initialRole`; existing tests untouched. ✓
- **No hardcoded domain:** T8 reads `/settings/auth.allowedEmailDomains`. ✓
- **Audit immutability:** T6 rule + T7 test assert `update,delete: if false`. ✓
- **Type consistency:** `Role`, `RouteId`, `routeRoles`, `canAccess`, `fetchUserRole`, `AuthStatus` used consistently across tasks. ✓
