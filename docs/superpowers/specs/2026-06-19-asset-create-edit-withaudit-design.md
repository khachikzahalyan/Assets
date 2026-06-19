# Asset Create + Detail/Edit on withAudit() — Design Spec

Date: 2026-06-19
Status: Approved (owner-agent; owner forks enumerated in §9)
Iteration: 5 (follows: scaffold → app-shell → auth+rules → assets-list)

## 1. Goal

Ship the first real **mutation** feature for AMS: asset **create**, asset **detail/edit**,
and asset **status transitions** — every state-changing write routed through a shared
`withAudit()` helper that writes the business mutation and its `audit_logs` entry in one
Firestore transaction. No public mutation path may write state without an audit entry in
the same transaction. This is the hard invariant of the system.

Builds on the existing production app in `C:/Users/DELL/Desktop/assets-crm` (Vite 6 + React 19
+ TS-strict + Tailwind + shadcn + Firebase v9 + Vitest). Read side (assets list) already ships
on `FirestoreAssetRepository` / `InMemoryAssetRepository`. This iteration adds the write side.

Prototypes in `C:/Users/DELL/Desktop/Warehouse/prototypes/` (`preview.html`, `asset-detail.html`)
are the visual reference, ported onto production primitives + the dark/orange theme. The
orchestrator §9bis invariants OVERRIDE the prototypes wherever they conflict.

## 2. Non-goals (this iteration)

- No live Firebase project / emulator run locally (no Java). Rules tests authored, run in CI.
- No full License module UI. License coupling in the create transaction is a documented STUB
  seam (see §6). Workstation/server license collections are not built yet.
- No Phase-2/3 features (repairs cost tracking, write-off two-eyes approval, inventory walk,
  Excel import, batches). Status transitions on the detail page are simple `changeStatus` ops.
- No `onSnapshot` live subscription for the detail page — load-once + reload-after-mutation.

## 3. Domain model additions (`src/domain/`)

### 3.1 Audit (`src/domain/audit/types.ts`)
```ts
export type AuditEntityType = 'asset' | 'assignment' | 'upgrade' | 'license'
export type AuditAction =
  | 'created' | 'updated' | 'status_changed' | 'assigned' | 'returned'
  | 'transferred' | 'upgrade_added' | 'disposed' | 'sent_to_repair' | 'repair_completed'

export interface AuditLog {
  id: string
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  actorUid: string
  actorRole: Role
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  comment: string | null
  at: string            // ISO; serverTimestamp() in Firestore, Date.now() in InMemory
}

export interface AuditSpec {
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  actorUid: string
  actorRole: Role
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  comment?: string | null
}

/** Every mutating repo method returns this: new state + the audit log id. */
export interface AuditedResult<T> { value: T; auditId: string }
```

### 3.2 Upgrade (`src/domain/asset/upgrade-types.ts`)
```ts
export const UPGRADE_COMPONENTS = ['RAM', 'SSD', 'CPU', 'GPU', 'PSU', 'Other'] as const
export type UpgradeComponent = (typeof UPGRADE_COMPONENTS)[number]
// Monitor is NOT a component. SPEC_TRACKED drive the currentSpecs denormalization + auto-before.
export const SPEC_TRACKED: readonly UpgradeComponent[] = ['CPU', 'RAM', 'SSD', 'GPU']
export const SPEC_KEY: Record<'CPU'|'RAM'|'SSD'|'GPU', keyof AssetSpecs> =
  { CPU: 'cpu', RAM: 'ram', SSD: 'ssd', GPU: 'gpu' }

export interface UpgradeEvent {
  id: string
  component: UpgradeComponent
  before: string | null   // auto-derived from currentSpecs for SPEC_TRACKED; null otherwise
  after: string
  changedAt: string       // serverTimestamp() server-side
  changedBy: string       // request.auth.uid server-side
}
```

### 3.3 Repository write port (extend `AssetRepository`)
```ts
export interface CreateAssetInput {
  categoryId: string
  brand: string | null
  model: string | null
  type?: string | null          // furniture single-field shape (hasTypeField categories)
  invCode: string
  serial: string | null
  // statusId is DERIVED from assignment, never passed by the UI in create mode.
  assignment: AssetAssignment | null   // null => warehouse
  branchId: string
  deptId: string | null
  currentSpecs?: AssetSpecs | null
}
export interface UpdateAssetInput {
  brand?: string | null; model?: string | null; type?: string | null
  serial?: string | null; currentSpecs?: AssetSpecs | null
}
export interface Actor { uid: string; role: Role }

export interface AssetWriteRepository {
  createAsset(input: CreateAssetInput, actor: Actor): Promise<AuditedResult<Asset>>
  updateAsset(id: string, patch: UpdateAssetInput, actor: Actor): Promise<AuditedResult<Asset>>
  changeStatus(id: string, toStatusId: AssetStatusId, actor: Actor,
               opts?: { comment?: string; assignment?: AssetAssignment | null }): Promise<AuditedResult<Asset>>
  addUpgrade(id: string, ev: { component: UpgradeComponent; after: string }, actor: Actor): Promise<AuditedResult<UpgradeEvent>>
  listUpgrades(id: string): Promise<UpgradeEvent[]>
  getAsset(id: string): Promise<Asset | null>
  isInvCodeTaken(invCode: string, exceptId?: string): Promise<boolean>
  isSerialTaken(serial: string, exceptId?: string): Promise<boolean>
}
```
`AssetRepository` (read) and `AssetWriteRepository` (write) are both implemented by the two
adapters. The read interface stays as-is for backward compat; write is additive.

### 3.4 Status-derivation rule (pure, shared `src/domain/asset/deriveStatus.ts`)
```ts
// Create mode: status derives purely from assignment.
//   null / mode 'warehouse-equivalent' (assignment === null)  -> st_warehouse
//   any assignment (employee|department|branch)               -> st_assigned
// In Repair / Disposed are reachable ONLY via changeStatus (edit-mode lifecycle actions).
export function deriveCreateStatus(assignment: AssetAssignment | null): AssetStatusId
```

## 4. withAudit() helper (`src/lib/audit/withAudit.ts`)

```ts
// Production (Firestore): wraps runTransaction. The mutate callback receives the txn,
// performs all business writes, and returns { value, auditAfter, auditBefore? }. withAudit
// then writes ONE audit_logs doc inside the SAME txn with actorUid/actorRole/at(serverTimestamp).
// InMemory: a synchronous "transaction" simulation that appends to an in-memory audit log
// array and the asset map atomically (all-or-nothing via try/rollback of a working copy).
//
// CONTRACT: there is no code path that commits a business write without appending exactly
// one audit entry in the same atomic unit. Enforced by routing every write method through it.
export async function withAudit<T>(
  ctx: AuditContext, spec: AuditSpec,
  mutate: (txn: TxnLike) => Promise<{ value: T; before?: unknown; after?: unknown }>,
): Promise<AuditedResult<T>>
```
`AuditContext` carries the db handle (Firestore) or the in-memory store (tests) plus an
`auditIdFactory`. Two concrete contexts: `firestoreAuditContext(db)` and `inMemoryAuditContext(store)`.

## 5. Firestore rules — N1 tightening (security-reviewer MANDATORY)

Current: `match /audit_logs/{id} { allow create: if isSignedIn(); }`
New:
```
allow create: if isSignedIn()
  && request.resource.data.actorUid == request.auth.uid
  && request.resource.data.keys().hasAll(['entityType','entityId','action','actorUid','actorRole','at'])
  && request.resource.data.actorRole == role();        // role can't be spoofed in payload
allow update, delete: if false;                         // unchanged, immutable
```
Plus: `/assets/{id}/upgrades/{uid}` sub-collection rules — read any signed-in; create by
super_admin OR tech_admin (tech attributes/upgrades = tech_admin per matrix); update/delete: false
(append-only). Rules unit tests authored with `@firebase/rules-unit-testing` (run in CI).

## 6. License coupling — STUB seam

The create transaction for Computer/Laptop (categories with `hasOemLicense`) must be able to
write an OEM license + its secret in the SAME `runTransaction`. The license module is not built
yet. So:
- `createAsset` accepts an optional `oemLicense?: { keyMasked: string; raw?: string }` field
  (documented). The Firestore adapter has a clearly-marked `// STUB: license write seam` block
  inside the transaction that is a no-op pending the license plan, with a TODO and a typed
  placeholder. The audit entry for the asset is still written. This keeps the transaction shape
  honest without faking a collection that doesn't exist. Listed as owner fork §9.

## 7. UI

### 7.1 Create form (`src/pages/AssetCreatePage.tsx` + `src/components/features/assets/create/*`)
Reduced v9 surface: Category (group cards + filtered combobox) → identity (Brand/Model OR Тип) →
Inv Code + Serial (serial collapses when `!requiresSerial`) → Quick Assignment (mandatory; derives
status) → read-only derived status chip. Specs card (initial snapshot) + OEM key for hasSpecs/hasOemLicense
device categories, fully interactive in create (v9.2.2). Single Save = one `createAsset` call.
Role gate: super_admin | asset_admin (receive/register = asset_admin).

### 7.2 Detail / edit page (`src/pages/AssetDetailPage.tsx`)
Route `/assets/:id`. Loads via `getAsset` + `listUpgrades` + reference data. Sections: hero +
identity (locked behind Изменить) + specs + Upgrades panel (EDIT-mode only, hasSpecs only,
super_admin|tech_admin) + assignment + history (audit_logs for this asset) + lifecycle actions
(Send to Repair, Write off via changeStatus; super_admin|asset_admin for issue/return,
super_admin|tech_admin for repair). Smart upgrade: `before` auto-derived & read-only for SPEC_TRACKED.

### 7.3 Routing
`/assets/new` → AssetCreatePage (RoleGate super_admin|asset_admin). `/assets/:id` → AssetDetailPage.
AssetsPage "Создать" button → navigate('/assets/new'); row click → navigate(`/assets/${id}`).

## 8. Verification

`npm run build` (tsc -b + vite), `npm test -- --run` (Vitest). All write methods covered on the
InMemory adapter: create derives status, blocks duplicate invCode/serial, writes exactly one audit
entry; update/changeStatus/addUpgrade each write one audit entry; upgrade before-derivation for
SPEC_TRACKED. Component tests for create form (derived status, save-gating) + detail page (upgrade
edit-mode gating, role gating). Rules tests authored (CI). Reviews: spec → code-quality →
security (MANDATORY for the rules change + audit write path).

## 9. Owner forks (enumerated, NOT blocking — decided with rationale, revisit on request)

1. **License coupling depth.** Decision: STUB seam (§6) — no faked license collection. Rationale:
   honest transaction shape now; real writes land with the license plan. *Owner may instead want
   the license module built first.*
2. **History source on detail page.** Decision: query `audit_logs` where entityId == assetId
   (admins can read all). Rationale: single source of truth, no denormalized history array.
3. **changeStatus assignment semantics.** Decision: Send-to-Repair preserves the prior assignment
   (restored on repair_completed) per §9bis v8. Return clears assignment → st_warehouse.
4. **Upgrade write role.** Decision: super_admin | tech_admin (tech attributes = tech_admin).
   asset_admin cannot add upgrades. Rationale: role matrix split.
5. **InMemory "transaction".** Decision: working-copy + commit-or-throw simulation. Rationale: gives
   real atomicity semantics in tests without an emulator.
