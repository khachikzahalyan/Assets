# Critical fixes pack — 2026-07-21

Owner-approved package: 4 critical fixes + 1 minor. No git ops, no deploys (rules/functions edits allowed; deploy listed in report).

Hard rule for all agents: NEVER edit files via PowerShell Get-Content/Set-Content/WriteAllText (breaks UTF-8 no-BOM). Only Read/Write/Edit tools.

## Fix 1 — invCode uniqueness lock

Problem: `firestoreAssetRepository.isInvCodeTaken` is read-then-write outside a txn → two concurrent admins can create duplicate invCode.

Design:
- New collection `/inv_codes/{lockId}`, `lockId = encodeURIComponent(invCode)` ('/' not allowed in doc ids; '%' is). Doc: `{ assetId, invCode, createdAt }`.
- `createAsset` (firestore): keep fast pre-checks; inside the existing `withAudit` transaction do `txn.get(invLockRef)` FIRST (reads before writes), throw `DuplicateInvCodeError` if exists, then `txn.set(assetRef)` + `txn.set(invLockRef)`. Fully atomic with asset + audit — better than the two-txn barcode pattern, no compensation needed.
- Domain error `DuplicateInvCodeError extends Error` in `src/domain/asset` with message keeping prefix `Inventory code already in use: <code>` — existing UI regex `/inv/i` → `validation.invTaken` keeps working, no new i18n key.
- `firestore.rules`: add `/inv_codes/{code}` block mirroring `/barcodes/{code}`.
- InMemory repo: same semantics (lock registry + same error class), used by batch atomicity too.

## Fix 2 — employee termination redesign

(а) In-place status flip:
- `archiveEmployee`: no more move to `former_employees` + delete. Merge-set on `employees/{id}`: `status:'terminated'`, `terminatedAt`, `terminatedBy`, `updatedAt/By`. Audit 'terminated' unchanged.
- `restoreEmployee`: if `employees/{id}` exists with status 'terminated' → flip to 'active' (terminatedAt:null); else legacy fallback: move `former_employees/{id}` → `employees/{id}` (backward compat, existing behavior).
- `listFormerEmployees`: union of employees-with-status-'terminated' + legacy `former_employees` docs (dedupe by id, employees doc wins). Keeps `useEmployeesData` status filter working unchanged (default 'active' as now).
- No migration script. Legacy docs remain readable via the union.
- Terms: reuse existing `'terminated'` (already in EMPLOYEE_STATUSES and /users).

(б) Active-assignments block:
- Extend `EmployeeArchiveError` reason union with `'active-assets'`.
- New ctor param on both employee repos: `activeAssetsCheck?: (employeeId: string) => Promise<boolean>`; `archiveEmployee` throws `EmployeeArchiveError('active-assets')` when true.
- `factories.getSharedEmployeeRepositoryWithGuard`: wire `activeAssetsCheck` via `getSharedAssetRepository().listAssetsForEmployee(id)` length > 0.
- UI: drawer button already opens HandoverModal (owner-approved flow, DO NOT rework). `handleHandoverConfirm` currently archives even with unreturned rows — server guard becomes the backstop; catch maps `guard.active-assets` toast (new i18n keys ru/en/hy).

(в) beforeCreate gate:
- `/employees` email lookup must pass ONLY active (missing status field = active for legacy docs, terminated = deny). Implement by fetching matching docs (limit a few, both casings) and checking `status !== 'terminated'` in code (no composite-index dependency). `/users` check unchanged.
- functions tests: terminated employee → deny; active → allow; legacy no-status → allow.

(г) Re-hire via restore:
- New repo method `findByEmail(email): Promise<Employee | null>` (employees, both casings; fallback legacy former_employees).
- `createEmployee`: if email belongs to terminated employee → throw `EmployeeEmailTerminatedError(employeeId)` (domain error); active → existing 'Email already in use'.
- UI `handleSaveForm` catch: on `EmployeeEmailTerminatedError` → close form, resolve the terminated Employee, `setRestoreTarget(emp)` (reuses existing RestoreConfirmModal) + hint toast. i18n keys ru/en/hy.

## Fix 3 — optimistic locking on updateAsset

- Interface: `updateAsset(id, patch, actor, opts?: { expectedUpdatedAt?: string })` (backward compatible — omitted opts = old behavior).
- Firestore impl: inside withAudit mutate, `txn.get(assetRef)` first; not-exists → not found; when `expectedUpdatedAt` provided and differs from stored `updatedAt` (ISO-normalized) → throw `ConcurrentEditError` (domain error, `src/domain/asset`). Merge write in same txn. Serial pre-check stays outside (queries not allowed in txn).
- InMemory: same semantics.
- i18n: `assets:validation.concurrentEdit` = «Запись изменена другим пользователем — обновите страницу» (ru/en/hy).
- UI: no current updateAsset caller exists (verified by grep). Add the key + export the error; wire mapping in the asset-detail mutation error surface if one exists; otherwise documented in report as ready-for-first-caller.

## Fix 4 — atomic batch create

- `createAssetsBatch` (firestore): single `runTransaction`. Per asset ops: asset doc + inv_codes lock + barcode lock + audit doc = 4 writes. Cap: throw clear domain error when `inputs.length > 100` (500-op txn limit; real batches are ~10s).
- Reads phase (all before writes): per input — invCode lock; barcode candidates (preferred + N generated), pick first free ensuring within-batch distinctness.
- Audit: one 'created' entry per asset written in the SAME txn. Extract shared `buildAuditDocData(spec)` helper in `src/lib/audit/withAudit.ts` reused by `firestoreAuditContext` (no payload drift).
- `oemLicense` in batch inputs: throw domain error (group-mode UI never sends it; fail fast beats silent partial atomicity).
- InMemory batch: validate all → insert all (no partial state on failure), same error semantics.

## Мелочь 5 — toast variant

- `ToastContext`: `showToast(text, opts?: { variant?: 'success' | 'error' })`, default 'success' (unchanged visuals). Error variant: rose tone + `alert-circle` icon, `role="alert"`.
- Update all failure-path `showToast` calls in employees page files (`useEmployeesActions`) to `{ variant: 'error' }`.

## Tests

- inMemory asset repo: invCode lock (second same-code create rejects), batch all-or-nothing, updateAsset optimistic lock (+ back-compat no-opts).
- inMemory employee repo: in-place archive/restore, active-assets guard, terminated-email create error, legacy former restore.
- functions: beforeCreate status gate.
- UI: toast error variant; restore-hint flow on create-with-terminated-email.

## Verification

- `npm run build`
- `cd functions && npm run build; npx vitest run`
- `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4`

## Deploy required (later, operator step)

- `firestore.rules` (new `/inv_codes` block) → `npx firebase deploy --only firestore:rules`
- Cloud Functions (`beforeCreate` gate) → `npx firebase deploy --only functions`
