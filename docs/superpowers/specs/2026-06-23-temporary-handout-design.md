# Design — «Временно» temporary hand-out (Intern / Audit) from the Employee Drawer

Date: 2026-06-23
Branch: `feat/employees-prototype-parity`
Feature slug: `employees-temporary-handout`

## Problem

Admins need to temporarily hand an asset to a lightweight, anonymous holder —
**Стажёр (Intern)** or **Аудит (Audit)** — with a **return date**, and see at a glance
"this asset is temporarily with an Intern/Audit, due back on DD.MM". When the return
date is ~1 day away the system must surface "this asset must be returned".

Interns and auditors are **NOT employee records**: no name, surname, email, phone.
It is enough to know the asset is held by "Стажёр" or "Аудит".

## What already exists (no work)

- **Domain** — `buildTransferPatch({ mode:'temporary', tempKind, expiresAt })`
  (`src/domain/asset/transferRules.ts`) returns
  `assignment:{ mode:'temporary', tempKind, expiresAt, isTemporary:true }`, status
  `st_assigned`, branch HQ. `AssetAssignment` (`src/domain/asset/types.ts`) carries
  `isTemporary`, `expiresAt`, `tempKind`.
- **Persistence** — both `changeStatus` adapters
  (`firestoreAssetRepository.ts`, `inMemoryAssetRepository.ts`) write the whole
  `assignment` object through, so temporary fields persist automatically + are audited.
- **Rules** — `/assets` write is `super_admin || asset_admin` with no per-field
  assignment shape restriction → temporary fields persist with NO rules change.
- **Reference UI** — the asset-detail `TransferPanel.tsx` already implements the exact
  Стажёр/Аудит + return-date flow with the create `DatePicker`. We mirror its UX.

## Scope (what we build)

### 1. DestPicker — add «Временно» destination
`src/components/features/employees/DestPicker.tsx`
- Extend `Destination` union with
  `{ kind:'temporary'; tempKind:'audit'|'intern'; expiresAt:string; label:string }`.
- 5th top option «Временно» (icon `timer`, rose accent).
- Third sub-panel (peer to employee/department/branch): Стажёр/Аудит segmented toggle
  + reused `DatePicker` (min = today, default = today+7d) + «Подтвердить».
- No identity inputs. Commit label `«Стажёр» · до DD.MM` / `«Аудит» · до DD.MM`.

### 2. EmployeesPage — map the new kind
`src/pages/EmployeesPage.tsx` `destToPatch`
- `temporary` branch → `buildTransferPatch({ mode:'temporary', tempKind, expiresAt })`.
- `handleTransferAssets` + `handleHandoverConfirm` loops persist it unchanged.

### 3. Temporary holder rendering
- **Asset-list `AssigneeCell`** + `mobileAssigneeName` (`AssetsTable.tsx`): add an
  explicit `kind === 'temporary'` branch (closes the latent gap where
  `assignment.mode==='temporary'` falls through to «На складе»). Renders «Стажёр / Аудит»
  + sub-line «Временно до DD.MM», colored by due-soon state.
- **Drawer linked-asset row**: chip label already renders `dest.label`; no change needed
  beyond the DestPicker chip.

### 4. 1-day-before "return due" — in-app default (heavy push flagged)
- Pure domain helpers in `src/domain/asset/temporaryHold.ts` (no Firebase):
  - `temporaryHoldStatus(assignment, now, dueWithinDays=1) → 'active'|'dueSoon'|'overdue'|null`
  - drives the temp sub-line color (amber «Возврат завтра» / red «Просрочено»).
- Surfaced in-app at read time → zero scheduled cost.
- **DEFERRED / flagged:** scheduled Cloud Function `scheduledTempReturnNotify` writing to
  the `mail` queue (Trigger Email) at `expiresAt − 1 day`. Feasible (functions workspace +
  Trigger Email pattern exist) but heavier than the stated need. Implement the in-app
  default; return the email/scheduling decision for the user to confirm.

## Sequencing (sequential, test-gated)
1. `domain-modeler`: `Destination` temporary variant + `temporaryHold.ts` helpers → tests.
2. `react-ui-engineer`: DestPicker «Временно» sub-panel + AssigneeCell/mobile temp branch +
   EmployeesPage `destToPatch` branch → tests.
3. `i18n-engineer`: employees-namespace keys ru/en/hy → tests.
4. Reviews: spec → quality → security (security REQUIRED — confirm no-rules-change
   reasoning + assess optional assignment shape-guard).

## Open decisions (returned with recommendations)
- **Notification channel/cadence** — recommend in-app due-soon indicator now; defer the
  scheduled-email Cloud Function until the user confirms push delivery.
- **Return-date default** — recommend **today + 7 days** ("handed out for 1 week").
- **Temporary holds list/filter** — recommend **not now**; status filter + temp sub-line
  cover visibility.
- **Optional rules shape-guard** — recommend leaving rules unchanged; security-reviewer
  rules on whether to add a defense-in-depth assignment guard.

## Non-goals
- No new employee/holder records for interns/auditors.
- No write-off / inventory-walk changes.
- No Phase 2/3 work. No merge — keep committing to `feat/employees-prototype-parity`.
