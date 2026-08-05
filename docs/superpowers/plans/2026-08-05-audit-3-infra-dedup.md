# Audit-3 Infra Deduplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate duplication of `toIso`/`stripUndefinedFs` across ~13 repositories, fix `TxnLike` interface so Firestore repos no longer need double-cast, replace dashboard partial-object double-casts with typed Picks, and add a JSDoc line to `withAudit`.

**Architecture:** Pure refactor — no behavioral change. `firestoreUtils.ts` is the single source of truth for the two util functions. `TxnLike` in `withAudit.ts` is widened to cover all methods actually used by callers (`set`, `delete`, `get`), eliminating the need for `as unknown as Transaction` in every callback. Dashboard local stubs are typed with `Pick<>` instead of `as unknown as FullType`. `firestoreUserRepository.ts` local `toIso` returns `string | null` — a DIFFERENT signature from the canonical `string`; that difference is preserved by using a local `toIsoOrNull` helper instead of forcibly collapsing it.

**Tech Stack:** TypeScript 5 strict + exactOptionalPropertyTypes, Firebase JS SDK v9 modular, Vitest.

---

## Critical pre-reading

Before touching any file, read these to understand the existing shapes:

- `src/infra/repositories/firestoreUtils.ts` — canonical `toIso` (returns `string`, fallback `new Date(0).toISOString()`) and `stripUndefinedFs`
- `src/lib/audit/withAudit.ts` — `TxnLike`, `AuditContext`, `withAudit`, `firestoreAuditContext` (the only place that currently holds `txn as unknown as TxnLike`)
- `src/infra/repositories/firestoreDashboardRepository.ts` — two `as unknown as` casts and local `toIso`
- `src/infra/repositories/firestorePartRepository.mappers.ts` — EXPORTS its own `toIso` with a DIFFERENT fallback (`new Date().toISOString()` — current time, not epoch)
- `src/infra/repositories/firestoreUserRepository.ts` — local `toIso` with DIFFERENT return type (`string | null`)

## Behavioral divergence map (must understand before Task 1)

| File | local `toIso` fallback | Return type | Resolution |
|------|----------------------|-------------|------------|
| `firestoreUtils.ts` (canonical) | `new Date(0).toISOString()` = epoch | `string` | Unchanged |
| `firestoreDashboardRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace with canonical import |
| `firestoreEmployeeRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace |
| `firestoreBranchRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace |
| `firestoreDepartmentRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace |
| `firestoreAssignmentRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace |
| `firestoreSubscriptionRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace |
| `firestoreServerLicenseRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace |
| `firestoreWorkstationLicenseRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace |
| `firestoreAuditLogRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace |
| `firestoreAssetRepository.ts` | `new Date(0).toISOString()` | `string` | Safe to replace |
| `firestorePartRepository.mappers.ts` | **`new Date().toISOString()` (NOW!)** | `string` | KEEP local — different behavior; rename to `toIsoOrNow` and add a comment |
| `firestoreUserRepository.ts` | returns `null` if unknown | `string \| null` | KEEP local — different type; rename to `toIsoOrNull` for clarity |

---

## File structure (files modified)

| File | Change |
|------|--------|
| `src/infra/repositories/firestoreUtils.ts` | No change needed — already correct |
| `src/lib/audit/withAudit.ts` | Widen `TxnLike` to add `delete`, `get`; add JSDoc to `withAudit` |
| `src/infra/repositories/firestoreDashboardRepository.ts` | Remove local `toIso`; import from utils; replace 2× `as unknown as` with Pick types |
| `src/infra/repositories/firestoreAssetRepository.ts` | Remove local `toIso` + `stripUndefinedFs`; import from utils; remove `as unknown as Transaction` casts |
| `src/infra/repositories/firestoreEmployeeRepository.ts` | Remove local `toIso` + `stripUndefinedFs`; import from utils; remove casts |
| `src/infra/repositories/firestoreBranchRepository.ts` | Remove local `toIso` + `stripUndefinedFs`; import from utils; remove casts |
| `src/infra/repositories/firestoreDepartmentRepository.ts` | Remove local `toIso` + `stripUndefinedFs`; import from utils; remove casts |
| `src/infra/repositories/firestoreAssignmentRepository.ts` | Remove local `toIso`; import from utils; remove casts |
| `src/infra/repositories/firestoreSubscriptionRepository.ts` | Remove local `toIso` + `stripUndefinedFs`; import from utils; remove casts |
| `src/infra/repositories/firestoreServerLicenseRepository.ts` | Remove local `toIso` + `stripUndefinedFs`; import from utils; remove casts |
| `src/infra/repositories/firestoreWorkstationLicenseRepository.ts` | Remove local `toIso` + `stripUndefinedFs`; import from utils; remove casts |
| `src/infra/repositories/firestoreAuditLogRepository.ts` | Remove local `toIso`; import from utils; remove casts |
| `src/infra/repositories/firestoreCategoryGroupRepository.ts` | Remove casts |
| `src/infra/repositories/firestoreCategoryRepository.ts` | Remove casts |
| `src/infra/repositories/firestorePartCategoryRepository.ts` | Remove casts |
| `src/infra/repositories/firestoreAuthSettingsRepository.ts` | Remove casts |
| `src/infra/repositories/firestorePartRepository.install.ts` | Remove casts |
| `src/infra/repositories/firestorePartRepository.uninstall.ts` | Remove casts |
| `src/infra/repositories/firestorePartRepository.service.ts` | Remove casts |
| `src/infra/repositories/firestorePartRepository.stock.ts` | Remove casts |
| `src/infra/repositories/firestorePartRepository.mappers.ts` | Rename `toIso` → `toIsoOrNow`; add comment; update all callers within this file |
| `src/infra/repositories/firestoreUserRepository.ts` | Rename local `toIso` → `toIsoOrNull`; keep logic; update callers within file |

---

## Task 1: Widen TxnLike + add JSDoc to withAudit

**Files:**
- Modify: `src/lib/audit/withAudit.ts`

The current `TxnLike` only has `set(ref, data, options?)`. But callers also call `.delete(ref)` (branch, department, category, categoryGroup repos) and `.get(ref)` (asset, assignment, employee, part repos). Widening `TxnLike` to include all three methods that callers actually use means the double-cast is no longer necessary in those repos — `txn` already satisfies `TxnLike` because Firestore `Transaction` is structurally compatible.

The ONE remaining double-cast inside `firestoreAuditContext` at line 105 (`mutate(txn as unknown as TxnLike)`) also disappears because after widening `TxnLike`, the Firestore `Transaction` type structurally satisfies `TxnLike` directly — no cast needed.

The `inMemoryAuditContext` stub at line 36 (`const txn: TxnLike = { set: () => undefined }`) needs to gain stub implementations of `delete` and `get` to keep the interface satisfied. Use no-ops.

Also add a one-line JSDoc comment to `withAudit()` explaining why this thin wrapper exists: it is the single mandatory call site; having an explicit named function (vs. calling `ctx.run` directly) keeps grep-for-`withAudit` reliable as the audit chokepoint sentinel.

- [ ] **Step 1: Read the current file to understand exact line numbers**

Run:
```
# already read above — see line 8 for TxnLike, lines 22-26 for withAudit, lines 36 for inMemory stub
```

- [ ] **Step 2: Edit `src/lib/audit/withAudit.ts` — widen TxnLike, fix inMemory stub, fix firestoreAuditContext cast, add JSDoc**

Replace the `TxnLike` interface (line 8) with:

```typescript
/**
 * Minimal Firestore Transaction surface used by mutate callbacks.
 * Firestore's Transaction type is structurally compatible with this interface,
 * so repositories receive `txn: TxnLike` without any cast.
 */
export interface TxnLike {
  set(ref: unknown, data: unknown, options?: unknown): unknown
  delete(ref: unknown): unknown
  get(ref: unknown): Promise<unknown>
}
```

Replace the `inMemoryAuditContext` stub (inside `run`, the `const txn: TxnLike` line 36):

```typescript
const txn: TxnLike = {
  set: () => undefined,
  delete: () => undefined,
  get: async () => ({ exists: () => false, data: () => undefined }),
}
```

Replace the `firestoreAuditContext` inner call (line 105), changing `mutate(txn as unknown as TxnLike)` to `mutate(txn)` — Firestore `Transaction` satisfies the widened `TxnLike` structurally without cast.

Add a JSDoc comment to `withAudit` (above line 22):

```typescript
/**
 * The single chokepoint for state-changing writes. Every mutating repository
 * method calls withAudit; there is NO path that commits a business write without
 * appending exactly one audit_logs entry in the same atomic unit.
 *
 * This thin wrapper over `ctx.run` exists so that `grep withAudit` reliably
 * identifies every audited write site across the codebase — calling `ctx.run`
 * directly would bypass that sentinel.
 */
export function withAudit<T>(
```

- [ ] **Step 3: Verify the file compiles without errors**

Run:
```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | head -30
```

Expected: zero errors referencing `withAudit.ts` or `TxnLike`.

- [ ] **Step 4: Run withAudit tests**

Run:
```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/lib/audit/withAudit.test.ts 2>&1 | tail -20
```

Expected: all 5 tests pass (commits value + audit entry, rolls back, actorName written, actorName absent, spec.before/after override mutate).

---

## Task 2: Remove all `as unknown as Transaction` casts from repositories

**Files (all `src/infra/repositories/` — modify only):**
- `firestoreAssetRepository.ts` (lines 360, 541, 584, 600)
- `firestoreAssignmentRepository.ts` (lines 84, 142)
- `firestoreBranchRepository.ts` (lines 100, 125, 144)
- `firestoreCategoryGroupRepository.ts` (lines 86, 120, 146)
- `firestoreCategoryRepository.ts` (lines 87, 114, 133)
- `firestoreDepartmentRepository.ts` (lines 90, 115, 134)
- `firestoreEmployeeRepository.ts` (lines 185, 217, 253, 305, 332, 367)
- `firestorePartCategoryRepository.ts` (lines 105, 149)
- `firestorePartRepository.install.ts` (line 100)
- `firestorePartRepository.service.ts` (line 51)
- `firestorePartRepository.stock.ts` (lines 69, 198)
- `firestorePartRepository.uninstall.ts` (line 80)
- `firestoreServerLicenseRepository.ts` (lines 108, 155, 191)
- `firestoreSubscriptionRepository.ts` (lines 108, 143)
- `firestoreWorkstationLicenseRepository.ts` (lines 201, 254, 396, 445, 481)
- `firestoreAuthSettingsRepository.ts` (lines 68, 99)

**Two patterns to replace:**

**Pattern A** — inline cast in one-liner callbacks:
```typescript
// BEFORE
async (txn) => { (txn as unknown as Transaction).set(ref, data); ... }
// AFTER
async (txn) => { txn.set(ref, data); ... }
```

**Pattern B** — local `const t` alias:
```typescript
// BEFORE
async (txn) => {
  const t = txn as unknown as Transaction
  // ... t.get(), t.set(), t.delete()
}
// AFTER
async (txn) => {
  // use txn directly — TxnLike now has get/delete/set
}
```

Note: After removing the casts, each file's import of `Transaction` from `firebase/firestore` may become unused. Remove those unused imports.

- [ ] **Step 1: Process `firestoreBranchRepository.ts`** (3 occurrences — simplest file, start here)

Read the file first:
```bash
# use Read tool for lines 90–155
```

Remove the three `as unknown as Transaction` casts. The callbacks only call `.set()` and `.delete()` — both now on `TxnLike`. Remove unused `Transaction` import if present.

- [ ] **Step 2: Process `firestoreDepartmentRepository.ts`** (3 occurrences — same pattern as branch)

Same three-occurrence pattern: create (set), update (set+merge), delete (delete). Remove casts + unused import.

- [ ] **Step 3: Process `firestoreCategoryRepository.ts`** (3 occurrences)

Same pattern. Remove casts + unused import.

- [ ] **Step 4: Process `firestoreCategoryGroupRepository.ts`** (3 occurrences)

Also uses `Parameters<Transaction['set']>[1]` type annotation in two casts. After removing the cast, also remove that `Parameters<Transaction['set']>[1]` type annotation — it's `DocumentData` from firebase but the data is already typed as `Record<string, unknown>` which Firestore accepts. Remove unused `Transaction` import.

- [ ] **Step 5: Process `firestorePartCategoryRepository.ts`** (2 occurrences)

Same as categoryGroup pattern with `Parameters<Transaction['set']>[1]`. Remove casts, remove annotation, remove unused import.

- [ ] **Step 6: Process `firestoreAuthSettingsRepository.ts`** (2 occurrences — set only)**

Remove both inline casts. Remove unused `Transaction` import.

- [ ] **Step 7: Process `firestoreSubscriptionRepository.ts`** (2 occurrences — set only)**

Remove both inline casts. Remove unused `Transaction` import.

- [ ] **Step 8: Process `firestoreServerLicenseRepository.ts`** (3 occurrences — set only)**

Remove three inline casts. Remove unused `Transaction` import.

- [ ] **Step 9: Process `firestoreWorkstationLicenseRepository.ts`** (5 occurrences — set only)**

Remove five inline casts. Remove unused `Transaction` import.

- [ ] **Step 10: Process `firestoreAssignmentRepository.ts`** (2 occurrences — `const t = ...` pattern)

Read lines 78–155. The `const t = txn as unknown as Transaction` is followed by `t.get()`, `t.set()` calls. Replace by using `txn` directly. Remove unused `Transaction` import.

- [ ] **Step 11: Process `firestoreEmployeeRepository.ts`** (6 occurrences — mix of `const t` and inline)**

Read lines 175–380. Six casts. Replace all with direct `txn.` usage. Remove unused `Transaction` import.

- [ ] **Step 12: Process `firestorePartRepository.install.ts`** (1 occurrence — `const t` pattern)**

Read lines 90–115. Replace `const t = txn as unknown as Transaction` with direct `txn` usage. Remove unused `Transaction` import.

- [ ] **Step 13: Process `firestorePartRepository.uninstall.ts`** (1 occurrence)**

Read lines 70–95. Replace `const t = txn as unknown as Transaction` with direct `txn`. Uses `.get()` and `.set()` — both now on `TxnLike`. Remove unused `Transaction` import.

- [ ] **Step 14: Process `firestorePartRepository.service.ts`** (1 occurrence)**

Read lines 40–65. Replace `const t = txn as unknown as Transaction`. Remove unused `Transaction` import.

- [ ] **Step 15: Process `firestorePartRepository.stock.ts`** (2 occurrences)**

Read lines 60–210. Two `const t = txn as unknown as Transaction` blocks. Replace both. Remove unused `Transaction` import.

- [ ] **Step 16: Process `firestoreAssetRepository.ts`** (4 occurrences — most complex file)**

Read lines 350–610. Four cast sites. Replace each with direct `txn.` usage. This file may still need `Transaction` imported for something else — check before removing. Remove unused import only if truly unused.

- [ ] **Step 17: Run tsc check**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 18: Run vitest**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run 2>&1 | tail -30
```

Expected: all tests pass (green).

---

## Task 3: Deduplicate `toIso` — replace local copies with canonical import

**Context:** The canonical `toIso` in `firestoreUtils.ts` returns `string` with `new Date(0).toISOString()` as fallback (epoch). All 10 files below have identical behavior and can safely import from utils. Two exceptions:

- `firestorePartRepository.mappers.ts` — exports its own `toIso` with `new Date().toISOString()` fallback (current time). Behavior intentionally different. **Rename to `toIsoOrNow`** and add a comment. Update all internal callers in this file. Do NOT change it to import from utils.
- `firestoreUserRepository.ts` — local `toIso` returns `string | null`. **Rename to `toIsoOrNull`**. Do NOT change to import from utils.

**Files to process (safe replacements):**

1. `firestoreDashboardRepository.ts`
2. `firestoreAssetRepository.ts`
3. `firestoreEmployeeRepository.ts`
4. `firestoreBranchRepository.ts`
5. `firestoreDepartmentRepository.ts`
6. `firestoreAssignmentRepository.ts`
7. `firestoreSubscriptionRepository.ts`
8. `firestoreServerLicenseRepository.ts`
9. `firestoreWorkstationLicenseRepository.ts`
10. `firestoreAuditLogRepository.ts`

- [ ] **Step 1: Process `firestoreDashboardRepository.ts`**

Read lines 1–30. Delete the local `toIso` function (lines 23–29). Add `toIso` to the import from `./firestoreUtils`. Verify no other local `toIso` usages remain.

```typescript
// Add to imports at top:
import { toIso } from './firestoreUtils'
```

- [ ] **Step 2: Process remaining 9 files in one pass**

For each file, read the top ~50 lines to find the local `toIso` block. Delete it. Add `toIso` to the import from `'./firestoreUtils'` (or check if `firestoreUtils` is already imported and extend that line).

Files: `firestoreAssetRepository.ts`, `firestoreEmployeeRepository.ts`, `firestoreBranchRepository.ts`, `firestoreDepartmentRepository.ts`, `firestoreAssignmentRepository.ts`, `firestoreSubscriptionRepository.ts`, `firestoreServerLicenseRepository.ts`, `firestoreWorkstationLicenseRepository.ts`, `firestoreAuditLogRepository.ts`.

- [ ] **Step 3: Handle `firestorePartRepository.mappers.ts` (DIFFERENT fallback — do NOT import from utils)**

Read lines 34–40. Rename `toIso` → `toIsoOrNow`. Add a comment:

```typescript
/**
 * Converts a Firestore Timestamp or string to ISO string.
 * Fallback is the CURRENT time (not epoch) because part movement records
 * without a timestamp should default to "now" for display ordering.
 * Do NOT replace with the canonical firestoreUtils.toIso — different intent.
 */
export function toIsoOrNow(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date().toISOString()
}
```

Then scan `firestorePartRepository.mappers.ts` for all calls to `toIso(` and rename them to `toIsoOrNow(`.

Also check every file that imports `toIso` from `firestorePartRepository.mappers.ts` (the Explore survey found `firestoreDashboardRepository.ts` imports `toMovement` from mappers — check if it also imports `toIso` from there). If any file imports `toIso` from mappers, update those import sites to use `toIsoOrNow`.

- [ ] **Step 4: Handle `firestoreUserRepository.ts` (DIFFERENT return type — do NOT import from utils)**

Read lines 17–24. Rename `toIso` → `toIsoOrNull`. Update all callers within that file. Add a comment:

```typescript
/**
 * Like firestoreUtils.toIso but returns null for missing/unknown values
 * (User.createdAt is optional string | null — epoch sentinel is wrong here).
 */
function toIsoOrNull(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return null
}
```

- [ ] **Step 5: Run tsc + vitest**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | head -30
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run 2>&1 | tail -20
```

Expected: zero type errors, all tests green.

---

## Task 4: Deduplicate `stripUndefinedFs` — replace local copies with canonical import

**Context:** All 7 local copies are identical to the canonical in `firestoreUtils.ts`. All are private (not exported). Safe to replace.

**Files:**
1. `firestoreBranchRepository.ts`
2. `firestoreDepartmentRepository.ts`
3. `firestoreSubscriptionRepository.ts`
4. `firestoreServerLicenseRepository.ts`
5. `firestoreWorkstationLicenseRepository.ts`
6. `firestoreEmployeeRepository.ts`
7. `firestoreAssetRepository.ts`

Note: `firestoreCategoryGroupRepository.ts` already imports `stripUndefinedFs` from utils (confirmed from the Explore survey — it was already deduplicated earlier). Do NOT touch it.

- [ ] **Step 1: For each of the 7 files: delete local `stripUndefinedFs`, add to `firestoreUtils` import**

For each file, read the relevant block, delete the local function. Find the existing `import { ... } from './firestoreUtils'` line (may already exist from Task 3 above) and add `stripUndefinedFs` to it.

Example for `firestoreBranchRepository.ts`:
```typescript
// BEFORE (two separate imports)
import { toIso } from './firestoreUtils'
// ... local stripUndefinedFs function defined separately

// AFTER (combined import, no local function)
import { toIso, stripUndefinedFs } from './firestoreUtils'
```

- [ ] **Step 2: Run tsc + vitest**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | head -30
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run 2>&1 | tail -20
```

Expected: zero errors, all tests green.

---

## Task 5: Fix `firestoreDashboardRepository.ts` dashboard partial-object casts

**File:** `src/infra/repositories/firestoreDashboardRepository.ts`

**Context:** Two casts use `as unknown as Asset` and `as unknown as WorkstationLicense` to pass partial stub objects into the reducers. The reducers only access a small subset of fields:

- `reduceAssetStats` reads: `categoryId: string`, `statusId: string`, `branchId: string` from each asset
- `reduceWorkstationLicenseStats` reads: `lifecycleStatus: LifecycleStatus`, `assignmentType: AssignmentType` from each license

Replace the full-type casts with minimal Pick types. This avoids importing the full domain type just to immediately violate it.

- [ ] **Step 1: Read `firestoreDashboardRepository.ts` lines 1–100 to confirm exact types and imports**

Use the Read tool.

- [ ] **Step 2: Define local Pick types in the file (just above the class definition)**

The `AssignmentType` and `LifecycleStatus` types are already imported in the file (via `WorkstationLicense`). If not, they can be imported directly from `@/domain/license`. Check imports first.

Add after the imports block:

```typescript
/** Minimal asset projection needed by reduceAssetStats — avoids casting to full Asset. */
type AssetStatRow = Pick<Asset, 'id' | 'categoryId' | 'statusId' | 'branchId' | 'updatedAt'>

/** Minimal license projection needed by reduceWorkstationLicenseStats. */
type LicenseStatRow = Pick<WorkstationLicense, 'id' | 'lifecycleStatus' | 'assignmentType'>
```

Note: `Pick<Asset, ...>` and `Pick<WorkstationLicense, ...>` require that `Asset` and `WorkstationLicense` are imported. They already are at the top of the file (confirmed at lines 8–10 of the file).

- [ ] **Step 3: Update `loadAssetStats` to return `AssetStatRow[]` instead of casting**

The current code (lines 39–55):

```typescript
const assets = assetsSnap.docs.map(d => {
  const x = d.data() as Record<string, unknown>
  return {
    id: d.id,
    categoryId: String(x.categoryId ?? ''),
    statusId: String(x.statusId ?? ''),
    branchId: String(x.branchId ?? ''),
    brand: null,
    model: null,
    invCode: '',
    serial: null,
    assignment: null,
    deptId: null,
    updatedAt: toIso(x.updatedAt),
    currentSpecs: null,
  } as unknown as Asset
})
return reduceAssetStats(assets, ref, topBranches)
```

Replace with:

```typescript
const assets: AssetStatRow[] = assetsSnap.docs.map(d => {
  const x = d.data() as Record<string, unknown>
  return {
    id: d.id,
    categoryId: String(x.categoryId ?? ''),
    statusId: String(x.statusId ?? ''),
    branchId: String(x.branchId ?? ''),
    updatedAt: toIso(x.updatedAt),
  }
})
return reduceAssetStats(assets as Asset[], ref, topBranches)
```

Wait — `reduceAssetStats` is typed `(assets: Asset[], ...)`. We need to either:
1. Cast `assets as Asset[]` at the call site (one honest cast, not double), or
2. Change `reduceAssetStats` to accept `Pick<Asset, 'id' | 'categoryId' | 'statusId' | 'branchId' | 'updatedAt'>[]` (no cast needed).

**Choose option 2** — change the `reduceAssetStats` function signature in `src/domain/dashboard/reducers.ts` to accept the narrower type. This is the cleanest solution: the function signature then documents exactly what it uses.

Edit `src/domain/dashboard/reducers.ts` line 9:

```typescript
// BEFORE
export function reduceAssetStats(assets: Asset[], ref: AssetReferenceData, topBranches: number): AssetStats {

// AFTER  
type AssetForStats = Pick<Asset, 'id' | 'categoryId' | 'statusId' | 'branchId' | 'updatedAt'>
export function reduceAssetStats(assets: AssetForStats[], ref: AssetReferenceData, topBranches: number): AssetStats {
```

Then in `firestoreDashboardRepository.ts`, remove the `as unknown as Asset` cast entirely:

```typescript
const assets = assetsSnap.docs.map(d => {
  const x = d.data() as Record<string, unknown>
  return {
    id: d.id,
    categoryId: String(x.categoryId ?? ''),
    statusId: String(x.statusId ?? ''),
    branchId: String(x.branchId ?? ''),
    updatedAt: toIso(x.updatedAt),
  }
})
return reduceAssetStats(assets, ref, topBranches)
```

Remove the unused stub fields (`brand: null`, `model: null`, etc.) and the ` as unknown as Asset` cast entirely.

- [ ] **Step 4: Update `loadWorkstationLicenseStats` similarly**

Edit `src/domain/dashboard/reducers.ts` line 36:

```typescript
// BEFORE
export function reduceWorkstationLicenseStats(rows: WorkstationLicense[]): WorkstationLicenseStats {

// AFTER
type LicenseForStats = Pick<WorkstationLicense, 'lifecycleStatus' | 'assignmentType'>
export function reduceWorkstationLicenseStats(rows: LicenseForStats[]): WorkstationLicenseStats {
```

In `firestoreDashboardRepository.ts`, remove the `as unknown as WorkstationLicense` cast:

```typescript
// BEFORE (lines 81–95)
const rows = snap.docs.map(d => {
  const x = d.data() as Record<string, unknown>
  return {
    id: d.id,
    lifecycleStatus: (x.lifecycleStatus as WorkstationLicense['lifecycleStatus']) ?? 'active',
    assignmentType: (x.assignmentType as WorkstationLicense['assignmentType']) ?? 'unassigned',
    name: '',
    vendor: null,
    type: 'Default' as WorkstationLicense['type'],
    isReusable: true,
    createdAt: toIso(x.createdAt),
    updatedAt: toIso(x.updatedAt),
    createdBy: String(x.createdBy ?? ''),
    updatedBy: String(x.updatedBy ?? ''),
  } as unknown as WorkstationLicense
})

// AFTER
import type { AssignmentType, LifecycleStatus } from '@/domain/license'

const rows = snap.docs.map(d => {
  const x = d.data() as Record<string, unknown>
  return {
    lifecycleStatus: (x.lifecycleStatus as LifecycleStatus) ?? 'active',
    assignmentType: (x.assignmentType as AssignmentType) ?? 'unassigned',
  }
})
```

Check whether `AssignmentType` and `LifecycleStatus` are already imported at the top of the file. If `WorkstationLicense` is imported, they can be derived from `WorkstationLicense['lifecycleStatus']` cast. If the file already imports `WorkstationLicense`, you can remove that import if it's no longer needed after the change. Confirm before removing.

- [ ] **Step 5: Check `inMemoryDashboardRepository.ts` for compatibility**

The `inMemoryDashboardRepository` implements `DashboardRepository` and calls these reducers. It passes real in-memory objects that are full `Asset[]` and `WorkstationLicense[]` — narrowing the reducer param to `Pick<>` is backward-compatible (a superset satisfies a Pick constraint). Verify it still compiles.

- [ ] **Step 6: Run tsc + vitest for dashboard tests**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | head -30
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/infra/repositories/firestoreDashboardRepository.test.ts src/domain/dashboard 2>&1 | tail -20
```

Expected: zero errors, all tests pass.

---

## Task 6: Final verification — full test suite + build

- [ ] **Step 1: Run the full vitest suite**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run 2>&1 | tail -40
```

Expected: zero failing tests. Note the total pass count.

- [ ] **Step 2: Run the production build**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run build 2>&1 | tail -20
```

Expected: build completes with `✓ built in` line. Zero TypeScript errors.

- [ ] **Step 3: If tsc or vitest fails, diagnose before fixing**

Common failure modes:
- `Transaction` import removed from a file that still uses it for something other than a cast — add it back
- `firestorePartRepository.mappers.ts` callers of `toIso` from that file not updated to `toIsoOrNow` — find with grep
- `reduceAssetStats` / `reduceWorkstationLicenseStats` caller in `inMemoryDashboardRepository.ts` breaks — verify the Pick type is a supertype of what inMemory passes

---

## Divergence notes for the report

The implementer MUST document these in the final report:

1. **`firestorePartRepository.mappers.ts`** — `toIso` renamed to `toIsoOrNow`, NOT replaced with canonical import. Fallback behavior intentionally different: uses current time not epoch. This is load-bearing for the part movement timeline display.

2. **`firestoreUserRepository.ts`** — `toIso` renamed to `toIsoOrNull`, return type is `string | null`, NOT `string`. Canonical `toIso` would return epoch string for missing timestamps, which is wrong for optional User fields (`createdAt` is `string | null` in the domain type).

3. **`withAudit` is NOT made generic over `TTxn`** — the generic approach was evaluated but rejected: `firestoreAuditContext` wraps the Firestore `Transaction` internally and passes it to the mutate callback; the AuditContext interface is the public boundary, not Transaction. Making `AuditContext<TTxn>` generic would leak `TTxn` up through every repository class constructor. The simpler fix (widening `TxnLike`) is sufficient because Firestore's `Transaction` is structurally compatible without any cast.

4. **`reduceAssetStats` and `reduceWorkstationLicenseStats` signatures narrowed** — parameters now accept `Pick<>` instead of the full type. This is a non-breaking change (existing callers with full types still satisfy the narrower constraint).
