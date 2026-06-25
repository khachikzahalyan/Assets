# Former Employees Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move terminated employees out of `employees` into a `former_employees` archive collection (gone from the Employees list) while preserving all history and live name-resolution everywhere; fold in self-lockout guards.

**Architecture:** Move-based termination — `archiveEmployee` atomically deletes `employees/{id}` + creates `former_employees/{id}` (one audit row); `restoreEmployee` is the inverse. Name resolution stays correct because `AssetRepository.fetchReferenceData()` reads `employees ∪ former_employees` into `ref.employees` (the only set the history/card components read). Pickers stay active-only because they source from the page's own active set, never `ref.employees`.

**Tech Stack:** React 19 + Vite + TypeScript (strict) + Firebase (Firestore modular v9+), Vitest, `@firebase/rules-unit-testing`, i18next (ru/en/hy).

**GIT DISCIPLINE (all tasks):** Stay on `refactor/pages-structure`. NEVER `git add -A`/`git add .`. Stage ONLY the files the task names, file-by-file. Run `git status` before each commit and confirm no foreign files are staged. Do NOT merge.

---

### Task 1: Domain — repository interface (move-based API)

**Files:**
- Modify: `src/domain/employee/EmployeeRepository.ts`

- [ ] **Step 1: Replace `setStatus` with the move-based API.** In `EmployeeRepository`, delete the `setStatus` method line and add:

```ts
export interface EmployeeRepository {
  listEmployees(query?: EmployeeListQuery): Promise<Employee[]>
  /** Read the archive set (former_employees). */
  listFormerEmployees(query?: EmployeeListQuery): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee | null>
  isEmailTaken(email: string, exceptId?: string): Promise<boolean>
  createEmployee(input: CreateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  updateEmployee(id: string, patch: UpdateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  /** Move active → former (terminate). Atomic. Audits 'terminated'.
   *  Throws EmployeeArchiveError on self-archive or last-super-admin. */
  archiveEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>>
  /** Move former → active (reactivate). Atomic. Audits 'reactivated'. */
  restoreEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>>
}
```

Keep `EmployeeArchiveError` and `LastSuperAdminCheck` exactly as they are (lines 1–18).

- [ ] **Step 2: Typecheck the domain file.**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "EmployeeRepository|domain/employee" | head`
Expected: errors only at call sites (firestore/inMemory/page) that still reference `setStatus` — those are fixed in later tasks. The interface file itself has no errors.

- [ ] **Step 3: Commit.**

```bash
git add src/domain/employee/EmployeeRepository.ts
git status   # confirm ONLY this file staged
git commit -m "feat(employees): move-based archive/restore repository API"
```

---

### Task 2: InMemory repo — archive/restore + listFormerEmployees (TDD)

**Files:**
- Modify: `src/infra/repositories/inMemoryEmployeeRepository.ts`
- Test: `src/infra/repositories/inMemoryEmployeeRepository.test.ts`

The inMemory repo currently holds a single `employees: Employee[]`. Add a parallel `former: Employee[]` array (constructor arg, default `[]`). Archive splices from `employees` → `former`; restore splices back.

- [ ] **Step 1: Write failing tests.** Append to `inMemoryEmployeeRepository.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { InMemoryEmployeeRepository } from './inMemoryEmployeeRepository'
import { EmployeeArchiveError } from '@/domain/employee'
import type { Employee } from '@/domain/employee'
import type { Actor } from '@/domain/asset'

const ACTOR: Actor = { uid: 'admin1', role: 'super_admin' }
function emp(id: string, over: Partial<Employee> = {}): Employee {
  return {
    id, firstName: 'Иван', lastName: 'Петров', email: `${id}@x.am`,
    phone: null, position: null, branchId: null, departmentId: null,
    status: 'active', terminatedAt: null,
    createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('InMemoryEmployeeRepository archive/restore (move)', () => {
  it('archive MOVES the doc out of employees into former', async () => {
    const active = [emp('e1'), emp('e2')]
    const former: Employee[] = []
    const repo = new InMemoryEmployeeRepository(active, former)
    await repo.archiveEmployee('e1', ACTOR)
    expect((await repo.listEmployees()).map(e => e.id)).toEqual(['e2'])
    const formerList = await repo.listFormerEmployees()
    expect(formerList.map(e => e.id)).toEqual(['e1'])
    expect(formerList[0]!.status).toBe('terminated')
    expect(formerList[0]!.terminatedAt).not.toBeNull()
    expect(formerList[0]!.createdAt).toBe('2020-01-01T00:00:00.000Z') // preserved
  })

  it('restore MOVES the doc back into employees', async () => {
    const active: Employee[] = []
    const former = [emp('e1', { status: 'terminated', terminatedAt: '2021-01-01T00:00:00.000Z' })]
    const repo = new InMemoryEmployeeRepository(active, former)
    await repo.restoreEmployee('e1', ACTOR)
    expect((await repo.listEmployees()).map(e => e.id)).toEqual(['e1'])
    expect(await repo.listFormerEmployees()).toEqual([])
    expect((await repo.listEmployees())[0]!.status).toBe('active')
    expect((await repo.listEmployees())[0]!.terminatedAt).toBeNull()
  })

  it('archiving a DIFFERENT employee works', async () => {
    const repo = new InMemoryEmployeeRepository([emp('e1'), emp('e2')], [])
    await repo.archiveEmployee('e2', ACTOR)
    expect((await repo.listEmployees()).map(e => e.id)).toEqual(['e1'])
  })

  it('rejects self-archive', async () => {
    const repo = new InMemoryEmployeeRepository([emp('admin1')], [])
    await expect(repo.archiveEmployee('admin1', ACTOR)).rejects.toBeInstanceOf(EmployeeArchiveError)
    expect((await repo.listEmployees()).map(e => e.id)).toEqual(['admin1']) // not moved
  })

  it('rejects last super_admin via injected check', async () => {
    const repo = new InMemoryEmployeeRepository(
      [emp('e1')], [], undefined, async () => true,
    )
    await expect(repo.archiveEmployee('e1', ACTOR)).rejects.toBeInstanceOf(EmployeeArchiveError)
  })
})
```

- [ ] **Step 2: Run — verify FAIL.**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx vitest run src/infra/repositories/inMemoryEmployeeRepository.test.ts`
Expected: FAIL — `archiveEmployee`/`restoreEmployee`/`listFormerEmployees` not a function; constructor arity.

- [ ] **Step 3: Implement.** In `inMemoryEmployeeRepository.ts`:
  - Add a 2nd constructor param `private readonly former: Employee[] = []` BEFORE the `audit` param (constructor becomes `(employees, former = [], audit = ..., lastSuperAdminCheck?)`). Note: this reorders args — Task 5 page wiring and any test that constructs it must pass `former` second.
  - Add `listFormerEmployees` mirroring `listEmployees` but filtering `this.former`.
  - Delete `setStatus`. Add `archiveEmployee` and `restoreEmployee`:

```ts
  async listFormerEmployees(query: EmployeeListQuery = {}): Promise<Employee[]> {
    const search = (query.search ?? '').trim().toLowerCase()
    return this.former.filter(e => {
      if (query.branchId && query.branchId !== 'all' && e.branchId !== query.branchId) return false
      if (query.departmentId && query.departmentId !== 'all' && e.departmentId !== query.departmentId) return false
      if (search) {
        const hay = [fullName(e), e.email, e.position].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
  }

  async archiveEmployee(id: string, actor: Actor) {
    const idx = this.employees.findIndex(e => e.id === id)
    if (idx < 0) throw new Error(`Employee not found: ${id}`)
    if (id === actor.uid) throw new EmployeeArchiveError('self-archive')
    if (this.lastSuperAdminCheck && await this.lastSuperAdminCheck(id)) {
      throw new EmployeeArchiveError('last-super-admin')
    }
    const before = this.employees[idx]!
    const now = new Date().toISOString()
    const archived: Employee = { ...before, status: 'terminated', terminatedAt: now, updatedAt: now }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'terminated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { status: before.status }, after: { status: 'terminated' },
      },
      async () => {
        this.employees.splice(idx, 1)
        this.former.push(archived)
        return { value: archived }
      },
    )
  }

  async restoreEmployee(id: string, actor: Actor) {
    const idx = this.former.findIndex(e => e.id === id)
    if (idx < 0) throw new Error(`Former employee not found: ${id}`)
    const before = this.former[idx]!
    const now = new Date().toISOString()
    const restored: Employee = { ...before, status: 'active', terminatedAt: null, updatedAt: now }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'reactivated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { status: 'terminated' }, after: { status: 'active' },
      },
      async () => {
        this.former.splice(idx, 1)
        this.employees.push(restored)
        return { value: restored }
      },
    )
  }
```

  Keep the `EmployeeArchiveError` import (already present, line 6). The `lastSuperAdminCheck` field stays as the LAST constructor param.

- [ ] **Step 4: Run — verify PASS (and the existing tests in that file still pass).**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx vitest run src/infra/repositories/inMemoryEmployeeRepository.test.ts`
Expected: PASS. If pre-existing tests referenced `setStatus` or 2-arg constructor, update them to the new API (`archiveEmployee`/`restoreEmployee`, `former` as 2nd arg).

- [ ] **Step 5: Commit.**

```bash
git add src/infra/repositories/inMemoryEmployeeRepository.test.ts src/infra/repositories/inMemoryEmployeeRepository.ts
git status
git commit -m "feat(employees): inMemory archive/restore move + listFormerEmployees"
```

---

### Task 3: Firestore repo — atomic move + guard wiring

**Files:**
- Modify: `src/infra/repositories/firestoreEmployeeRepository.ts`

The firestore impl must do delete+create+audit in ONE transaction. `withAudit` already runs inside a Firestore transaction (the `txn` passed to the callback). Use `txn.delete` on the old ref and `txn.set` on the new ref inside the same `withAudit` callback. The repo gets an optional `LastSuperAdminCheck` constructor arg.

- [ ] **Step 1: Add constructor + listFormerEmployees + archive + restore.** Edit `firestoreEmployeeRepository.ts`:
  - Import: add `import type { LastSuperAdminCheck } from '@/domain/employee'` and `import { EmployeeArchiveError } from '@/domain/employee'` and add `deleteDoc` is NOT needed (use `txn.delete`). Ensure `Transaction` already imported (it is).
  - Constructor: `constructor(private readonly db: Firestore, private readonly lastSuperAdminCheck?: LastSuperAdminCheck) {}`
  - Add after `listEmployees`:

```ts
  async listFormerEmployees(query: EmployeeListQuery = {}): Promise<Employee[]> {
    const snap = await getDocs(collection(this.db, 'former_employees'))
    let rows = snap.docs.map(d => toEmployee(d.id, d.data() as Record<string, unknown>))
    if (query.branchId && query.branchId !== 'all') rows = rows.filter(e => e.branchId === query.branchId)
    if (query.departmentId && query.departmentId !== 'all') rows = rows.filter(e => e.departmentId === query.departmentId)
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(e =>
        [fullName(e), e.email, e.position].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
    }
    return rows.sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'))
  }
```

  - Delete `setStatus`. Add:

```ts
  async archiveEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>> {
    const before = await this.getEmployee(id)
    if (!before) throw new Error(`Employee not found: ${id}`)
    if (id === actor.uid) throw new EmployeeArchiveError('self-archive')
    if (this.lastSuperAdminCheck && await this.lastSuperAdminCheck(id)) {
      throw new EmployeeArchiveError('last-super-admin')
    }
    const oldRef = doc(this.db, 'employees', id)
    const newRef = doc(this.db, 'former_employees', id)
    const archived: Record<string, unknown> = {
      firstName: before.firstName, lastName: before.lastName, email: before.email,
      phone: before.phone, position: before.position,
      branchId: before.branchId, departmentId: before.departmentId,
      status: 'terminated',
      terminatedAt: serverTimestamp(), terminatedBy: actor.uid,
      createdAt: before.createdAt, createdBy: actor.uid, // createdAt preserved (ISO string)
      updatedBy: actor.uid, updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'terminated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { status: before.status }, after: { status: 'terminated' },
      },
      async (txn) => {
        const t = txn as unknown as Transaction
        t.set(newRef, archived)
        t.delete(oldRef)
        return { value: undefined as unknown as void }
      },
    )
    return { value: { ...before, status: 'terminated', terminatedAt: new Date().toISOString() }, auditId: r.auditId }
  }

  async restoreEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>> {
    const snap = await getDoc(doc(this.db, 'former_employees', id))
    if (!snap.exists()) throw new Error(`Former employee not found: ${id}`)
    const before = toEmployee(snap.id, snap.data() as Record<string, unknown>)
    const oldRef = doc(this.db, 'former_employees', id)
    const newRef = doc(this.db, 'employees', id)
    const restored: Record<string, unknown> = {
      firstName: before.firstName, lastName: before.lastName, email: before.email,
      phone: before.phone, position: before.position,
      branchId: before.branchId, departmentId: before.departmentId,
      status: 'active', terminatedAt: null,
      createdAt: before.createdAt, updatedBy: actor.uid, updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'reactivated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { status: 'terminated' }, after: { status: 'active' },
      },
      async (txn) => {
        const t = txn as unknown as Transaction
        t.set(newRef, restored)
        t.delete(oldRef)
        return { value: undefined as unknown as void }
      },
    )
    return { value: { ...before, status: 'active', terminatedAt: null }, auditId: r.auditId }
  }
```

- [ ] **Step 2: Typecheck.**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx tsc --noEmit 2>&1 | grep "firestoreEmployeeRepository" | head`
Expected: no errors in this file. (Note: `withAudit` must support a transaction that does delete — verify `firestoreAuditContext` uses `runTransaction`; it does, per the existing create/update pattern.)

- [ ] **Step 3: Commit.**

```bash
git add src/infra/repositories/firestoreEmployeeRepository.ts
git status
git commit -m "feat(employees): firestore atomic archive/restore move + guards"
```

---

### Task 4: AssetRepository — combined ref.employees (employees ∪ former_employees)

**Files:**
- Modify: `src/infra/repositories/firestoreAssetRepository.ts:159-174` (`fetchReferenceData`)

- [ ] **Step 1: Read both collections into `ref.employees`.** Replace the single `employees` read in `fetchReferenceData` with a combined read. Change the `Promise.all` to read `former_employees` too, then concat (active first; on id collision the active wins — but a person can't be in both, so a flat concat is fine):

```ts
  private async fetchReferenceData(): Promise<AssetReferenceData> {
    const empMap = (d: Record<string, unknown>) => ({
      firstName: (d.firstName as string | null) ?? null,
      lastName: (d.lastName as string | null) ?? null,
      email: (d.email as string | null) ?? null,
      departmentId: (d.departmentId as string | null) ?? null,
      position: (d.position as string | null) ?? null,
    })
    const [statuses, branches, departments, categories, activeEmps, formerEmps] = await Promise.all([
      this.readCol<StatusRow>('asset_statuses', d => ({ name: String(d.name ?? ''), color: String(d.color ?? 'gray') })),
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<RefRow>('departments', d => ({ name: String(d.name ?? '') })),
      this.readCol<CategoryRow>('categories', mapCategory),
      this.readCol<EmployeeRow>('employees', empMap),
      this.readCol<EmployeeRow>('former_employees', empMap),
    ])
    const seen = new Set(activeEmps.map(e => e.id))
    const employees = [...activeEmps, ...formerEmps.filter(e => !seen.has(e.id))]
    return { statuses, branches, departments, categories, employees }
  }
```

- [ ] **Step 2: Typecheck.**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx tsc --noEmit 2>&1 | grep "firestoreAssetRepository" | head`
Expected: no errors.

- [ ] **Step 3: Commit.**

```bash
git add src/infra/repositories/firestoreAssetRepository.ts
git status
git commit -m "feat(employees): ref.employees resolves former employees for history names"
```

---

### Task 5: EmployeesPage — status filter, archive/restore wiring, guard toasts, self-guard

**Files:**
- Modify: `src/pages/employees/EmployeesPage.tsx`
- Modify: `src/components/features/employees/EmployeeDetailDrawer.tsx` (disable «Сдача техники» for self)
- Test: `src/pages/employees/EmployeesPage.test.tsx` (extend)

- [ ] **Step 1: Wire the status filter to the right source set.** In `reload`, branch on `query.status`:
  - `'active'` → `repo.listEmployees(repoQuery)` → set `employees`, set `former = []`.
  - `'terminated'` → `repo.listFormerEmployees(repoQuery)` → set `former`, set `employees = []`.
  - `'all'` → `Promise.all([listEmployees, listFormerEmployees])` → set both; the combined list for the table is `[...employees, ...former]`.

  Add a `former` state array. The table/pagination must operate over the active-or-archive-or-merged set per `query.status`. Replace the `statusFiltered` memo so it returns: active set when status='active', former set when status='terminated', merged when 'all'. (The data is now pre-split by collection — `statusFiltered` no longer filters by `e.status`; it selects the source set.)

- [ ] **Step 2: Inject `LastSuperAdminCheck` into the default firestore repo.** Replace the default repo memo:

```ts
  const defaultRepo = useMemo<EmployeeRepository>(
    () => new FirestoreEmployeeRepository(
      db(),
      async (targetUid: string) => (await new FirestoreUserRepository(db()).countSuperAdmins(targetUid)) === 0,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
```

  Add `FirestoreUserRepository` to the `@/infra/repositories` import.

- [ ] **Step 3: Swap archive/restore handlers + guard toasts.** Import `EmployeeArchiveError` from `@/domain/employee`.
  - `handleArchive` (no-asset path): `await repo.archiveEmployee(empId, actor)` instead of `setStatus(...,'terminated',...)`. Wrap in try/catch; on `EmployeeArchiveError` show `t(\`guard.${err.reason}\`)`.
  - `handleHandoverConfirm`: `await repo.archiveEmployee(handoverTarget.id, actor)` (after the asset return/transfer loop, unchanged). Same guard catch.
  - `handleConfirmRestore`: `await repo.restoreEmployee(restoreTarget.id, actor)` instead of `setStatus(...,'active',...)`.
  - Self-guard in `handleArchive`: at the top, `if (empId === actor.uid) { showToast(t('guard.self-archive')); return }` (defensive — the drawer also disables it).

- [ ] **Step 4: Disable «Сдача техники» for self in the drawer.** In `EmployeeDetailDrawer.tsx`, the archive/«Сдача техники» button must be disabled when `emp?.id === currentUserId`. Thread a `currentUserId` prop from the page (`user.id`) and add `disabled={emp?.id === currentUserId}` to that button. If `EmployeeDetailDrawer` already receives the current user via context, use that instead — locate first.

- [ ] **Step 5: Extend page test.** In `EmployeesPage.test.tsx`, add a test that an injected repo whose `archiveEmployee` rejects with `new EmployeeArchiveError('self-archive')` surfaces the guard toast text, and that selecting the «Архив» status calls `listFormerEmployees`. Use the existing test's repo-injection pattern.

- [ ] **Step 6: Run page tests.**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx vitest run src/pages/employees/`
Expected: PASS (update any existing test that injected a `setStatus`-based mock repo to the new API).

- [ ] **Step 7: Commit.**

```bash
git add src/pages/employees/EmployeesPage.tsx src/pages/employees/EmployeesPage.test.tsx src/components/features/employees/EmployeeDetailDrawer.tsx
git status
git commit -m "feat(employees): page status filter + archive/restore move + self-lockout guard"
```

---

### Task 6: i18n — guard keys (ru/en/hy)

**Files:**
- Modify: `src/locales/ru/employees.json`, `src/locales/en/employees.json`, `src/locales/hy/employees.json`

- [ ] **Step 1: Add a `guard` block** (mirror the `roles.json` guard pattern) to each locale. ru (authoritative):

```json
"guard": {
  "self-archive": "Нельзя списать самого себя",
  "last-super-admin": "Нельзя списать последнего супер-администратора"
}
```

  en: `"self-archive": "You cannot archive your own record"`, `"last-super-admin": "You cannot archive the last super admin"`.
  hy: `"self-archive": "Չեք կարող արխիվացնել ձեր սեփական գրառումը"`, `"last-super-admin": "Չեք կարող արխիվացնել վերջին գերադմինիստրատորին"`.

  Verify all three files keep valid JSON and the same key set.

- [ ] **Step 2: Verify keys resolve.**

Run: `cd /c/Users/DELL/Desktop/assets-crm && node -e "['ru','en','hy'].forEach(l=>{const j=require('./src/locales/'+l+'/employees.json');if(!j.guard||!j.guard['self-archive']||!j.guard['last-super-admin'])throw new Error('missing '+l);});console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit.**

```bash
git add src/locales/ru/employees.json src/locales/en/employees.json src/locales/hy/employees.json
git status
git commit -m "i18n(employees): self-archive + last-super-admin guard messages"
```

---

### Task 7: firestore.rules — former_employees + allow employees delete (move leg)

**Files:**
- Modify: `firestore.rules`
- Test: locate the rules test file (`find . -name "*.rules.test.*" -o -name "firestore*rules*test*"`); extend it.

- [ ] **Step 1: Add the `former_employees` block + change the employees `delete` rule.** Replace the `/employees` block:

```
    match /employees/{id} {
      allow read: if isAnyAdmin() || (isSignedIn() && request.auth.uid == id);
      allow create, update: if (isSuperAdmin() || isAssetAdmin())
        && request.resource.data.email is string
        && request.resource.data.email.size() > 0;
      // delete: only as the termination MOVE leg (admin archives the employee).
      allow delete: if isSuperAdmin() || isAssetAdmin();
    }

    // ---- /former_employees — archive of terminated employees ----
    // Read: any admin (name resolution + Архив list). Write/delete: super | asset_admin
    //   (the archive/restore move legs). NO employee self-read (terminated → no self-service).
    match /former_employees/{id} {
      allow read: if isAnyAdmin();
      allow create, update: if (isSuperAdmin() || isAssetAdmin())
        && request.resource.data.email is string
        && request.resource.data.email.size() > 0;
      allow delete: if isSuperAdmin() || isAssetAdmin();
    }
```

- [ ] **Step 2: Add rules tests** asserting: admin can read `former_employees`; super_admin/asset_admin can create in `former_employees` and delete from `employees` (the move); a `tech_admin`/`employee`/unauthenticated caller is DENIED write to `former_employees`; `audit_logs` update/delete still denied for all. Use the existing rules-test harness pattern.

- [ ] **Step 3: Run rules tests** (emulator).

Run: `cd /c/Users/DELL/Desktop/assets-crm && <the project's rules-test command, e.g. npm run test:rules>`
Expected: PASS. If no emulator is wired in CI, run the rules test file via its documented command; if unavailable in this environment, mark this step as needing the emulator and have security-reviewer read the rule diff.

- [ ] **Step 4: Commit.**

```bash
git add firestore.rules <rules test file>
git status
git commit -m "rules(employees): former_employees collection + allow archive-move delete"
```

---

### Task 8: Full verification

- [ ] **Step 1: Scoped typecheck of touched files.** (Full `tsc` may break on the untracked `parts/*` workstream — not ours.)

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx tsc --noEmit 2>&1 | grep -E "employee|Employee" | head -30`
Expected: no errors in any file this plan touched.

- [ ] **Step 2: Run the full employee + repo + asset-repo test surface.**

Run: `cd /c/Users/DELL/Desktop/assets-crm && npx vitest run src/infra/repositories/inMemoryEmployeeRepository.test.ts src/pages/employees/ src/domain/employee/`
Expected: PASS, all green.

- [ ] **Step 3: Confirm the user's foreign files are untouched.**

Run: `cd /c/Users/DELL/Desktop/assets-crm && git status`
Expected: only this feature's commits on `refactor/pages-structure`; no foreign files staged; working tree otherwise as the user left it. NOT merged.
