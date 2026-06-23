# Drawer Asset Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin select 1/several/all of an employee's linked assets in the Employee Detail Drawer and transfer them to warehouse / another employee / a department / a branch in one action, persisted with audit.

**Architecture:** Add a `department` assignment mode end-to-end (domain → both repo adapters → rules) and a new atomic `transfer()` repository method (end current assignment + create new + update asset cache + 2 audit entries, in one transaction). Build a multi-select + DestPicker transfer flow in the drawer; the page owns persistence. «Временно» deferred.

**Tech Stack:** React 19 + Vite + TypeScript (strict), Firebase modular SDK v9+, Vitest + @testing-library/react + @firebase/rules-unit-testing, i18next (ru/en/hy).

**Spec:** `docs/superpowers/specs/2026-06-23-drawer-asset-transfer-design.md`

---

## File Structure

- `src/domain/assignment/types.ts` — add `department` to `ASSIGNMENT_MODES`; add `assignedToDepartmentId` to `Assignment`.
- `src/domain/assignment/AssignmentRepository.ts` — add `departmentId` to `AssignInput`; add `transfer()` to interface.
- `src/infra/repositories/inMemoryAssignmentRepository.ts` — department in `assign`; new `transfer()`.
- `src/infra/repositories/firestoreAssignmentRepository.ts` — department in `assign`/`toAssignment`; new `transfer()`.
- `firestore.rules` — comment + verify department-mode; add rules tests.
- `src/components/features/employees/EmployeeDetailDrawer.tsx` — select mode + transfer bar.
- `src/pages/EmployeesPage.tsx` — `handleTransferAssets`; wire HandoverModal redirected dests.
- `src/locales/{ru,en,hy}/employees.json` — `transfer.*` keys.
- Tests co-located + `firestore.rules.test.ts` (existing rules test file).

---

## Task 1: Domain — add `department` mode + field (domain-modeler)

**Files:**
- Modify: `src/domain/assignment/types.ts`
- Modify: `src/domain/assignment/AssignmentRepository.ts`
- Test: `src/domain/assignment/assignment-types.test.ts`

- [ ] **Step 1: Write failing tests** in `assignment-types.test.ts`:

```ts
import { ASSIGNMENT_MODES, isAssignmentMode } from './types'

it('includes department mode', () => {
  expect(ASSIGNMENT_MODES).toContain('department')
  expect(isAssignmentMode('department')).toBe(true)
})
```

- [ ] **Step 2: Run** `npm test -- --run src/domain/assignment/assignment-types.test.ts` → expect FAIL.

- [ ] **Step 3: Implement** in `types.ts`:
  - `export const ASSIGNMENT_MODES = ['employee', 'branch', 'department'] as const`
  - Add to `Assignment`: `assignedToDepartmentId: string | null`

- [ ] **Step 4:** In `AssignmentRepository.ts` add to `AssignInput`: `/** Required when mode === 'department'. */ departmentId?: string` and add the `transfer` method signature to the interface:

```ts
/** Transfer an already-assigned asset to a new holder (employee|branch|department).
 *  Atomic: close current assignment + new assignment doc + asset cache + 2 audit entries
 *  (returned + assigned) + mail (employee). Throws if the asset has no active assignment. */
transfer(input: AssignInput, actor: Actor): Promise<AuditedResult<Assignment>>
```

- [ ] **Step 5: Run** the test → expect PASS. Also `npx tsc --noEmit` for the two files' package (note: full repo build runs in verify).

- [ ] **Step 6: Commit** `feat(assignment): add department mode + transfer() to domain`

---

## Task 2: inMemory repo — department in assign + transfer() (firebase-engineer)

**Files:**
- Modify: `src/infra/repositories/inMemoryAssignmentRepository.ts`
- Test: `src/infra/repositories/inMemoryAssignmentRepository.test.ts`

- [ ] **Step 1: Write failing tests.** Add cases:
  - `assign({mode:'department', departmentId:'dep_it'})` on a warehouse asset → asset cache `{mode:'department', departmentId:'dep_it'}`, statusId `st_assigned`, assignment doc `assignedToDepartmentId === 'dep_it'`, audit `assigned` written.
  - `transfer({assetId, mode:'employee', employeeId:'e2', ...})` on an asset currently assigned to `e1` → prior assignment `endedAt != null`, new assignment active with `assignedToEmployeeId === 'e2'`, asset cache updated, **two** audit entries (returned + assigned), mail enqueued for employee dest.
  - `transfer({assetId, mode:'department', departmentId:'dep_hr'})` → asset cache `{mode:'department', departmentId:'dep_hr'}`.
  - `transfer({assetId, mode:'branch', branchId:'br_2'})` → asset cache `{mode:'branch', branchId:'br_2'}`, no mail.
  - `transfer` on an asset with no active assignment → throws.

- [ ] **Step 2: Run** the test file → expect FAIL.

- [ ] **Step 3: Implement.**
  - In `assign()`: extend the guard + assignment + asset-cache branches to handle `department` (validate `departmentId` present; assignment `assignedToDepartmentId`; asset cache `{ mode:'department', departmentId }`). Add `assignedToDepartmentId: null` to non-department branches so the field always exists.
  - Add `transfer(input, actor)`: find asset (throw if missing); find active assignment (throw if none); validate target id for the mode. Compose: write **one `withAudit`** for the `returned` of the old + a second `withAudit` for the `assigned` of the new (sequential `await`s are fine in-memory since there is no real transaction). Set `old.endedAt = now`; push new `Assignment` (with the right `assignedTo*` field); update `this.assets[idx]` cache to `st_assigned` + new `assignment`; enqueue mail when `mode==='employee' && employeeEmail`. Return the new assignment's `AuditedResult`.

- [ ] **Step 4: Run** the test file → expect PASS.

- [ ] **Step 5: Commit** `feat(assignment): inMemory department mode + transfer()`

---

## Task 3: firestore repo — department in assign + transfer() (firebase-engineer)

**Files:**
- Modify: `src/infra/repositories/firestoreAssignmentRepository.ts`
- Test: extend `src/infra/repositories/inMemoryAssignmentRepository.test.ts` is NOT enough — firestore repo is integration-tested via rules/emulator only where available. Add a focused unit test with a mocked Firestore if the existing pattern supports it; otherwise rely on the rules test (Task 4) + inMemory parity. (Check existing firestore repo test coverage first; match the established pattern — do NOT invent a new mock harness.)

- [ ] **Step 1:** Inspect how other firestore repos are tested in this repo. If there is an existing firestore-repo unit-test pattern, write failing tests mirroring Task 2 against it. If firestore repos are only covered by emulator/rules tests, state that explicitly in the report and proceed to implementation (parity guaranteed by inMemory tests + rules tests).

- [ ] **Step 2: Implement.**
  - `toAssignment()`: add `assignedToDepartmentId: (d.assignedToDepartmentId as string | null) ?? null`.
  - `assign()`: validate department; `after` + assignment doc + asset cache handle `department` (`assignedToDepartmentId`, cache `{mode:'department', departmentId}`). Ensure `assignedToDepartmentId` is written (null for non-department).
  - `transfer(input, actor)`: ONE `runTransaction`. Read asset (must exist, must be `st_assigned`/have active assignment), read the active assignment doc (query by `assetId` + `endedAt==null` BEFORE the txn to get its id, then re-read inside txn to close TOCTOU like `returnAsset` does). Inside txn: set old `endedAt=serverTimestamp()`; create new assignment doc (`startedAt`, `endedAt:null`, the right `assignedTo*`, `createdBy`, `createdAt`); set asset cache `{statusId:'st_assigned', assignment:{mode,…id}}`; enqueue mail for employee dest. Write audit: use the same `withAudit` composition pattern the file already uses; emit **two** audit specs (returned for old id, assigned for new id) — follow the existing `withAudit(this.audit, spec, fn)` usage; if the helper supports only one spec per call, nest/sequence two `withAudit` calls bound to the same txn pattern used elsewhere, OR write the second audit doc directly inside the txn matching the audit doc shape. Match whatever `returnAsset`/`assign` already do — do not invent a new audit mechanism.
  - Readback the new assignment doc; return `{ value: toAssignment(newRef.id, …), auditId }`.

- [ ] **Step 3: Run** any added tests → PASS; then `npm run build` for type safety on touched files.

- [ ] **Step 4: Commit** `feat(assignment): firestore department mode + transfer()`

---

## Task 4: firestore.rules — department mode + tests (firebase-engineer)

**Files:**
- Modify: `firestore.rules` (comment only — create already permits department docs)
- Test: the existing rules test file (find it: `*rules*.test.ts`)

- [ ] **Step 1: Write failing rules tests:**
  - asset_admin CAN create an `/assignments/{id}` doc with `mode:'department'`, `assignedToDepartmentId:'dep_it'`, `assignedToEmployeeId:null`, `assignedToBranchId:null`.
  - An employee (non-admin) CANNOT read that department-mode assignment doc (assignedToEmployeeId null ≠ uid → fail-closed).
  - update of that doc by asset_admin touching only `endedAt` is allowed; touching `mode` is denied.

- [ ] **Step 2: Run** the rules test → expect the new cases FAIL only if a rule actually blocks them; if they already pass (because create is mode-agnostic), keep them as regression guards and note it.

- [ ] **Step 3: Implement.** Add an explanatory comment in the `/assignments` block documenting department-mode shape (assignedToEmployeeId null → employee self-read fail-closed). No logic change expected; if a shape guard is desired, keep it minimal and justified.

- [ ] **Step 4: Run** rules tests → PASS.

- [ ] **Step 5: Commit** `test(rules): cover department-mode assignments`

---

## Task 5: i18n — transfer.* keys (i18n-engineer)

**Files:**
- Modify: `src/locales/ru/employees.json`, `src/locales/en/employees.json`, `src/locales/hy/employees.json`

- [ ] **Step 1:** Add a `transfer` object to all three locales (keys identical, values translated):
  - ru: `select:"Выбрать"`, `selectAll:"Выбрать все"`, `deselectAll:"Снять все"`, `nSelected:"{{count}} выбрано"`, `action:"Передать"`, `confirmTitle:"Передать {{count}} активов → {{dest}}?"`, `cancel:"Отмена"`, `toastDone:"Передано: {{count}}"`, `toastFailed:"Не удалось передать"`, `done:"Готово"`, `empty:"Нет выбранных"`.
  - en/hy: faithful translations. Verify `dest.*` keys already exist (warehouse/employee/department/branch/search/notFound) — do not duplicate.

- [ ] **Step 2:** Run `npm test -- --run src/locales` (or the existing i18n parity test if present) → PASS; ensure ru/en/hy have identical key sets.

- [ ] **Step 3: Commit** `feat(i18n): add transfer.* keys for drawer transfer`

---

## Task 6: Drawer UI — select mode + transfer bar (react-ui-engineer)

**Files:**
- Modify: `src/components/features/employees/EmployeeDetailDrawer.tsx`
- Test: `src/components/features/employees/EmployeeDetailDrawer.test.tsx`

**New prop:** add to `EmployeeDetailDrawerProps`:
```ts
employees: { id: string; name: string; status: string }[]
departments: { id: string; name: string }[]
branches: { id: string; name: string }[]
onTransferAssets: (assetIds: string[], destination: Destination) => void
```
(import `Destination` + `DestPicker` from `./DestPicker`).

- [ ] **Step 1: Write failing component tests:**
  - Clicking «Выбрать» enters select mode → checkboxes render on each asset row.
  - «Выбрать все» selects all; counter shows N.
  - With ≥1 selected, the transfer bar renders with a DestPicker chip + «Передать».
  - Choosing a destination then «Передать» → inline confirm appears; confirming calls `onTransferAssets` with the selected ids + chosen destination.
  - Leaving select mode (toggle off / after transfer) clears selection.

- [ ] **Step 2: Run** test → FAIL.

- [ ] **Step 3: Implement.**
  - Local state: `selectMode`, `selectedIds:Set<string>`, `dest:Destination` (default `{kind:'warehouse'}`), `confirming:boolean`.
  - Section bar: when `isActive`, render a «Выбрать» / «Готово» toggle button (ghost style consistent with existing emerald «Привязать» button; use a distinct neutral style so the two CTAs read clearly). Hide «Привязать» CTA OR keep both — keep both; select toggle sits left of «Привязать».
  - Asset row: when `selectMode`, prepend an emerald checkbox (reuse the HandoverModal checkbox visual: `w-5 h-5 rounded-md border-2 …`). Whole row toggles membership on click in select mode; out of select mode the row is non-interactive as today.
  - Transfer bar: a pinned block above the footer, shown when `selectMode && selectedIds.size>0`. Contains: `[N выбрано]`, `<DestPicker value={dest} onChange={setDest} currentEmpId={emp.id} employees departments branches forceDropUp />`, and a primary «Передать» button. On «Передать», set `confirming=true`.
  - Inline confirm: when `confirming`, the bar swaps to show `transfer.confirmTitle` (count + dest label) + «Отмена» / «Передать» (confirm). Confirm → `onTransferAssets([...selectedIds], dest)` then reset (`selectMode=false`, clear set, `confirming=false`).
  - Reset all transfer state whenever `emp?.id` changes or drawer closes (so reopening on another employee is clean).
  - Keep DestPicker's `forceDropUp` true (the bar sits near the bottom).

- [ ] **Step 4: Run** test → PASS.

- [ ] **Step 5: Commit** `feat(employees): multi-select asset transfer in detail drawer`

---

## Task 7: Page wiring — real persistence (react-ui-engineer)

**Files:**
- Modify: `src/pages/EmployeesPage.tsx`
- Test: `src/pages/EmployeesPage.test.tsx`

- [ ] **Step 1: Write failing tests** (inject an inMemory-backed assignmentRepository + asset/employee repos):
  - Opening a detail drawer for an employee with linked assets, entering select mode, selecting 1, choosing «Склад», confirming → `returnAsset` called once with that asset id; toast shown; drawer asset list refreshed (asset gone).
  - Same but choosing another employee as dest → `transfer` called with `{mode:'employee', employeeId}`.
  - HandoverModal confirm with a redirected (employee) destination → `transfer` called (no longer a no-op).

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**
  - Pass `employees={handoverEmployees}`, `departments={departments}`, `branches={branches}`, `onTransferAssets={(ids,dest)=>void handleTransferAssets(ids,dest)}` to `<EmployeeDetailDrawer>`.
  - `handleTransferAssets(assetIds, dest)`:
    - For each id: if `dest.kind==='warehouse'` → `asnRepo.returnAsset(id, actor)`. Else build `AssignInput` `{assetId:id, mode:dest.kind, employeeId/branchId/departmentId, employeeEmail/Name (employee), invCode}` and call `asnRepo.transfer(input, actor)`. Resolve employee email/name + invCode from loaded data (employees list + detailLinkedAssets).
    - On success: `showToast(t('transfer.toastDone',{count}))`; refresh `detailLinkedAssets` via `handleOpenDetail(detailId)`; reload counts. On error: `showToast(t('transfer.toastFailed'))`.
  - Update `handleHandoverConfirm`: for redirected rows (`destination.kind !== 'warehouse'`) call `asnRepo.transfer(...)` with the right `AssignInput` instead of skipping. Keep warehouse rows → `returnAsset`. (Employee is being terminated, so closing their assignments + reassigning is correct.)

- [ ] **Step 4: Run** page tests → PASS.

- [ ] **Step 5: Commit** `feat(employees): wire drawer + handover transfers to persistence`

---

## Task 8: Verify + reviews

- [ ] `npm test -- --run` (full) green; `npm run build` clean.
- [ ] spec-reviewer → code-quality-reviewer → security-reviewer (rules + new write paths). Loop on FAIL.
- [ ] Final report: design summary, backend+tests, UI, reviewer verdicts, «Временно» status, commit list, NOT merged.
