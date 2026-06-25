# Former Employees Archive (move-out on termination) — Design

Date: 2026-06-25
Branch: `refactor/pages-structure` (stay on it; never merge here)
Status: Approved by owner (decision confirmed in the task brief)

## Problem

When an employee is terminated via «Сдача техники», the current model flips
`employees/{id}.status = 'terminated'` and stamps `terminatedAt`, keeping the doc
in the `employees` collection. The owner wants the terminated person **gone from
the Employees list entirely** — moved into a dedicated archive — while **all
history and references everywhere keep displaying the employee's name**.

### Data-integrity fact (verified)

History does NOT store name snapshots. Employee names in history/cards are
resolved LIVE from `ref.employees` (type `EmployeeRow[]`) by `employeeId`:
- `src/components/features/assets/detail/AssignmentHistory.tsx`
- `src/components/features/assets/detail/AssignmentCard.tsx`
- `src/components/features/assets/detail/auditToHistoryEvent.ts` (`resolveEmployeeName`)

`ref.employees` is sourced from `AssetRepository.loadReferenceData()` →
`fetchReferenceData()` which reads the `employees` collection. A hard delete
would blank these to «—»/raw id. Therefore: **move, not delete** — and the
combined name lookup must include the archive.

### Picker fact (verified)

The assign/transfer "to employee" pickers do NOT read `ref.employees`. They read
`EmployeesPage`'s own `employees` state, filtered to active
(`handoverEmployees = employees.filter(e => e.status === 'active')`), passed into
`AssignmentForm` / `TransferPanel` / `HandoverModal` / `AssetPickerSheet`. So
keeping former employees OUT of pickers is automatic as long as those sets stay
active-only.

## Design

### 1. New collection `former_employees/{id}`

On terminate, ATOMICALLY (batch/transaction):
- delete `employees/{id}`
- create `former_employees/{id}` carrying ALL original fields + termination
  metadata: `terminatedAt`, `terminatedBy: actor.uid`. Preserve original
  `createdAt`. `status` is stored as `'terminated'`.
- one audit entry (`entityType: 'employee'`, `action: 'terminated'`).

Restore is the exact inverse: move `former_employees/{id}` → `employees/{id}`,
clear termination metadata (`terminatedAt = null`, drop `terminatedBy`,
`status = 'active'`), audit `action: 'reactivated'`.

Nothing in `assignments`, `auditLogs`, or `assets` is touched by the move. The
asset return/transfer step of «Сдача техники» runs FIRST (existing flow,
unchanged) and clears only the asset's CURRENT assignment.

### 2. Name resolution — single combined lookup

`fetchReferenceData()` reads `employees` ∪ `former_employees` into
`ref.employees`. Because every name-resolution consumer reads `ref.employees`
(and ONLY pickers avoid it, sourcing from the page's active set), this one change
fixes name display for archived employees across all three history consumers
with zero edits to those components.

- DISPLAY / name-resolution set = `employees ∪ former_employees` (via `ref.employees`).
- PICK-ACTIVE-ONLY set = `EmployeesPage.employees` filtered to active — pickers
  (`AssignmentForm`, `TransferPanel`, drawer «Привязать актив», handover target
  picker). Unchanged; already active-only.

In-memory asset repo: its `ref.employees` is seeded by the test; tests that need
archived-name-resolution pass the former employee into that seed.

### 3. Repository API (move-based)

`EmployeeRepository` gains:
- `archiveEmployee(id, actor): Promise<AuditedResult<Employee>>` — move active→former.
- `restoreEmployee(id, actor): Promise<AuditedResult<Employee>>` — move former→active.
- `listFormerEmployees(query?): Promise<Employee[]>` — read archive set.
- `listEmployees(query?)` stays active-only (reads `employees`).

`setStatus` is REMOVED from the interface and both impls; all call sites move to
`archiveEmployee` / `restoreEmployee`. (`EmployeeStatus`/`status` field stays on
the `Employee` type for display; archived docs carry `'terminated'`.)

Self-lockout guards live in `archiveEmployee` (both impls):
- `id === actor.uid` → `EmployeeArchiveError('self-archive')`.
- last active super_admin → `EmployeeArchiveError('last-super-admin')` via
  injected `LastSuperAdminCheck` (firestore wires it to
  `UserRepository.countSuperAdmins(exceptUid)`).

Every mutation audits via the existing `withAudit` helper. Firestore impl uses a
`runTransaction`/batch so delete+create+audit commit atomically.

### 4. EmployeesPage status filter + restore + guard wiring

- «Активен» → `listEmployees` (`employees`).
- «Архив» → `listFormerEmployees` (`former_employees`).
- «Все» → merge both (default chosen below).
- «Восстановить» → `restoreEmployee` (replaces old `setStatus('active')`).
- `handleArchive` / `handleHandoverConfirm` → `archiveEmployee`. Catch
  `EmployeeArchiveError` → toast `guard.self-archive` / `guard.last-super-admin`.
- «Сдача техники» action disabled in the drawer when the row is the current user.
- KindTabs counts + pagination operate over whichever set the status filter selects.

### 5. firestore.rules

Add `former_employees` block mirroring `employees`: read for signed-in admins,
write for super_admin/asset_admin (the move's delete on `employees` + create on
`former_employees` must both be allowed). Preserve `audit_logs` immutability.
Self-archive denial is enforced in code (the rules can't see "actor.uid ==
target" cheaply without a read); security-reviewer confirms the move is sound.

### 6. i18n

`employees.json` (ru authoritative + en + hy):
- `guard.self-archive` = «Нельзя списать самого себя» (+ en/hy).
- `guard.last-super-admin` = «Нельзя списать последнего супер-администратора» (+ en/hy).
- Archive/restore toasts (`toast.archived`, `toast.restored`, `toast.handover`)
  already exist. Add an «Архив» filter label if the filter bar needs one.

## Open decisions (defaults chosen; owner may override)

1. **«Все» tab** — merge active + former for display. DEFAULT: keep «Все» and
   merge (consistent with the prototype's three-way status filter). Former rows
   render with a restore affordance; active rows with archive.
2. **No separate Former Employees page** — reuse the Архив status filter on the
   existing page. DEFAULT: filter, not a new route (less surface, matches brief §3).
3. **Restore affordance** — «Восстановить» row action on archived rows +
   `RestoreConfirmModal` (already exists). DEFAULT: reuse it, swap its handler to
   `restoreEmployee`.

## Testing (TDD — write first)

Domain/repo (inMemory) tests:
- archive MOVES the doc: gone from `listEmployees`, present in `listFormerEmployees`.
- archived employee's name STILL resolves via combined `ref.employees`
  (the core invariant — proves history won't blank).
- restore MOVES it back: present in `listEmployees`, gone from `listFormerEmployees`.
- archiving a DIFFERENT employee succeeds.
- self-archive (`id === actor.uid`) → `EmployeeArchiveError('self-archive')`.
- last super_admin → `EmployeeArchiveError('last-super-admin')`.
- the move does NOT mutate assignments / audit / asset docs.

Page tests: status filter switches the source set; restore calls
`restoreEmployee`; guard toasts surface; «Сдача техники» disabled for self.

Rules tests (`@firebase/rules-unit-testing`): admin can read/write
`former_employees`; the move (delete employees + create former) is permitted for
super_admin/asset_admin; non-admin denied; `audit_logs` stays immutable.

## Out of scope

No changes to the asset return/transfer mechanics, audit-log schema, or self-
service rules. No Phase-2/3 work.
