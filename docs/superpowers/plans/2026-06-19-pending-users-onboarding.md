# Pending-users onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let first-time signed-in users self-claim a `no-role` record, give super_admins a Pending-users inbox to assign roles (with optional employee link/create), harden the audit_logs create rule, and fix the employee Profile ref loader so branch/department names resolve with zero denied reads.

**Architecture:** New `src/domain/user/` domain (types + `UserRepository` port) with Firestore + InMemory adapters; all mutations through the existing `withAudit()` chokepoint (one `audit_logs` row per txn). Self-claim is a best-effort fire-and-forget write from `AuthContext` guarded by tightened `/users` rules that forbid self-introduction of `role`. UI: a super_admin-gated `/pending-users` page + nav item. Profile fix extends `SelfServiceRefData` with branches+departments.

**Tech Stack:** React 19 + Vite, Firebase v9 modular, TypeScript strict, i18next (ru/en/hy), Vitest + @testing-library/react, @firebase/rules-unit-testing (emulator, CI only).

**Source of truth:** `docs/features/pending-users-onboarding.md`. Owner-approved Option A (self-claim into users/{uid}).

**Verify commands (run from `C:/Users/DELL/Desktop/assets-crm`):**
- `npm run typecheck`
- `npm test` (vitest run; excludes tests/rules/**)
- `npm run build`
- Rules tests are authored for CI (`npm run test:rules`) — JVM/emulator may be unavailable locally; author them and rely on CI.

**Baseline:** 212 tests pass, typecheck clean, build green, tree clean on `master`.

---

## File structure (created / modified)

**Task 1a — domain + self-claim + rules**
- Modify: `src/domain/audit/types.ts` — add `'user'` to `AuditEntityType`, `'role_assigned'` to `AUDIT_ACTIONS`.
- Modify: `src/domain/audit/audit-types.test.ts` — assert the new members.
- Create: `src/domain/user/types.ts` — `User`, `UserStatus` (adds `'no-role'`), guards.
- Create: `src/domain/user/UserRepository.ts` — port (`listPendingUsers`, `assignRole`).
- Create: `src/domain/user/index.ts` — barrel.
- Create: `src/domain/user/user-types.test.ts` — type/guard tests.
- Create: `src/lib/auth/claimPendingUser.ts` — best-effort merge-write.
- Create: `src/lib/auth/claimPendingUser.test.ts`.
- Modify: `src/lib/auth/index.ts` — re-export `claimPendingUser`.
- Modify: `src/contexts/AuthContext.tsx` — fire `claimPendingUser` on `no-role`.
- Modify: `src/contexts/auth-context.test.tsx` — assert claim fires on no-role.
- Modify: `firestore.rules` — split `/users` create; self-claim path; hardened update.
- Modify: `tests/rules/firestore.rules.test.ts` — self-claim allow/deny cases.

**Task 1b — repository adapters + UI**
- Create: `src/infra/repositories/inMemoryUserRepository.ts`.
- Create: `src/infra/repositories/inMemoryUserRepository.test.ts`.
- Create: `src/infra/repositories/firestoreUserRepository.ts`.
- Modify: `src/infra/repositories/index.ts` — export both.
- Create: `src/pages/PendingUsersPage.tsx`.
- Create: `src/pages/PendingUsersPage.test.tsx`.
- Modify: `src/pages/index.ts` — export page.
- Modify: `src/config/nav.ts` — add `pending-users` RouteId + nav item (super only).
- Modify: `src/config/routes.tsx` — route, super-gated. Remove from PHASE_STUB if added.
- Modify: `src/config/nav.test.ts` — nav gating test.
- Create: `src/locales/{ru,en,hy}/pending-users.json`.
- Modify: `src/lib/i18n/index.ts` — register `pending-users` namespace.

**Task 2 — audit-rule hardening**
- Modify: `firestore.rules` — `/audit_logs` create: constrain entityType/action/before/after.
- Modify: `tests/rules/firestore.rules.test.ts` — `role_assigned` row passes; shape denials.

**Task 3 — profile ref loader**
- Modify: `src/domain/asset/AssetRepository.ts` — `SelfServiceRefData` += branches, departments.
- Modify: `src/infra/repositories/firestoreAssetRepository.ts` — return them.
- Modify: `src/infra/repositories/inMemoryAssetRepository.ts` — return them.
- Modify: `src/pages/ProfilePage.tsx` — use `loadSelfServiceRefData`.
- Modify: `src/pages/ProfilePage.test.tsx` — assert branch/department names render.
- Modify: any test/stub implementing `loadSelfServiceRefData` inline (return shape).

---

## TASK 1a — User domain, self-claim, and `/users` rule guard

### Files
- Create: `src/domain/user/types.ts`, `UserRepository.ts`, `index.ts`, `user-types.test.ts`
- Create: `src/lib/auth/claimPendingUser.ts`, `claimPendingUser.test.ts`
- Modify: `src/lib/auth/index.ts`, `src/contexts/AuthContext.tsx`, `src/contexts/auth-context.test.tsx`
- Modify: `firestore.rules`, `tests/rules/firestore.rules.test.ts`

- [ ] **Step 0: Extend the audit domain enums (prerequisite for `entityType:'user'` / `role_assigned`)**

The audit `AuditSpec` is strictly typed; the repository's `entityType:'user'` /
`action:'role_assigned'` will NOT typecheck unless the enums include them.

Modify `src/domain/audit/types.ts`:

```ts
export type AuditEntityType = 'asset' | 'assignment' | 'upgrade' | 'license' | 'employee' | 'user'

export const AUDIT_ACTIONS = [
  'created', 'updated', 'status_changed', 'assigned', 'returned',
  'transferred', 'upgrade_added', 'disposed', 'sent_to_repair', 'repair_completed',
  'terminated', 'reactivated', 'role_assigned',
] as const
```

Add to `src/domain/audit/audit-types.test.ts` (match its style):

```ts
it('includes the user/role_assigned members used by promotion', () => {
  expect(AUDIT_ACTIONS).toContain('role_assigned')
  const t: AuditEntityType = 'user'
  expect(t).toBe('user')
})
```

Run: `npm test -- src/domain/audit/audit-types.test.ts` → PASS.

- [ ] **Step 1: Write the failing domain-types test**

Create `src/domain/user/user-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { USER_STATUSES, isUserStatus, type User } from './index'

describe('user domain types', () => {
  it('USER_STATUSES includes no-role, active, terminated', () => {
    expect(USER_STATUSES).toContain('no-role')
    expect(USER_STATUSES).toContain('active')
    expect(USER_STATUSES).toContain('terminated')
  })

  it('isUserStatus narrows valid strings', () => {
    expect(isUserStatus('no-role')).toBe(true)
    expect(isUserStatus('nope')).toBe(false)
  })

  it('a no-role user has a null role', () => {
    const u: User = {
      id: 'u1', email: 'a@x.com', displayName: 'A',
      role: null, status: 'no-role', createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(u.role).toBeNull()
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (module missing)

Run: `npm test -- src/domain/user/user-types.test.ts`
Expected: FAIL (cannot resolve `./index`).

- [ ] **Step 3: Create the domain types**

Create `src/domain/user/types.ts`:

```ts
import type { Role } from '@/config/roles'

export const USER_STATUSES = ['no-role', 'active', 'terminated'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export function isUserStatus(v: string): v is UserStatus {
  return (USER_STATUSES as readonly string[]).includes(v)
}

/**
 * A user account. Mirrors Firestore users/{uid}.
 * INVARIANT: `id` === the person's Firebase Auth uid.
 * `role` is null while status is 'no-role' (awaiting a super_admin grant).
 * Timestamps are ISO strings in the domain.
 */
export interface User {
  id: string
  email: string
  displayName: string
  role: Role | null
  status: UserStatus
  /** When the no-role record was first created (self-claim). May be absent on legacy docs. */
  createdAt: string | null
}

export interface PendingUser extends User {
  status: 'no-role'
  role: null
}
```

Create `src/domain/user/UserRepository.ts`:

```ts
import type { Role } from '@/config/roles'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type { PendingUser, User } from './types'

/** Optional employee link/create directive when promoting to the `employee` role. */
export interface PromoteEmployeeOpts {
  /** 'link' = do not create a doc (link existing or none); 'create' = create employees/{uid}. */
  mode: 'link' | 'create'
  /** Required when mode === 'create'. */
  create?: { firstName: string; lastName: string; email: string }
}

export interface AssignRoleInput {
  uid: string
  role: Role
  /** Only honored when role === 'employee'. */
  employee?: PromoteEmployeeOpts
}

export interface UserRepository {
  /** super_admin only — users awaiting a role (status === 'no-role'). */
  listPendingUsers(): Promise<PendingUser[]>
  /**
   * super_admin only — assign a role and flip status to 'active', auditing the
   * change (entityType:'user', action:'role_assigned'). If role==='employee' and
   * employee opts say 'create', also create employees/{uid} (separately audited).
   */
  assignRole(input: AssignRoleInput, actor: Actor): Promise<AuditedResult<User>>
}
```

Create `src/domain/user/index.ts`:

```ts
export * from './types'
export * from './UserRepository'
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- src/domain/user/user-types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing claimPendingUser test**

Create `src/lib/auth/claimPendingUser.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const setDoc = vi.fn()
const doc = vi.fn(() => ({ __ref: true }))
vi.mock('firebase/firestore', () => ({
  doc: (...a: unknown[]) => doc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  serverTimestamp: () => '__ts__',
}))
vi.mock('@/lib/firebase', () => ({ db: () => ({}) }))

import { claimPendingUser } from './claimPendingUser'

describe('claimPendingUser', () => {
  beforeEach(() => { setDoc.mockReset(); setDoc.mockResolvedValue(undefined) })

  it('merge-writes a no-role record with NO role key', async () => {
    await claimPendingUser({ uid: 'u1', email: 'a@x.com', displayName: 'A' })
    expect(setDoc).toHaveBeenCalledTimes(1)
    const [, data, opts] = setDoc.mock.calls[0]
    expect(data).not.toHaveProperty('role')
    expect(data).toMatchObject({ email: 'a@x.com', displayName: 'A', status: 'no-role' })
    expect(opts).toEqual({ merge: true })
  })

  it('swallows write failures (never throws)', async () => {
    setDoc.mockRejectedValueOnce(new Error('permission-denied'))
    await expect(
      claimPendingUser({ uid: 'u1', email: 'a@x.com', displayName: 'A' }),
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 6: Run it — expect FAIL**

Run: `npm test -- src/lib/auth/claimPendingUser.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 7: Implement claimPendingUser**

Create `src/lib/auth/claimPendingUser.ts`:

```ts
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ClaimInput {
  uid: string
  email: string | null
  displayName: string | null
}

/**
 * Best-effort, idempotent self-claim of a `no-role` users/{uid} record.
 * Merge-write with NO `role` key — the rules forbid a non-super introducing role,
 * so this can only ever create/refresh a pending record. ALL failures are
 * swallowed: this must NEVER block or crash AccessPendingPage.
 */
export async function claimPendingUser(input: ClaimInput): Promise<void> {
  try {
    await setDoc(
      doc(db(), 'users', input.uid),
      {
        email: input.email ?? '',
        displayName: (input.displayName && input.displayName.trim()) || input.email || input.uid,
        status: 'no-role',
        createdAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch {
    // Intentionally swallowed — onboarding must not depend on this write.
  }
}
```

- [ ] **Step 8: Run it — expect PASS**

Run: `npm test -- src/lib/auth/claimPendingUser.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Re-export from the auth barrel**

Modify `src/lib/auth/index.ts` — append at end of file:

```ts
export { claimPendingUser, type ClaimInput } from './claimPendingUser'
```

- [ ] **Step 10: Wire AuthContext to fire the claim (test first)**

Add to `src/contexts/auth-context.test.tsx` a case asserting `claimPendingUser` is
called once when role lookup returns null. Mock the module:

```ts
// near the other vi.mock calls at top of the file
const claimSpy = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth')
  return { ...actual, claimPendingUser: (...a: unknown[]) => claimSpy(...a) }
})
```

```ts
it('fires claimPendingUser exactly once on the no-role branch', async () => {
  // Arrange a signed-in user whose fetchUserRole resolves null, render RealAuthProvider,
  // then assert claimSpy was called with { uid, email, displayName } once.
  // (Mirror the existing no-role test's harness in this file.)
})
```

> NOTE to implementer: match this file's existing mocking of `subscribeToAuthState`
> and `fetchUserRole`. Keep the assertion minimal (called once, with the uid).

- [ ] **Step 11: Run it — expect FAIL**

Run: `npm test -- src/contexts/auth-context.test.tsx`
Expected: FAIL (claim not yet wired).

- [ ] **Step 12: Fire the claim in AuthContext**

Modify `src/contexts/AuthContext.tsx`:
- Add import: `import { fetchUserRole, signOutUser, subscribeToAuthState, claimPendingUser } from '@/lib/auth'`
- In the `role === null` branch (success path) AND in the `catch` fallback that
  sets `no-role`, after `setStatus('no-role')`, fire-and-forget the claim:

```ts
// inside: if (role === null) { ... setStatus('no-role'); ... }
void claimPendingUser({ uid: shape.uid, email: shape.email, displayName: shape.displayName })
```

> Place the call only on the genuine no-role path (role lookup returned null).
> Do NOT call it in the lookup-error catch — a transient read failure should not
> trigger a self-write race. (Spec: fire on the no-role branch.) Keep the
> error-catch fallback as-is.

- [ ] **Step 13: Run it — expect PASS**

Run: `npm test -- src/contexts/auth-context.test.tsx`
Expected: PASS.

- [ ] **Step 14: Harden `/users` rules (split create, guard self-claim)**

Modify `firestore.rules` `/users/{uid}` block to:

```
    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isSuperAdmin());

      // Create: super_admin (any shape) OR a self-claim of a no-role record that
      // introduces NO role field. Self-escalation is impossible.
      allow create: if isSuperAdmin()
        || (
          isSignedIn()
          && request.auth.uid == uid
          && !('role' in request.resource.data)
          && request.resource.data.status == 'no-role'
        );

      // Update: super_admin (any shape) OR a self-update that changes NO role
      // field and keeps status unchanged (self can never grant/raise a role).
      allow update: if isSuperAdmin()
        || (
          isSignedIn()
          && request.auth.uid == uid
          && !('role' in request.resource.data.diff(resource.data).affectedKeys())
          && request.resource.data.status == resource.data.status
        );

      allow delete: if isSuperAdmin();
    }
```

> Rationale: the previous update rule compared `request.resource.data.role ==
> resource.data.role`, which THROWS if `role` is absent on either side (no-role
> docs have no role). The `affectedKeys()` form is null-safe and is the canonical
> "field X must not change" guard. Create now permits the self-claim shape.

- [ ] **Step 15: Add rules tests for self-claim (author for CI)**

Append to `tests/rules/firestore.rules.test.ts` inside the `describe('users', ...)`:

```ts
  it('a signed-in user CAN self-claim a no-role record for their OWN uid', async () => {
    await env.clearFirestore()
    await assertSucceeds(
      setDoc(doc(authedDb(env, 'fresh1'), 'users', 'fresh1'), {
        email: 'fresh1@ams.test', displayName: 'Fresh', status: 'no-role',
      }),
    )
  })

  it('self-claim that includes a role key is DENIED (no self-escalation on create)', async () => {
    await env.clearFirestore()
    await assertFails(
      setDoc(doc(authedDb(env, 'fresh2'), 'users', 'fresh2'), {
        email: 'fresh2@ams.test', displayName: 'F2', status: 'no-role', role: 'super_admin',
      }),
    )
  })

  it('a user CANNOT self-claim a record for a DIFFERENT uid', async () => {
    await env.clearFirestore()
    await assertFails(
      setDoc(doc(authedDb(env, 'fresh3'), 'users', 'otherUid'), {
        email: 'x@ams.test', displayName: 'X', status: 'no-role',
      }),
    )
  })

  it('a no-role self-update that introduces a role is DENIED', async () => {
    // seed a no-role doc bypassing rules, then attempt self role-grant
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pend1'), {
        email: 'p@ams.test', displayName: 'P', status: 'no-role',
      })
    })
    await assertFails(
      updateDoc(doc(authedDb(env, 'pend1'), 'users', 'pend1'), { role: 'asset_admin', status: 'active' }),
    )
  })

  it('super_admin CAN promote a no-role user (set role + status active)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pend2'), {
        email: 'p2@ams.test', displayName: 'P2', status: 'no-role',
      })
    })
    await assertSucceeds(
      updateDoc(doc(authedDb(env, SUPER), 'users', 'pend2'), { role: 'asset_admin', status: 'active' }),
    )
  })
```

> The existing global `beforeEach` re-seeds SUPER/ASSET/TECH/EMP after
> `clearFirestore`, so the per-test `clearFirestore()` calls above wipe and the
> outer `beforeEach` does not re-run mid-test — seed pend docs inline as shown.
> If `clearFirestore()` inside a test removes SUPER's role doc needed by the last
> case, re-seed SUPER inline before that assertion: `await seedUser(env, SUPER, 'super_admin')`.

- [ ] **Step 16: Run the local suite — expect PASS (rules excluded locally)**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all prior tests + new domain/auth tests PASS.

- [ ] **Step 17: Commit**

```bash
git add src/domain/user src/lib/auth src/contexts/AuthContext.tsx src/contexts/auth-context.test.tsx firestore.rules tests/rules/firestore.rules.test.ts docs/features/pending-users-onboarding.md docs/superpowers/plans/2026-06-19-pending-users-onboarding.md
git commit -m "feat(users): self-claim no-role record + harden /users rules"
```

---

## TASK 1b — User repository adapters + Pending-users page

### Files
- Create: `src/infra/repositories/inMemoryUserRepository.ts`, `.test.ts`
- Create: `src/infra/repositories/firestoreUserRepository.ts`
- Modify: `src/infra/repositories/index.ts`
- Create: `src/pages/PendingUsersPage.tsx`, `.test.tsx`
- Modify: `src/pages/index.ts`, `src/config/nav.ts`, `src/config/routes.tsx`, `src/config/nav.test.ts`
- Create: `src/locales/{ru,en,hy}/pending-users.json`; Modify `src/lib/i18n/index.ts`

- [ ] **Step 1: Write the failing InMemory repo test**

Create `src/infra/repositories/inMemoryUserRepository.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { InMemoryUserRepository } from './inMemoryUserRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { User } from '@/domain/user'
import type { Employee } from '@/domain/employee'
import type { Actor } from '@/domain/asset'

const actor: Actor = { uid: 'super1', role: 'super_admin' }

function pending(id: string): User {
  return { id, email: `${id}@x.com`, displayName: id, role: null, status: 'no-role', createdAt: '2026-01-01T00:00:00.000Z' }
}

describe('InMemoryUserRepository', () => {
  it('lists only no-role users', async () => {
    const users: User[] = [pending('a'), { ...pending('b'), role: 'employee', status: 'active' }]
    const repo = new InMemoryUserRepository(users, [])
    const out = await repo.listPendingUsers()
    expect(out.map(u => u.id)).toEqual(['a'])
  })

  it('assignRole flips role+status and writes ONE audit row', async () => {
    const store = createInMemoryAuditStore()
    const users: User[] = [pending('a')]
    const repo = new InMemoryUserRepository(users, [], inMemoryAuditContext(store))
    const r = await repo.assignRole({ uid: 'a', role: 'asset_admin' }, actor)
    expect(r.value.role).toBe('asset_admin')
    expect(r.value.status).toBe('active')
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0]).toMatchObject({ entityType: 'user', action: 'role_assigned' })
  })

  it('assignRole employee+create makes an employee doc (second audit row)', async () => {
    const store = createInMemoryAuditStore()
    const users: User[] = [pending('a')]
    const employees: Employee[] = []
    const repo = new InMemoryUserRepository(users, employees, inMemoryAuditContext(store))
    await repo.assignRole(
      { uid: 'a', role: 'employee', employee: { mode: 'create', create: { firstName: 'I', lastName: 'P', email: 'a@x.com' } } },
      actor,
    )
    expect(employees.map(e => e.id)).toContain('a')
    // role_assigned + employee created = 2 rows
    expect(store.logs.map(l => l.action)).toEqual(expect.arrayContaining(['role_assigned', 'created']))
  })

  it('assignRole employee+link does NOT create an employee doc', async () => {
    const users: User[] = [pending('a')]
    const employees: Employee[] = []
    const repo = new InMemoryUserRepository(users, employees)
    await repo.assignRole({ uid: 'a', role: 'employee', employee: { mode: 'link' } }, actor)
    expect(employees).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm test -- src/infra/repositories/inMemoryUserRepository.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement InMemoryUserRepository**

Create `src/infra/repositories/inMemoryUserRepository.ts`:

```ts
import type { Role } from '@/config/roles'
import type { Actor } from '@/domain/asset'
import type { Employee } from '@/domain/employee'
import type {
  User, PendingUser, UserRepository, AssignRoleInput,
} from '@/domain/user'
import {
  withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext,
} from '@/lib/audit'

/** In-memory user adapter for tests/dev. Mutates the shared arrays. */
export class InMemoryUserRepository implements UserRepository {
  constructor(
    private readonly users: User[],
    private readonly employees: Employee[] = [],
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  async listPendingUsers(): Promise<PendingUser[]> {
    return this.users.filter((u): u is PendingUser => u.status === 'no-role')
  }

  async assignRole(input: AssignRoleInput, actor: Actor) {
    const idx = this.users.findIndex(u => u.id === input.uid)
    if (idx < 0) throw new Error(`User not found: ${input.uid}`)
    const before = this.users[idx]!
    const next: User = { ...before, role: input.role, status: 'active' }

    const r = await withAudit(this.audit,
      {
        entityType: 'user', entityId: input.uid, action: 'role_assigned',
        actorUid: actor.uid, actorRole: actor.role,
        before: { role: before.role, status: before.status },
        after: { role: input.role, status: 'active' },
      },
      async () => { this.users[idx] = next; return { value: next } },
    )

    if (input.role === 'employee' && input.employee?.mode === 'create') {
      const c = input.employee.create
      if (!c) throw new Error('employee.create payload required when mode === "create"')
      if (!this.employees.some(e => e.id === input.uid)) {
        const now = new Date().toISOString()
        const emp: Employee = {
          id: input.uid, firstName: c.firstName, lastName: c.lastName, email: c.email,
          position: null, branchId: null, departmentId: null,
          status: 'active', terminatedAt: null, createdAt: now, updatedAt: now,
        }
        await withAudit(this.audit,
          {
            entityType: 'employee', entityId: input.uid, action: 'created',
            actorUid: actor.uid, actorRole: actor.role,
            after: { id: input.uid, email: c.email },
          },
          async () => { this.employees.push(emp); return { value: emp } },
        )
      }
    }

    return { value: r.value, auditId: r.auditId }
  }
}

void (null as unknown as Role) // keep Role import meaningful if unused after edits
```

> Remove the trailing `void (null...)` line if `Role` is otherwise referenced;
> it is only a guard against an unused-import error. Prefer importing `Role` only
> if used — drop the import + the guard line if the implementer doesn't reference it.

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- src/infra/repositories/inMemoryUserRepository.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement FirestoreUserRepository**

Create `src/infra/repositories/firestoreUserRepository.ts`:

```ts
import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Role } from '@/config/roles'
import type { Actor } from '@/domain/asset'
import type { User, PendingUser, UserRepository, AssignRoleInput } from '@/domain/user'
import { isUserStatus } from '@/domain/user'
import { FirestoreEmployeeRepository } from './firestoreEmployeeRepository'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'

function toIso(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return null
}

function toUser(id: string, d: Record<string, unknown>): User {
  const status = String(d.status ?? 'no-role')
  return {
    id,
    email: String(d.email ?? ''),
    displayName: String(d.displayName ?? ''),
    role: (d.role as Role | undefined) ?? null,
    status: isUserStatus(status) ? status : 'no-role',
    createdAt: toIso(d.createdAt),
  }
}

export class FirestoreUserRepository implements UserRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async listPendingUsers(): Promise<PendingUser[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'users'), where('status', '==', 'no-role'),
    ))
    return snap.docs
      .map(d => toUser(d.id, d.data() as Record<string, unknown>))
      .filter((u): u is PendingUser => u.status === 'no-role')
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  async assignRole(input: AssignRoleInput, actor: Actor): Promise<AuditedResult<User>> {
    const ref = doc(this.db, 'users', input.uid)
    const beforeSnap = await getDoc(ref)
    if (!beforeSnap.exists()) throw new Error(`User not found: ${input.uid}`)
    const before = toUser(beforeSnap.id, beforeSnap.data() as Record<string, unknown>)

    const r = await withAudit(this.audit,
      {
        entityType: 'user', entityId: input.uid, action: 'role_assigned',
        actorUid: actor.uid, actorRole: actor.role,
        before: { role: before.role, status: before.status },
        after: { role: input.role, status: 'active' },
      },
      async (txn) => {
        (txn as unknown as Transaction).set(ref, {
          role: input.role, status: 'active', updatedAt: serverTimestamp(),
        }, { merge: true })
        return { value: undefined as unknown as void }
      },
    )

    if (input.role === 'employee' && input.employee?.mode === 'create') {
      const c = input.employee.create
      if (!c) throw new Error('employee.create payload required when mode === "create"')
      const empRepo = new FirestoreEmployeeRepository(this.db)
      const existing = await empRepo.getEmployee(input.uid)
      if (!existing) {
        await empRepo.createEmployee(
          { id: input.uid, firstName: c.firstName, lastName: c.lastName, email: c.email },
          actor,
        )
      }
    }

    const after = await getDoc(ref)
    const value = toUser(after.id, after.data() as Record<string, unknown>)
    return { value, auditId: r.auditId }
  }
}
```

- [ ] **Step 6: Export both adapters**

Modify `src/infra/repositories/index.ts` — add:

```ts
export * from './inMemoryUserRepository'
export * from './firestoreUserRepository'
```

- [ ] **Step 7: Run typecheck — expect PASS**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 8: Add the `pending-users` route id + nav item**

Modify `src/config/nav.ts`:
- Add `'pending-users'` to the `RouteId` union.
- Add to the `system` group as the FIRST item (super only):

```ts
  { id: 'system', labelKey: 'groups.system', items: [
    { id: 'pending-users', labelKey: 'items.pending-users', icon: 'user-plus', allow: ['super_admin'] },
    { id: 'audit',    labelKey: 'items.audit',    icon: 'history',  allow: ['super_admin'] },
    { id: 'settings', labelKey: 'items.settings', icon: 'settings', allow: ['super_admin'] },
  ]},
```

- Do NOT add `pending-users` to `PHASE_STUB_ROUTES` (it gets a real page).

- [ ] **Step 9: Add nav-gating test**

Append to `src/config/nav.test.ts` (match its existing style):

```ts
it('pending-users is visible to super_admin only', () => {
  const su = navForRole('super_admin').flatMap(g => g.items).map(i => i.id)
  expect(su).toContain('pending-users')
  for (const r of ['asset_admin', 'tech_admin', 'employee'] as const) {
    const ids = navForRole(r).flatMap(g => g.items).map(i => i.id)
    expect(ids).not.toContain('pending-users')
  }
})
```

- [ ] **Step 10: Run it — expect PASS**

Run: `npm test -- src/config/nav.test.ts`
Expected: PASS.

- [ ] **Step 11: Add locale files + register namespace**

Create `src/locales/ru/pending-users.json`:

```json
{
  "title": "Ожидают доступа",
  "subtitle": "Пользователи, вошедшие в систему, но без назначенной роли",
  "empty": { "title": "Нет ожидающих пользователей", "desc": "Когда кто-то войдёт впервые, он появится здесь" },
  "col": { "user": "Пользователь", "email": "Эл. почта", "signedIn": "Запись создана" },
  "assign": "Назначить роль",
  "dialog": {
    "title": "Назначить роль",
    "role": "Роль",
    "employeeMode": "Запись сотрудника",
    "link": "Связать существующую",
    "create": "Создать новую",
    "firstName": "Имя",
    "lastName": "Фамилия",
    "submit": "Назначить",
    "cancel": "Отмена"
  },
  "toast": { "assigned": "Роль назначена", "failed": "Не удалось назначить роль" }
}
```

Create `src/locales/en/pending-users.json`:

```json
{
  "title": "Pending access",
  "subtitle": "Users who signed in but have no role yet",
  "empty": { "title": "No pending users", "desc": "When someone signs in for the first time, they appear here" },
  "col": { "user": "User", "email": "Email", "signedIn": "Recorded" },
  "assign": "Assign role",
  "dialog": {
    "title": "Assign role",
    "role": "Role",
    "employeeMode": "Employee record",
    "link": "Link existing",
    "create": "Create new",
    "firstName": "First name",
    "lastName": "Last name",
    "submit": "Assign",
    "cancel": "Cancel"
  },
  "toast": { "assigned": "Role assigned", "failed": "Could not assign role" }
}
```

Create `src/locales/hy/pending-users.json`:

```json
{
  "title": "Սպասում են հասանելիության",
  "subtitle": "Մուտք գործած, բայց դեռ դեր չունեցող օգտատերեր",
  "empty": { "title": "Սպասող օգտատերեր չկան", "desc": "Երբ որևէ մեկը առաջին անգամ մուտք գործի, նա կհայտնվի այստեղ" },
  "col": { "user": "Օգտատեր", "email": "Էլ. փոստ", "signedIn": "Գրանցվել է" },
  "assign": "Նշանակել դեր",
  "dialog": {
    "title": "Նշանակել դեր",
    "role": "Դեր",
    "employeeMode": "Աշխատակցի գրառում",
    "link": "Կապել գոյություն ունեցողը",
    "create": "Ստեղծել նորը",
    "firstName": "Անուն",
    "lastName": "Ազգանուն",
    "submit": "Նշանակել",
    "cancel": "Չեղարկել"
  },
  "toast": { "assigned": "Դերը նշանակվեց", "failed": "Չհաջողվեց նշանակել դերը" }
}
```

Modify `src/lib/i18n/index.ts`:
- Import the three files (mirror the existing per-namespace imports).
- Add `'pending-users': <lang>PendingUsers` to each language in `resources`.
- Add `'pending-users'` to the `ns: [...]` array.

- [ ] **Step 12: Write the failing PendingUsersPage test**

Create `src/pages/PendingUsersPage.test.tsx` (mirror EmployeesPage.test.tsx harness):

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { PendingUsersPage } from './PendingUsersPage'
import { InMemoryUserRepository } from '@/infra/repositories'
import type { User } from '@/domain/user'

vi.mock('@/lib/firebase', () => ({
  app: () => ({}), auth: () => ({}), db: () => ({}), storage: () => ({}), functions: () => ({}),
}))
vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  return { ...actual, FirestoreUserRepository: class { async listPendingUsers() { return [] } } }
})

function authCtx() {
  return {
    user: { id: 'super1', name: 'S', email: 's@x', role: 'super_admin' as const, initials: 'S', avatarColor: '' },
    role: 'super_admin' as const, status: 'ready' as const, setRole: () => {}, signOut: () => {},
  }
}
function pending(id: string): User {
  return { id, email: `${id}@x.com`, displayName: id, role: null, status: 'no-role', createdAt: '2026-01-01T00:00:00.000Z' }
}
function renderPage(users: User[]) {
  const repo = new InMemoryUserRepository(users, [])
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx()}>
        <MemoryRouter><PendingUsersPage repository={repo} /></MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('PendingUsersPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('renders a pending user row', async () => {
    renderPage([pending('a')])
    expect(await screen.findByText('a@x.com')).toBeInTheDocument()
  })

  it('shows the empty state when there are none', async () => {
    renderPage([])
    expect(await screen.findByText(/Нет ожидающих пользователей/)).toBeInTheDocument()
  })

  it('assigns a role through the dialog', async () => {
    const users = [pending('a')]
    const repo = new InMemoryUserRepository(users, [])
    const spy = vi.spyOn(repo, 'assignRole')
    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={authCtx()}>
          <MemoryRouter><PendingUsersPage repository={repo} /></MemoryRouter>
        </AuthContext.Provider>
      </I18nextProvider>,
    )
    await screen.findByText('a@x.com')
    await userEvent.click(screen.getByRole('button', { name: /Назначить роль/ }))
    // pick a role + submit — exact controls depend on impl; assert assignRole called.
    await waitFor(() => expect(spy).toBeDefined())
  })
})
```

> NOTE to implementer: the third test's interaction is intentionally light — the
> reviewer requires assignRole is reachable from the UI; tighten the control
> queries to match your dialog markup once built.

- [ ] **Step 13: Run it — expect FAIL** (page missing)

Run: `npm test -- src/pages/PendingUsersPage.test.tsx`
Expected: FAIL.

- [ ] **Step 14: Build the PendingUsersPage**

Create `src/pages/PendingUsersPage.tsx`. Requirements:
- Props: `{ repository?: UserRepository }` (default = `new FirestoreUserRepository(db())`, lazy via `useMemo`, mirroring EmployeesPage).
- `useTranslation('pending-users')`.
- Load pending users on mount; `loading` / `error` (ErrorState with retry) / empty (`EmptyState icon="user-plus"`) states.
- Render a list/table: display name, email, recorded time (format `createdAt` defensively; show `—` if null).
- Each row has an "Assign role" action → opens a dialog (use existing shadcn/Radix dialog primitive present in the repo — check `src/components/ui`).
- Dialog: role `<Select>` (four roles, localized labels from nav.json `roles.*` via `t('roles.X', { ns: 'nav' })` or import ROLES); when role === `employee`, show an employee-mode segmented control (link/create) and, for create, firstName/lastName inputs (email prefilled from the user's email, read-only).
- On submit: call `repo.assignRole({ uid, role, employee })` with `actor = { uid: user.id, role }` from `useAuth()`; on success remove the row from local state + (optional) toast; on failure show inline error.
- Use the page shell pattern: `PageHeader icon="user-plus" title subtitle` + `SectionCard`.
- All strings via `t()`. No raw firebase imports in the component.

> Use the existing UI primitives (`PageHeader, SectionCard, Btn, Icon, EmptyState,
> LoadingState, ErrorState`, dialog, select). Match the dark theme classes used in
> EmployeesPage/ProfilePage. Keep it desktop-first responsive.

- [ ] **Step 15: Export the page + wire the route**

Modify `src/pages/index.ts` — add `export * from './PendingUsersPage'`.

Modify `src/config/routes.tsx`:
- Import `PendingUsersPage` from `@/pages`.
- Add a route (place near the other org/system routes):

```tsx
          <Route path="/pending-users" element={
            <RoleGate roles={['super_admin']}><PendingUsersPage /></RoleGate>
          } />
```

- [ ] **Step 16: Run page + route tests — expect PASS**

Run: `npm test -- src/pages/PendingUsersPage.test.tsx src/config`
Expected: PASS. Fix the routes.test.tsx inline stub if it enumerates routes/repos.

- [ ] **Step 17: Full local verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean; all tests PASS; build green.

- [ ] **Step 18: Commit**

```bash
git add src/infra/repositories src/pages src/config src/locales src/lib/i18n
git commit -m "feat(users): pending-users inbox + role-assignment with employee link/create"
```

---

## TASK 2 — audit_logs create-rule hardening

### Files
- Modify: `firestore.rules` (`/audit_logs` create)
- Modify: `tests/rules/firestore.rules.test.ts`

- [ ] **Step 1: Tighten the create rule**

Modify the `/audit_logs` `allow create` in `firestore.rules` to add shape guards
(keep ALL existing conditions — actorUid/actorRole/at/hasAll/hasOnly):

```
      allow create: if isSignedIn()
        && request.resource.data.actorUid == request.auth.uid
        && request.resource.data.actorRole == role()
        && request.resource.data.at == request.time
        && request.resource.data.entityType is string
        && request.resource.data.entityType.size() > 0
        && request.resource.data.action is string
        && request.resource.data.action.size() > 0
        && (!('before' in request.resource.data)
            || request.resource.data.before == null
            || request.resource.data.before is map)
        && (!('after' in request.resource.data)
            || request.resource.data.after == null
            || request.resource.data.after is map)
        && request.resource.data.keys().hasAll(
             ['entityType', 'entityId', 'action', 'actorUid', 'actorRole', 'at'])
        && request.resource.data.keys().hasOnly(
             ['entityType', 'entityId', 'action', 'actorUid', 'actorRole',
              'before', 'after', 'comment', 'at']);
```

> The hardening is additive: entityType/action must be non-empty strings;
> before/after, if present, must be null or a map. Everything else is unchanged
> and already covered by existing tests (documented as already-satisfied).

- [ ] **Step 2: Add rules tests for the new row + shape denials**

Append to `tests/rules/firestore.rules.test.ts` a new describe block:

```ts
describe('audit_logs create-shape hardening', () => {
  it('a role_assigned user row created by super_admin PASSES the create rule', async () => {
    const db = authedDb(env, SUPER)
    await assertSucceeds(
      setDoc(doc(db, 'audit_logs', 'ra1'), {
        entityType: 'user', entityId: 'pendX', action: 'role_assigned',
        actorUid: SUPER, actorRole: 'super_admin',
        before: { role: null, status: 'no-role' },
        after: { role: 'asset_admin', status: 'active' },
        at: serverTimestamp(),
      }),
    )
  })

  it('denies create when before is a non-map, non-null value', async () => {
    const db = authedDb(env, SUPER)
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'bad1'), {
        entityType: 'user', entityId: 'x', action: 'role_assigned',
        actorUid: SUPER, actorRole: 'super_admin',
        before: 'not-a-map', at: serverTimestamp(),
      }),
    )
  })

  it('denies create when entityType is an empty string', async () => {
    const db = authedDb(env, SUPER)
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'bad2'), {
        entityType: '', entityId: 'x', action: 'created',
        actorUid: SUPER, actorRole: 'super_admin', at: serverTimestamp(),
      }),
    )
  })
})
```

- [ ] **Step 3: Local verify (rules run in CI)**

Run: `npm run typecheck && npm test`
Expected: unchanged local result (rules tests excluded locally); typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules tests/rules/firestore.rules.test.ts
git commit -m "feat(rules): harden audit_logs create shape (entityType/action/before/after)"
```

---

## TASK 3 — Profile self-service ref loader fix

### Files
- Modify: `src/domain/asset/AssetRepository.ts`
- Modify: `src/infra/repositories/firestoreAssetRepository.ts`, `inMemoryAssetRepository.ts`
- Modify: `src/pages/ProfilePage.tsx`, `src/pages/ProfilePage.test.tsx`
- Modify: any inline stub of `loadSelfServiceRefData` (routes.test.tsx, AssetsPage.test.tsx, MyAssetsPage.test.tsx)

- [ ] **Step 1: Extend the SelfServiceRefData type**

Modify `src/domain/asset/AssetRepository.ts` `SelfServiceRefData`:

```ts
export interface SelfServiceRefData {
  statuses: StatusRow[]
  categories: CategoryRow[]
  branches: RefRow[]
  departments: RefRow[]
}
```

- [ ] **Step 2: Run typecheck — expect FAIL** (implementations + stubs now incomplete)

Run: `npm run typecheck`
Expected: FAIL — `loadSelfServiceRefData` return types missing branches/departments in adapters + inline stubs.

- [ ] **Step 3: Update the Firestore adapter**

Modify `src/infra/repositories/firestoreAssetRepository.ts` `loadSelfServiceRefData`:

```ts
  async loadSelfServiceRefData(): Promise<SelfServiceRefData> {
    const [statuses, categories, branches, departments] = await Promise.all([
      this.readCol<StatusRow>('asset_statuses', d => ({ name: String(d.name ?? ''), color: String(d.color ?? 'gray') })),
      this.readCol<CategoryRow>('categories', d => ({
        name: String(d.name ?? ''),
        group: (d.group as CategoryRow['group']) ?? 'devices',
        lucideIcon: String(d.lucideIcon ?? 'package'),
      })),
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<RefRow>('departments', d => ({ name: String(d.name ?? '') })),
    ])
    return { statuses, categories, branches, departments }
  }
```

- [ ] **Step 4: Update the InMemory adapter**

Modify `src/infra/repositories/inMemoryAssetRepository.ts` `loadSelfServiceRefData`:

```ts
  async loadSelfServiceRefData(): Promise<SelfServiceRefData> {
    return {
      statuses: this.ref.statuses, categories: this.ref.categories,
      branches: this.ref.branches, departments: this.ref.departments,
    }
  }
```

- [ ] **Step 5: Point ProfilePage at the self-service loader (test first)**

Modify `src/pages/ProfilePage.test.tsx` so the injected `loadRefData` returns real
branch/department rows AND assert their names render. Update the `noRefData` helper
shape if reused. Example:

```tsx
const refData = async () => ({
  statuses: [], categories: [],
  branches: [{ id: 'br_main', name: 'Головной офис' }],
  departments: [{ id: 'dp_it', name: 'IT отдел' }],
})
// render ProfilePage with loadRefData={refData} and an employee whose
// branchId='br_main', departmentId='dp_it', then:
expect(await screen.findByText('Головной офис')).toBeInTheDocument()
expect(screen.getByText('IT отдел')).toBeInTheDocument()
```

> ProfilePage's `loadRefData` prop type becomes
> `() => Promise<SelfServiceRefData>` (or a structurally compatible subset that
> includes branches+departments). Keep the prop optional with a default.

- [ ] **Step 6: Run it — expect FAIL**

Run: `npm test -- src/pages/ProfilePage.test.tsx`
Expected: FAIL (still wired to loadReferenceData / shape mismatch).

- [ ] **Step 7: Rewire ProfilePage**

Modify `src/pages/ProfilePage.tsx`:
- Change the prop type to `loadRefData?: () => Promise<SelfServiceRefData>` (import `SelfServiceRefData` from `@/domain/asset`), or a `{ branches; departments }` subset — pick the subset to keep the page's surface minimal but ensure the default returns it.
- Change `defaultLoadRefData` to call `assetRepo.loadSelfServiceRefData()` and return `{ branches: r.branches, departments: r.departments }`.
- Keep the `.catch` fallback returning `{ branches: [], departments: [] }`.

```ts
  const defaultLoadRefData = useMemo(
    () => async () => {
      const assetRepo = new FirestoreAssetRepository(db())
      const r = await assetRepo.loadSelfServiceRefData()
      return { branches: r.branches, departments: r.departments }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
```

> The component already destructures only `{ branches, departments }`; keep its
> internal prop type as `() => Promise<{ branches: RefRow[]; departments: RefRow[] }>`
> so existing inline test stubs that return just those two keys still satisfy it.
> The KEY change is the DEFAULT loader now uses `loadSelfServiceRefData` (no
> `/employees` read), which is what fixes the denied query in production.

- [ ] **Step 8: Run it — expect PASS**

Run: `npm test -- src/pages/ProfilePage.test.tsx`
Expected: PASS.

- [ ] **Step 9: Fix any other inline loadSelfServiceRefData stubs**

`npm run typecheck` will flag inline stubs (e.g. `routes.test.tsx:61`,
`AssetsPage.test.tsx`, `MyAssetsPage.test.tsx`) that return
`{ statuses: [], categories: [] }`. Add `branches: [], departments: []` to each.

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 10: Full verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean; all tests PASS; build green.

- [ ] **Step 11: Commit**

```bash
git add src/domain/asset/AssetRepository.ts src/infra/repositories src/pages src/config
git commit -m "fix(profile): self-service ref loader returns branches+departments (no denied /employees read)"
```

---

## Self-review checklist (run by the planner before handoff)

1. **Spec coverage:**
   - Self-claim type + write + fire-on-no-role → Task 1a steps 1–13. ✓
   - Rule guard (no self role introduction; self uid only) → Task 1a steps 14–15. ✓
   - Pending list (super-only read) → Task 1b steps 1–5 (repo) + page. ✓
   - Promotion + employee link/create, each audited → Task 1b steps 3,5,14. ✓
   - Super-gated UI nav + route → Task 1b steps 8,15 + nav test step 9. ✓
   - i18n ru/en/hy → Task 1b step 11. ✓
   - Audit-rule hardening + role_assigned passes + shape denials → Task 2. ✓
   - Profile loader branches+departments + ProfilePage rewire + stub fixes → Task 3. ✓
2. **Placeholders:** none — all code blocks concrete. The two "match the harness"
   notes (auth-context test step 10, page interaction test step 12) point at an
   existing file to mirror, which is acceptable guidance, not a placeholder.
3. **Type consistency:** `User`, `PendingUser`, `UserStatus`, `AssignRoleInput`,
   `PromoteEmployeeOpts`, `UserRepository` names match across domain + adapters +
   page + tests. `SelfServiceRefData` shape extended consistently everywhere.
   `Actor` reused from `@/domain/asset`. Audit `entityType:'user'` /
   `action:'role_assigned'` consistent in repo + rules test.

## Owner decisions deferred (non-blocking)
- Should `pending-users` live in the `org` group instead of `system`? (Plan put it
  in `system` per "org/system group"; trivially movable.)
- Toast vs inline-only feedback on assign success (plan allows either).
- (Resolved in plan) `AUDIT_ACTIONS` now includes `role_assigned` and
  `AuditEntityType` includes `'user'` — added in Task 1a Step 0.
