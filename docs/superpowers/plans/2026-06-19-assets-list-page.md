# Assets List Page + departments rules narrowing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Narrow `/departments` write access to super_admin only, then replace the `/assets` StubPage with a real Assets list page (table + search + filters + pagination + states), backed by an `AssetRepository` port with a Firestore read adapter, verifiable now against the Firebase emulator seeded with the prototype's mock data.

**Architecture:** Ports-and-adapters. `src/domain/asset/` defines the `Asset` entity, `AssetStatusId` enum, query types, and the `AssetRepository` interface. `src/infra/repositories/firestoreAssetRepository.ts` is the production read adapter. A typed in-memory fake adapter (`src/infra/repositories/inMemoryAssetRepository.ts`) backs unit tests and the page-level component tests. The page consumes the repository via a `useAssets` hook returning `{ data, loading, error }`. The route is wired in `routes.tsx` (remove `'assets'` from `PHASE_STUB_ROUTES`, add a dedicated `<RoleGate>`d route). Reference data (statuses/branches/departments/categories) is read through the same repository so the list can resolve names without N+1 component coupling.

**Tech Stack:** React 19 + Vite 6 + TypeScript (strict) + Tailwind (dark/orange theme) + Firebase v9 modular Firestore + react-i18next + Vitest + @testing-library/react + @firebase/rules-unit-testing.

**Working directory:** `C:/Users/DELL/Desktop/assets-crm` (NOT the Warehouse prototype dir). All paths below are absolute.

---

## Canonical data contract (from prototype mock-data.js)

Asset doc shape (Firestore `assets/{id}`):
```
{
  id: string,
  categoryId: string,          // e.g. 'cat_laptop' → categories/{id}
  brand: string | null,        // null for furniture
  model: string | null,        // null for furniture
  invCode: string,             // 'PREFIX/NUMBER' e.g. 'LAP/00031' — unique
  serial: string | null,       // null when category.requiresSerial === false
  statusId: string,            // one of st_warehouse|st_assigned|st_repair|st_disposed
  assignment: {                // null = unassigned
    mode: 'employee'|'department'|'branch',
    employeeId?: string, departmentId?: string, branchId?: string
  } | null,
  branchId: string,            // branches/{id}
  deptId: string | null,       // departments/{id} (denormalised)
  updatedAt: string,           // ISO string
  currentSpecs?: { cpu?, ram?, ssd?, gpu? } | null,
}
```
Statuses (4 canonical): `st_warehouse`/На складе/gray, `st_assigned`/Выдано/green, `st_repair`/В ремонте/orange, `st_disposed`/Списано/red.
Branches (5), Departments (~6), Categories (131) each carry `{ id, name, ... }`.

List columns: **Актив** (icon + brand/model + category·serial sub-line) · **Инв. код** (mono) · **Статус** (Chip with status color) · **Назначен** (employee/dept/branch/warehouse) · **Филиал** · **Обновлено** (relative time).
Filters: group tabs (all/devices/network/furniture), status select, branch select, search box. Sort: updated_desc (default) / updated_asc / name_asc / name_desc / inv_asc. Page size 15.

---

## Part A — Owner decision 2: narrow `/departments` write to super_admin

### Task A1: Move departments write to super_admin in firestore.rules

**Files:**
- Modify: `C:/Users/DELL/Desktop/assets-crm/firestore.rules` (the `/departments/{id}` block, currently lines ~71-74)
- Test: `C:/Users/DELL/Desktop/assets-crm/tests/rules/firestore.rules.test.ts` (add cases to the `role matrix` describe)

- [ ] **Step 1: Add failing rules tests for the narrowed permission**

In `tests/rules/firestore.rules.test.ts`, inside `describe('role matrix', ...)`, add:
```ts
it('super_admin CAN write departments; asset_admin CANNOT; tech_admin CANNOT', async () => {
  await assertSucceeds(setDoc(doc(authedDb(env, SUPER), 'departments', 'd1'), { name: 'D' }))
  await assertFails(setDoc(doc(authedDb(env, ASSET), 'departments', 'd2'), { name: 'D' }))
  await assertFails(setDoc(doc(authedDb(env, TECH), 'departments', 'd3'), { name: 'D' }))
})

it('any signed-in user CAN read departments; unauthenticated CANNOT', async () => {
  await seedDoc(env, 'departments/r1', { name: 'D' })
  await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'departments', 'r1')))
  await assertFails(getDoc(doc(unauthedDb(env), 'departments', 'r1')))
})
```

- [ ] **Step 2: Run rules tests to verify the asset_admin case fails**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run test:rules`
Expected: the new `super_admin CAN write departments; asset_admin CANNOT` test FAILS (asset_admin currently CAN write departments).

- [ ] **Step 3: Move the departments block from operational entities to reference catalogs**

In `firestore.rules`, delete the `/departments/{id}` block from the "Operational entities" group:
```
    match /departments/{id} {
      allow read: if isSignedIn();
      allow write: if isSuperAdmin() || isAssetAdmin();
    }
```
Add it to the "Reference catalogs" group (after `/categories/{id}`), so the comment reflects catalog ownership:
```
    // ---- Reference catalogs: read any signed-in, write super only ----
    match /asset_statuses/{id} {
      allow read: if isSignedIn();
      allow write: if isSuperAdmin();
    }
    match /categories/{id} {
      allow read: if isSignedIn();
      allow write: if isSuperAdmin();
    }
    // Departments are reference/catalog data (§5): super_admin only may mutate.
    match /departments/{id} {
      allow read: if isSignedIn();
      allow write: if isSuperAdmin();
    }
```

- [ ] **Step 4: Run rules tests to verify all pass**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npm run test:rules`
Expected: PASS (new departments cases + all pre-existing cases).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/DELL/Desktop/assets-crm
git add firestore.rules tests/rules/firestore.rules.test.ts
git commit -m "feat(rules): narrow departments write to super_admin (catalog data)"
```

> GATE: After A1, run `security-reviewer` on the firestore.rules diff before proceeding to Part B.

---

## Part B — Assets list page

### Task B1 (domain-modeler): Asset domain types + AssetRepository port

**Files:**
- Create: `C:/Users/DELL/Desktop/assets-crm/src/domain/asset/types.ts`
- Create: `C:/Users/DELL/Desktop/assets-crm/src/domain/asset/AssetRepository.ts`
- Create: `C:/Users/DELL/Desktop/assets-crm/src/domain/asset/index.ts`
- Modify: `C:/Users/DELL/Desktop/assets-crm/src/domain/index.ts`
- Test: `C:/Users/DELL/Desktop/assets-crm/src/domain/asset/asset-types.test.ts`

- [ ] **Step 1: Write failing test for the inventory-code helpers and status enum**

`src/domain/asset/asset-types.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ASSET_STATUS_IDS, isAssetStatusId, parseInventoryCode } from './types'

describe('asset status enum', () => {
  it('has exactly the 4 canonical status ids', () => {
    expect(ASSET_STATUS_IDS).toEqual(['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'])
  })
  it('isAssetStatusId narrows correctly', () => {
    expect(isAssetStatusId('st_assigned')).toBe(true)
    expect(isAssetStatusId('st_unknown')).toBe(false)
  })
})

describe('parseInventoryCode', () => {
  it('splits PREFIX/NUMBER', () => {
    expect(parseInventoryCode('LAP/00031')).toEqual({ prefix: 'LAP', number: '00031' })
  })
  it('returns null for malformed codes', () => {
    expect(parseInventoryCode('LAP')).toBeNull()
    expect(parseInventoryCode('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/domain/asset/asset-types.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/domain/asset/types.ts`**

```ts
/** The four canonical AMS asset statuses (CONFIRMED v8). Order = display order. */
export const ASSET_STATUS_IDS = ['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'] as const
export type AssetStatusId = (typeof ASSET_STATUS_IDS)[number]

export function isAssetStatusId(v: string): v is AssetStatusId {
  return (ASSET_STATUS_IDS as readonly string[]).includes(v)
}

export type AssignmentMode = 'employee' | 'department' | 'branch'

export interface AssetAssignment {
  mode: AssignmentMode
  employeeId?: string
  departmentId?: string
  branchId?: string
}

export interface AssetSpecs {
  cpu?: string
  ram?: string
  ssd?: string
  gpu?: string
}

/** A single tracked physical item. Mirrors Firestore assets/{id}. */
export interface Asset {
  id: string
  categoryId: string
  brand: string | null
  model: string | null
  invCode: string
  serial: string | null
  statusId: string
  assignment: AssetAssignment | null
  branchId: string
  deptId: string | null
  /** ISO timestamp string. */
  updatedAt: string
  currentSpecs?: AssetSpecs | null
}

/** Reference rows resolved alongside assets so the table can render names. */
export interface RefRow { id: string; name: string }
export interface CategoryRow extends RefRow { group: 'devices' | 'network' | 'furniture'; lucideIcon: string }
export interface StatusRow extends RefRow { color: string }

export interface EmployeeRow {
  id: string
  firstName: string | null
  lastName: string | null
}

export type AssetGroupFilter = 'all' | 'devices' | 'network' | 'furniture'
export type AssetSort = 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' | 'inv_asc'

export interface AssetListQuery {
  group?: AssetGroupFilter
  statusId?: string | 'all'
  branchId?: string | 'all'
  search?: string
  sort?: AssetSort
}

export function parseInventoryCode(code: string): { prefix: string; number: string } | null {
  const m = /^([^/]+)\/(.+)$/.exec(code)
  if (!m) return null
  return { prefix: m[1]!, number: m[2]! }
}
```

- [ ] **Step 4: Write `src/domain/asset/AssetRepository.ts`**

```ts
import type {
  Asset, AssetListQuery, CategoryRow, StatusRow, RefRow, EmployeeRow,
} from './types'

/** Reference data needed to render the assets table without N+1 reads. */
export interface AssetReferenceData {
  statuses: StatusRow[]
  branches: RefRow[]
  departments: RefRow[]
  categories: CategoryRow[]
  employees: EmployeeRow[]
}

/**
 * Read-side port for the Assets list. Mutations (create/edit/withAudit) arrive
 * in a later plan. Implementations: firestoreAssetRepository (production),
 * inMemoryAssetRepository (tests/dev).
 */
export interface AssetRepository {
  /** Returns ALL assets matching the query, sorted. Pagination is applied in the UI
   *  layer over the returned set (the dataset is org-scale: hundreds, not millions). */
  listAssets(query: AssetListQuery): Promise<Asset[]>
  /** Loads the reference rows needed to resolve names/colors/icons for the table. */
  loadReferenceData(): Promise<AssetReferenceData>
}
```

- [ ] **Step 5: Write barrels**

`src/domain/asset/index.ts`:
```ts
export * from './types'
export * from './AssetRepository'
```
Append to `src/domain/index.ts`:
```ts
export * from './asset'
```

- [ ] **Step 6: Run to verify pass + typecheck**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/domain/asset/asset-types.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/DELL/Desktop/assets-crm
git add src/domain
git commit -m "feat(domain): Asset entity, status enum, and AssetRepository port"
```

> GATE: test-engineer validates B1 before B2.

---

### Task B2 (firebase-engineer): in-memory + Firestore read adapters

**Files:**
- Create: `C:/Users/DELL/Desktop/assets-crm/src/infra/repositories/inMemoryAssetRepository.ts`
- Create: `C:/Users/DELL/Desktop/assets-crm/src/infra/repositories/firestoreAssetRepository.ts`
- Create: `C:/Users/DELL/Desktop/assets-crm/src/infra/repositories/index.ts`
- Modify: `C:/Users/DELL/Desktop/assets-crm/src/infra/index.ts`
- Modify: `C:/Users/DELL/Desktop/assets-crm/firestore.indexes.json`
- Test: `C:/Users/DELL/Desktop/assets-crm/src/infra/repositories/inMemoryAssetRepository.test.ts`

- [ ] **Step 1: Write failing tests for the in-memory adapter query semantics**

`src/infra/repositories/inMemoryAssetRepository.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { InMemoryAssetRepository } from './inMemoryAssetRepository'
import type { Asset, CategoryRow, StatusRow, RefRow } from '@/domain/asset'

const cats: CategoryRow[] = [
  { id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' },
  { id: 'cat_server', name: 'Сервер', group: 'network', lucideIcon: 'server' },
  { id: 'cat_desk', name: 'Стол', group: 'furniture', lucideIcon: 'table-2' },
]
const statuses: StatusRow[] = [
  { id: 'st_warehouse', name: 'На складе', color: 'gray' },
  { id: 'st_assigned', name: 'Выдано', color: 'green' },
]
const branches: RefRow[] = [{ id: 'br_main', name: 'Головной офис' }, { id: 'br_g', name: 'Гюмри' }]
const a = (id: string, p: Partial<Asset>): Asset => ({
  id, categoryId: 'cat_laptop', brand: 'Dell', model: 'X', invCode: 'LAP/1', serial: 's',
  statusId: 'st_assigned', assignment: null, branchId: 'br_main', deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z', ...p,
})
const assets: Asset[] = [
  a('a1', { invCode: 'LAP/00002', updatedAt: '2026-01-02T00:00:00.000Z', categoryId: 'cat_laptop', branchId: 'br_main', statusId: 'st_assigned', brand: 'Dell' }),
  a('a2', { invCode: 'SRV/00001', updatedAt: '2026-01-03T00:00:00.000Z', categoryId: 'cat_server', branchId: 'br_g', statusId: 'st_warehouse', brand: 'HPE' }),
  a('a3', { invCode: 'FRN/00001', updatedAt: '2026-01-01T00:00:00.000Z', categoryId: 'cat_desk', branchId: 'br_main', statusId: 'st_assigned', brand: null, model: null }),
]

function repo() {
  return new InMemoryAssetRepository(assets, { statuses, branches, departments: [], categories: cats, employees: [] })
}

describe('InMemoryAssetRepository.listAssets', () => {
  it('returns all with default sort updated_desc', async () => {
    const r = await repo().listAssets({})
    expect(r.map(x => x.id)).toEqual(['a2', 'a1', 'a3'])
  })
  it('filters by group via category lookup', async () => {
    const r = await repo().listAssets({ group: 'network' })
    expect(r.map(x => x.id)).toEqual(['a2'])
  })
  it('filters by status and branch', async () => {
    const r = await repo().listAssets({ statusId: 'st_assigned', branchId: 'br_main' })
    expect(r.map(x => x.id).sort()).toEqual(['a1', 'a3'])
  })
  it('searches invCode and brand/model case-insensitively', async () => {
    expect((await repo().listAssets({ search: 'srv' })).map(x => x.id)).toEqual(['a2'])
    expect((await repo().listAssets({ search: 'dell' })).map(x => x.id)).toEqual(['a1'])
  })
  it('sorts by inv_asc', async () => {
    const r = await repo().listAssets({ sort: 'inv_asc' })
    expect(r.map(x => x.invCode)).toEqual(['FRN/00001', 'LAP/00002', 'SRV/00001'])
  })
})

describe('InMemoryAssetRepository.loadReferenceData', () => {
  it('returns the seeded reference rows', async () => {
    const ref = await repo().loadReferenceData()
    expect(ref.categories.length).toBe(3)
    expect(ref.statuses.map(s => s.id)).toContain('st_warehouse')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/infra/repositories/inMemoryAssetRepository.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/infra/repositories/inMemoryAssetRepository.ts`**

```ts
import type {
  Asset, AssetListQuery, AssetSort, AssetGroupFilter,
} from '@/domain/asset'
import type { AssetRepository, AssetReferenceData } from '@/domain/asset'

const SORTERS: Record<AssetSort, (a: Asset, b: Asset) => number> = {
  updated_desc: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  updated_asc: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
  name_asc: (a, b) => nameOf(a).localeCompare(nameOf(b), 'ru'),
  name_desc: (a, b) => nameOf(b).localeCompare(nameOf(a), 'ru'),
  inv_asc: (a, b) => a.invCode.localeCompare(b.invCode),
}
function nameOf(a: Asset): string {
  return [a.brand, a.model].filter(Boolean).join(' ') || a.invCode
}

/** In-memory read adapter for tests/dev. Same query semantics as the Firestore adapter. */
export class InMemoryAssetRepository implements AssetRepository {
  constructor(
    private readonly assets: Asset[],
    private readonly ref: AssetReferenceData,
  ) {}

  async listAssets(query: AssetListQuery): Promise<Asset[]> {
    const group: AssetGroupFilter = query.group ?? 'all'
    const catGroup = new Map(this.ref.categories.map(c => [c.id, c.group]))
    const search = (query.search ?? '').trim().toLowerCase()
    const result = this.assets.filter(a => {
      if (group !== 'all' && catGroup.get(a.categoryId) !== group) return false
      if (query.statusId && query.statusId !== 'all' && a.statusId !== query.statusId) return false
      if (query.branchId && query.branchId !== 'all' && a.branchId !== query.branchId) return false
      if (search) {
        const hay = [a.invCode, a.brand, a.model, a.serial].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
    return result.sort(SORTERS[query.sort ?? 'updated_desc'])
  }

  async loadReferenceData(): Promise<AssetReferenceData> {
    return this.ref
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/infra/repositories/inMemoryAssetRepository.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `src/infra/repositories/firestoreAssetRepository.ts` (production read path)**

```ts
import {
  collection, getDocs, query as fsQuery, where, orderBy,
  type Firestore, type QueryConstraint,
} from 'firebase/firestore'
import type {
  Asset, AssetListQuery, AssetSort, CategoryRow, StatusRow, RefRow, EmployeeRow,
} from '@/domain/asset'
import type { AssetRepository, AssetReferenceData } from '@/domain/asset'

const SERVER_SORT: Record<AssetSort, [string, 'asc' | 'desc']> = {
  updated_desc: ['updatedAt', 'desc'],
  updated_asc: ['updatedAt', 'asc'],
  name_asc: ['brand', 'asc'],
  name_desc: ['brand', 'desc'],
  inv_asc: ['invCode', 'asc'],
}

function toAsset(id: string, d: Record<string, unknown>): Asset {
  return {
    id,
    categoryId: String(d.categoryId ?? ''),
    brand: (d.brand as string | null) ?? null,
    model: (d.model as string | null) ?? null,
    invCode: String(d.invCode ?? ''),
    serial: (d.serial as string | null) ?? null,
    statusId: String(d.statusId ?? ''),
    assignment: (d.assignment as Asset['assignment']) ?? null,
    branchId: String(d.branchId ?? ''),
    deptId: (d.deptId as string | null) ?? null,
    updatedAt: toIso(d.updatedAt),
    currentSpecs: (d.currentSpecs as Asset['currentSpecs']) ?? null,
  }
}
function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  // Firestore Timestamp duck-typing without importing the class.
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

/**
 * Production read adapter. Status + branch equality filters and the sort field
 * run server-side (require composite indexes — see firestore.indexes.json).
 * Group (needs category lookup) and free-text search run client-side over the
 * returned set, matching the org-scale dataset (hundreds of assets).
 */
export class FirestoreAssetRepository implements AssetRepository {
  constructor(private readonly db: Firestore) {}

  async listAssets(query: AssetListQuery): Promise<Asset[]> {
    const cons: QueryConstraint[] = []
    if (query.statusId && query.statusId !== 'all') cons.push(where('statusId', '==', query.statusId))
    if (query.branchId && query.branchId !== 'all') cons.push(where('branchId', '==', query.branchId))
    const [field, dir] = SERVER_SORT[query.sort ?? 'updated_desc']
    cons.push(orderBy(field, dir))
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), ...cons))
    let rows = snap.docs.map(doc => toAsset(doc.id, doc.data() as Record<string, unknown>))

    // Client-side refinements (group via category lookup + free-text search).
    if (query.group && query.group !== 'all') {
      const ref = await this.loadReferenceData()
      const catGroup = new Map(ref.categories.map(c => [c.id, c.group]))
      rows = rows.filter(a => catGroup.get(a.categoryId) === query.group)
    }
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(a =>
        [a.invCode, a.brand, a.model, a.serial].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
    }
    return rows
  }

  async loadReferenceData(): Promise<AssetReferenceData> {
    const [statuses, branches, departments, categories, employees] = await Promise.all([
      this.readCol<StatusRow>('asset_statuses', d => ({ id: '', name: String(d.name ?? ''), color: String(d.color ?? 'gray') })),
      this.readCol<RefRow>('branches', d => ({ id: '', name: String(d.name ?? '') })),
      this.readCol<RefRow>('departments', d => ({ id: '', name: String(d.name ?? '') })),
      this.readCol<CategoryRow>('categories', d => ({
        id: '', name: String(d.name ?? ''),
        group: (d.group as CategoryRow['group']) ?? 'devices',
        lucideIcon: String(d.lucideIcon ?? 'package'),
      })),
      this.readCol<EmployeeRow>('employees', d => ({
        id: '', firstName: (d.firstName as string | null) ?? null, lastName: (d.lastName as string | null) ?? null,
      })),
    ])
    return { statuses, branches, departments, categories, employees }
  }

  private async readCol<T extends { id: string }>(
    name: string, map: (d: Record<string, unknown>) => T,
  ): Promise<T[]> {
    const snap = await getDocs(collection(this.db, name))
    return snap.docs.map(doc => ({ ...map(doc.data() as Record<string, unknown>), id: doc.id }))
  }
}
```

- [ ] **Step 6: Write barrels + composite indexes**

`src/infra/repositories/index.ts`:
```ts
export * from './inMemoryAssetRepository'
export * from './firestoreAssetRepository'
```
Append to `src/infra/index.ts`:
```ts
export * from './repositories'
```
Replace `firestore.indexes.json` contents (covers status+sort, branch+sort, and status+branch+sort combinations the list issues):
```json
{
  "indexes": [
    { "collectionGroup": "assets", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "statusId", "order": "ASCENDING" },
      { "fieldPath": "updatedAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "assets", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "branchId", "order": "ASCENDING" },
      { "fieldPath": "updatedAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "assets", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "statusId", "order": "ASCENDING" },
      { "fieldPath": "branchId", "order": "ASCENDING" },
      { "fieldPath": "updatedAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "assets", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "statusId", "order": "ASCENDING" },
      { "fieldPath": "invCode", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "assets", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "branchId", "order": "ASCENDING" },
      { "fieldPath": "invCode", "order": "ASCENDING" }
    ]},
    { "collectionGroup": "assets", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "statusId", "order": "ASCENDING" },
      { "fieldPath": "branchId", "order": "ASCENDING" },
      { "fieldPath": "invCode", "order": "ASCENDING" }
    ]}
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 7: Run tests + typecheck**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/infra/repositories && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 8: Add an emulator-backed integration test for the Firestore adapter**

`tests/rules/` already has emulator infra. Create `C:/Users/DELL/Desktop/assets-crm/tests/integration/firestoreAssetRepository.test.ts` that, under the emulator, seeds a handful of asset + reference docs (using `withSecurityRulesDisabled`) and asserts `listAssets`/`loadReferenceData` return them with correct filter/sort behavior. Gate it the same way as rules tests (excluded from default `vitest run`; runs under `test:rules` or a new `test:emulator` script). If vitest config can't easily include it, the firebase-engineer adds a `test:emulator` npm script mirroring `test:rules` and documents the run command. (Decision recorded for owner: emulator integration coverage of the read adapter.)

- [ ] **Step 9: Commit**

```bash
cd C:/Users/DELL/Desktop/assets-crm
git add src/infra firestore.indexes.json tests/integration package.json
git commit -m "feat(infra): Firestore + in-memory AssetRepository read adapters + indexes"
```

> GATE: test-engineer validates B2 before B3.

---

### Task B3 (react-ui-engineer): useAssets hook + Assets list page + route wiring + i18n

**Files:**
- Create: `C:/Users/DELL/Desktop/assets-crm/src/hooks/useAssets.ts`
- Modify: `C:/Users/DELL/Desktop/assets-crm/src/hooks/index.ts`
- Create: `C:/Users/DELL/Desktop/assets-crm/src/components/features/assets/AssetsTable.tsx`
- Create: `C:/Users/DELL/Desktop/assets-crm/src/components/features/assets/AssetsFilterBar.tsx`
- Create: `C:/Users/DELL/Desktop/assets-crm/src/components/features/assets/assetFormat.ts` (relativeTime, assignee label, asset title helpers — pure, unit-tested)
- Create: `C:/Users/DELL/Desktop/assets-crm/src/components/features/assets/index.ts`
- Create: `C:/Users/DELL/Desktop/assets-crm/src/pages/AssetsPage.tsx`
- Modify: `C:/Users/DELL/Desktop/assets-crm/src/pages/index.ts`
- Modify: `C:/Users/DELL/Desktop/assets-crm/src/config/routes.tsx` (remove 'assets' from stub map, add dedicated route)
- Modify: `C:/Users/DELL/Desktop/assets-crm/src/config/nav.ts` (remove 'assets' from PHASE_STUB_ROUTES)
- Create locale namespace `assets.json` in ru/en/hy + register in i18n
- Test: `assetFormat.test.ts`, `AssetsPage.test.tsx`

**Repository injection seam:** `AssetsPage` accepts an optional `repository?: AssetRepository` prop (defaults to a `FirestoreAssetRepository(db())` built lazily). Tests pass an `InMemoryAssetRepository`. This mirrors the `AuthProvider initialRole` test seam already used in the codebase.

- [ ] **Step 1: Write failing tests for pure format helpers**

`src/components/features/assets/assetFormat.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { assetTitle, relativeTime } from './assetFormat'
import type { Asset } from '@/domain/asset'

const base: Asset = {
  id: 'a', categoryId: 'cat_laptop', brand: 'Dell', model: 'Latitude', invCode: 'LAP/1',
  serial: 's', statusId: 'st_assigned', assignment: null, branchId: 'br', deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('assetTitle', () => {
  it('joins brand + model', () => { expect(assetTitle(base)).toBe('Dell Latitude') })
  it('falls back to invCode for furniture (no brand/model)', () => {
    expect(assetTitle({ ...base, brand: null, model: null })).toBe('LAP/1')
  })
})

describe('relativeTime', () => {
  it('returns a localized relative string for a recent date', () => {
    const now = new Date('2026-01-01T01:00:00.000Z')
    expect(relativeTime('2026-01-01T00:00:00.000Z', now)).toMatch(/ч|hour|час/i)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/components/features/assets/assetFormat.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `assetFormat.ts`**

```ts
import type { Asset } from '@/domain/asset'

export function assetTitle(a: Asset): string {
  return [a.brand, a.model].filter(Boolean).join(' ') || a.invCode
}

/** Coarse relative time. `lang` selects the unit words; defaults to ru. */
export function relativeTime(iso: string, now: Date = new Date(), lang: 'ru' | 'en' | 'hy' = 'ru'): string {
  const then = new Date(iso).getTime()
  const diffMs = Math.max(0, now.getTime() - then)
  const min = Math.floor(diffMs / 60000)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  const W = {
    ru: { now: 'только что', m: 'мин назад', h: 'ч назад', d: 'дн назад' },
    en: { now: 'just now', m: 'min ago', h: 'hour ago', d: 'days ago' },
    hy: { now: 'հենց հիմա', m: 'րոպե առաջ', h: 'ժ առաջ', d: 'օր առաջ' },
  }[lang]
  if (min < 1) return W.now
  if (hr < 1) return `${min} ${W.m}`
  if (day < 1) return `${hr} ${W.h}`
  return `${day} ${W.d}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/components/features/assets/assetFormat.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `useAssets` hook**

`src/hooks/useAssets.ts`:
```ts
import { useEffect, useState } from 'react'
import type { Asset, AssetListQuery, AssetReferenceData, AssetRepository } from '@/domain/asset'

export interface UseAssetsResult {
  assets: Asset[]
  ref: AssetReferenceData | null
  loading: boolean
  error: Error | null
  reload: () => void
}

export function useAssets(repository: AssetRepository, query: AssetListQuery): UseAssetsResult {
  const [assets, setAssets] = useState<Asset[]>([])
  const [ref, setRef] = useState<AssetReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  // Serialize query so the effect only re-runs on real changes.
  const key = JSON.stringify(query)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([repository.listAssets(query), ref ? Promise.resolve(ref) : repository.loadReferenceData()])
      .then(([list, refData]) => {
        if (!active) return
        setAssets(list)
        setRef(refData)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, key, nonce])

  return { assets, ref, loading, error, reload: () => setNonce(n => n + 1) }
}
```
Append to `src/hooks/index.ts`: `export * from './useAssets'`

- [ ] **Step 6: Implement the feature components**

`AssetsFilterBar.tsx` — group tabs (all/devices/network/furniture using Chip-style buttons), status `<Select>`, branch `<Select>`, search `<Input>`, and a sort `<Select>` (5 options). Controlled via props `{ query, onChange, ref }`. Reset chip shown when any filter ≠ default. Use only existing primitives + i18n `t('...', { ns: 'assets' })`.

`AssetsTable.tsx` — `<table>` with the dark theme (`thead` `bg-[#22272E]/40`, rows `border-t border-[#2A2F36] hover:bg-[#22272E]/40`). Columns: Актив (category lucide icon in a `w-8 h-8` badge + title + `category·serial` sub-line), Инв. код (mono via Input's font pattern / a `<span className="font-mono">`), Статус (`<Chip color={statusColorMap[status.color]} dot>{status.name}</Chip>`), Назначен (resolve employee/dept/branch/warehouse with a leading icon), Филиал, Обновлено (`relativeTime`). Row click is a no-op stub for now (detail page is a later plan) — wire `onRowClick?` prop. Status color map: `gray→gray, green→green, orange→orange, red→red` (Chip already supports these).

`assetFormat.ts` already created. `index.ts` barrels all three + AssetsPage helpers.

- [ ] **Step 7: Implement `AssetsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/page-header'
import { SectionCard } from '@/components/ui/section-card'
import { Btn } from '@/components/ui/btn'
import { Icon } from '@/components/ui/icon'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/contexts/AuthContext'
import { useAssets } from '@/hooks/useAssets'
import { db } from '@/lib/firebase'
import { FirestoreAssetRepository } from '@/infra/repositories'
import type { AssetListQuery, AssetRepository, AssetSort } from '@/domain/asset'
import { AssetsFilterBar, AssetsTable } from '@/components/features/assets'

const PAGE_SIZE = 15
const MUTATE_ROLES = ['super_admin', 'asset_admin'] as const

export interface AssetsPageProps { repository?: AssetRepository }

export function AssetsPage({ repository }: AssetsPageProps) {
  const { t } = useTranslation(['assets', 'nav', 'common'])
  const { role } = useAuth()
  const repo = useMemo(() => repository ?? new FirestoreAssetRepository(db()), [repository])
  const [query, setQuery] = useState<AssetListQuery>({ group: 'all', statusId: 'all', branchId: 'all', search: '', sort: 'updated_desc' })
  const [page, setPage] = useState(1)
  const { assets, ref, loading, error, reload } = useAssets(repo, query)

  const canMutate = (MUTATE_ROLES as readonly string[]).includes(role)
  const pageCount = Math.max(1, Math.ceil(assets.length / PAGE_SIZE))
  const pageRows = assets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function update(patch: Partial<AssetListQuery>) { setQuery(q => ({ ...q, ...patch })); setPage(1) }

  return (
    <div className="anim-content-enter">
      <PageHeader
        icon="package"
        title={t('items.assets', { ns: 'nav' })}
        count={assets.length}
        actions={canMutate ? <Btn variant="primary"><Icon name="plus" size={16} />{t('create', { ns: 'assets' })}</Btn> : undefined}
      />
      <SectionCard noHeader>
        {ref && <AssetsFilterBar query={query} onChange={update} ref={ref} />}
        {loading && <LoadingState rows={8} />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading && !error && assets.length === 0 && (
          <EmptyState icon="package-search" title={t('empty.title', { ns: 'assets' })} description={t('empty.desc', { ns: 'assets' })} />
        )}
        {!loading && !error && assets.length > 0 && ref && (
          <>
            <AssetsTable rows={pageRows} ref={ref} canMutate={canMutate} />
            {/* pagination: prev/next + "X–Y из Z" */}
          </>
        )}
      </SectionCard>
    </div>
  )
}
```
(react-ui-engineer fills the pagination bar + filter bar + table bodies in full; the snippet shows the contract.)

- [ ] **Step 8: Wire route + nav + i18n**

In `src/config/nav.ts`, remove `'assets'` from `PHASE_STUB_ROUTES`.
In `src/config/routes.tsx`, add before the stub `.map`:
```tsx
<Route
  path="/assets"
  element={<RoleGate roles={routeRoles('assets')}><AssetsPage /></RoleGate>}
/>
```
and `import { AssetsPage } from '@/pages'` + export it from `src/pages/index.ts`.
Create `src/locales/{ru,en,hy}/assets.json` with keys: `create`, `search`, `filters.group`, `filters.allGroups`, `groups.devices|network|furniture`, `filters.status`, `filters.allStatuses`, `filters.branch`, `filters.allBranches`, `filters.sort`, `sort.updated_desc|updated_asc|name_asc|name_desc|inv_asc`, `filters.reset`, `cols.asset|code|status|assignee|branch|updated`, `assignee.warehouse|none`, `empty.title|empty.desc`, `pagination.range` ("{{from}}–{{to}} из {{total}}"). Register `assets` in `resources` + `ns` array in `src/lib/i18n/index.ts`.

- [ ] **Step 9: Write `AssetsPage.test.tsx`**

Render `<AuthProvider initialRole="asset_admin"><AssetsPage repository={inMemoryRepo} /></AuthProvider>` wrapped with i18n + MemoryRouter. Assert: rows render, status chip text appears, search filters the table, switching group tab filters, pagination caps at 15, create button visible for asset_admin and HIDDEN for tech_admin and employee, loading→table transition, empty state when repo returns [], error state when repo rejects (use a stub repo whose listAssets rejects). Use the in-memory repo seeded from a small fixture.

- [ ] **Step 10: Run page tests + full suite + typecheck + build**

Run:
```bash
cd C:/Users/DELL/Desktop/assets-crm
npx vitest run src/components/features/assets src/pages/AssetsPage.test.tsx
npm test
npm run typecheck
npm run build
```
Expected: all PASS, build succeeds, no new warnings.

- [ ] **Step 11: Commit**

```bash
cd C:/Users/DELL/Desktop/assets-crm
git add src docs
git commit -m "feat(assets): Assets list page (table, filters, search, pagination, states)"
```

> GATE: test-engineer validates B3. Then spec-reviewer → code-quality-reviewer over the whole feature.

---

## Verification (Phase 6)

From `C:/Users/DELL/Desktop/assets-crm`:
- `npm test` — all unit/component tests green (default suite excludes emulator tests).
- `npm run typecheck` — no errors.
- `npm run build` — succeeds.
- `npm run test:rules` — rules tests green (covers narrowed departments).
- `npm run test:emulator` (new) — Firestore adapter integration test green against the emulator with seeded mock data. Document the seed command.

## Data / verification approach (stated decision)

Production path is `FirestoreAssetRepository` reading `assets` + reference collections via Firebase v9 modular SDK with composite indexes. Verifiability NOW (no live Firebase project): (1) page + hook + query semantics covered by unit/component tests using `InMemoryAssetRepository` seeded from a typed fixture; (2) the production Firestore adapter covered by an emulator integration test seeding the prototype's mock-data shape. Both share the `AssetRepository` port, so the page is identical regardless of adapter.

## Rollback

Each task is its own commit. Revert B3 to restore the StubPage (re-add `'assets'` to `PHASE_STUB_ROUTES`); revert B2/B1 independently. The rules change (A1) is a single revertable commit; `deploy:rules` is a separate manual step not performed by this plan.
