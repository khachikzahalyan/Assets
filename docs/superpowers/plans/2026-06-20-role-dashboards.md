# Role-Specific Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder DashboardPage with role-specific, real-data dashboards (KPI tiles + breakdowns + recent-activity lists) gated per role.

**Architecture:** A read-only `DashboardRepository` port aggregates from existing collections via bounded reads (no `count()`); two adapters (InMemory + Firestore) reduce identically so numbers match. A role-aware `useDashboard` hook fetches only the sections a role may see. The page composes role-gated section components built from existing dark/orange primitives.

**Tech Stack:** React 19 + Vite + TypeScript (strict) + Firebase modular SDK + react-i18next + Vitest + Testing Library. Repo-factory pattern; page imports no raw `firebase/firestore`.

**Spec:** `docs/superpowers/specs/2026-06-20-role-dashboards-design.md`

---

## Conventions (read once)

- Working dir: `C:/Users/DELL/Desktop/assets-crm`. All paths below are repo-relative.
- Run tests: `npm test -- --run`. Typecheck: `npm run typecheck`. Build: `npm run build`.
- Path alias `@/` → `src/`.
- Every commit message ends with the Co-Authored-By trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- Branch: `feat/role-dashboards` (already created).
- The 4 status ids: `st_warehouse`, `st_assigned`, `st_repair`, `st_disposed` (from `@/domain/asset`, `ASSET_STATUS_IDS`).
- `AuditLog.entityType: 'assignment'` rows carry the asset id in `after.assetId` and `entityId` = the assignment doc id. Activity rows must read `assetId` from `after.assetId`.

---

## Task 1: Domain types + port (domain-modeler)

**Files:**
- Create: `src/domain/dashboard/types.ts`
- Create: `src/domain/dashboard/DashboardRepository.ts`
- Create: `src/domain/dashboard/index.ts`
- Modify: `src/domain/index.ts` (add barrel re-export)
- Test: `src/domain/dashboard/dashboard-types.test.ts`

- [ ] **Step 1: Write the failing test**

`src/domain/dashboard/dashboard-types.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { emptyAssetStats, EMPTY_STATUS_COUNTS } from './types'

describe('dashboard types helpers', () => {
  it('emptyAssetStats has all four status keys zeroed', () => {
    const s = emptyAssetStats()
    expect(s.total).toBe(0)
    expect(s.byStatus).toEqual({
      st_warehouse: 0, st_assigned: 0, st_repair: 0, st_disposed: 0,
    })
    expect(s.byGroup).toEqual([
      { group: 'devices', count: 0 },
      { group: 'network', count: 0 },
      { group: 'furniture', count: 0 },
    ])
    expect(s.topBranches).toEqual([])
  })

  it('EMPTY_STATUS_COUNTS is a fresh object each call site (frozen template not shared mutable)', () => {
    const a = { ...EMPTY_STATUS_COUNTS }
    a.st_warehouse = 5
    expect(EMPTY_STATUS_COUNTS.st_warehouse).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/dashboard/dashboard-types.test.ts`
Expected: FAIL ("Cannot find module './types'").

- [ ] **Step 3: Write `src/domain/dashboard/types.ts`**

```ts
import type { AssetStatusId } from '@/domain/asset'
import { ASSET_STATUS_IDS } from '@/domain/asset'
import type { AuditLog } from '@/domain/audit'

export type AssetGroup = 'devices' | 'network' | 'furniture'
export const ASSET_GROUPS: readonly AssetGroup[] = ['devices', 'network', 'furniture']

export interface BranchCount { branchId: string; name: string; count: number }
export interface GroupCount { group: AssetGroup; count: number }

export interface AssetStats {
  total: number
  byStatus: Record<AssetStatusId, number>
  byGroup: GroupCount[]
  topBranches: BranchCount[]
}

export interface AssignmentActivityRow {
  auditId: string
  assetId: string
  action: 'assigned' | 'returned'
  actorUid: string
  at: string
}

export interface AssignmentActivity {
  currentlyOut: number
  recent: AssignmentActivityRow[]
}

export interface WorkstationLicenseStats {
  total: number
  free: number
  inUse: number
  retired: number
}

export interface PeopleStats {
  employeeCount: number
  pendingUsersCount: number | null
}

export interface DashboardData {
  assets: AssetStats | null
  assignments: AssignmentActivity | null
  workstationLicenses: WorkstationLicenseStats | null
  serverLicenseCount: number | null
  people: PeopleStats | null
  recentAudit: AuditLog[] | null
}

/** Template of zeroed per-status counts. Spread (`{ ...EMPTY_STATUS_COUNTS }`) before mutating. */
export const EMPTY_STATUS_COUNTS: Record<AssetStatusId, number> = ASSET_STATUS_IDS.reduce(
  (acc, id) => { acc[id] = 0; return acc },
  {} as Record<AssetStatusId, number>,
)

export function emptyAssetStats(): AssetStats {
  return {
    total: 0,
    byStatus: { ...EMPTY_STATUS_COUNTS },
    byGroup: ASSET_GROUPS.map(group => ({ group, count: 0 })),
    topBranches: [],
  }
}
```

- [ ] **Step 4: Write `src/domain/dashboard/DashboardRepository.ts`**

```ts
import type {
  AssetStats, AssignmentActivityRow, WorkstationLicenseStats, PeopleStats,
} from './types'
import type { AuditLog } from '@/domain/audit'

/**
 * READ-ONLY aggregation port for the role dashboards. No mutation methods.
 * Each method is independently role-gated AT THE CALL SITE (the useDashboard hook):
 * a method a role cannot use is never invoked, so its data is never fetched.
 */
export interface DashboardRepository {
  loadAssetStats(topBranches?: number): Promise<AssetStats>
  loadAssignmentActivity(limitN?: number): Promise<AssignmentActivityRow[]>
  loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats>
  /** super_admin only (caller-gated). */
  loadServerLicenseCount(): Promise<number>
  /** pendingUsersCount queried only when includePending (super_admin). */
  loadPeopleStats(includePending: boolean): Promise<PeopleStats>
  /** super_admin only (caller-gated). Newest first. Keys already masked upstream. */
  loadRecentAudit(limitN?: number): Promise<AuditLog[]>
}
```

- [ ] **Step 5: Write `src/domain/dashboard/index.ts`**

```ts
export * from './types'
export * from './DashboardRepository'
```

- [ ] **Step 6: Add to `src/domain/index.ts` barrel**

Append a line consistent with the existing re-exports in that file:
```ts
export * from './dashboard'
```

- [ ] **Step 7: Run tests + typecheck**

Run: `npm test -- --run src/domain/dashboard/dashboard-types.test.ts`
Expected: PASS.
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/domain/dashboard src/domain/index.ts
git commit -m "feat(dashboard): domain types + read-only DashboardRepository port

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: InMemory adapter (firebase-engineer)

**Files:**
- Create: `src/infra/repositories/inMemoryDashboardRepository.ts`
- Modify: `src/infra/repositories/index.ts` (barrel)
- Test: `src/infra/repositories/inMemoryDashboardRepository.test.ts`

The InMemory adapter computes summaries from plain seed arrays. Constructor inputs mirror what the Firestore adapter reads: assets, asset reference data (for branch names + category groups), workstation licenses, server-license count, employee count, pending-user count, and an audit-log array.

- [ ] **Step 1: Write the failing test**

`src/infra/repositories/inMemoryDashboardRepository.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { InMemoryDashboardRepository } from './inMemoryDashboardRepository'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'

function asset(id: string, statusId: string, categoryId: string, branchId: string): Asset {
  return {
    id, categoryId, brand: 'B', model: 'M', invCode: `INV/${id}`, serial: null,
    statusId, assignment: null, branchId, deptId: null, updatedAt: '2026-06-01T00:00:00.000Z',
    currentSpecs: null,
  }
}

const ref: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'Warehouse', color: 'gray' },
    { id: 'st_assigned', name: 'Assigned', color: 'green' },
    { id: 'st_repair', name: 'In Repair', color: 'orange' },
    { id: 'st_disposed', name: 'Disposed', color: 'red' },
  ],
  branches: [{ id: 'br_1', name: 'HQ' }, { id: 'br_2', name: 'West' }],
  departments: [],
  categories: [
    { id: 'cat_laptop', name: 'Laptop', group: 'devices', lucideIcon: 'laptop' },
    { id: 'cat_router', name: 'Router', group: 'network', lucideIcon: 'router' },
    { id: 'cat_desk', name: 'Desk', group: 'furniture', lucideIcon: 'table-2' },
  ],
  employees: [],
}

function lic(id: string, lifecycleStatus: 'active' | 'retired', assignmentType: 'employee' | 'device' | 'unassigned'): WorkstationLicense {
  return {
    id, name: id, vendor: null, type: 'Default', isReusable: true,
    assignmentType, assignedToEmployeeId: null, assignedToAssetId: null,
    assignedAt: null, assignedBy: null, lifecycleStatus,
    retiredAt: null, retiredWithAssetId: null, expiresAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'u', updatedBy: 'u',
  }
}

const auditRows: AuditLog[] = [
  { id: 'au_3', entityType: 'assignment', entityId: 'as_3', action: 'returned',
    actorUid: 'u_1', actorRole: 'asset_admin', before: null, after: { assetId: 'a_2' },
    comment: null, at: '2026-06-10T00:00:00.000Z' },
  { id: 'au_2', entityType: 'assignment', entityId: 'as_2', action: 'assigned',
    actorUid: 'u_1', actorRole: 'asset_admin', before: null, after: { assetId: 'a_1' },
    comment: null, at: '2026-06-09T00:00:00.000Z' },
  { id: 'au_1', entityType: 'asset', entityId: 'a_1', action: 'created',
    actorUid: 'u_1', actorRole: 'asset_admin', before: null, after: null,
    comment: null, at: '2026-06-08T00:00:00.000Z' },
]

function makeRepo() {
  return new InMemoryDashboardRepository({
    assets: [
      asset('a_1', 'st_assigned', 'cat_laptop', 'br_1'),
      asset('a_2', 'st_warehouse', 'cat_laptop', 'br_1'),
      asset('a_3', 'st_repair', 'cat_router', 'br_2'),
      asset('a_4', 'st_disposed', 'cat_desk', 'br_2'),
    ],
    ref,
    workstationLicenses: [
      lic('l_1', 'active', 'unassigned'),
      lic('l_2', 'active', 'device'),
      lic('l_3', 'retired', 'unassigned'),
    ],
    serverLicenseCount: 7,
    employeeCount: 42,
    pendingUsersCount: 3,
    auditLogs: auditRows,
  })
}

describe('InMemoryDashboardRepository', () => {
  it('loadAssetStats totals, byStatus, byGroup, topBranches', async () => {
    const s = await makeRepo().loadAssetStats(5)
    expect(s.total).toBe(4)
    expect(s.byStatus).toEqual({ st_warehouse: 1, st_assigned: 1, st_repair: 1, st_disposed: 1 })
    expect(s.byGroup).toEqual([
      { group: 'devices', count: 2 },
      { group: 'network', count: 1 },
      { group: 'furniture', count: 1 },
    ])
    expect(s.topBranches).toEqual([
      { branchId: 'br_1', name: 'HQ', count: 2 },
      { branchId: 'br_2', name: 'West', count: 2 },
    ])
  })

  it('loadAssignmentActivity returns assign/return rows newest-first with assetId from after', async () => {
    const rows = await makeRepo().loadAssignmentActivity(8)
    expect(rows).toEqual([
      { auditId: 'au_3', assetId: 'a_2', action: 'returned', actorUid: 'u_1', at: '2026-06-10T00:00:00.000Z' },
      { auditId: 'au_2', assetId: 'a_1', action: 'assigned', actorUid: 'u_1', at: '2026-06-09T00:00:00.000Z' },
    ])
  })

  it('loadAssignmentActivity respects limit', async () => {
    const rows = await makeRepo().loadAssignmentActivity(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.auditId).toBe('au_3')
  })

  it('loadWorkstationLicenseStats splits free/inUse/retired', async () => {
    const s = await makeRepo().loadWorkstationLicenseStats()
    expect(s).toEqual({ total: 3, free: 1, inUse: 1, retired: 1 })
  })

  it('loadServerLicenseCount', async () => {
    expect(await makeRepo().loadServerLicenseCount()).toBe(7)
  })

  it('loadPeopleStats omits pending when not requested', async () => {
    expect(await makeRepo().loadPeopleStats(false)).toEqual({ employeeCount: 42, pendingUsersCount: null })
    expect(await makeRepo().loadPeopleStats(true)).toEqual({ employeeCount: 42, pendingUsersCount: 3 })
  })

  it('loadRecentAudit returns newest-first, limited', async () => {
    const rows = await makeRepo().loadRecentAudit(2)
    expect(rows.map(r => r.id)).toEqual(['au_3', 'au_2'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/infra/repositories/inMemoryDashboardRepository.test.ts`
Expected: FAIL ("Cannot find module './inMemoryDashboardRepository'").

- [ ] **Step 3: Write `src/infra/repositories/inMemoryDashboardRepository.ts`**

```ts
import type { Asset, AssetReferenceData } from '@/domain/asset'
import { isAssetStatusId } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { DashboardRepository } from '@/domain/dashboard'
import type {
  AssetStats, AssignmentActivityRow, WorkstationLicenseStats, PeopleStats, AssetGroup,
} from '@/domain/dashboard'
import { ASSET_GROUPS, EMPTY_STATUS_COUNTS } from '@/domain/dashboard'

export interface InMemoryDashboardSeed {
  assets: Asset[]
  ref: AssetReferenceData
  workstationLicenses: WorkstationLicense[]
  serverLicenseCount: number
  employeeCount: number
  pendingUsersCount: number
  auditLogs: AuditLog[]
}

/** In-memory aggregation adapter for tests/dev. Reduces the same docs the Firestore
 *  adapter reads, so the two produce identical numbers. */
export class InMemoryDashboardRepository implements DashboardRepository {
  constructor(private readonly seed: InMemoryDashboardSeed) {}

  async loadAssetStats(topBranches = 5): Promise<AssetStats> {
    const { assets, ref } = this.seed
    const byStatus = { ...EMPTY_STATUS_COUNTS }
    const catGroup = new Map(ref.categories.map(c => [c.id, c.group as AssetGroup]))
    const branchName = new Map(ref.branches.map(b => [b.id, b.name]))
    const groupCounts = new Map<AssetGroup, number>(ASSET_GROUPS.map(g => [g, 0]))
    const branchCounts = new Map<string, number>()

    for (const a of assets) {
      if (isAssetStatusId(a.statusId)) byStatus[a.statusId] += 1
      const g = catGroup.get(a.categoryId)
      if (g) groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1)
      branchCounts.set(a.branchId, (branchCounts.get(a.branchId) ?? 0) + 1)
    }

    const topB = [...branchCounts.entries()]
      .map(([branchId, count]) => ({ branchId, name: branchName.get(branchId) ?? branchId, count }))
      .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'ru'))
      .slice(0, topBranches)

    return {
      total: assets.length,
      byStatus,
      byGroup: ASSET_GROUPS.map(group => ({ group, count: groupCounts.get(group) ?? 0 })),
      topBranches: topB,
    }
  }

  async loadAssignmentActivity(limitN = 8): Promise<AssignmentActivityRow[]> {
    return this.seed.auditLogs
      .filter(l => l.entityType === 'assignment' && (l.action === 'assigned' || l.action === 'returned'))
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .slice(0, limitN)
      .map(l => ({
        auditId: l.id,
        assetId: String((l.after as Record<string, unknown> | null)?.assetId ?? ''),
        action: l.action as 'assigned' | 'returned',
        actorUid: l.actorUid,
        at: l.at,
      }))
  }

  async loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats> {
    const rows = this.seed.workstationLicenses
    let free = 0, inUse = 0, retired = 0
    for (const l of rows) {
      if (l.lifecycleStatus === 'retired') retired += 1
      else if (l.assignmentType === 'unassigned') free += 1
      else inUse += 1
    }
    return { total: rows.length, free, inUse, retired }
  }

  async loadServerLicenseCount(): Promise<number> {
    return this.seed.serverLicenseCount
  }

  async loadPeopleStats(includePending: boolean): Promise<PeopleStats> {
    return {
      employeeCount: this.seed.employeeCount,
      pendingUsersCount: includePending ? this.seed.pendingUsersCount : null,
    }
  }

  async loadRecentAudit(limitN = 8): Promise<AuditLog[]> {
    return [...this.seed.auditLogs]
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .slice(0, limitN)
  }
}
```

- [ ] **Step 4: Add to `src/infra/repositories/index.ts` barrel**

Append:
```ts
export * from './inMemoryDashboardRepository'
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- --run src/infra/repositories/inMemoryDashboardRepository.test.ts`
Expected: PASS (7 tests).
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/infra/repositories/inMemoryDashboardRepository.ts src/infra/repositories/index.ts src/infra/repositories/inMemoryDashboardRepository.test.ts
git commit -m "feat(dashboard): InMemory aggregation adapter + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Firestore adapter (firebase-engineer)

**Files:**
- Create: `src/infra/repositories/firestoreDashboardRepository.ts`
- Modify: `src/infra/repositories/index.ts` (barrel)
- Modify: `firestore.indexes.json` (only if a query shape needs it — see Step 4)
- Test: `src/infra/repositories/firestoreDashboardRepository.test.ts`

The Firestore adapter reads the live collections with bounded `getDocs` and reduces with the SAME logic as the InMemory adapter. To keep reduction DRY and identical, extract pure reducer functions into a shared module and have BOTH adapters call them.

- [ ] **Step 1: Create shared pure reducers `src/domain/dashboard/reducers.ts`**

```ts
import type { Asset, AssetReferenceData } from '@/domain/asset'
import { isAssetStatusId } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type {
  AssetStats, AssignmentActivityRow, WorkstationLicenseStats, AssetGroup,
} from './types'
import { ASSET_GROUPS, EMPTY_STATUS_COUNTS } from './types'

export function reduceAssetStats(
  assets: Asset[], ref: AssetReferenceData, topBranches: number,
): AssetStats {
  const byStatus = { ...EMPTY_STATUS_COUNTS }
  const catGroup = new Map(ref.categories.map(c => [c.id, c.group as AssetGroup]))
  const branchName = new Map(ref.branches.map(b => [b.id, b.name]))
  const groupCounts = new Map<AssetGroup, number>(ASSET_GROUPS.map(g => [g, 0]))
  const branchCounts = new Map<string, number>()

  for (const a of assets) {
    if (isAssetStatusId(a.statusId)) byStatus[a.statusId] += 1
    const g = catGroup.get(a.categoryId)
    if (g) groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1)
    branchCounts.set(a.branchId, (branchCounts.get(a.branchId) ?? 0) + 1)
  }

  const topB = [...branchCounts.entries()]
    .map(([branchId, count]) => ({ branchId, name: branchName.get(branchId) ?? branchId, count }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'ru'))
    .slice(0, topBranches)

  return {
    total: assets.length,
    byStatus,
    byGroup: ASSET_GROUPS.map(group => ({ group, count: groupCounts.get(group) ?? 0 })),
    topBranches: topB,
  }
}

export function reduceWorkstationLicenseStats(rows: WorkstationLicense[]): WorkstationLicenseStats {
  let free = 0, inUse = 0, retired = 0
  for (const l of rows) {
    if (l.lifecycleStatus === 'retired') retired += 1
    else if (l.assignmentType === 'unassigned') free += 1
    else inUse += 1
  }
  return { total: rows.length, free, inUse, retired }
}

export function mapAssignmentActivity(rows: AuditLog[]): AssignmentActivityRow[] {
  return rows
    .filter(l => l.entityType === 'assignment' && (l.action === 'assigned' || l.action === 'returned'))
    .map(l => ({
      auditId: l.id,
      assetId: String((l.after as Record<string, unknown> | null)?.assetId ?? ''),
      action: l.action as 'assigned' | 'returned',
      actorUid: l.actorUid,
      at: l.at,
    }))
}
```

  Then refactor `inMemoryDashboardRepository.ts` to call `reduceAssetStats`, `reduceWorkstationLicenseStats`, and `mapAssignmentActivity` (sort before mapping for activity). Re-run Task 2 tests to confirm still green:
  Run: `npm test -- --run src/infra/repositories/inMemoryDashboardRepository.test.ts` → PASS.
  Add `export * from './reducers'` to `src/domain/dashboard/index.ts`.

- [ ] **Step 2: Write the failing test**

`src/infra/repositories/firestoreDashboardRepository.test.ts` uses a hand-rolled fake `Firestore` that records `getDocs` calls and returns canned snapshots. Mirror the style already used by other `firestore*Repository.test.ts` files in this folder (open one to copy the fake-`getDocs`/`collection`/`query` mocking approach). The test must assert:
  - `loadAssetStats` reduces the assets snapshot identically to InMemory (reuse the same expected numbers as Task 2);
  - `loadWorkstationLicenseStats` reduces the licenses snapshot;
  - `loadServerLicenseCount` returns the server_licenses snapshot size;
  - `loadPeopleStats(true)` reads employees + pending; `loadPeopleStats(false)` does NOT read pending;
  - `loadAssignmentActivity` issues an `audit_logs` query filtered to `entityType == 'assignment'`, ordered by `at desc`, limited, and maps `assetId` from `after.assetId`;
  - `loadRecentAudit` issues an `audit_logs` query ordered by `at desc`, limited.

  Follow the EXACT mocking pattern in the sibling test file you open; do not invent a new mock harness.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --run src/infra/repositories/firestoreDashboardRepository.test.ts`
Expected: FAIL ("Cannot find module './firestoreDashboardRepository'").

- [ ] **Step 4: Write `src/infra/repositories/firestoreDashboardRepository.ts`**

```ts
import {
  collection, getDocs, query as fsQuery, where, orderBy, limit as fsLimit,
  type Firestore,
} from 'firebase/firestore'
import type { Asset, AssetReferenceData, CategoryRow, StatusRow, RefRow, EmployeeRow } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { DashboardRepository } from '@/domain/dashboard'
import type {
  AssetStats, AssignmentActivityRow, WorkstationLicenseStats, PeopleStats,
} from '@/domain/dashboard'
import { reduceAssetStats, reduceWorkstationLicenseStats, mapAssignmentActivity } from '@/domain/dashboard'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

/**
 * Production aggregation adapter. Bounded getDocs reads + shared pure reducers.
 * No count() aggregation (keeps InMemory mirror exact). Every collection read here
 * is one a signed-in admin can already read under firestore.rules; the super-admin-only
 * methods (server licenses, pending users, recent audit) are invoked ONLY for super_admin
 * by the useDashboard hook.
 */
export class FirestoreDashboardRepository implements DashboardRepository {
  constructor(private readonly db: Firestore) {}

  async loadAssetStats(topBranches = 5): Promise<AssetStats> {
    const [assetsSnap, ref] = await Promise.all([
      getDocs(collection(this.db, 'assets')),
      this.loadAssetRef(),
    ])
    const assets = assetsSnap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return {
        id: d.id,
        categoryId: String(x.categoryId ?? ''),
        statusId: String(x.statusId ?? ''),
        branchId: String(x.branchId ?? ''),
        // remaining Asset fields are unused by the reducer; cast minimally
      } as unknown as Asset
    })
    return reduceAssetStats(assets, ref, topBranches)
  }

  private async loadAssetRef(): Promise<AssetReferenceData> {
    const [branches, categories] = await Promise.all([
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<CategoryRow>('categories', d => ({
        name: String(d.name ?? ''),
        group: (d.group as CategoryRow['group']) ?? 'devices',
        lucideIcon: String(d.lucideIcon ?? 'package'),
      })),
    ])
    // statuses/departments/employees not needed by reduceAssetStats; supply empties.
    return {
      statuses: [] as StatusRow[], branches, departments: [], categories, employees: [] as EmployeeRow[],
    }
  }

  async loadAssignmentActivity(limitN = 8): Promise<AssignmentActivityRow[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'audit_logs'),
      where('entityType', '==', 'assignment'),
      orderBy('at', 'desc'),
      fsLimit(limitN * 2), // over-read: filter assigned|returned client-side, then slice
    ))
    const rows = snap.docs.map(d => this.toAuditLog(d.id, d.data() as Record<string, unknown>))
    return mapAssignmentActivity(rows).slice(0, limitN)
  }

  async loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats> {
    const snap = await getDocs(collection(this.db, 'licenses'))
    const rows = snap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return {
        id: d.id,
        lifecycleStatus: (x.lifecycleStatus as WorkstationLicense['lifecycleStatus']) ?? 'active',
        assignmentType: (x.assignmentType as WorkstationLicense['assignmentType']) ?? 'unassigned',
      } as unknown as WorkstationLicense
    })
    return reduceWorkstationLicenseStats(rows)
  }

  async loadServerLicenseCount(): Promise<number> {
    const snap = await getDocs(collection(this.db, 'server_licenses'))
    return snap.size
  }

  async loadPeopleStats(includePending: boolean): Promise<PeopleStats> {
    const employeesSnap = await getDocs(collection(this.db, 'employees'))
    let pendingUsersCount: number | null = null
    if (includePending) {
      const pendingSnap = await getDocs(fsQuery(
        collection(this.db, 'users'), where('status', '==', 'no-role'),
      ))
      pendingUsersCount = pendingSnap.size
    }
    return { employeeCount: employeesSnap.size, pendingUsersCount }
  }

  async loadRecentAudit(limitN = 8): Promise<AuditLog[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'audit_logs'), orderBy('at', 'desc'), fsLimit(limitN),
    ))
    return snap.docs.map(d => this.toAuditLog(d.id, d.data() as Record<string, unknown>))
  }

  private toAuditLog(id: string, x: Record<string, unknown>): AuditLog {
    return {
      id,
      entityType: x.entityType as AuditLog['entityType'],
      entityId: String(x.entityId ?? ''),
      action: x.action as AuditLog['action'],
      actorUid: String(x.actorUid ?? ''),
      actorRole: x.actorRole as AuditLog['actorRole'],
      before: (x.before as AuditLog['before']) ?? null,
      after: (x.after as AuditLog['after']) ?? null,
      comment: (x.comment as string | null) ?? null,
      at: toIso(x.at),
    }
  }

  private async readCol<T extends { id: string }>(
    name: string, map: (d: Record<string, unknown>) => Omit<T, 'id'>,
  ): Promise<T[]> {
    const snap = await getDocs(collection(this.db, name))
    return snap.docs.map(d => ({ ...map(d.data() as Record<string, unknown>), id: d.id } as T))
  }
}
```

  NOTE on the pending-users query: confirm how `pending-users` is actually queried in the existing `firestoreUserRepository.ts` (`listPendingUsers`). Match its EXACT collection + filter (it may read `users where status == 'no-role'` or a `pending_users` collection). Use whatever that file uses — do not guess. Adjust the `loadPeopleStats` pending branch to match it verbatim.

- [ ] **Step 5: Check/extend `firestore.indexes.json`**

`loadAssignmentActivity` queries `audit_logs` with `where(entityType==assignment) + orderBy(at desc)` — this is covered by the existing `entityType + at` composite index (lines 71-74). `loadRecentAudit` is a single-field `orderBy(at desc)` — single-field indexes are automatic. `loadPeopleStats` pending query matches the existing user-repo query (already supported). **Expected: no index change.** If the firebase-engineer's test or a real query plan reveals a missing index, add the minimal composite to `firestore.indexes.json` and note it in the task report.

- [ ] **Step 6: Run tests + typecheck**

Run: `npm test -- --run src/infra/repositories/firestoreDashboardRepository.test.ts`
Expected: PASS.
Run: `npm test -- --run src/infra/repositories/inMemoryDashboardRepository.test.ts`
Expected: PASS (still green after reducer refactor).
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/domain/dashboard/reducers.ts src/domain/dashboard/index.ts src/infra/repositories/firestoreDashboardRepository.ts src/infra/repositories/inMemoryDashboardRepository.ts src/infra/repositories/index.ts src/infra/repositories/firestoreDashboardRepository.test.ts firestore.indexes.json
git commit -m "feat(dashboard): Firestore aggregation adapter + shared reducers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Role-aware data hook (react-ui-engineer)

**Files:**
- Create: `src/hooks/useDashboard.ts`
- Modify: `src/hooks/index.ts` (barrel)
- Test: `src/hooks/useDashboard.test.ts`

- [ ] **Step 1: Write the failing test**

`src/hooks/useDashboard.test.ts` — drive the hook with `@testing-library/react`'s `renderHook` and a fake repo (a plain object implementing `DashboardRepository` with `vi.fn()` per method). Assert per role which methods are called and which `DashboardData` slots are populated:
```ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDashboard } from './useDashboard'
import type { DashboardRepository } from '@/domain/dashboard'
import { emptyAssetStats } from '@/domain/dashboard'

function fakeRepo(overrides: Partial<DashboardRepository> = {}): DashboardRepository {
  return {
    loadAssetStats: vi.fn().mockResolvedValue(emptyAssetStats()),
    loadAssignmentActivity: vi.fn().mockResolvedValue([]),
    loadWorkstationLicenseStats: vi.fn().mockResolvedValue({ total: 0, free: 0, inUse: 0, retired: 0 }),
    loadServerLicenseCount: vi.fn().mockResolvedValue(0),
    loadPeopleStats: vi.fn().mockResolvedValue({ employeeCount: 0, pendingUsersCount: null }),
    loadRecentAudit: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

describe('useDashboard role gating', () => {
  it('super_admin calls every section', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'super_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(repo.loadAssetStats).toHaveBeenCalled()
    expect(repo.loadAssignmentActivity).toHaveBeenCalled()
    expect(repo.loadWorkstationLicenseStats).toHaveBeenCalled()
    expect(repo.loadServerLicenseCount).toHaveBeenCalled()
    expect(repo.loadPeopleStats).toHaveBeenCalledWith(true)
    expect(repo.loadRecentAudit).toHaveBeenCalled()
    expect(result.current.data.serverLicenseCount).toBe(0)
    expect(result.current.data.recentAudit).toEqual([])
  })

  it('asset_admin: assets+assignments+people(no pending); NO licenses/server/audit', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'asset_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(repo.loadAssetStats).toHaveBeenCalled()
    expect(repo.loadAssignmentActivity).toHaveBeenCalled()
    expect(repo.loadPeopleStats).toHaveBeenCalledWith(false)
    expect(repo.loadWorkstationLicenseStats).not.toHaveBeenCalled()
    expect(repo.loadServerLicenseCount).not.toHaveBeenCalled()
    expect(repo.loadRecentAudit).not.toHaveBeenCalled()
    expect(result.current.data.workstationLicenses).toBeNull()
    expect(result.current.data.serverLicenseCount).toBeNull()
    expect(result.current.data.people).not.toBeNull()
  })

  it('tech_admin: assets+assignments+workstation licenses; NO server/people/audit', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'tech_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(repo.loadWorkstationLicenseStats).toHaveBeenCalled()
    expect(repo.loadServerLicenseCount).not.toHaveBeenCalled()
    expect(repo.loadPeopleStats).not.toHaveBeenCalled()
    expect(repo.loadRecentAudit).not.toHaveBeenCalled()
    expect(result.current.data.people).toBeNull()
  })

  it('fills currentlyOut from asset byStatus.st_assigned', async () => {
    const stats = emptyAssetStats(); stats.byStatus.st_assigned = 9
    const repo = fakeRepo({ loadAssetStats: vi.fn().mockResolvedValue(stats) })
    const { result } = renderHook(() => useDashboard(repo, 'asset_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data.assignments?.currentlyOut).toBe(9)
  })

  it('a failing section leaves its slot null and does not blank others', async () => {
    const repo = fakeRepo({ loadWorkstationLicenseStats: vi.fn().mockRejectedValue(new Error('x')) })
    const { result } = renderHook(() => useDashboard(repo, 'tech_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data.assets).not.toBeNull()
    expect(result.current.data.workstationLicenses).toBeNull()
    expect(result.current.error).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/hooks/useDashboard.test.ts`
Expected: FAIL ("Cannot find module './useDashboard'").

- [ ] **Step 3: Write `src/hooks/useDashboard.ts`**

```ts
import { useEffect, useState, useCallback } from 'react'
import type { Role } from '@/config/roles'
import type { DashboardRepository, DashboardData } from '@/domain/dashboard'

const EMPTY: DashboardData = {
  assets: null, assignments: null, workstationLicenses: null,
  serverLicenseCount: null, people: null, recentAudit: null,
}

export interface UseDashboardResult {
  data: DashboardData
  loading: boolean
  /** True if ANY permitted section failed (per-section nulls remain). */
  error: boolean
  reload: () => void
}

/** Section permissions per role — MUST mirror nav RoleGate (see config/nav.ts). */
function permissions(role: Role) {
  const admin = role === 'super_admin' || role === 'asset_admin' || role === 'tech_admin'
  return {
    assets: admin,
    assignments: admin,
    workstationLicenses: role === 'super_admin' || role === 'tech_admin',
    serverLicense: role === 'super_admin',
    people: role === 'super_admin' || role === 'asset_admin',
    pending: role === 'super_admin',
    recentAudit: role === 'super_admin',
  }
}

/**
 * Loads dashboard sections the role is permitted to see, in parallel.
 * @param repo MUST be a stable reference (memoized) — same contract as useAssets.
 */
export function useDashboard(repo: DashboardRepository, role: Role): UseDashboardResult {
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let active = true
    const p = permissions(role)
    setLoading(true)
    setError(false)
    setData(EMPTY)

    void (async () => {
      const next: DashboardData = { ...EMPTY }
      let anyError = false

      const tasks: Promise<void>[] = []
      const run = <T,>(fn: () => Promise<T>, assign: (v: T) => void) => {
        tasks.push(fn().then(assign).catch(() => { anyError = true }))
      }

      if (p.assets) run(() => repo.loadAssetStats(5), v => { next.assets = v })
      if (p.assignments) run(() => repo.loadAssignmentActivity(8), v => {
        next.assignments = { currentlyOut: 0, recent: v }
      })
      if (p.workstationLicenses) run(() => repo.loadWorkstationLicenseStats(), v => { next.workstationLicenses = v })
      if (p.serverLicense) run(() => repo.loadServerLicenseCount(), v => { next.serverLicenseCount = v })
      if (p.people) run(() => repo.loadPeopleStats(p.pending), v => { next.people = v })
      if (p.recentAudit) run(() => repo.loadRecentAudit(8), v => { next.recentAudit = v })

      await Promise.allSettled(tasks)
      if (!active) return
      // Fill currentlyOut from asset status counts (no extra query).
      if (next.assignments && next.assets) {
        next.assignments = { ...next.assignments, currentlyOut: next.assets.byStatus.st_assigned }
      }
      setData(next)
      setError(anyError)
      setLoading(false)
    })()

    return () => { active = false }
  }, [repo, role, tick])

  return { data, loading, error, reload }
}
```

- [ ] **Step 4: Add to `src/hooks/index.ts` barrel**

Append:
```ts
export * from './useDashboard'
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test -- --run src/hooks/useDashboard.test.ts`
Expected: PASS (5 tests).
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDashboard.ts src/hooks/index.ts src/hooks/useDashboard.test.ts
git commit -m "feat(dashboard): role-aware useDashboard hook + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Dashboard UI components (react-ui-engineer)

**Files:**
- Create: `src/components/features/dashboard/KpiTile.tsx`
- Create: `src/components/features/dashboard/StatusBreakdown.tsx`
- Create: `src/components/features/dashboard/GroupBreakdown.tsx`
- Create: `src/components/features/dashboard/BranchBreakdown.tsx`
- Create: `src/components/features/dashboard/LicenseStatTile.tsx`
- Create: `src/components/features/dashboard/PeopleTile.tsx`
- Create: `src/components/features/dashboard/RecentActivityList.tsx`
- Create: `src/components/features/dashboard/index.ts`
- Test: `src/components/features/dashboard/dashboard-components.test.tsx`

Use existing primitives: `SectionCard`, `Icon`, `Btn` from `@/components/ui`; `react-router-dom`'s `Link` for navigation. Match the dark/orange palette already used (e.g. card bg `#22272E`, muted `#64748B`/`#94A3B8`, text `#F8FAFC`, orange `#F97316`). Status proportion bars: a track div + a fill div whose width is `count/total*100%` and whose background derives from the status `color` token. Map status `color` strings (`gray/green/orange/red`) to Tailwind/hex via a small local map — DO NOT introduce SVG/chart libs.

- [ ] **Step 1: Write the failing test**

`src/components/features/dashboard/dashboard-components.test.tsx` renders each component inside a `MemoryRouter` and asserts: KpiTile shows label+value and links to its `to`; StatusBreakdown renders 4 rows with counts; GroupBreakdown renders 3 group rows; BranchBreakdown renders branch names+counts and an empty state when no branches; LicenseStatTile shows total + free/in-use/retired numbers and NEVER renders any key string; RecentActivityList renders rows with action labels + an empty state. Example shape:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'   // confirm actual i18n instance export path
import { KpiTile, StatusBreakdown, LicenseStatTile } from './index'

function wrap(ui: React.ReactNode) {
  return render(<I18nextProvider i18n={i18n}><MemoryRouter>{ui}</MemoryRouter></I18nextProvider>)
}

describe('dashboard components', () => {
  it('KpiTile renders value + link', () => {
    wrap(<KpiTile icon="package" label="Total assets" value={12} to="/assets" />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/assets')
  })

  it('StatusBreakdown renders four rows', () => {
    wrap(<StatusBreakdown
      byStatus={{ st_warehouse: 1, st_assigned: 2, st_repair: 0, st_disposed: 0 }}
      statuses={[
        { id: 'st_warehouse', name: 'Warehouse', color: 'gray' },
        { id: 'st_assigned', name: 'Assigned', color: 'green' },
        { id: 'st_repair', name: 'In Repair', color: 'orange' },
        { id: 'st_disposed', name: 'Disposed', color: 'red' },
      ]}
      total={3}
    />)
    expect(screen.getByText('Warehouse')).toBeInTheDocument()
    expect(screen.getByText('Assigned')).toBeInTheDocument()
  })

  it('LicenseStatTile shows aggregate numbers, no keys', () => {
    const { container } = wrap(<LicenseStatTile stats={{ total: 5, free: 2, inUse: 2, retired: 1 }} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/[A-Z0-9]{5}-[A-Z0-9]{5}/) // no license-key pattern
  })
})
```

Confirm the actual i18n instance import (open `src/main.tsx` or an existing component test that uses `I18nextProvider`) and use that exact path. If existing tests render with the app's test helpers instead, follow that established helper.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/features/dashboard/dashboard-components.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the seven components + barrel**

Build each component with the dark/orange primitives. Required prop contracts (keep these exact so Task 6 wires them cleanly):

- `KpiTile({ icon: string; label: string; value: number | string; to: string; sub?: string })` — wraps content in `<Link to={to}>`, renders `SectionCard noHeader` with icon badge + label + big tabular number + optional `sub`.
- `StatusBreakdown({ byStatus: Record<AssetStatusId, number>; statuses: StatusRow[]; total: number })` — 4 rows in `ASSET_STATUS_IDS` order; each row label from `statuses` name, count from `byStatus`, proportion bar `width: total ? count/total*100% : 0`. Local `STATUS_BAR_COLOR: Record<string,string>` maps `gray/green/orange/red` → hex.
- `GroupBreakdown({ byGroup: GroupCount[] })` — 3 rows (devices/network/furniture); label via `t('groups.<group>')`; compact bars relative to the max group count.
- `BranchBreakdown({ branches: BranchCount[] })` — rows name+count; `EmptyState` when `branches.length === 0`.
- `LicenseStatTile({ stats: WorkstationLicenseStats })` — total big number + 3 chips (free/in-use/retired) with `t()` labels. NEVER render a license name or key.
- `PeopleTile({ employeeCount: number; pendingUsersCount: number | null })` — employee count KPI; when `pendingUsersCount != null && > 0`, a secondary `Link to="/pending-users"` line with the count.
- `RecentActivityList({ title: string; icon: string; rows: ActivityRowVM[]; emptyLabel: string; moreTo?: string })` where `ActivityRowVM = { id: string; icon: string; label: string; at: string; to?: string }` — list rows (icon + label + DD/Mon/YYYY date), `EmptyState` when empty, optional "view all" link.

  `index.ts` re-exports all seven + the `ActivityRowVM` type.

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test -- --run src/components/features/dashboard/dashboard-components.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/features/dashboard
git commit -m "feat(dashboard): KPI/breakdown/activity UI components + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Rewrite DashboardPage (react-ui-engineer)

**Files:**
- Modify: `src/pages/DashboardPage.tsx` (full rewrite)
- Test: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/pages/DashboardPage.test.tsx` renders `DashboardPage` with an injected `InMemoryDashboardRepository` (seed like Task 2) and the app's auth/i18n test wrapper, once per admin role. Assert:
  - super_admin: asset KPIs visible, license tile visible, server-license tile visible, people tile visible, recent-audit list visible.
  - asset_admin: asset KPIs + people visible; license tile + server tile + recent-audit NOT in the document.
  - tech_admin: asset KPIs + workstation license tile visible; people tile + server tile + recent-audit NOT present.
  - loading state renders `LoadingState` before data resolves.

  Use the same auth wrapper other page tests use (open `AssetsPage.test.tsx` / `LicensesPage.test.tsx` to copy the `AuthProvider initialRole=...` + i18n render helper). Inject the repo via the page's `repo` prop.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/pages/DashboardPage.test.tsx`
Expected: FAIL (page still the placeholder; assertions miss).

- [ ] **Step 3: Rewrite `src/pages/DashboardPage.tsx`**

```tsx
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, LoadingState } from '@/components/ui'
import {
  KpiTile, StatusBreakdown, GroupBreakdown, BranchBreakdown,
  LicenseStatTile, PeopleTile, RecentActivityList,
} from '@/components/features/dashboard'
import type { ActivityRowVM } from '@/components/features/dashboard'
import { useDashboard } from '@/hooks'
import type { DashboardRepository } from '@/domain/dashboard'
import { FirestoreDashboardRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

export interface DashboardPageProps {
  /** Test seam. Production builds a FirestoreDashboardRepository. */
  repo?: DashboardRepository
}

export function DashboardPage({ repo }: DashboardPageProps) {
  const { t } = useTranslation('dashboard')
  const { role } = useAuth()

  const defaultRepo = useMemo<DashboardRepository>(
    () => new FirestoreDashboardRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const activeRepo = repo ?? defaultRepo

  const { data, loading } = useDashboard(activeRepo, role)

  if (loading) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="layout-dashboard" title={t('title')} />
        <LoadingState rows={6} />
      </div>
    )
  }

  const assets = data.assets
  const activityRows: ActivityRowVM[] = (data.assignments?.recent ?? []).map(r => ({
    id: r.auditId,
    icon: r.action === 'assigned' ? 'arrow-right' : 'undo-2',
    label: t(`activity.${r.action}`),
    at: r.at,
    to: r.assetId ? `/assets/${r.assetId}` : undefined,
  }))
  const auditRows: ActivityRowVM[] = (data.recentAudit ?? []).map(a => ({
    id: a.id,
    icon: 'history',
    label: t(`auditAction.${a.action}`, { defaultValue: a.action }),
    at: a.at,
  }))

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="layout-dashboard" title={t('title')} />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {assets && <KpiTile icon="package" label={t('kpi.totalAssets')} value={assets.total} to="/assets" />}
        {data.assignments && (
          <KpiTile icon="arrow-right-left" label={t('kpi.currentlyOut')} value={data.assignments.currentlyOut} to="/assets" />
        )}
        {data.workstationLicenses && (
          <KpiTile icon="key-round" label={t('kpi.licenses')} value={data.workstationLicenses.total} to="/licenses" />
        )}
        {data.serverLicenseCount != null && (
          <KpiTile icon="server" label={t('kpi.serverLicenses')} value={data.serverLicenseCount} to="/licenses" />
        )}
        {data.people && (
          <KpiTile icon="users" label={t('kpi.employees')} value={data.people.employeeCount} to="/employees" />
        )}
      </div>

      {/* Breakdown + activity grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {assets && (
          <StatusBreakdown byStatus={assets.byStatus} statuses={[
            { id: 'st_warehouse', name: t('status.st_warehouse'), color: 'gray' },
            { id: 'st_assigned', name: t('status.st_assigned'), color: 'green' },
            { id: 'st_repair', name: t('status.st_repair'), color: 'orange' },
            { id: 'st_disposed', name: t('status.st_disposed'), color: 'red' },
          ]} total={assets.total} />
        )}
        {assets && <GroupBreakdown byGroup={assets.byGroup} />}
        {assets && <BranchBreakdown branches={assets.topBranches} />}
        {data.workstationLicenses && <LicenseStatTile stats={data.workstationLicenses} />}
        {data.people && (
          <PeopleTile employeeCount={data.people.employeeCount} pendingUsersCount={data.people.pendingUsersCount} />
        )}
        <RecentActivityList title={t('recentActivity')} icon="arrow-right-left" rows={activityRows} emptyLabel={t('noActivity')} />
        {data.recentAudit && (
          <RecentActivityList title={t('recentAudit')} icon="history" rows={auditRows} emptyLabel={t('noAudit')} moreTo="/audit" />
        )}
      </div>
    </div>
  )
}
```

  NOTE: status names here use the `dashboard` namespace status keys for the breakdown labels; if the project already has localized status names in the `statuses` namespace, prefer importing those to avoid duplication — the i18n-engineer (Task 7) resolves the final source. Keep the prop contract (`StatusBreakdown` takes `StatusRow[]`) regardless.

- [ ] **Step 4: Run tests + typecheck + build**

Run: `npm test -- --run src/pages/DashboardPage.test.tsx`
Expected: PASS.
Run: `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx
git commit -m "feat(dashboard): role-gated DashboardPage on real data

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: i18n — dashboard namespace (i18n-engineer)

**Files:**
- Create: `src/locales/ru/dashboard.json`
- Create: `src/locales/en/dashboard.json`
- Create: `src/locales/hy/dashboard.json`
- Modify: i18n config (register the `dashboard` namespace — open `src/lib/i18n/index.ts` or wherever namespaces/resources are registered and follow the existing pattern used for `licenses`/`audit`).
- Test: `src/locales/dashboard-i18n.test.ts` (or extend the existing locale-parity test if one exists — check `src/locales` for a parity test first).

- [ ] **Step 1: Write the failing test**

A parity test asserting every key present in `ru/dashboard.json` exists in `en` and `hy`, and that a few representative keys resolve via `i18n.t`. If the repo already has a generic locale-parity test that auto-discovers namespaces, that test will start covering `dashboard.json` automatically — in that case add a focused resolve test for 3 dashboard keys in `ru/en/hy`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run dashboard-i18n` (or the parity test)
Expected: FAIL (files missing / namespace unregistered).

- [ ] **Step 3: Author the three locale files**

Keys (author in ru first, then en, then hy — translate, don't transliterate):
```
title, recentActivity, recentAudit, noActivity, noAudit
kpi.totalAssets, kpi.currentlyOut, kpi.licenses, kpi.serverLicenses, kpi.employees
status.st_warehouse, status.st_assigned, status.st_repair, status.st_disposed
groups.devices, groups.network, groups.furniture
license.total, license.free, license.inUse, license.retired, license.title
people.title, people.employees, people.pending
activity.assigned, activity.returned
branches.title, branches.empty
auditAction.created, auditAction.updated, auditAction.status_changed, auditAction.assigned,
auditAction.returned, auditAction.disposed, auditAction.role_assigned
```
ru values (sample — complete all keys):
```json
{
  "title": "Панель управления",
  "recentActivity": "Недавняя активность",
  "recentAudit": "Недавний аудит",
  "noActivity": "Нет активности",
  "kpi": { "totalAssets": "Всего активов", "currentlyOut": "Выдано сейчас", "licenses": "Лицензии", "serverLicenses": "Серверные лицензии", "employees": "Сотрудники" },
  "status": { "st_warehouse": "На складе", "st_assigned": "Выдано", "st_repair": "В ремонте", "st_disposed": "Списано" },
  "groups": { "devices": "Устройства", "network": "Сетевые устройства", "furniture": "Мебель" },
  "license": { "total": "Всего", "free": "Свободно", "inUse": "Используется", "retired": "Выведено", "title": "Лицензии рабочих станций" },
  "people": { "title": "Люди", "employees": "Сотрудники", "pending": "Ожидают подтверждения" },
  "activity": { "assigned": "Выдан актив", "returned": "Актив возвращён" },
  "branches": { "title": "Активы по филиалам", "empty": "Нет данных по филиалам" }
}
```
  (If status/group names already exist in the `statuses`/`categories` namespaces, you MAY import those at the call site instead of duplicating — coordinate with the page's `StatusBreakdown`/`GroupBreakdown` labels. Either way ensure no missing-key warnings.)

- [ ] **Step 4: Register the namespace**

In the i18n config, add `dashboard` to the resources for `ru/en/hy` exactly as `licenses`/`audit` are registered.

- [ ] **Step 5: Run tests + typecheck + build**

Run: `npm test -- --run` (full suite)
Expected: PASS — 577 baseline + all new tests; no missing-i18n-key warnings for `dashboard`.
Run: `npm run typecheck` → clean.
Run: `npm run build` → success.

- [ ] **Step 6: Commit**

```bash
git add src/locales/ru/dashboard.json src/locales/en/dashboard.json src/locales/hy/dashboard.json src/lib/i18n
git commit -m "feat(dashboard): ru/en/hy locale namespace + parity test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Rules tests for new read paths (firebase-engineer)

**Files:**
- Modify/Create: the existing rules-test file covering `audit_logs`/`server_licenses`/`users` reads (find it under the rules-test location used by the project — search for `@firebase/rules-unit-testing`).

The dashboard introduces NO new collection and NO new write path. Every read targets a collection admins can already read. Still, author (do not necessarily run — Java may be unavailable locally) focused rules tests asserting:
  - tech_admin CAN read `licenses` (workstation) but the dashboard never reads `server_licenses` for tech_admin; assert tech_admin read of `server_licenses` is the SAME as current rules (no regression).
  - asset_admin reading `licenses` matches current rules (the dashboard never calls it for asset_admin; this just documents the boundary).
  - super_admin CAN read `server_licenses`, the pending-users query, and `audit_logs`.

- [ ] **Step 1: Locate the rules test harness** — search the repo for `rules-unit-testing` and open the existing file; mirror its setup.
- [ ] **Step 2: Add the assertions above** following the existing pattern.
- [ ] **Step 3: Attempt to run** the rules tests per the project's documented command. If Java is unavailable locally, note "authored for CI; not run locally (Java unavailable)" in the task report — this matches the owner's stated constraint.
- [ ] **Step 4: Commit**

```bash
git add <rules-test-file>
git commit -m "test(dashboard): rules tests documenting read-path boundaries for dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification (orchestrator gate before reviews)

Run from `C:/Users/DELL/Desktop/assets-crm`:
```
npm run typecheck
npm test -- --run
npm run build
```
Expected: typecheck clean; tests = 577 baseline + new (all green); build success. Then run the review gates: spec-reviewer → code-quality-reviewer → security-reviewer.

---

## Self-review notes (author check)

- **Spec coverage:** Asset KPIs (Task 1/2/3 stats + Task 5 components + Task 6 page); assignment activity + currentlyOut (Tasks 2/3/4/5/6, fork B audit-derived per spec §7); license stats + server count (Tasks 2/3/4/5/6, role-gated); people + pending (Tasks 2/3/4/5/6); recent audit (Tasks 2/3/4/5/6, super_admin); quick links/empty states (Task 5 components each link + EmptyState); role gating (Task 4 hook + Task 6 page); InMemory mirror (Task 2); page imports no Firebase except composition root (Task 6); i18n ru/en/hy (Task 7); indexes/rules (Tasks 3/8). All spec sections mapped.
- **Placeholder scan:** Task 3 Step 2 and Task 5/6/7/8 reference "open the sibling file and copy the pattern" — intentional because the exact mock/i18n/auth test helpers must match existing project conventions verbatim; the prop contracts and assertions are fully specified so the implementer cannot drift.
- **Type consistency:** `DashboardData` slots, `permissions()` keys, hook assignments, and page reads all use the same names; `AssignmentActivityRow.assetId` sourced from `after.assetId` consistently in Tasks 2/3; `WorkstationLicenseStats` shape identical across Tasks 1/2/3/4/5/6.
