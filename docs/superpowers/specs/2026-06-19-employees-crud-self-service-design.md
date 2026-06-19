# Employees CRUD + Email-Link Self-Service Landing — Design Spec

**Date:** 2026-06-19
**Status:** Approved (owner-driven default chosen for the linkage fork; see §2)
**Depends on:** assignments-act-scan (shipped), auth-route-guards-security-rules (shipped)

## 1. Goal

Resolve the deferred dependencies the assignments feature flagged:

1. `EmployeeRow` has no `email` field → notification mail can't be enqueued.
2. Employee docs aren't uid-keyed → the employee self-service read paths (audit_logs employee-scoped read, `acts/` storage read) don't function for real employees.
3. There is no Employees CRUD UI and no working employee self-service landing.

This iteration delivers: an Employee domain entity + repository (InMemory + Firestore, all mutations via `withAudit`), a uid-keyed linkage that makes the already-shipped self-service rules correct by construction, Employees CRUD UI (list/create/edit/detail), the email-link self-service landing pages (My Assets, My Acts, Profile), real notification-mail enqueue with the employee's email, `/employees` firestore rules with tests, and a mandatory security review.

## 2. The employee ↔ uid linkage (deferred decision #1) — RESOLVED

### The fixed constraint

Two already-shipped rules compare the employee identifier stored on assignment/asset docs to the caller's auth uid:

- `firestore.rules` audit_logs employee read: `resource.data.after.assignedToEmployeeId == request.auth.uid`
- `storage.rules` `acts/{assetId}/*` read: `assets/{assetId}.data.assignment.employeeId == request.auth.uid`

Therefore the value written into `assignedToEmployeeId` / `assignment.employeeId` **must equal the employee's Firebase Auth uid** for self-service to work. The rules cannot do a cheap reverse lookup ("find the employee doc whose authUid field == my uid").

### Decision: uid-keyed employee docs (`employees/{uid}`)

The employee record id **is** the person's Firebase Auth uid, and it is the **same id** as their `users/{uid}` doc. One person = one uid = `users/{uid}` (role + status) + `employees/{uid}` (HR profile: name, email, branch, department, position, status).

**Consequences:**

- `assignment.employeeId` and `assignedToEmployeeId` store that uid. Self-service rules work **unchanged** — no rules edit needed for the comparison itself.
- No Cloud Function and no `authUid` reconciliation field needed.
- Aligns with the standing **"first-login access-pending, no auto-provision"** decision: an admin onboards a person by creating `users/{uid}` (role=employee) and `employees/{uid}` (profile). The person then signs in via email-link and resolves to exactly that uid.

**Onboarding sequence (documented, partly Phase-1, partly noted as operational):**

1. Person signs in once via email-link → Firebase Auth mints a uid → `users/{uid}` does not exist yet → app shows **AccessPending**. (Already shipped.)
2. A super_admin / asset_admin sees the pending person (out of scope for THIS plan — pending-user discovery is a later admin tool) OR, in the Phase-1 reality, the admin **creates the employee record with the uid in hand**. Because Firebase mints uids non-deterministically, the create form takes the **uid as the record id**. The list/create UI supports entering the uid (copied from the access-pending screen / Firebase console) OR — the common path — editing an employee that the system surfaces.

> **Pragmatic Phase-1 stance:** the create form's "id" field is the uid. For the MVP we accept that an employee record is keyed by uid and that an admin supplies it. A future iteration adds a "pending users" inbox that turns a signed-in-but-roleless user into one click "make employee". This iteration does NOT build that inbox; it builds the data model + CRUD that the inbox will later drive. This is called out as a non-blocking owner follow-up.

**Email is the human join key + uniqueness guard.** `employees/{uid}.email` is unique across the collection (validated in the repository, mirrored by a rules check on create/update). Admin-facing flows match on email; the uid is the machine key.

### Why not random-id + authUid (rejected)

`employees/{autoId}` + a separate `authUid` field stamped on first login would: (a) break self-service for any employee assigned an asset before they ever signed in (the stored doc-id never equals a uid), (b) require a Cloud Function to stamp `authUid`, (c) require a rules change to compare against `authUid` via a cross-doc get (expensive / fragile). Rejected.

## 3. Domain model

### `Employee` entity — `src/domain/employee/types.ts`

```ts
export const EMPLOYEE_STATUSES = ['active', 'terminated'] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export interface Employee {
  id: string            // == Firebase Auth uid == users/{uid} id
  firstName: string
  lastName: string
  email: string         // corporate email, unique, used for email-link auth + mail
  position: string | null
  branchId: string | null
  departmentId: string | null
  status: EmployeeStatus
  terminatedAt: string | null   // ISO; set when status -> terminated
  createdAt: string             // ISO
  updatedAt: string             // ISO
}
```

i18n tiering (per the 4-tier strategy): `firstName`, `lastName`, `position` are **Tier-3 free text** (stored as typed, rendered as-is — Russian names are common). `email` is **Tier-4 English-only**. No multi-lang storage on the employee record.

### `EmployeeRepository` port — `src/domain/employee/EmployeeRepository.ts`

```ts
export interface CreateEmployeeInput {
  id: string                    // the uid (record key)
  firstName: string
  lastName: string
  email: string
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}
export interface UpdateEmployeeInput {
  firstName?: string
  lastName?: string
  email?: string
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}

export interface EmployeeRepository {
  listEmployees(query?: EmployeeListQuery): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee | null>
  isEmailTaken(email: string, exceptId?: string): Promise<boolean>
  createEmployee(input: CreateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  updateEmployee(id: string, patch: UpdateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  setStatus(id: string, status: EmployeeStatus, actor: Actor): Promise<AuditedResult<Employee>>
}

export interface EmployeeListQuery {
  status?: EmployeeStatus | 'all'
  branchId?: string | 'all'
  departmentId?: string | 'all'
  search?: string
}
```

All four mutating methods (`create`, `update`, `setStatus`) run inside `withAudit` — exactly one `audit_logs` entry per call. `Actor` is imported from `@/domain/asset` (existing).

### Audit extension

`AuditEntityType` gains `'employee'`. `AUDIT_ACTIONS` gains `'terminated'` and `'reactivated'` (for `setStatus`). `created` / `updated` already exist and are reused.

### `EmployeeRow` evolution

The thin `EmployeeRow` (`{ id, firstName, lastName }`) used by the assets reference data **gains `email`** (`{ id, firstName, lastName, email }`). This is the minimal additive change so the assignment flow can resolve the employee's email for mail enqueue. `firstName`/`lastName` become `string | null` still (ref-data tolerance), but the full `Employee` entity uses non-null name fields. The asset reference-data loader (`FirestoreAssetRepository.fetchReferenceData`) reads `email` into the employee ref rows.

## 4. Repository adapters

### `InMemoryEmployeeRepository` — `src/infra/repositories/inMemoryEmployeeRepository.ts`

Mirrors `InMemoryAssetRepository`'s structure: constructor takes a shared `Employee[]` + an `AuditContext`. Mutations push/replace in the array inside `withAudit`. `setStatus` to `terminated` stamps `terminatedAt`; to `active` clears it (reactivation). `isEmailTaken` is case-insensitive. Email uniqueness + "employee not found" throw before the audit txn.

### `FirestoreEmployeeRepository` — `src/infra/repositories/firestoreEmployeeRepository.ts`

Mirrors `FirestoreAssetRepository`: `toIso` + `toEmployee` mappers, `serverTimestamp()` on writes, all mutations through `withAudit(this.audit, spec, txn => {...})`. `createEmployee` writes `employees/{input.id}` (uid-keyed — uses `doc(db, 'employees', input.id)`, NOT `doc(collection(...))`). It throws if the doc already exists (no overwrite) and if `isEmailTaken`. `isEmailTaken` queries `where('email','==',email) limit(2)`. `setStatus` merges `status` + `terminatedAt`.

## 5. Email-link self-service

### Linkage in AuthContext

`AuthContext` already resolves `users/{uid}.role`. For an employee, `user.id === uid === employees/{uid}.id`. The self-service pages use `user.id` to query their own assets and acts. No new auth wiring is needed — the existing `fetchUserRole(uid)` + `user.id` is the bridge. (The employee's *profile* — name/email — is read from `employees/{uid}` on the Profile page; identity for display comes from Firebase Auth as today.)

### Self-service pages

Three Phase-1 employee routes already exist as stubs in nav (`my-assets`, `my-acts`, `profile`). This plan replaces the stubs with real pages:

- **MyAssetsPage** (`/my-assets`): lists assets where `assignment.employeeId == user.id`. Read via a new `AssetRepository.listAssetsForEmployee(uid)` (Firestore: `where('assignment.employeeId','==',uid)`; InMemory: filter). Read-only cards.
- **MyActsPage** (`/my-acts`): lists the employee's assignments that have an `actStoragePath`, via a new `AssignmentRepository.listAssignmentsForEmployee(uid)` (Firestore: `where('assignedToEmployeeId','==',uid)`, has actStoragePath). Each row opens the scan (storage rules already permit the assigned employee to read).
- **ProfilePage** (`/profile`): read-only display of the employee's own `employees/{uid}` record (name, email, position, branch, department, status). Read via `EmployeeRepository.getEmployee(user.id)`.

All three are gated by `RoleGate roles={['employee']}` (already wired by route config). They MUST tolerate "no employee doc yet" gracefully (a signed-in employee whose profile hasn't been created shows an empty/info state, never a crash).

### Notification mail (deferred decision #2) — RESOLVED

`EmployeeRow` now has `email`. `AssetDetailPage.handleAssign` resolves the employee's email from ref data and passes `employeeEmail` to `repoAsn.assign(...)`. The assignment repo enqueues `mail/{id}` with `{ to: [email], message: { subject, text, html } }` only when `mode === 'employee' && employeeEmail`. **Locale choice:** the mail body stays a single language for MVP — **Russian** (the real customer audience; default UI language). This is noted as a follow-up for the Phase-2 notifications matrix (which will template + localize per the employee's `preferredLocale`). Payload is minimal: email + invCode + assignee name.

## 6. firestore.rules — `/employees`

The `/employees/{id}` block already exists (read any signed-in; write super|asset_admin). This plan **tightens** it to:

- **Read:** any signed-in admin (super/asset/tech) OR the employee reading their OWN doc (`request.auth.uid == id`). An employee must NOT read other employees' PII.
- **Create / Update:** super_admin OR asset_admin (per the role matrix). Plus a guard: the doc id must be a non-empty string (it's a uid); `email` must be present.
- **Delete:** `if false` (employees are soft-deleted via `status: 'terminated'`, never hard-deleted — Phase-3 bulk redistribution handles the rest).

> **Email-uniqueness in rules:** Firestore rules cannot enforce cross-document uniqueness (no aggregate query). Uniqueness is enforced in the repository layer (`isEmailTaken`) before the write. The rules guarantee role + shape + self-read scoping; the app guarantees uniqueness. This split is documented and is the standard Firestore pattern. (A future hardening could add a `/employee_emails/{emailHash}` uniqueness-token collection; out of scope.)

Rules tests (run in CI; Java unavailable locally) cover: admin read-all, employee self-read-only, employee cannot read another employee, role-gated write, employee cannot write, delete forbidden for everyone.

## 7. Employees CRUD UI

Port `prototypes/employees.html` onto the existing dark/orange primitives (`PageHeader`, `SectionCard`, `Btn`, `Icon`, `Chip`, `Field`, `Input`, `Select`, `EmptyState`, `LoadingState`, `ErrorState`). Components under `src/components/features/employees/`:

- **EmployeesPage** (`/employees`): list with status/branch/department filters + search, paginated client-side (mirrors AssetsPage). "Create employee" primary action gated by `canMutate = super_admin || asset_admin`. Row click → `/employees/:id`.
- **EmployeeForm** (create + edit): firstName, lastName, email, position, branch (Select), department (Select). Create mode additionally requires the **uid** (record id) field with a clear hint. Email-format + uniqueness validation (uniqueness surfaced from the repo error). Reuses branch/department ref data from the asset reference loader (or a small dedicated loader).
- **EmployeeDetailPage** (`/employees/:id`): profile card + status chip + Terminate/Reactivate action (gated) + a panel showing the employee's assigned assets and signed acts (reuses `listAssetsForEmployee` / `listAssignmentsForEmployee`). Admins can view any employee's assets+acts.

i18n: a new `employees` namespace (ru/en/hy) for all chrome strings, registered in `src/lib/i18n/index.ts`. Empty/loading/error states everywhere.

## 8. Routing

`PHASE_STUB_ROUTES` currently includes `employees`, `my-assets`, `my-acts`, `profile`. Remove those four from the stub list and add real routes in `src/config/routes.tsx`:

- `/employees` → `EmployeesPage` (RoleGate super_admin|asset_admin)
- `/employees/new` → `EmployeeCreatePage` (RoleGate super_admin|asset_admin)
- `/employees/:id` → `EmployeeDetailPage` (RoleGate super_admin|asset_admin)
- `/my-assets` → `MyAssetsPage` (RoleGate employee)
- `/my-acts` → `MyActsPage` (RoleGate employee)
- `/profile` → `ProfilePage` (RoleGate employee)

## 9. Testing

- Domain: `employee-types.test.ts` (guards, shape).
- InMemory repo: create/update/setStatus via withAudit (1 audit each), email-uniqueness throw, terminatedAt stamping, reactivation clearing, listForEmployee filters.
- Firestore repo: typecheck-only (production path, exercised by rules tests + manual), mirroring the assignment repo precedent.
- Components: EmployeesPage (list/empty/filter), EmployeeForm (validation), MyAssetsPage (self-scope), ProfilePage (no-doc tolerance) via Testing Library + InMemory repos.
- i18n: render-resolution test for the new namespace in ru/en/hy.
- Rules: `/employees` read/write/self-scope/delete in `tests/rules/firestore.rules.test.ts` (CI).

Verification: `npm run typecheck`, `npm run test` (Vitest, all green, no regressions from the existing 178), `npm run build`. Rules: `npm run test:rules` (CI if no local JVM).

## 10. Non-blocking owner follow-ups (enumerated in the final report)

1. **Pending-users inbox** — a one-click "promote signed-in-but-roleless user → employee" admin tool (this plan builds the data model it will drive, not the inbox).
2. **Localized mail** — mail body is Russian-only for MVP; Phase-2 notifications matrix templates + localizes per `preferredLocale`.
3. **`preferredLocale` on the user/employee** — not modeled this iteration (UI language is detected/persisted client-side via i18next localStorage today).
4. **Email-uniqueness token collection** — repository-layer uniqueness is the MVP guarantee; a `/employee_emails` token collection would make it race-proof at the rules layer.

## 11. Self-review

- Placeholders: none.
- Consistency: the uid-keying decision is applied uniformly (domain id, repo write key, rules self-read, self-service queries, mail resolution). The audit extension is additive and matches the existing union pattern.
- Scope: one iteration; employees data model + CRUD + self-service + mail wiring + rules. The pending-users inbox is explicitly excluded.
- Ambiguity: the "who supplies the uid at create" question is made explicit (admin supplies it; future inbox automates it) rather than left implicit.
