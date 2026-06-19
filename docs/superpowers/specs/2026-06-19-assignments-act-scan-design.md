# Assignments + Act-of-Acceptance Scan Upload — Design Spec

**Status:** APPROVED (owner pre-approved design; (A)/(B)/(C) sign-off answered YES).
**Date:** 2026-06-19
**Phase:** Phase 1 (MVP) — assign/return flow with act-of-acceptance scan upload + employee self-service read.

---

## 1. Goal

Let an admin (super_admin | asset_admin) **assign** an asset to an employee or a branch,
optionally attaching a scan of the signed act-of-acceptance, and later **return** that
asset to the warehouse. Every mutation is atomic and writes exactly one `audit_logs`
entry in the same transaction (via `withAudit()`). Assigned employees can read the scan
of the act they signed.

## 2. Approved decisions (do NOT re-deliberate)

- **(A) Two assignment modes only:** `employee` | `branch`. Department assignment is
  DEFERRED this iteration. (The `assignments` doc schema still uses discrete reference
  fields so a future `department` mode is additive, not a refactor.)
- **(B) Upload-before-transaction:** the act scan is uploaded to Cloud Storage BEFORE the
  `withAudit` transaction runs. A transaction that fails afterward may orphan a harmless
  scan file in Storage. ACCEPTED — documented as a known non-blocking tradeoff. No
  compensating delete is implemented this iteration.
- **(C) Employee scan read enforced in `storage.rules`** via cross-service
  `firestore.exists()` against an active assignment doc. Confirmed supported by
  Firebase Storage rules.

## 3. Data model

### 3.1 `assignments/{id}` — immutable history docs

| Field | Type | Notes |
|---|---|---|
| `assetId` | string | The asset being assigned. |
| `mode` | `'employee' \| 'branch'` | Two modes this iteration. |
| `assignedToEmployeeId` | string \| null | Set when `mode === 'employee'`. |
| `assignedToBranchId` | string \| null | Set when `mode === 'branch'`. |
| `startedAt` | Timestamp | Server timestamp at assign time. |
| `endedAt` | Timestamp \| null | `null` while the assignment is active. Set on return. |
| `actStoragePath` | string \| null | Storage path of the uploaded act scan; `null` if none. |
| `transferComment` | string \| null | Optional free text (Tier-3). |
| `createdBy` | string (uid) | Actor who created the assignment. |
| `createdAt` | Timestamp | Server timestamp. |

**Invariant:** at most ONE active (`endedAt == null`) assignment per asset at a time.
Enforced by the application flow (the asset must be in `st_warehouse` to assign; assigning
moves it to `st_assigned`; returning clears it).

### 3.2 Asset denormalized current-state cache

On assign/return the asset's existing fields are updated in the SAME transaction:
- `statusId`: `st_assigned` (assign) / `st_warehouse` (return).
- `assignment`: `{ mode, employeeId? , branchId? }` (assign) / `null` (return).

This reuses the existing `Asset.assignment: AssetAssignment | null` field — the table and
detail page already render it. No asset schema change.

### 3.3 `mail/{id}` — Trigger Email queue (employee mode only)

Payload shape (matches the Firebase Trigger Email extension):
```
{
  to: [employeeEmail],
  message: { subject, text, html },
}
```
Body contains ONLY: employee email (the `to`), the asset `invCode`, and the assignee
display name. NO secrets, NO PII beyond that. Branch-mode assignments do NOT enqueue mail
(no human recipient).

## 4. Transactional flows (each is one `withAudit` transaction)

### 4.1 Assign

Pre-step (outside txn): if an act scan file is provided, upload it to
`acts/{assetId}/{fileName}` in Cloud Storage; capture `actStoragePath`. (Decision B.)

Inside the `withAudit` transaction:
1. Create `assignments/{newId}` (active: `endedAt = null`, with `actStoragePath`).
2. Update `assets/{assetId}`: `statusId = 'st_assigned'`, `assignment = {mode, ...}`.
3. If `mode === 'employee'`: create `mail/{newId}` with the Trigger Email payload.
4. `withAudit` writes one `audit_logs` entry: `entityType:'assignment'`, `action:'assigned'`.

Guard: asset must exist and be in `st_warehouse` (not already assigned/disposed).

### 4.2 Return

Inside the `withAudit` transaction:
1. Find the active assignment for the asset; set its `endedAt = serverTimestamp()`.
2. Update `assets/{assetId}`: `statusId = 'st_warehouse'`, `assignment = null`.
3. `withAudit` writes one `audit_logs` entry: `entityType:'assignment'`, `action:'returned'`.

Guard: asset must exist and be in `st_assigned`.

## 5. Security rules

### 5.1 `firestore.rules`

- `/assignments/{id}` — the EXISTING rule already matches the approved shape:
  - read: any signed-in
  - create: super | asset_admin
  - update: super | asset_admin, ONLY `endedAt` + `transferComment` keys
  - delete: never

  **Extension this iteration:** none required for the assignments block itself. (Verified.)

- `/mail/{id}` — NEW block:
  - create: super | asset_admin
  - read, update, delete: never (no client read)

- `/audit_logs` read for employees — the EXISTING rule scopes employee reads to
  `after.assignedToEmployeeId == request.auth.uid`. Our `assigned` audit entry MUST
  carry `after.assignedToEmployeeId` for that path to function. (See §7 owner note.)

### 5.2 `storage.rules` — replace the deny-all stub

`acts/{assetId}/{fileName}`:
- **write:** super | asset_admin AND `request.resource.size <= 10MB` AND
  `request.resource.contentType` in {`image/jpeg`, `image/png`, `application/pdf`}.
  Role resolved via cross-service `firestore.get(/users/$(uid)).data.role`.
- **read:** any admin OR an employee who has an ACTIVE assignment of that asset to them,
  resolved via cross-service `firestore.exists()` / a query is not possible in rules, so
  read uses: admin OR
  `firestore.get(/assignments/...).data.assignedToEmployeeId == uid && endedAt == null`.
  Because rules cannot enumerate the assignments collection, the asset's denormalized
  `assignment` field is the practical anchor: an employee may read iff
  `firestore.get(/assets/$(assetId)).data.assignment.employeeId == request.auth.uid`
  (the active assignment is mirrored on the asset). This avoids needing the assignment
  doc id in the rule. (Confirmed cross-service get supported.)
- everything else: deny.

## 6. UI

- **LifecycleActions:** add an **Assign** action, visible to super | asset_admin when the
  asset is in `st_warehouse`. (Return already exists via `changeStatus` → now routed
  through the assignment Return flow.)
- **AssignmentForm:** pick mode (employee | branch) → pick recipient → optional act-scan
  file input (JPEG/PNG/PDF, ≤10MB, client-side validated) → optional comment → submit.
- **AssignmentHistory panel:** lists `assignments` for the asset, newest first, with
  mode, recipient name, started/ended dates, and a link/affordance when a scan exists.
- Empty / loading / error states for the history panel.
- Role-gated in UI (mirrors rules). i18n ru/en/hy.
- Visual language: dark/orange, ported from `prototypes/employees.html` +
  `asset-detail.html`.

## 7. Owner decisions surfaced (non-blocking)

1. **Employee identity vs `users.uid`:** the `audit_logs` employee-read rule and the
   storage employee-read rule both compare against `request.auth.uid`. That requires the
   employee's `assignedToEmployeeId` to EQUAL their Firebase Auth uid. Today `employees`
   is a separate collection with its own doc ids. For the employee self-service read path
   to work, either (a) employee docs must be keyed by the auth uid, or (b) a mapping is
   needed. THIS ITERATION: we store `assignedToEmployeeId` as the employee-collection id
   and the read rules compare to `uid`; the employee read path therefore only works once
   employee docs are uid-keyed (a documented follow-up). Admin read/write is unaffected.
2. **Orphaned scan files** (Decision B) — no cleanup job this iteration.
3. **Department assignment** — deferred (Decision A).
4. **`transferComment` on assign** — stored on the assignment doc at create; the
   update-only-`endedAt`+`transferComment` rule still permits editing it later.
