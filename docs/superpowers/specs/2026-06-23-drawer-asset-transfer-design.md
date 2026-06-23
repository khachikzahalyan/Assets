# Drawer Asset Transfer — Design

**Date:** 2026-06-23
**Branch:** `feat/employees-prototype-parity`
**Status:** Approved-by-owner (defaults), pending user confirmation on flagged decisions.

## Goal

On the Employee Detail Drawer (`EmployeeDetailDrawer.tsx`), let an admin select **1, several, or all** of an
employee's «Закреплённые активы» and transfer them in one action to a destination:

- **Склад** (warehouse — return)
- **Сотрудник** (another employee)
- **Отдел** (department)
- **Филиал** (branch)
- ~~**Временно** (temporary)~~ — DEFERRED (see §6).

This is a deliberate extension beyond the prototype; the rest of the page stays 1:1 with the prototype.

## Key discovery — transfer = return + reassign

`AssignmentRepository.assign()` (both firestore + inMemory adapters) hard-requires the asset's
`statusId === 'st_warehouse'`. An asset currently held by an employee is `st_assigned`, so `assign()`
throws `"Asset not assignable"`. A transfer from an assigned holder is therefore a two-part operation:
**end the current assignment, then create a new one.**

- **→ Склад:** `returnAsset(assetId)` — already exists, no change.
- **→ Сотрудник / Отдел / Филиал:** new atomic `transfer()` method (chosen Option A below).

### Options considered

- **Option A (CHOSEN): add `transfer(input, actor)`** to `AssignmentRepository`. One Firestore
  `runTransaction`: close current active assignment (`endedAt`), create the new assignment doc,
  update the asset cache (`statusId`, `assignment`), write audit. Keeps atomicity and a clean contract;
  callers that rely on `assign()`'s warehouse guard (e.g. AssetPickerSheet) are untouched.
- **Option B (REJECTED): relax `assign()` to accept assigned assets.** Overloads `assign()`'s contract,
  weakens the warehouse-only safety guard other callers depend on, muddies audit semantics.

### Audit shape for a transfer

Inside the single `transfer()` transaction, write **two audit entries**: a `returned` entry for the
closed assignment and an `assigned` entry for the new one. This reuses existing audit `action` values
(no new action type), keeps per-asset assignment history queryable, and mirrors the real-world lifecycle.

## Backend — `department` mode end-to-end + `transfer()`

1. **`src/domain/assignment/types.ts`**
   - `ASSIGNMENT_MODES = ['employee', 'branch', 'department'] as const`
   - `Assignment.assignedToDepartmentId: string | null` (new field)
2. **`src/domain/assignment/AssignmentRepository.ts`**
   - `AssignInput.departmentId?: string` (required when `mode === 'department'`)
   - New `transfer(input: AssignInput, actor): Promise<AuditedResult<Assignment>>`
     - `input` carries the **destination** (mode + target id). The asset is identified by `input.assetId`.
     - Pre: asset has an active assignment (else throw). Mode ∈ {employee, branch, department}.
3. **`src/infra/repositories/firestoreAssignmentRepository.ts`**
   - `assign()` + `toAssignment()` + asset-cache write handle `department`.
   - `transfer()`: single `runTransaction` — read active assignment, set its `endedAt`, create new
     assignment doc, set asset cache `{statusId:'st_assigned', assignment:{mode, …id}}`, enqueue mail
     for employee destinations, write both audit entries (return + assign) via `withAudit` composition.
4. **`src/infra/repositories/inMemoryAssignmentRepository.ts`** — mirror all of the above.
5. **`firestore.rules`** — `/assignments`:
   - create already allows super | asset_admin → department-mode create OK.
   - update guard already `hasOnly(['endedAt','transferComment'])` → closing the prior assignment OK.
   - Department-mode docs have `assignedToEmployeeId == null`, so the employee self-read clause is
     fail-closed (correct — a department asset is not personally readable).
   - Add a shape note + rules tests for department-mode create/read.

## UI — multi-select transfer in the drawer

`EmployeeDetailDrawer.tsx`:

- **Section bar** gains a **«Выбрать»** toggle button (next to «Привязать», active employees only).
- **Select mode:** each linked-asset row shows a left-edge emerald checkbox (HandoverModal idiom).
  A **«Выбрать все»** control appears. Selecting toggles row membership.
- **Transfer bar** (slides in above footer when ≥1 selected): `[N выбрано]` + reused `<DestPicker>` chip
  (Склад/Сотрудник…/Отдел…/Филиал…) + primary **«Передать»**.
- **Inline confirm:** «Передать» → small inline confirm ("Передать N активов → {dest}?") inside the
  transfer bar (not a separate modal) → confirm fires the batch.
- The drawer exposes a single new callback prop `onTransferAssets(assetIds, destination)` so the page
  owns all persistence. The drawer stays presentational.

`EmployeesPage.tsx`:

- New `handleTransferAssets(assetIds, destination)`: for each id, `returnAsset` (warehouse) or
  `transfer` (employee/department/branch) with full `AssignInput`; toast; reload; refresh drawer's
  `detailLinkedAssets`.
- Also wires real persistence for the existing `HandoverModal` redirected destinations
  (employee/department/branch) which are currently UI-only no-ops — now they call `transfer()`.

## i18n (4-tier, Tier-1 chrome)

New keys under `employees.json` (ru/en/hy): `transfer.select`, `transfer.selectAll`, `transfer.deselectAll`,
`transfer.nSelected`, `transfer.action`, `transfer.confirmTitle`, `transfer.cancel`, `transfer.toastDone`,
`transfer.toastFailed`. `dest.*` already exist. No Tier-2/3/4 fields introduced.

## §6 — «Временно» status: DEFERRED (flagged to user)

Findings: the prototype DestPicker has **no «Временно»** (only warehouse/employee/department/branch).
«Временно» in the prototype is an asset-creation Quick-Assignment sub-flow bound to **intern/audit
employee kinds**, which this Employees page deliberately filters out (`kind === 'staff'` only).
Production has **no intern/audit kinds** (domain `Employee` has no `kind`; `EMPLOYEE_KINDS = [staff]`).

Decision: **do not ship «Временно» here**; do not invent intern/audit kinds. It is a separate feature
requiring (a) intern/audit employee kinds across the domain, (b) a temporary-assignment expiry model
(`expiresAt`, `tempKind`, scheduled-notify), (c) product confirmation of semantics. The asset cache type
(`AssetAssignment`) already carries forward-compatible `isTemporary`/`expiresAt`/`tempKind` fields, so
the future work is additive.

## Test plan

- Domain: `ASSIGNMENT_MODES` includes department; `isAssignmentMode('department')`.
- inMemory repo: `assign` department mode; `transfer` employee↔employee, →department, →branch, →warehouse
  path uses `returnAsset`; throws when no active assignment; audit entries (returned+assigned) written;
  asset cache updated; mail enqueued for employee destination.
- Rules: department-mode create allowed for asset_admin; employee self-read fail-closed for department doc;
  update still limited to endedAt/transferComment.
- UI: drawer select mode toggles; select-all; transfer bar appears at ≥1; `onTransferAssets` fires with
  correct ids + destination; confirm gates the call.
- Page: `handleTransferAssets` routes warehouse→returnAsset, others→transfer; reload refreshes drawer.

## Out of scope

- «Временно» / intern / audit kinds.
- Changing HandoverModal's 2-step wizard structure (only its confirm persistence is wired).
- Act-of-acceptance scan upload in the drawer transfer (transfers here are comment-less, scan-less;
  the heavier act flow stays in the asset-detail AssignmentForm).
