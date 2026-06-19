# Feature — Pending-users onboarding, audit-rule hardening, profile ref loader fix

> Product spec (the WHAT). The implementation playbook (the HOW) is
> `docs/superpowers/plans/2026-06-19-pending-users-onboarding.md`.

Status: APPROVED (owner sign-off; source-of-truth = Option A self-claim). Phase 1.

## Problem

Today a person who signs in with Google/email-link but has no `users/{uid}` role
doc lands on `AccessPendingPage` and is stuck. There is no record of them anywhere
a super_admin can see, so granting access means manually creating a `users` doc by
hand. We need a self-service onboarding loop:

1. A first-time signed-in user is **recorded** (self-claims a `no-role` users doc).
2. A super_admin **sees** the queue of pending users.
3. A super_admin **promotes** one: assigns a role; optionally creates/links an
   employee record when the role is `employee`.

Two adjacent fixes ride along:

- **Audit rule hardening** — tighten the `audit_logs` create rule shape so the new
  `entityType:'user'` / `role_assigned` rows are explicitly valid and the payload
  shape is constrained.
- **Profile ref loader** — the employee `ProfilePage` calls `loadReferenceData()`
  which lists `/employees` (denied for employees) → branch/department names never
  resolve. Extend `loadSelfServiceRefData()` to also return branches + departments
  (both already `read: isSignedIn()`).

## Roles & scope

- **Self-claim:** any signed-in user, for their OWN `users/{uid}` doc only.
- **Pending list + promotion:** `super_admin` only — enforced in BOTH the UI
  (RoleGate + nav `allow`) AND `firestore.rules` (role grants are super-only).
- **Profile ref loader:** any signed-in user (employee self-service).
- MVP boundary respected. No Phase 2/3 work.

## User stories

1. As a **new signed-in user with no role**, when I land on AccessPending, the
   system records me as `no-role` so an admin can find me — without me being able
   to grant myself any role.
2. As a **super_admin**, I can open a "Pending users" page, see everyone awaiting
   access (email, display name, when they signed in / were recorded), and assign
   each a role.
3. As a **super_admin** assigning the `employee` role, I can additionally
   **link an existing employee** record to that uid OR **create a new** employee
   record (id = uid) in the same flow.
4. As an **employee**, my Profile page shows my real branch and department names,
   with zero denied Firestore queries.

## Functional requirements

### Self-claim (Task 1a)
- `User.status` domain type gains `'no-role'` alongside `'active' | 'terminated'`.
- AuthContext's `no-role` branch fires a best-effort, idempotent `claimPendingUser()`:
  merge-writes `users/{uid} = { email, displayName, status:'no-role' }` with **NO
  `role` key**. The write is fire-and-forget; any failure is swallowed and MUST
  NEVER block / crash `AccessPendingPage`.
- Self-claim is idempotent: re-running it for an already-claimed or already-roled
  user does not change role and does not error the UI.

### Rule guard for self-write (Task 1a — rules)
- A signed-in self-write of one's OWN `users/{uid}`:
  - **create** allowed only when payload has NO `role` key and `status == 'no-role'`.
  - **update** allowed only when it introduces/changes NO `role` field and the
    `status` is unchanged (existing behaviour) OR is being set to `'no-role'` by self.
  - Self role-escalation is impossible. Only super_admin may introduce/change `role`.
- Existing self-or-super **read** scoping on `/users` is preserved.

### Pending list (Task 1b)
- A super_admin-only repository read returns users `where status == 'no-role'`,
  newest first if an ordering signal exists (else stable order).
- UI: a super_admin-gated "Pending users" surface (new nav item, super_admin only,
  in the `system` nav group) listing pending users (email, display name, recorded
  time). Empty, loading, and error states all present.

### Promotion (Task 1b)
- A super_admin-gated repository method run through `withAudit()`:
  - assigns the chosen role and sets `status: 'active'` on `users/{uid}`.
  - writes exactly one audit row: `entityType:'user'`, `action:'role_assigned'`,
    `before:{ role: null|prev, status:'no-role' }`, `after:{ role, status:'active' }`.
- If the assigned role is `employee` AND the admin chose "create/link employee":
  - **link existing:** no employee doc is created if it already exists at id=uid;
    the promotion still records the role.
  - **create new:** an employee doc (id = uid) is created via the employee repo's
    `createEmployee`, which itself audits per the chokepoint contract (a SECOND
    audit row, `entityType:'employee'`, `action:'created'`). Two mutations →
    two audit rows, each in its own `withAudit()` unit.
- Role select offers the four roles per the matrix. The employee link/create
  branch surfaces only when the selected role is `employee`.
- i18n ru/en/hy for every user-facing string.

### Audit-rule hardening (Task 2)
- Already enforced (verified live): `actorUid == auth.uid`, `actorRole == role()`,
  `at == request.time`, `hasAll` required keys, `hasOnly` allowed keys; spoof /
  backdate / extra-key denials are covered by existing tests.
- ADD only what is genuinely missing:
  - constrain `entityType` and `action` to be non-empty strings,
  - constrain `before`/`after` to be a map or null,
  - a rules test asserting the new `entityType:'user'` / `role_assigned` row
    created by promotion PASSES the create rule.
- If a sub-item is already satisfied by the live rule, DOCUMENT it as already-met
  rather than inventing churn.

### Profile ref loader (Task 3)
- `SelfServiceRefData` gains `branches: RefRow[]` and `departments: RefRow[]`.
- `loadSelfServiceRefData()` (both Firestore + InMemory adapters) returns them,
  reading `/branches` + `/departments` (both already `read: isSignedIn()`).
- `ProfilePage` points its `loadRefData` at `loadSelfServiceRefData()` instead of
  `loadReferenceData()`. The `.catch` fallback shape and the prop default update.
- Employee profile resolves real branch/department names with NO denied queries.

## Out of scope (explicit)
- Terminating / re-disabling a user from the pending UI.
- Bulk promotion.
- Editing role of an already-active user from this surface (that stays the future
  Roles & access page, currently a stub).
- Any Phase 2/3 feature.

## Acceptance
- Typecheck clean; existing 212 tests still pass; new tests additive; build green.
- `withAudit()` chokepoint preserved (exactly one audit row per mutation txn).
- Role grants super-gated in BOTH UI and rules.
- spec-reviewer → code-quality-reviewer → security-reviewer all PASS.
