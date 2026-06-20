# Roles & Access Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Super-Admin `/roles` screen — a full user/role roster with per-row "Change role" backed by the EXISTING `UserRepository.assignRole()` (withAudit, action `role_assigned`), with a self-demotion / zero-super-admin lockout guard.

**Architecture:** Extend the existing `UserRepository` port with a `listUsers(query?)` read method (InMemory + Firestore adapters). The role-change write path REUSES `assignRole()` unchanged — including its employee link/create branch. A new `RolesPage` mirrors `PendingUsersPage` patterns (table, dialog, repo injection). The lockout guard lives in the repository (`assignRole`) so it holds regardless of caller. Firestore LIST for super_admin is already permitted by the existing per-doc read rule (`isSuperAdmin()`); we add a rules test to prove it and do NOT loosen reads.

**Tech Stack:** React 19 + Vite + TS (strict), react-i18next (ru/en/hy), repo-factory pattern, `withAudit`, `@firebase/rules-unit-testing`, Vitest.

---

## File Structure

- `src/domain/user/UserRepository.ts` — MODIFY: add `UserListQuery` + `listUsers(query?)` to the port; add `LockoutError`/guard contract note.
- `src/infra/repositories/inMemoryUserRepository.ts` — MODIFY: implement `listUsers`; add lockout guard to `assignRole`.
- `src/infra/repositories/firestoreUserRepository.ts` — MODIFY: implement `listUsers`; add lockout guard to `assignRole`.
- `src/pages/RolesPage.tsx` — CREATE: roster table + filters + search + ChangeRoleDialog.
- `src/pages/index.ts` — MODIFY: export `RolesPage`.
- `src/config/nav.ts` — MODIFY: remove `'roles'` from `PHASE_STUB_ROUTES`.
- `src/config/routes.tsx` — MODIFY: add real `/roles` route, import `RolesPage`.
- `src/locales/{ru,en,hy}/roles.json` — CREATE: namespace strings.
- `src/lib/i18n/index.ts` — MODIFY: register `roles` namespace (3 imports + 3 resource entries + ns array).
- `tests/rules/firestore.rules.test.ts` — MODIFY: add super_admin LIST `/users` test + self-demotion note (rules unchanged).
- Test files (co-located): `src/infra/repositories/userRepository.roles.test.ts`, `src/pages/RolesPage.test.tsx`.

---

## Task 1: Extend the UserRepository port with `listUsers` + lockout contract

**Files:**
- Modify: `src/domain/user/UserRepository.ts`

- [ ] **Step 1: Add the query type, list method, and lockout error to the port**

In `src/domain/user/UserRepository.ts`, add ABOVE `export interface UserRepository`:

```ts
/** Filter for the full-roster read. All fields optional → returns everyone. */
export interface UserListQuery {
  /** Restrict to a single role. Omit for all. `'no-role'` matches role === null. */
  role?: Role | 'no-role'
  status?: import('./types').UserStatus
}

/**
 * Thrown by assignRole when a change would leave the system with zero super_admins
 * or when a super_admin tries to demote their OWN super_admin role (lockout guard).
 * Callers should surface input.lockoutReason to the user, not a generic failure.
 */
export class RoleLockoutError extends Error {
  constructor(public readonly reason: 'self-demotion' | 'last-super-admin') {
    super(`Role change blocked: ${reason}`)
    this.name = 'RoleLockoutError'
  }
}
```

Then inside `export interface UserRepository`, ADD this method (keep `listPendingUsers` and `assignRole` exactly as-is):

```ts
  /** super_admin only — the full user roster, newest first, optionally filtered. */
  listUsers(query?: UserListQuery): Promise<User[]>
```

Update the `assignRole` doc comment to append:
```
   * GUARD: throws RoleLockoutError('self-demotion') if actor demotes their own
   * super_admin role; throws RoleLockoutError('last-super-admin') if the change
   * would drop the super_admin count to zero.
```

- [ ] **Step 2: Verify typecheck still resolves the port (no impl yet → adapters break, expected)**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx tsc --noEmit`
Expected: FAIL — `InMemoryUserRepository`/`FirestoreUserRepository` do not implement `listUsers`. This proves the port changed. (Fixed in Tasks 2–3.)

- [ ] **Step 3: Commit**

```bash
git add src/domain/user/UserRepository.ts
git commit -m "feat(user): add listUsers port + RoleLockoutError contract"
```

---

## Task 2: Implement `listUsers` + lockout guard in InMemoryUserRepository (TDD)

**Files:**
- Modify: `src/infra/repositories/inMemoryUserRepository.ts`
- Test: `src/infra/repositories/userRepository.roles.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/infra/repositories/userRepository.roles.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { InMemoryUserRepository } from './inMemoryUserRepository'
import { RoleLockoutError } from '@/domain/user'
import type { User } from '@/domain/user'
import type { Employee } from '@/domain/employee'

function seed(): User[] {
  return [
    { id: 'su1', email: 'su1@x.io', displayName: 'Super One', role: 'super_admin', status: 'active', createdAt: '2026-01-03T00:00:00.000Z' },
    { id: 'su2', email: 'su2@x.io', displayName: 'Super Two', role: 'super_admin', status: 'active', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'aa1', email: 'aa1@x.io', displayName: 'Asset Admin', role: 'asset_admin', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'np1', email: 'np1@x.io', displayName: 'No Role', role: null, status: 'no-role', createdAt: '2026-01-04T00:00:00.000Z' },
  ]
}
const SUPER = { uid: 'su1', role: 'super_admin' } as const

describe('InMemoryUserRepository.listUsers', () => {
  it('returns all users newest-first', async () => {
    const repo = new InMemoryUserRepository(seed())
    const all = await repo.listUsers()
    expect(all.map(u => u.id)).toEqual(['np1', 'su1', 'su2', 'aa1'])
  })
  it('filters by role', async () => {
    const repo = new InMemoryUserRepository(seed())
    expect((await repo.listUsers({ role: 'super_admin' })).map(u => u.id)).toEqual(['su1', 'su2'])
  })
  it('filters role:no-role (role === null)', async () => {
    const repo = new InMemoryUserRepository(seed())
    expect((await repo.listUsers({ role: 'no-role' })).map(u => u.id)).toEqual(['np1'])
  })
  it('filters by status', async () => {
    const repo = new InMemoryUserRepository(seed())
    expect((await repo.listUsers({ status: 'no-role' })).map(u => u.id)).toEqual(['np1'])
  })
})

describe('InMemoryUserRepository.assignRole lockout guard', () => {
  it('blocks a super_admin demoting THEIR OWN role', async () => {
    const repo = new InMemoryUserRepository(seed())
    await expect(repo.assignRole({ uid: 'su1', role: 'asset_admin' }, SUPER))
      .rejects.toBeInstanceOf(RoleLockoutError)
  })
  it('allows self-change that keeps super_admin (no-op role)', async () => {
    const repo = new InMemoryUserRepository(seed())
    const r = await repo.assignRole({ uid: 'su1', role: 'super_admin' }, SUPER)
    expect(r.value.role).toBe('super_admin')
  })
  it('blocks demoting the LAST super_admin (another actor)', async () => {
    const users: User[] = [
      { id: 'only', email: 'o@x.io', displayName: 'Only Super', role: 'super_admin', status: 'active', createdAt: null },
      { id: 'su1', email: 'su1@x.io', displayName: 'S', role: 'super_admin', status: 'active', createdAt: null },
    ]
    // Demote 'only' while su1 is actor → still one super left → OK
    const repo = new InMemoryUserRepository(users)
    await repo.assignRole({ uid: 'only', role: 'tech_admin' }, SUPER)
    // Now su1 is the last super; demoting su1 (by itself) is self-demotion AND last-super
    await expect(repo.assignRole({ uid: 'su1', role: 'tech_admin' }, SUPER))
      .rejects.toBeInstanceOf(RoleLockoutError)
  })
  it('promoting a non-super to a role still audits (regression)', async () => {
    const employees: Employee[] = []
    const repo = new InMemoryUserRepository(seed(), employees)
    const r = await repo.assignRole({ uid: 'np1', role: 'tech_admin' }, SUPER)
    expect(r.value.role).toBe('tech_admin')
    expect(r.auditId).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npm test -- --run src/infra/repositories/userRepository.roles.test.ts`
Expected: FAIL — `listUsers is not a function` / guard not implemented.

- [ ] **Step 3: Implement `listUsers` + guard**

In `src/infra/repositories/inMemoryUserRepository.ts`:

(a) Update the import line to include the new symbols:
```ts
import type { User, PendingUser, UserRepository, AssignRoleInput, UserListQuery } from '@/domain/user'
import { RoleLockoutError } from '@/domain/user'
```

(b) Add the method right after `listPendingUsers`:
```ts
  async listUsers(query?: UserListQuery): Promise<User[]> {
    let rows = [...this.users]
    if (query?.role === 'no-role') rows = rows.filter(u => u.role === null)
    else if (query?.role) rows = rows.filter(u => u.role === query.role)
    if (query?.status) rows = rows.filter(u => u.status === query.status)
    return rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  /** Count active super_admins, optionally excluding one uid (the one being changed). */
  private countSuperAdmins(exceptUid?: string): number {
    return this.users.filter(u =>
      u.role === 'super_admin' && u.status === 'active' && u.id !== exceptUid,
    ).length
  }
```

(c) At the TOP of `assignRole`, right after computing `before` (after the `if (idx < 0)` throw and `const before = this.users[idx]!`), insert the guard:
```ts
    // ── Lockout guard ──────────────────────────────────────────────────────
    const isDemotingASuper = before.role === 'super_admin' && input.role !== 'super_admin'
    if (isDemotingASuper) {
      if (input.uid === actor.uid) throw new RoleLockoutError('self-demotion')
      // would this drop active super_admins to zero?
      if (this.countSuperAdmins(input.uid) === 0) throw new RoleLockoutError('last-super-admin')
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npm test -- --run src/infra/repositories/userRepository.roles.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/infra/repositories/inMemoryUserRepository.ts src/infra/repositories/userRepository.roles.test.ts
git commit -m "feat(user): InMemory listUsers + assignRole lockout guard"
```

---

## Task 3: Implement `listUsers` + lockout guard in FirestoreUserRepository

**Files:**
- Modify: `src/infra/repositories/firestoreUserRepository.ts`

- [ ] **Step 1: Add `listUsers` and the guard**

(a) Extend imports — add `UserListQuery` to the type import and `RoleLockoutError` to a value import:
```ts
import {
  isUserStatus, type User, type PendingUser, type UserRepository, type AssignRoleInput,
  type UserListQuery,
} from '@/domain/user'
import { RoleLockoutError } from '@/domain/user'
```

(b) Add method after `listPendingUsers`:
```ts
  async listUsers(query?: UserListQuery): Promise<User[]> {
    const constraints = []
    if (query?.role === 'no-role') constraints.push(where('role', '==', null))
    else if (query?.role) constraints.push(where('role', '==', query.role))
    if (query?.status) constraints.push(where('status', '==', query.status))
    const snap = await getDocs(fsQuery(collection(this.db, 'users'), ...constraints))
    return snap.docs
      .map(d => toUser(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  /** Count active super_admins (server read), excluding one uid. */
  private async countSuperAdmins(exceptUid: string): Promise<number> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'users'),
      where('role', '==', 'super_admin'),
      where('status', '==', 'active'),
    ))
    return snap.docs.filter(d => d.id !== exceptUid).length
  }
```

(c) In `assignRole`, after `const before = toUser(...)`, BEFORE the employee-create step, insert:
```ts
    const isDemotingASuper = before.role === 'super_admin' && input.role !== 'super_admin'
    if (isDemotingASuper) {
      if (input.uid === actor.uid) throw new RoleLockoutError('self-demotion')
      if ((await this.countSuperAdmins(input.uid)) === 0) throw new RoleLockoutError('last-super-admin')
    }
```

- [ ] **Step 2: Typecheck**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx tsc --noEmit`
Expected: PASS — both adapters now satisfy the port.

- [ ] **Step 3: Commit**

```bash
git add src/infra/repositories/firestoreUserRepository.ts
git commit -m "feat(user): Firestore listUsers + assignRole lockout guard"
```

---

## Task 4: i18n — roles namespace (ru/en/hy)

**Files:**
- Create: `src/locales/ru/roles.json`, `src/locales/en/roles.json`, `src/locales/hy/roles.json`
- Modify: `src/lib/i18n/index.ts`

- [ ] **Step 1: Create `src/locales/ru/roles.json`**

```json
{
  "title": "Роли и доступ",
  "subtitle": "Управление ролями всех пользователей системы",
  "search": "Поиск по имени или эл. почте",
  "filter": { "role": "Роль", "status": "Статус", "all": "Все" },
  "you": "Это вы",
  "col": { "user": "Пользователь", "email": "Эл. почта", "role": "Роль", "status": "Статус", "actions": "" },
  "role": { "none": "Без роли" },
  "status": { "active": "Активен", "no-role": "Без роли", "terminated": "Уволен" },
  "change": "Изменить роль",
  "empty": { "title": "Пользователи не найдены", "desc": "Измените фильтры или поиск" },
  "dialog": {
    "title": "Изменить роль",
    "role": "Новая роль",
    "confirm": "Изменение роли откроет или закроет доступ к разделам. Подтвердите.",
    "submit": "Изменить",
    "cancel": "Отмена",
    "employeeMode": "Запись сотрудника",
    "link": "Связать существующую",
    "create": "Создать новую",
    "firstName": "Имя",
    "lastName": "Фамилия",
    "emailRequired": "У пользователя нет эл. почты — выберите «Связать существующую»"
  },
  "guard": {
    "self-demotion": "Нельзя снять с себя роль Супер Админа",
    "last-super-admin": "Нельзя оставить систему без Супер Админа"
  },
  "toast": { "changed": "Роль изменена", "failed": "Не удалось изменить роль" }
}
```

- [ ] **Step 2: Create `src/locales/en/roles.json`**

```json
{
  "title": "Roles & Access",
  "subtitle": "Manage roles for all system users",
  "search": "Search by name or email",
  "filter": { "role": "Role", "status": "Status", "all": "All" },
  "you": "This is you",
  "col": { "user": "User", "email": "Email", "role": "Role", "status": "Status", "actions": "" },
  "role": { "none": "No role" },
  "status": { "active": "Active", "no-role": "No role", "terminated": "Terminated" },
  "change": "Change role",
  "empty": { "title": "No users found", "desc": "Adjust filters or search" },
  "dialog": {
    "title": "Change role",
    "role": "New role",
    "confirm": "Changing a role grants or revokes access to sections. Please confirm.",
    "submit": "Change",
    "cancel": "Cancel",
    "employeeMode": "Employee record",
    "link": "Link existing",
    "create": "Create new",
    "firstName": "First name",
    "lastName": "Last name",
    "emailRequired": "This user has no email — choose \"Link existing\""
  },
  "guard": {
    "self-demotion": "You cannot remove your own Super Admin role",
    "last-super-admin": "The system cannot be left without a Super Admin"
  },
  "toast": { "changed": "Role changed", "failed": "Failed to change role" }
}
```

- [ ] **Step 3: Create `src/locales/hy/roles.json`**

```json
{
  "title": "Դերեր և մուտք",
  "subtitle": "Կառավարեք համակարգի բոլոր օգտատերերի դերերը",
  "search": "Որոնել ըստ անվան կամ էլ․ փոստի",
  "filter": { "role": "Դեր", "status": "Կարգավիճակ", "all": "Բոլորը" },
  "you": "Սա դուք եք",
  "col": { "user": "Օգտատեր", "email": "Էլ․ փոստ", "role": "Դեր", "status": "Կարգավիճակ", "actions": "" },
  "role": { "none": "Առանց դերի" },
  "status": { "active": "Ակտիվ", "no-role": "Առանց դերի", "terminated": "Ազատված" },
  "change": "Փոխել դերը",
  "empty": { "title": "Օգտատերեր չեն գտնվել", "desc": "Փոխեք զտիչները կամ որոնումը" },
  "dialog": {
    "title": "Փոխել դերը",
    "role": "Նոր դեր",
    "confirm": "Դերի փոփոխությունը բացում կամ փակում է բաժինների մուտքը։ Հաստատեք։",
    "submit": "Փոխել",
    "cancel": "Չեղարկել",
    "employeeMode": "Աշխատակցի գրառում",
    "link": "Կապել գոյություն ունեցողը",
    "create": "Ստեղծել նոր",
    "firstName": "Անուն",
    "lastName": "Ազգանուն",
    "emailRequired": "Այս օգտատերը էլ․ փոստ չունի — ընտրեք «Կապել գոյություն ունեցողը»"
  },
  "guard": {
    "self-demotion": "Չեք կարող հեռացնել ձեր սեփական Սուպեր Ադմին դերը",
    "last-super-admin": "Համակարգը չի կարող մնալ առանց Սուպեր Ադմինի"
  },
  "toast": { "changed": "Դերը փոխվեց", "failed": "Չհաջողվեց փոխել դերը" }
}
```

- [ ] **Step 4: Register the namespace in `src/lib/i18n/index.ts`**

Add three imports next to the existing `*PendingUsers` imports:
```ts
import ruRoles from '@/locales/ru/roles.json'
import enRoles from '@/locales/en/roles.json'
import hyRoles from '@/locales/hy/roles.json'
```
Add `roles: ruRoles` / `roles: enRoles` / `roles: hyRoles` into the respective `ru`/`en`/`hy` resource objects, and add `'roles'` to the `ns: [...]` array.

- [ ] **Step 5: Add an i18n resolution test (mirror existing)**

In `src/lib/i18n/i18n.test.ts`, add inside the existing namespace block (follow the `licenses` example):
```ts
  it('resolves roles namespace title in ru', async () => {
    await i18n.changeLanguage('ru')
    expect(i18n.t('title', { ns: 'roles' })).toBe('Роли и доступ')
  })
```

- [ ] **Step 6: Run i18n tests**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npm test -- --run src/lib/i18n/i18n.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/locales/ru/roles.json src/locales/en/roles.json src/locales/hy/roles.json src/lib/i18n/index.ts src/lib/i18n/i18n.test.ts
git commit -m "feat(i18n): roles namespace (ru/en/hy)"
```

---

## Task 5: Build the RolesPage (component + tests)

**Files:**
- Create: `src/pages/RolesPage.tsx`
- Test: `src/pages/RolesPage.test.tsx`
- Modify: `src/pages/index.ts`

- [ ] **Step 1: Write the failing component test**

Create `src/pages/RolesPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { RolesPage } from './RolesPage'
import { InMemoryUserRepository } from '@/infra/repositories'
import type { User } from '@/domain/user'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'su1' }, role: 'super_admin' }),
}))

function makeRepo() {
  const users: User[] = [
    { id: 'su1', email: 'su1@x.io', displayName: 'Super One', role: 'super_admin', status: 'active', createdAt: '2026-01-03T00:00:00.000Z' },
    { id: 'aa1', email: 'aa1@x.io', displayName: 'Asset Admin', role: 'asset_admin', status: 'active', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'np1', email: 'np1@x.io', displayName: 'No Role', role: null, status: 'no-role', createdAt: '2026-01-04T00:00:00.000Z' },
  ]
  return new InMemoryUserRepository(users)
}

describe('RolesPage', () => {
  it('renders the roster after load', async () => {
    render(<RolesPage repository={makeRepo()} />)
    expect(await screen.findByText('Super One')).toBeInTheDocument()
    expect(screen.getByText('Asset Admin')).toBeInTheDocument()
    expect(screen.getByText('No Role')).toBeInTheDocument()
  })

  it('marks the current user row as "you"', async () => {
    render(<RolesPage repository={makeRepo()} />)
    await screen.findByText('Super One')
    expect(screen.getByText('Это вы')).toBeInTheDocument()
  })

  it('filters by search', async () => {
    render(<RolesPage repository={makeRepo()} />)
    await screen.findByText('Super One')
    fireEvent.change(screen.getByPlaceholderText('Поиск по имени или эл. почте'), { target: { value: 'asset' } })
    expect(screen.getByText('Asset Admin')).toBeInTheDocument()
    expect(screen.queryByText('Super One')).not.toBeInTheDocument()
  })

  it('blocks self-demotion with the guard message', async () => {
    render(<RolesPage repository={makeRepo()} />)
    await screen.findByText('Super One')
    // open the dialog on the current user's own row
    const row = screen.getByText('Super One').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: /Изменить роль/ }))
    // pick asset_admin then confirm
    fireEvent.change(await screen.findByLabelText('Новая роль'), { target: { value: 'asset_admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    expect(await screen.findByText('Нельзя снять с себя роль Супер Админа')).toBeInTheDocument()
  })

  it('changes a non-super role successfully', async () => {
    const repo = makeRepo()
    const spy = vi.spyOn(repo, 'assignRole')
    render(<RolesPage repository={repo} />)
    await screen.findByText('Asset Admin')
    const row = screen.getByText('Asset Admin').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: /Изменить роль/ }))
    fireEvent.change(await screen.findByLabelText('Новая роль'), { target: { value: 'tech_admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'aa1', role: 'tech_admin' }),
      expect.objectContaining({ uid: 'su1', role: 'super_admin' }),
    ))
  })
})
```

- [ ] **Step 2: Run it — verify it fails**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npm test -- --run src/pages/RolesPage.test.tsx`
Expected: FAIL — `RolesPage` does not exist.

- [ ] **Step 3: Implement `src/pages/RolesPage.tsx`**

Mirror `PendingUsersPage` structure (repo injection, `useAuth`, table, dialog) plus filters/search and the lockout-aware dialog. Full file:

```tsx
import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState, Field, Select, Input,
} from '@/components/ui'
import type { User, UserRepository, AssignRoleInput, UserListQuery } from '@/domain/user'
import { RoleLockoutError } from '@/domain/user'
import type { Role } from '@/config/roles'
import { ROLE_IDS } from '@/config/roles'
import { createDefaultUserRepository } from '@/infra/repositories'

export interface RolesPageProps { repository?: UserRepository }

// ─── Change-role dialog ────────────────────────────────────────────────────────
interface ChangeDialogProps {
  target: User
  isSelf: boolean
  onClose: () => void
  onChanged: (u: User) => void
  repo: UserRepository
  actor: { uid: string; role: Role }
}

function ChangeRoleDialog({ target, isSelf, onClose, onChanged, repo, actor }: ChangeDialogProps) {
  const { t } = useTranslation('roles')
  const { t: tNav } = useTranslation('nav')
  const [selectedRole, setSelectedRole] = useState<Role | ''>(target.role ?? '')
  const [empMode, setEmpMode] = useState<'link' | 'create'>('link')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roleOptions = ROLE_IDS.map(id => ({ value: id, label: tNav(`roles.${id}`) }))
  const emailMissing = selectedRole === 'employee' && empMode === 'create' && !target.email?.trim()
  const unchanged = selectedRole === (target.role ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRole || unchanged) return
    setSubmitting(true)
    setError(null)
    try {
      const input: AssignRoleInput = { uid: target.id, role: selectedRole }
      if (selectedRole === 'employee') {
        input.employee = empMode === 'create'
          ? { mode: 'create', create: { firstName, lastName, email: target.email } }
          : { mode: 'link' }
      }
      const r = await repo.assignRole(input, actor)
      onChanged(r.value)
    } catch (err) {
      if (err instanceof RoleLockoutError) setError(t(`guard.${err.reason}`))
      else setError(t('toast.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="change-role-title"
        className="w-full max-w-md bg-[#1B1F24] border border-[#2A2F36] rounded-xl shadow-2xl p-6 space-y-5 mx-4"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 id="change-role-title" className="text-[15px] font-bold text-[#F8FAFC]">{t('dialog.title')}</h2>
          <button type="button" aria-label={t('dialog.cancel')} onClick={onClose}
            className="text-[#64748B] hover:text-[#F8FAFC] transition-colors">
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="flex items-center gap-3 px-3 py-2.5 bg-[#111315] rounded-lg border border-[#2A2F36]">
          <Icon name="user" size={16} className="text-[#64748B] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#F8FAFC] truncate">{target.displayName || target.email}</p>
            <p className="text-[11.5px] text-[#64748B] truncate">{target.email}</p>
          </div>
          {isSelf && <span className="ml-auto text-[11px] text-[#F97316]">{t('you')}</span>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="change-role-select"
              className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
              {t('dialog.role')}
            </label>
            <Select id="change-role-select" value={selectedRole}
              onChange={(v) => setSelectedRole(v as Role)} options={roleOptions}
              placeholder={t('dialog.role')} />
          </div>

          {selectedRole === 'employee' && (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('dialog.employeeMode')}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEmpMode('link')}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'link' ? 'bg-[#F97316]/10 border-[#F97316] text-[#F97316]'
                      : 'bg-[#111315] border-[#2A2F36] text-[#94A3B8] hover:border-[#3A4048]'}`}>
                  {t('dialog.link')}
                </button>
                <button type="button" onClick={() => setEmpMode('create')}
                  className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                    empMode === 'create' ? 'bg-[#F97316]/10 border-[#F97316] text-[#F97316]'
                      : 'bg-[#111315] border-[#2A2F36] text-[#94A3B8] hover:border-[#3A4048]'}`}>
                  {t('dialog.create')}
                </button>
              </div>
              {empMode === 'create' && (
                <div className="space-y-3">
                  <Field label={t('dialog.firstName')} required>
                    <Input id="change-first-name" value={firstName} onChange={setFirstName} placeholder={t('dialog.firstName')} />
                  </Field>
                  <Field label={t('dialog.lastName')} required>
                    <Input id="change-last-name" value={lastName} onChange={setLastName} placeholder={t('dialog.lastName')} />
                  </Field>
                  {emailMissing && <p role="alert" className="text-[12px] text-amber-400">{t('dialog.emailRequired')}</p>}
                </div>
              )}
            </div>
          )}

          <p className="text-[12px] text-[#94A3B8]">{t('dialog.confirm')}</p>
          {error && <p role="alert" className="text-[12.5px] text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={onClose} disabled={submitting}>{t('dialog.cancel')}</Btn>
            <Btn type="submit" variant="primary" disabled={!selectedRole || unchanged || submitting || emailMissing}>
              {t('dialog.submit')}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function RolesPage({ repository }: RolesPageProps) {
  const { t } = useTranslation('roles')
  const { t: tNav } = useTranslation('nav')
  const { user, role } = useAuth()

  const defaultRepo = useMemo<UserRepository>(
    () => createDefaultUserRepository(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<Role | 'no-role' | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'no-role' | 'terminated'>('all')
  const [search, setSearch] = useState('')
  const [dialogUser, setDialogUser] = useState<User | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const q: UserListQuery = {}
      const all = await repo.listUsers(q)
      setUsers(all)
    } catch { setError(t('toast.failed')) }
    finally { setLoading(false) }
  }, [repo, t])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return users.filter(u => {
      if (roleFilter === 'no-role' && u.role !== null) return false
      if (roleFilter !== 'all' && roleFilter !== 'no-role' && u.role !== roleFilter) return false
      if (statusFilter !== 'all' && u.status !== statusFilter) return false
      if (s && !(`${u.displayName} ${u.email}`.toLowerCase().includes(s))) return false
      return true
    })
  }, [users, roleFilter, statusFilter, search])

  function handleChanged(updated: User) {
    setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))
    setDialogUser(null)
  }

  const roleFilterOptions = [
    { value: 'all', label: t('filter.all') },
    ...ROLE_IDS.map(id => ({ value: id, label: tNav(`roles.${id}`) })),
    { value: 'no-role', label: t('role.none') },
  ]
  const statusFilterOptions = [
    { value: 'all', label: t('filter.all') },
    { value: 'active', label: t('status.active') },
    { value: 'no-role', label: t('status.no-role') },
    { value: 'terminated', label: t('status.terminated') },
  ]

  function roleLabel(r: Role | null): string { return r ? tNav(`roles.${r}`) : t('role.none') }

  function renderBody() {
    if (loading) return <LoadingState rows={6} />
    if (error) return <ErrorState onRetry={load} />
    if (filtered.length === 0) return <EmptyState icon="shield-check" title={t('empty.title')} description={t('empty.desc')} />
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2F36]">
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('col.user')}</th>
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('col.email')}</th>
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('col.role')}</th>
              <th className="text-left py-2.5 px-3 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('col.status')}</th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const isSelf = u.id === user.id
              return (
                <tr key={u.id} className={`border-b border-[#2A2F36] last:border-0 transition-colors ${isSelf ? 'bg-[#F97316]/5' : 'hover:bg-[#22272E]'}`}>
                  <td className="py-3 px-3">
                    <span className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-[#22272E] border border-[#2A2F36] text-[#64748B] inline-flex items-center justify-center flex-shrink-0">
                        <Icon name="user" size={13} />
                      </span>
                      <span className="text-[13px] font-medium text-[#F8FAFC] truncate max-w-[160px]">{u.displayName || u.email}</span>
                      {isSelf && <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#F97316]/15 text-[#F97316] flex-shrink-0">{t('you')}</span>}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[13px] text-[#94A3B8]">{u.email}</td>
                  <td className="py-3 px-3 text-[13px] text-[#F8FAFC]">{roleLabel(u.role)}</td>
                  <td className="py-3 px-3 text-[13px] text-[#94A3B8]">{t(`status.${u.status}`)}</td>
                  <td className="py-3 px-3 text-right">
                    <Btn size="sm" variant="secondary" onClick={() => setDialogUser(u)}>
                      <Icon name="shield-check" size={13} />
                      {t('change')}
                    </Btn>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="shield-check" title={t('title')} description={t('subtitle')}
        {...(!loading ? { count: filtered.length } : {})} />

      <SectionCard noHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <Input id="roles-search" value={search} onChange={setSearch} placeholder={t('search')} />
            </div>
            <div className="w-[160px]">
              <Select id="roles-role-filter" value={roleFilter}
                onChange={(v) => setRoleFilter(v as Role | 'no-role' | 'all')} options={roleFilterOptions} />
            </div>
            <div className="w-[160px]">
              <Select id="roles-status-filter" value={statusFilter}
                onChange={(v) => setStatusFilter(v as 'all' | 'active' | 'no-role' | 'terminated')} options={statusFilterOptions} />
            </div>
          </div>
          {renderBody()}
        </div>
      </SectionCard>

      {dialogUser && (
        <ChangeRoleDialog
          target={dialogUser}
          isSelf={dialogUser.id === user.id}
          onClose={() => setDialogUser(null)}
          onChanged={handleChanged}
          repo={repo}
          actor={{ uid: user.id, role }}
        />
      )}
    </div>
  )
}
```

NOTE for implementer: confirm `Input`/`Select` prop signatures against `src/components/ui` (PendingUsersPage uses `Input value onChange placeholder` where `onChange` receives the string value, and `Select value onChange options placeholder`). Adjust if the local primitives differ. Use `getByLabelText('Новая роль')` requires the Select to associate its label via `id`/`htmlFor` — the dialog wires `htmlFor="change-role-select"`; verify the `Select` renders a native `<select id>` so `getByLabelText` resolves. If the shared `Select` is a custom combobox, switch the test to `getByRole('combobox')` or open-and-click the option instead.

- [ ] **Step 4: Export from pages index**

In `src/pages/index.ts` add (alphabetically near the others): `export * from './RolesPage'`

- [ ] **Step 5: Run the component tests**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npm test -- --run src/pages/RolesPage.test.tsx`
Expected: PASS. If `getByLabelText` fails due to the Select primitive, apply the NOTE adjustment and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/pages/RolesPage.tsx src/pages/RolesPage.test.tsx src/pages/index.ts
git commit -m "feat(roles): RolesPage roster + change-role dialog with lockout guard"
```

---

## Task 6: Wire the route (un-stub /roles)

**Files:**
- Modify: `src/config/nav.ts` (remove `'roles'` from `PHASE_STUB_ROUTES`)
- Modify: `src/config/routes.tsx` (import `RolesPage`, add real route)

- [ ] **Step 1: Un-stub in nav.ts**

In `src/config/nav.ts`, change `PHASE_STUB_ROUTES` to:
```ts
export const PHASE_STUB_ROUTES: RouteId[] = [
  'assignments', 'repairs', 'parts',
]
```
(The `roles` nav item stays in `ADMIN_NAV` catalogs group, allow `['super_admin']` — already present.)

- [ ] **Step 2: Add the route in routes.tsx**

Add `RolesPage` to the `@/pages` import list, and add a route alongside `/statuses`:
```tsx
          <Route path="/roles" element={
            <RoleGate roles={routeRoles('roles')}><RolesPage /></RoleGate>
          } />
```

- [ ] **Step 3: Typecheck + full test run**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx tsc --noEmit && npm test -- --run`
Expected: typecheck PASS; all tests PASS (≥ 784 + new).

- [ ] **Step 4: Commit**

```bash
git add src/config/nav.ts src/config/routes.tsx
git commit -m "feat(roles): wire /roles route, un-stub from PHASE_STUB_ROUTES"
```

---

## Task 7: Rules test — prove super_admin can LIST /users; non-super cannot

**Files:**
- Modify: `tests/rules/firestore.rules.test.ts`

- [ ] **Step 1: Add LIST tests in the `describe('users', ...)` block**

```ts
  it('super_admin CAN list the whole users collection', async () => {
    await assertSucceeds(getDocs(query(collection(authedDb(env, SUPER), 'users'))))
  })
  it('a non-super user CANNOT list the whole users collection', async () => {
    await assertFails(getDocs(query(collection(authedDb(env, EMP), 'users'))))
  })
  it('super_admin CAN list users filtered by role', async () => {
    await assertSucceeds(getDocs(query(
      collection(authedDb(env, SUPER), 'users'), where('role', '==', 'super_admin'),
    )))
  })
```

Ensure the test file imports `getDocs`, `collection`, `query`, `where` from `firebase/firestore` (add any missing to the existing import). The harness already exposes `assertSucceeds`/`assertFails`/`authedDb`/`env`/`SUPER`/`EMP`.

- [ ] **Step 2: Note on rules (no change required)**

The existing `/users` read rule `allow read: if isSignedIn() && (request.auth.uid == uid || isSuperAdmin())` permits a super_admin LIST because `isSuperAdmin()` is uid-independent and evaluated per matched doc. Do NOT loosen reads for other roles. If CI's rules runner (Java) is unavailable locally, the test is authored for CI; mark it as authored in the report.

- [ ] **Step 3: Run (if Java available) or stage for CI**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npm test -- --run tests/rules/firestore.rules.test.ts` (skips/fails gracefully if emulator/Java missing — report which).

- [ ] **Step 4: Commit**

```bash
git add tests/rules/firestore.rules.test.ts
git commit -m "test(rules): super_admin can LIST /users; non-super denied"
```

---

## Task 8: Final verification

- [ ] **Step 1: Typecheck**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx tsc --noEmit` → Expected: PASS

- [ ] **Step 2: Full test suite**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npm test -- --run` → Expected: all PASS, count ≥ baseline 784 + new tests.

- [ ] **Step 3: Build**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npm run build` → Expected: green, no new warnings.

- [ ] **Step 4: Report** — built artifacts, fresh evidence (typecheck + test count + build), gate confirmations, owner decisions, next plan.

---

## Owner decisions (non-blocking, implemented as secure defaults; flag in report)

1. **Self-demotion guard:** HARD BLOCK (throw `RoleLockoutError('self-demotion')`) — a super_admin cannot remove their own super_admin role via this UI. Rationale: simplest lockout-proof default. Owner may later relax to "warn + allow if other supers exist."
2. **Last-super-admin guard:** HARD BLOCK demoting the final active super_admin (any actor). Belt-and-braces alongside #1.
3. **Guard location:** repository layer (`assignRole`), so it holds for InMemory + Firestore + any future caller. NOT a Firestore rule (rules can't cheaply count remaining supers). Flag: a determined super_admin could still bypass via raw SDK/console — acceptable for MVP; document as a known limitation.
4. **Roster read:** client-side filter for search; role/status filters could be pushed to `listUsers(query)` server-side later. MVP loads all then filters in-memory (user counts ~ hundreds).
5. **No rules change for LIST** — current read rule already supports super_admin LIST; only a test was added.

## Self-review

- Spec coverage: roster table (Task 5) ✓, filter by role+status (Task 5) ✓, search (Task 5) ✓, change-role per row → confirm → assignRole withAudit (Task 5 reuses port) ✓, employee link/create reuse (Task 5 reuses `assignRole`'s branch, no duplication) ✓, empty/loading/error (Task 5) ✓, i18n ru/en/hy (Task 4) ✓, route un-stub + nav (Task 6) ✓, self-demotion guard (Tasks 2/3/5) ✓, mark own row (Task 5) ✓, super LIST read verified (Task 7) ✓, InMemory verification + tests (Tasks 2/5) ✓, additive/green (Task 8) ✓.
- Type consistency: `listUsers(query?: UserListQuery)`, `RoleLockoutError(reason)`, `assignRole(input, actor)` consistent across port + both adapters + page + tests.
- No placeholders: all code shown inline.
