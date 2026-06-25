# Plan — Employee Archive Lockout Guard (self-archive + last-super-admin)

**Slug:** `employee-archive-lockout-guard`
**Branch:** `refactor/pages-structure` (STAY — do not switch/stash/merge)
**Date:** 2026-06-24

## Problem
A super_admin archived their OWN employee record via «Сдача техники» (→ `EmployeeRepository.setStatus(id,'terminated',actor)`), disappeared from the active list, and could not re-create (duplicate-email block). Lockout. Prevent self-archival and last-super-admin archival.

## Invariants relied on
- `Employee.id === uid === users/{uid}` for real accounts. Actor `{ uid, role }` has no email; Employee has no role field. So **uid-match** is the robust self key.
- Precedent to mirror: `RoleLockoutError` in `src/domain/user/UserRepository.ts` (`reason: 'self-demotion' | 'last-super-admin'`), used by both user repo adapters with a `countSuperAdmins(exceptUid)` helper (currently private on each adapter).

## Settled design (implement exactly)

### 1. Typed error — `src/domain/employee/EmployeeRepository.ts`
```ts
export class EmployeeArchiveError extends Error {
  constructor(public readonly reason: 'self-archive' | 'last-super-admin') {
    super(`Employee archive blocked: ${reason}`)
    this.name = 'EmployeeArchiveError'
  }
}
```
Re-export via `src/domain/employee/index.ts` (already `export * from './EmployeeRepository'` — automatic).

### 2. Inject the last-super-admin check (clean repo boundary)
- Promote `countSuperAdmins` to a **public** method on the `UserRepository` port + both adapters:
  - `countSuperAdmins(exceptUid?: string): Promise<number>` (Firestore already async; make in-memory return a resolved number to match the port — keep its sync body, wrap in `Promise.resolve` or make method `async`).
  - Keep the existing private call-sites working.
- Add an **optional** constructor dependency to BOTH employee repos:
  ```ts
  /** Returns true if terminating `targetUid` would leave zero active super_admins. */
  type LastSuperAdminCheck = (targetUid: string) => Promise<boolean>
  ```
  - The employee repo does NOT import the user repo. The page wires the callback from the user repo.
  - When the callback is omitted (most tests/dev), the last-super-admin guard is skipped (only the self-archive guard fires). This is acceptable — the page always wires it in prod, and dedicated tests inject a stub.

### 3. `setStatus` guards (BOTH adapters)
Only when `status === 'terminated'`:
```ts
if (id === actor.uid) throw new EmployeeArchiveError('self-archive')
if (this.lastSuperAdminCheck && await this.lastSuperAdminCheck(id)) {
  throw new EmployeeArchiveError('last-super-admin')
}
```
- Guards run BEFORE the withAudit write (no audit row on a blocked archive).
- `status === 'active'` (restore/reactivate) is ALWAYS allowed — no guard.
- The callback itself decides relevance: it returns false for non-super-admins (it counts super_admins excluding the target; if target isn't a super_admin the count is unaffected, but the page-supplied callback must check the target's role first → see §5 wiring). Net: only a super_admin target can trip 'last-super-admin'.

### 4. UI guard — `EmployeeDetailDrawer`
- New prop `currentUid: string`.
- When `emp.id === currentUid`: the «Сдача техники» (`detail.handover`) danger button is **disabled** + shows a hint/tooltip (`title={t('guard.self-archive')}`) and an inline helper line. Everything else stays enabled. Keep theme/visual language (use existing `Btn disabled` + a small muted hint row).
- Restore button is unaffected.

### 5. Error surfacing + wiring — `EmployeesPage`
- Pass `currentUid={user.id}` to `EmployeeDetailDrawer`.
- Construct the last-super-admin callback and pass it to the default `FirestoreEmployeeRepository`:
  ```ts
  const userRepo = new FirestoreUserRepository(db())
  const lastSuperAdminCheck = async (targetUid: string) => {
    const target = (await userRepo.listUsers()).find(u => u.id === targetUid)
    if (target?.role !== 'super_admin') return false
    return (await userRepo.countSuperAdmins(targetUid)) === 0
  }
  ```
  (Or a leaner getUser if available — listUsers is the existing public read.)
- In `handleArchive` and `handleHandoverConfirm`, catch `EmployeeArchiveError` → `showToast(t(\`guard.${err.reason}\`))`. Keep the generic `validation.saveFailed` fallback for other errors.
- The duplicate-email-on-create block stays intact.

### 6. i18n — `employees.json` (ru authoritative + en + hy)
Add a `guard` block mirroring `roles.json`:
```json
"guard": {
  "self-archive": "Нельзя сдать технику и архивировать самого себя",
  "last-super-admin": "Нельзя архивировать последнего Супер Админа"
}
```
- en: "You cannot hand over equipment and archive yourself" / "You cannot archive the last Super Admin"
- hy: Armenian equivalents.

### 7. firestore.rules — cheap self-archive denial (server-side)
In `/employees/{id}` update rule, deny a self-termination:
- A signed-in caller whose `request.auth.uid == id` must NOT be able to flip status active→'terminated' on their own doc.
- Cross-collection last-admin count is NOT cheap in rules → stays repo-only (security-reviewer confirms).
- Shape: extend `allow update` with a guard:
  ```
  && !(request.auth.uid == id
        && request.resource.data.status == 'terminated'
        && resource.data.status != 'terminated')
  ```
  Keep existing email shape guard. Let security-reviewer confirm the exact clause placement (the employees update rule currently also serves admin edits of OTHER employees — the guard must only bite the self case).

### 8. Keep duplicate-email-on-create block intact (correct behavior).

## TDD (write tests FIRST)
Domain/repo tests (in-memory + applicable firestore-shape unit tests):
1. self-terminate rejects (`id === actor.uid`, status 'terminated') → `EmployeeArchiveError('self-archive')`.
2. last-super-admin terminate rejects (callback returns true) → `EmployeeArchiveError('last-super-admin')`.
3. archiving a DIFFERENT employee succeeds (no self, callback false).
4. restoring/activating self (`setStatus(self,'active')`) is ALLOWED.
5. non-admin self-archive still rejected by rule 2 (self guard is role-agnostic — any uid==actor.uid termination blocked).
6. Existing tests stay green (the no-callback path keeps old behavior except self-archive).

## Verification
- Scoped typecheck of touched files (full build is broken by untracked `parts/*` — not ours).
- `npm test -- --run` for the touched test files + employee/user suites.
- Reviews: spec-reviewer → code-quality-reviewer → security-reviewer (REQUIRED).

## Git
- Stage ONLY files this feature touches, explicitly per file. NEVER `git add -A`/`.`.
- Sub-agents instructed: no broad `git add`. Orchestrator stages + commits.
- Do NOT merge. Verify `git status` shows the user's other ~98 files untouched.

## Files touched (allowlist for staging)
- `src/domain/employee/EmployeeRepository.ts`
- `src/domain/user/UserRepository.ts`
- `src/infra/repositories/inMemoryEmployeeRepository.ts`
- `src/infra/repositories/firestoreEmployeeRepository.ts`
- `src/infra/repositories/inMemoryUserRepository.ts`
- `src/infra/repositories/firestoreUserRepository.ts`
- `src/infra/repositories/inMemoryEmployeeRepository.test.ts` (extend)
- new: `src/infra/repositories/employeeRepository.archiveGuard.test.ts` (or extend existing)
- `src/components/features/employees/EmployeeDetailDrawer.tsx`
- `src/components/features/employees/EmployeeDetailDrawer.test.tsx` (extend)
- `src/pages/employees/EmployeesPage.tsx`
- `src/locales/ru/employees.json`, `src/locales/en/employees.json`, `src/locales/hy/employees.json`
- `firestore.rules`
- new plan: `docs/superpowers/plans/2026-06-24-employee-archive-lockout-guard.md`
