# Super-Admin Catalogs CRUD (Branches, Departments, Categories, Asset Statuses) — Design Spec

**Date:** 2026-06-19
**Status:** Approved (owner-driven defaults chosen for the referential-integrity + system-status + prefix-edit forks; see §6–§8)
**Depends on:** employees-crud-self-service (shipped), auth-route-guards-security-rules (shipped), assets-list-page (shipped)

## 1. Goal

Assets and Employees currently reference reference-data (branches, departments, categories, statuses) that exists only as seed docs with no management UI. Deliver four CRUD management surfaces so admins manage these collections as first-class data:

- **Branches** (`/branches`) — physical locations; `type: branch | warehouse`.
- **Departments** (`/departments`) — first-class collection for shared-asset attribution.
- **Categories** (`/categories`) — carry `hasSpecs`, inventory-code `prefix`, `group`, `lucideIcon`.
- **Asset Statuses** (`/asset_statuses`) — the 4 canonical statuses are `isSystem` and protected.

Each delivers: domain entity + repository port, InMemory + Firestore adapters (every mutation via `withAudit` — exactly one `audit_logs` entry per txn), and a RoleGate-gated CRUD page (list/create/edit/delete-where-safe) mirroring the Employees page pattern (dark/orange, empty/loading/error states, i18n ru/en/hy, repo-factory — page imports no Firebase).

This is a Phase-1 MVP feature. No Phase-2/3 work.

## 2. Architecture — mirror the established pattern exactly

For each catalog `X` (branch, department, category, asset_status):

```
src/domain/<x>/types.ts            entity + list-query + type guards
src/domain/<x>/<X>Repository.ts    port: list/get/create/update/delete (+ usage check)
src/domain/<x>/index.ts            barrel
src/infra/repositories/inMemory<X>Repository.ts    InMemory adapter (withAudit)
src/infra/repositories/firestore<X>Repository.ts   Firestore adapter (withAudit)
src/pages/<X>esPage.tsx + <X>FormDialog (feature component)
src/components/features/<x>/...    table + form (modal) + filter bar where useful
src/locales/{ru,en,hy}/<x>.json    Tier-1 keys
```

Wiring: extend `domain/index.ts` barrel; extend `repositories/index.ts`; register routes in `routes.tsx`; remove the four ids from `PHASE_STUB_ROUTES`; nav already lists `branches`, `departments`, `categories`, `statuses` (no nav edit needed beyond removing stubs). Add locale namespaces to `i18n` config.

### Page UX choice: in-page modal create/edit (not a sub-route)

Catalog records are small (a name + a few fields). Unlike Assets/Employees (which have rich detail pages + dedicated `/new` routes), catalogs use a **single list page with a create/edit modal dialog** and an inline delete-with-confirm. This is the lighter, correct altitude for reference data and avoids four extra `/new` + `/:id` routes. Each catalog page is one route.

## 3. Domain entities

### Branch — `src/domain/branch/types.ts`

```ts
export const BRANCH_TYPES = ['branch', 'warehouse'] as const
export type BranchType = (typeof BRANCH_TYPES)[number]

export interface Branch {
  id: string
  name: string                 // Tier-2 in the full spec; MVP stores a single display string (see §9)
  type: BranchType
  city: string | null
  address: string | null
  createdAt: string
  updatedAt: string
}
export interface BranchListQuery { type?: BranchType | 'all'; search?: string }
```

### Department — `src/domain/department/types.ts`

```ts
export interface Department {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}
export interface DepartmentListQuery { search?: string }
```

### Category — `src/domain/category/types.ts`

```ts
export const CATEGORY_GROUPS = ['devices', 'network', 'furniture'] as const
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]

export interface Category {
  id: string
  name: string
  group: CategoryGroup
  prefix: string               // inventory-code PREFIX (e.g. "450"); per-category
  hasSpecs: boolean            // Computer/Laptop/Server = true → specs/upgrades panels
  lucideIcon: string
  createdAt: string
  updatedAt: string
}
export interface CategoryListQuery { group?: CategoryGroup | 'all'; search?: string }
```

> Note: the live `categories` reference reads use field `name`, `group`, `lucideIcon` (see `firestoreAssetRepository.fetchReferenceData`). We ADD `prefix` + `hasSpecs`. `nextInventoryNumber` (auto-increment counter) is a **write-side concern of the asset-create flow**, not surfaced/edited in the catalog UI; the catalog page treats it as an opaque managed counter and never displays or edits it (documented owner follow-up: the asset-create plan owns it).

### AssetStatus — `src/domain/asset_status/types.ts`

```ts
export interface AssetStatus {
  id: string
  name: string
  color: string                // chip color token (e.g. "gray" | "green" | "orange" | "red")
  isFinal: boolean             // terminal lifecycle (Disposed)
  isSystem: boolean            // canonical 4 → protected: not deletable, isFinal not editable
  sortOrder: number
  createdAt: string
  updatedAt: string
}
export interface AssetStatusListQuery { search?: string }

/** The 4 canonical system statuses (CONFIRMED v8). Used to seed + to guard. */
export const SYSTEM_STATUS_IDS = ['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'] as const
```

## 4. Repository ports

Common shape (illustrated for Branch; same for the others):

```ts
export interface CreateBranchInput { name: string; type: BranchType; city?: string|null; address?: string|null }
export interface UpdateBranchInput { name?: string; type?: BranchType; city?: string|null; address?: string|null }

export interface BranchRepository {
  listBranches(q?: BranchListQuery): Promise<Branch[]>
  getBranch(id: string): Promise<Branch | null>
  createBranch(input: CreateBranchInput, actor: Actor): Promise<AuditedResult<Branch>>
  updateBranch(id: string, patch: UpdateBranchInput, actor: Actor): Promise<AuditedResult<Branch>>
  /** Throws EntityInUseError when referenced; otherwise deletes + writes one audit entry. */
  deleteBranch(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>>
  /** Count of docs referencing this catalog entry (for delete guard + UI hinting). */
  countReferences(id: string): Promise<number>
}
```

- All mutations return `AuditedResult<T>` via `withAudit`.
- `create`/`update` enforce **name uniqueness** (case-insensitive) per collection (categories also enforce **prefix uniqueness**).
- `delete` calls `countReferences` first; if `> 0`, throws `EntityInUseError` (a shared typed error in `src/domain/shared/errors.ts`) carrying the count.

### AuditAction additions

The audit action vocabulary needs `'deleted'`. Current `AUDIT_ACTIONS` has `created`/`updated` (reused) but no `deleted`. Add `'deleted'` to `AUDIT_ACTIONS`.

### AuditEntityType additions

Extend `AuditEntityType` to `... | 'branch' | 'department' | 'category' | 'asset_status'`.

## 5. Referential integrity — `countReferences` per catalog

| Catalog | Referenced by (collections × fields) |
|---|---|
| Branch | `assets.branchId`, `assets.assignment.branchId`, `employees.branchId`, `assignments.assignedToBranchId` |
| Department | `assets.deptId`, `assets.assignment.departmentId`, `employees.departmentId` |
| Category | `assets.categoryId` |
| AssetStatus | `assets.statusId` |

InMemory: counts over the injected arrays. Firestore: `getDocs(query(..., where(field,'==',id), limit(1)))` per referencing field; `countReferences` returns ≥1 if any referencing query is non-empty (we only need "in use or not", so each check uses `limit(1)` and we short-circuit). The UI surfaces "in use — cannot delete" with the human message; the number is informational.

> Firestore note: `assets.assignment.branchId` / `assignment.departmentId` are nested fields. We check the **top-level** denormalized fields (`branchId`, `deptId` on the asset doc) which the asset-create flow keeps in sync (see §9bis of the orchestrator: Branch assignment syncs `asset.branchId`; department assignment sets `deptId`). The nested assignment mirror is not separately indexed; the top-level fields are the authoritative reference for integrity purposes. Documented.

## 6. FORK RESOLVED — referential integrity policy: **BLOCK delete when referenced**

Default chosen: **block** (not cascade, not orphan). Deleting a branch that still holds assets/employees, or a status/category in use, would corrupt referential integrity and the audit story. The UI shows a clear, localized message ("Cannot delete — N record(s) reference this entry"). Owner may later add a "reassign then delete" flow; out of scope here. This is the secure, reversible-by-inaction default.

## 7. FORK RESOLVED — Asset-status system invariant

The 4 canonical statuses (`SYSTEM_STATUS_IDS`) are seeded with `isSystem: true`.

**Enforced in THREE layers:**

- **UI:** system statuses show a lock badge; delete action hidden/disabled; the form disables editing `isFinal` and the id; `name`/`color`/`sortOrder` remain editable (Super Admin may relabel/recolor).
- **Repository:** `deleteAssetStatus` throws `SystemEntityProtectedError` if `isSystem`. `updateAssetStatus` strips/refuses changes to `isFinal` and `isSystem` when the target is a system status (only display fields pass through).
- **Firestore rules:** `/asset_statuses/{id}` — `delete` denied when `resource.data.isSystem == true`; `update` denied when it changes `isSystem` or (for a system doc) `isFinal`. Create still super-only.

Super Admin **may** create additional **non-system** statuses (`isSystem:false`) which are fully editable/deletable (subject to the in-use guard). This preserves the "Super Admin owns the catalog" power without letting the 4-status invariant break.

## 8. FORK RESOLVED — Category prefix edit guard

Changing a category's inventory-code `prefix` after assets exist under it would break PREFIX/NUMBER continuity and make existing codes inconsistent with the category. **Default chosen: block prefix change when the category has ≥1 asset** (reuse `countReferences`). `name`/`group`/`lucideIcon`/`hasSpecs` remain editable. Repository throws `PrefixLockedError`; UI disables the prefix field in edit mode when referenced and shows the reason. Documented as a guard, not a silent mutation.

## 9. i18n tiers (MVP simplification, consistent with shipped catalogs)

The full spec marks branch/department/category names as Tier-2 multi-lang. **Every shipped reference read in this codebase treats `name` as a single string** (`firestoreAssetRepository` reads `String(d.name)`). To stay consistent and not break existing reads, MVP stores `name` as a **single display string** (Tier-3-style) entered via a normal input — NOT `<MultiLangInput>`. Tier-1 UI chrome (labels, buttons, messages) IS fully translated ru/en/hy. Category `prefix` is Tier-4 (English/numeric, no translation). This is a deliberate, documented MVP scope decision; multi-lang catalog names are a clean future enhancement (add `{ru,en,hy}` to `name` + `localize()` at read sites) and are listed as an owner follow-up.

## 10. Security rules changes

- `/branches`, `/departments`, `/categories` already exist with correct read/write gates. **No write-gate change** (branches super|asset_admin; departments/categories super only — matches matrix).
- `/asset_statuses`: ADD the system-protection guards (§7): block delete of `isSystem` docs; block `isSystem`/`isFinal` mutation. Keep create/update super-only, read signed-in.
- Add shape tolerance for `createdBy`/`updatedBy`/`createdAt`/`updatedAt` fields written by adapters (rules currently use `allow write: if isSuperAdmin()` with no shape clamp for these three catalogs, so adding fields is already allowed; asset_statuses gets explicit guards).
- Rules tests authored for CI (`@firebase/rules-unit-testing`); Java emulator unavailable locally so they are written + committed, not run here.

## 11. Testing

- **Domain:** type-guard + invariant unit tests (`*-types.test.ts`).
- **Repository:** InMemory adapter tests per catalog — create/update/delete happy paths; uniqueness rejection; `countReferences`/in-use delete rejection; system-status protection; prefix-lock; **assert exactly one audit entry per mutation** and zero on failure (rollback).
- **Page/component:** `@testing-library/react` — list renders, empty/loading/error states, create+edit modal submit calls repo, delete-confirm, RoleGate gating (asset_admin can write branches but NOT the super-only three).
- Baseline 229 tests must stay green; additions are additive.

## 12. Gates

spec-reviewer → code-quality-reviewer → security-reviewer (MANDATORY — privileged super-admin write surfaces + audit trail + rules change).

## 13. Non-blocking owner follow-ups (enumerated, not built here)

1. Multi-lang catalog names (Tier-2 `{ru,en,hy}` + `localize()`).
2. "Reassign then delete" flow for in-use catalog entries (currently blocked).
3. Asset-create `nextInventoryNumber` counter ownership (catalog page treats it as opaque).
4. Seeding script for the 4 system statuses + initial branches/categories (data-migration-engineer; the InMemory paths + rules already encode the invariant).
5. Pending-users → employee onboarding already shipped; unrelated.
