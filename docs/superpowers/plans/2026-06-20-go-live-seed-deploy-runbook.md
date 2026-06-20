# AMS Go-Live: Seed + Bootstrap + Deploy + Runbook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AMS runnable live with one idempotent Admin-SDK seeder, a one-time first-super-admin bootstrap script, complete deploy config, and a single authoritative operator runbook — without regressing the 806 app / 53 function test baseline.

**Architecture:** Pure builder (`buildSeedDocs`, zero Firebase imports, unit-tested) + thin Admin-SDK runner (`seed.ts`) that writes create-if-absent. A separate Admin-SDK `grant-super-admin.ts` mints the first super_admin (the Admin SDK bypasses rules, solving the bootstrap chicken-and-egg). DevOps adds npm scripts, `.firebaserc`/`.env.example` completeness, and the runbook.

**Tech Stack:** TypeScript, firebase-admin, tsx (dev-dep runner), Vitest (builder tests), Firebase CLI.

---

## File Structure

- Create `scripts/seed/referenceData.ts` — pure reference data + prefix generator.
- Create `scripts/seed/buildSeed.ts` — pure `buildSeedDocs(opts) → SeedDoc[]`.
- Create `scripts/seed/buildSeed.test.ts` — Vitest unit tests for the builder.
- Create `scripts/seed/adminApp.ts` — Admin SDK init + credential/project resolution.
- Create `scripts/seed.ts` — CLI runner (create-if-absent / --force / --dry-run / --demo / --all-categories / --domains).
- Create `scripts/grant-super-admin.ts` — one-time bootstrap CLI.
- Modify `package.json` — add `tsx` dev-dep + npm scripts.
- Modify `.firebaserc` — keep placeholder, document setting it.
- Modify `.env.example` — add seeder/admin env vars + comments.
- Create `docs/RUNBOOK-go-live.md` — the operator runbook.

---

## DATA-MIGRATION TASKS (dispatch: data-migration-engineer)

### Task 1: SeedDoc type + reference data (statuses, branches, departments)

**Files:**
- Create: `scripts/seed/referenceData.ts`
- Test: `scripts/seed/buildSeed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/seed/buildSeed.test.ts
import { describe, it, expect } from 'vitest'
import { STATUS_SEED, BRANCH_SEED, DEPARTMENT_SEED } from './referenceData'

describe('reference data', () => {
  it('has the 4 canonical system statuses with correct ids/flags', () => {
    expect(STATUS_SEED.map(s => s.id)).toEqual(
      ['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'])
    expect(STATUS_SEED.every(s => s.isSystem)).toBe(true)
    const disposed = STATUS_SEED.find(s => s.id === 'st_disposed')!
    expect(disposed.isFinal).toBe(true)
    expect(STATUS_SEED.filter(s => s.isFinal)).toHaveLength(1)
    expect(STATUS_SEED.map(s => s.sortOrder)).toEqual([0, 1, 2, 3])
  })
  it('has 5 branches with br_main as the warehouse type', () => {
    expect(BRANCH_SEED).toHaveLength(5)
    expect(BRANCH_SEED.find(b => b.id === 'br_main')!.type).toBe('warehouse')
    expect(BRANCH_SEED.filter(b => b.id !== 'br_main').every(b => b.type === 'branch')).toBe(true)
  })
  it('has 6 departments', () => {
    expect(DEPARTMENT_SEED.map(d => d.id)).toEqual(
      ['dep_it', 'dep_hr', 'dep_sales', 'dep_finance', 'dep_legal', 'dep_ops'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/seed/buildSeed.test.ts`
Expected: FAIL — cannot find module `./referenceData`.

- [ ] **Step 3: Write `referenceData.ts` (statuses, branches, departments)**

```ts
// scripts/seed/referenceData.ts
// Pure reference data for the AMS seeder. NO Firebase imports.
// Shapes mirror the production domain types (timestamps added by the writer).

export interface StatusSeed {
  id: string; name: string; color: string; isFinal: boolean; isSystem: boolean; sortOrder: number
}
export interface BranchSeed {
  id: string; name: string; type: 'branch' | 'warehouse'; city: string | null; address: string | null
}
export interface DepartmentSeed { id: string; name: string }
export interface CategorySeed {
  id: string; name: string; group: 'devices' | 'network' | 'furniture'; prefix: string;
  hasSpecs: boolean; lucideIcon: string
}

export const STATUS_SEED: StatusSeed[] = [
  { id: 'st_warehouse', name: 'На складе', color: 'gray',   isFinal: false, isSystem: true, sortOrder: 0 },
  { id: 'st_assigned',  name: 'Выдано',    color: 'green',  isFinal: false, isSystem: true, sortOrder: 1 },
  { id: 'st_repair',    name: 'В ремонте', color: 'orange', isFinal: false, isSystem: true, sortOrder: 2 },
  { id: 'st_disposed',  name: 'Списано',   color: 'red',    isFinal: true,  isSystem: true, sortOrder: 3 },
]

export const BRANCH_SEED: BranchSeed[] = [
  { id: 'br_main',      name: 'Головной офис',   type: 'warehouse', city: null, address: null },
  { id: 'br_yerevan_2', name: 'Филиал Ереван-2', type: 'branch',    city: null, address: null },
  { id: 'br_yerevan_3', name: 'Филиал Ереван-3', type: 'branch',    city: null, address: null },
  { id: 'br_gyumri',    name: 'Филиал Гюмри',    type: 'branch',    city: null, address: null },
  { id: 'br_vanadzor',  name: 'Филиал Ванадзор', type: 'branch',    city: null, address: null },
]

export const DEPARTMENT_SEED: DepartmentSeed[] = [
  { id: 'dep_it',      name: 'ИТ'       },
  { id: 'dep_hr',      name: 'HR'       },
  { id: 'dep_sales',   name: 'Продажи'  },
  { id: 'dep_finance', name: 'Финансы'  },
  { id: 'dep_legal',   name: 'Юристы'   },
  { id: 'dep_ops',     name: 'Операции' },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/seed/buildSeed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/seed/referenceData.ts scripts/seed/buildSeed.test.ts
git commit -m "feat(seed): reference data for statuses, branches, departments"
```

---

### Task 2: Core category set + collision-checked full-prefix generator

**Files:**
- Modify: `scripts/seed/referenceData.ts`
- Test: `scripts/seed/buildSeed.test.ts`

- [ ] **Step 1: Add failing tests for categories**

```ts
// append to scripts/seed/buildSeed.test.ts
import { CORE_CATEGORY_SEED, ALL_CATEGORY_SOURCE, buildAllCategorySeed } from './referenceData'

describe('categories', () => {
  it('core set has unique ids and unique prefixes across all groups', () => {
    const ids = CORE_CATEGORY_SEED.map(c => c.id)
    const prefixes = CORE_CATEGORY_SEED.map(c => c.prefix)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(prefixes).size).toBe(prefixes.length)
    expect(CORE_CATEGORY_SEED.some(c => c.group === 'devices')).toBe(true)
    expect(CORE_CATEGORY_SEED.some(c => c.group === 'network')).toBe(true)
    expect(CORE_CATEGORY_SEED.some(c => c.group === 'furniture')).toBe(true)
  })
  it('core set includes the prefixes the mock inventory codes use', () => {
    const prefixes = new Set(CORE_CATEGORY_SEED.map(c => c.prefix))
    for (const p of ['LAP', 'MON', 'DSK', 'PHN', 'SRV']) expect(prefixes.has(p)).toBe(true)
  })
  it('buildAllCategorySeed produces unique prefixes for every source category', () => {
    const all = buildAllCategorySeed()
    expect(all.length).toBe(ALL_CATEGORY_SOURCE.length)
    const prefixes = all.map(c => c.prefix)
    expect(new Set(prefixes).size).toBe(prefixes.length)
    expect(all.every(c => /^[A-Z0-9]{2,6}$/.test(c.prefix))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/seed/buildSeed.test.ts`
Expected: FAIL — `CORE_CATEGORY_SEED` / `ALL_CATEGORY_SOURCE` / `buildAllCategorySeed` not exported.

- [ ] **Step 3: Add the core set + source + generator to `referenceData.ts`**

```ts
// append to scripts/seed/referenceData.ts

// --- Curated core category set (default). Explicit, hand-assigned unique prefixes.
// Prefixes here MUST match the inventory-code prefixes used elsewhere (LAP/MON/DSK/PHN/SRV).
export const CORE_CATEGORY_SEED: CategorySeed[] = [
  // devices
  { id: 'cat_laptop',   name: 'Ноутбук',   group: 'devices',   prefix: 'LAP', hasSpecs: true,  lucideIcon: 'laptop'     },
  { id: 'cat_computer', name: 'Компьютер', group: 'devices',   prefix: 'DSK', hasSpecs: true,  lucideIcon: 'monitor'    },
  { id: 'cat_monitor',  name: 'Монитор',   group: 'devices',   prefix: 'MON', hasSpecs: false, lucideIcon: 'monitor'    },
  { id: 'cat_phone',    name: 'Смартфон',  group: 'devices',   prefix: 'PHN', hasSpecs: false, lucideIcon: 'smartphone' },
  { id: 'cat_tablet',   name: 'Планшет',   group: 'devices',   prefix: 'TAB', hasSpecs: false, lucideIcon: 'tablet'     },
  { id: 'cat_printer',  name: 'Принтер',   group: 'devices',   prefix: 'PRN', hasSpecs: false, lucideIcon: 'printer'    },
  { id: 'cat_keyboard', name: 'Клавиатура',group: 'devices',   prefix: 'KBD', hasSpecs: false, lucideIcon: 'keyboard'   },
  { id: 'cat_mouse',    name: 'Мышь',      group: 'devices',   prefix: 'MSE', hasSpecs: false, lucideIcon: 'mouse'      },
  { id: 'cat_headset',  name: 'Гарнитура', group: 'devices',   prefix: 'HST', hasSpecs: false, lucideIcon: 'headphones' },
  { id: 'cat_dock',     name: 'Док-станция',group: 'devices',  prefix: 'DCK', hasSpecs: false, lucideIcon: 'plug'       },
  { id: 'cat_webcam',   name: 'Веб-камера',group: 'devices',   prefix: 'WBC', hasSpecs: false, lucideIcon: 'camera'     },
  { id: 'cat_projector',name: 'Проектор',  group: 'devices',   prefix: 'PRJ', hasSpecs: false, lucideIcon: 'projector'  },
  // network
  { id: 'cat_server',   name: 'Сервер',         group: 'network', prefix: 'SRV', hasSpecs: true,  lucideIcon: 'server'  },
  { id: 'cat_router',   name: 'Маршрутизатор',  group: 'network', prefix: 'RTR', hasSpecs: false, lucideIcon: 'router'  },
  { id: 'cat_switch',   name: 'Коммутатор',     group: 'network', prefix: 'SWT', hasSpecs: false, lucideIcon: 'network' },
  { id: 'cat_firewall', name: 'Файрвол',        group: 'network', prefix: 'FWL', hasSpecs: false, lucideIcon: 'shield'  },
  { id: 'cat_ap',       name: 'Точка доступа',  group: 'network', prefix: 'WAP', hasSpecs: false, lucideIcon: 'wifi'    },
  { id: 'cat_nas',      name: 'NAS',            group: 'network', prefix: 'NAS', hasSpecs: false, lucideIcon: 'hard-drive' },
  { id: 'cat_ups',      name: 'ИБП',            group: 'network', prefix: 'UPS', hasSpecs: false, lucideIcon: 'battery-charging' },
  // furniture
  { id: 'cat_desk',     name: 'Стол офисный',     group: 'furniture', prefix: 'DSKF', hasSpecs: false, lucideIcon: 'table-2'  },
  { id: 'cat_chair',    name: 'Стул',             group: 'furniture', prefix: 'CHR',  hasSpecs: false, lucideIcon: 'armchair' },
  { id: 'cat_cabinet',  name: 'Шкаф',             group: 'furniture', prefix: 'CAB',  hasSpecs: false, lucideIcon: 'archive'  },
  { id: 'cat_sofa',     name: 'Диван',            group: 'furniture', prefix: 'SOF',  hasSpecs: false, lucideIcon: 'sofa'     },
  { id: 'cat_meet_tbl', name: 'Стол переговоров', group: 'furniture', prefix: 'MTG',  hasSpecs: false, lucideIcon: 'square'   },
  { id: 'cat_safe',     name: 'Сейф',             group: 'furniture', prefix: 'SAF',  hasSpecs: false, lucideIcon: 'shield'   },
]

// --- Full source taxonomy (id/name/group/hasSpecs/lucideIcon only — NO prefix).
// Transcribe from Warehouse/prototypes/_shared/mock-data.js CATEGORIES (131).
// hasSpecs = true only for laptop/desktop/server families (per mock _d/_n hasSpecs arg).
export const ALL_CATEGORY_SOURCE: Omit<CategorySeed, 'prefix'>[] = [
  // NOTE to implementer: copy EVERY entry from mock-data.js CATEGORIES, mapping
  // _d/_n/_f → group, and the 4th positional arg of _d/_n (hasSpecs) → hasSpecs.
  // _f entries are furniture with hasSpecs:false. Keep ids EXACTLY as in mock.
  { id: 'cat_computer', name: 'Компьютер', group: 'devices', hasSpecs: true, lucideIcon: 'monitor' },
  // ... (full list filled in by implementer from mock-data.js) ...
]

// --- Deterministic, collision-checked prefix generator for the full set.
// Strategy: derive a 3-letter base from the id suffix (uppercased latin), then
// disambiguate with a numeric suffix on collision. THROWS if it cannot produce
// a unique <=6-char [A-Z0-9] prefix — a corrupt catalog must never be written.
export function buildAllCategorySeed(): CategorySeed[] {
  const used = new Set<string>()
  const base = (id: string): string => {
    const stem = id.replace(/^cat_/, '').replace(/[^a-z0-9]/gi, '')
    const up = stem.toUpperCase()
    return (up.slice(0, 3) || 'CAT')
  }
  return ALL_CATEGORY_SOURCE.map((c) => {
    let p = base(c.id)
    let n = 0
    while (used.has(p)) {
      n += 1
      p = (base(c.id).slice(0, 4) + String(n))
      if (p.length > 6) throw new Error(`Cannot generate unique prefix for ${c.id}`)
    }
    if (!/^[A-Z0-9]{2,6}$/.test(p)) throw new Error(`Invalid generated prefix "${p}" for ${c.id}`)
    used.add(p)
    return { ...c, prefix: p }
  })
}
```

NOTE: The implementer MUST fully populate `ALL_CATEGORY_SOURCE` with all 131
entries from `Warehouse/prototypes/_shared/mock-data.js` (the `CATEGORIES`
array). Read that file (it is the canonical source) and transcribe every
`_d/_n/_f(...)` entry. Do not abbreviate.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/seed/buildSeed.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed/referenceData.ts scripts/seed/buildSeed.test.ts
git commit -m "feat(seed): core category set + collision-checked full-prefix generator"
```

---

### Task 3: Pure `buildSeedDocs` builder

**Files:**
- Create: `scripts/seed/buildSeed.ts`
- Test: `scripts/seed/buildSeed.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
// append to scripts/seed/buildSeed.test.ts
import { buildSeedDocs } from './buildSeed'
import type { AssetStatus } from '../../src/domain/asset_status'
import type { Category } from '../../src/domain/category'

describe('buildSeedDocs', () => {
  it('emits statuses + branches + departments + core categories + settings by default', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const cols = docs.reduce<Record<string, number>>((m, d) => {
      m[d.collection] = (m[d.collection] ?? 0) + 1; return m }, {})
    expect(cols.asset_statuses).toBe(4)
    expect(cols.branches).toBe(5)
    expect(cols.departments).toBe(6)
    expect(cols.categories).toBe(25) // core count
    // settings/auth always emitted
    expect(docs.some(d => d.collection === 'settings' && d.id === 'auth')).toBe(true)
  })
  it('settings/auth carries the provided allowed domains', () => {
    const docs = buildSeedDocs({ nowIso: 'x', allowedEmailDomains: ['acme.example'] })
    const auth = docs.find(d => d.collection === 'settings' && d.id === 'auth')!
    expect((auth.data as { allowedEmailDomains: string[] }).allowedEmailDomains).toEqual(['acme.example'])
  })
  it('settings/auth defaults to [] when no domains provided', () => {
    const docs = buildSeedDocs({ nowIso: 'x' })
    const auth = docs.find(d => d.collection === 'settings' && d.id === 'auth')!
    expect((auth.data as { allowedEmailDomains: string[] }).allowedEmailDomains).toEqual([])
  })
  it('emits settings/defaults with mainBranchId br_main', () => {
    const docs = buildSeedDocs({ nowIso: 'x' })
    const def = docs.find(d => d.collection === 'settings' && d.id === 'defaults')!
    expect((def.data as { mainBranchId: string }).mainBranchId).toBe('br_main')
  })
  it('allCategories option emits the full set', () => {
    const docs = buildSeedDocs({ nowIso: 'x', allCategories: true })
    const n = docs.filter(d => d.collection === 'categories').length
    expect(n).toBeGreaterThan(100)
  })
  it('status docs satisfy the AssetStatus shape (sans server-written fields are present)', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const s = docs.find(d => d.collection === 'asset_statuses' && d.id === 'st_disposed')!
    const status = { id: s.id, ...(s.data as object) } as unknown as AssetStatus
    expect(status.isFinal).toBe(true)
    expect(status.isSystem).toBe(true)
    expect((s.data as { createdBy: string }).createdBy).toBe('system')
  })
  it('demo option adds sample assets + employees', () => {
    const base = buildSeedDocs({ nowIso: 'x' }).length
    const demo = buildSeedDocs({ nowIso: 'x', demo: true })
    expect(demo.some(d => d.collection === 'assets')).toBe(true)
    expect(demo.some(d => d.collection === 'employees')).toBe(true)
    expect(demo.length).toBeGreaterThan(base)
  })
  it('category docs satisfy the Category shape', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const c = docs.find(d => d.collection === 'categories' && d.id === 'cat_laptop')!
    const cat = { id: c.id, ...(c.data as object) } as unknown as Category
    expect(cat.prefix).toBe('LAP')
    expect(cat.group).toBe('devices')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/seed/buildSeed.test.ts`
Expected: FAIL — `./buildSeed` not found.

- [ ] **Step 3: Implement `buildSeed.ts`**

```ts
// scripts/seed/buildSeed.ts
// Pure builder — NO Firebase imports. Emits the full seed doc set.
import {
  STATUS_SEED, BRANCH_SEED, DEPARTMENT_SEED, CORE_CATEGORY_SEED,
  buildAllCategorySeed, type CategorySeed,
} from './referenceData'

export interface SeedDoc { collection: string; id: string; data: Record<string, unknown> }

export interface BuildSeedOptions {
  /** ISO timestamp written into createdAt/updatedAt (the writer converts to Timestamp). */
  nowIso: string
  allowedEmailDomains?: string[]
  allCategories?: boolean
  demo?: boolean
  mainBranchId?: string
}

const SYSTEM = 'system'

export function buildSeedDocs(opts: BuildSeedOptions): SeedDoc[] {
  const now = opts.nowIso
  const stamp = { createdBy: SYSTEM, updatedBy: SYSTEM, createdAt: now, updatedAt: now }
  const docs: SeedDoc[] = []

  for (const s of STATUS_SEED) {
    docs.push({ collection: 'asset_statuses', id: s.id, data: {
      name: s.name, color: s.color, isFinal: s.isFinal, isSystem: s.isSystem,
      sortOrder: s.sortOrder, ...stamp } })
  }
  for (const b of BRANCH_SEED) {
    docs.push({ collection: 'branches', id: b.id, data: {
      name: b.name, type: b.type, city: b.city, address: b.address, ...stamp } })
  }
  for (const d of DEPARTMENT_SEED) {
    docs.push({ collection: 'departments', id: d.id, data: { name: d.name, ...stamp } })
  }
  const cats: CategorySeed[] = opts.allCategories ? buildAllCategorySeed() : CORE_CATEGORY_SEED
  for (const c of cats) {
    docs.push({ collection: 'categories', id: c.id, data: {
      name: c.name, group: c.group, prefix: c.prefix, hasSpecs: c.hasSpecs,
      lucideIcon: c.lucideIcon, ...stamp } })
  }

  docs.push({ collection: 'settings', id: 'auth', data: {
    allowedEmailDomains: opts.allowedEmailDomains ?? [], updatedBy: SYSTEM, updatedAt: now } })
  docs.push({ collection: 'settings', id: 'defaults', data: {
    mainBranchId: opts.mainBranchId ?? 'br_main', defaultLocale: 'ru', updatedBy: SYSTEM, updatedAt: now } })

  if (opts.demo) docs.push(...buildDemoDocs(now))
  return docs
}

function buildDemoDocs(now: string): SeedDoc[] {
  const stamp = { createdBy: SYSTEM, updatedBy: SYSTEM, createdAt: now, updatedAt: now }
  return [
    { collection: 'employees', id: 'demo_emp_1', data: {
      firstName: 'Демо', lastName: 'Сотрудник', email: 'demo.employee@example.com',
      departmentId: 'dep_it', branchId: 'br_main', status: 'active', ...stamp } },
    { collection: 'assets', id: 'demo_asset_1', data: {
      invCode: 'LAP/00001', brand: 'Dell', model: 'Latitude 5440', serial: 'DEMO-SN-001',
      categoryId: 'cat_laptop', statusId: 'st_warehouse', branchId: 'br_main',
      assignment: null, ...stamp } },
  ]
}
```

NOTE: If the core category count changes, update the `cols.categories` assertion
in Step 1 to match `CORE_CATEGORY_SEED.length`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/seed/buildSeed.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the emitted docs load into the InMemory repositories**

Add this test (proves app readers accept the shapes):

```ts
// append to scripts/seed/buildSeed.test.ts
import { InMemoryCategoryRepository } from '../../src/infra/repositories/inMemoryCategoryRepository'
import { InMemoryAssetStatusRepository } from '../../src/infra/repositories/inMemoryAssetStatusRepository'

describe('emitted docs round-trip through InMemory repositories', () => {
  it('categories list cleanly', async () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const cats = docs.filter(d => d.collection === 'categories')
      .map(d => ({ id: d.id, ...(d.data as object) })) as any
    const repo = new InMemoryCategoryRepository(cats)
    expect((await repo.listCategories()).length).toBe(cats.length)
  })
  it('statuses list cleanly and sort by sortOrder', async () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const statuses = docs.filter(d => d.collection === 'asset_statuses')
      .map(d => ({ id: d.id, ...(d.data as object) })) as any
    const repo = new InMemoryAssetStatusRepository(statuses)
    const out = await repo.listAssetStatuses()
    expect(out.map(s => s.id)).toEqual(['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'])
  })
})
```

Run: `npx vitest run scripts/seed/buildSeed.test.ts`
Expected: PASS. (If `InMemoryAssetStatusRepository`'s constructor signature
differs, adapt the test to its real constructor — read the file first.)

- [ ] **Step 6: Commit**

```bash
git add scripts/seed/buildSeed.ts scripts/seed/buildSeed.test.ts
git commit -m "feat(seed): pure buildSeedDocs builder + InMemory round-trip tests"
```

---

### Task 4: Admin SDK init + credential/project resolution

**Files:**
- Create: `scripts/seed/adminApp.ts`

- [ ] **Step 1: Implement `adminApp.ts`** (no unit test — thin Admin wiring; covered manually via emulator)

```ts
// scripts/seed/adminApp.ts
// The ONLY module that imports firebase-admin. Resolves credentials + project.
import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

export interface AdminCtx { db: Firestore; auth: Auth; projectId: string }

/** Resolve the project id from flag → env → .firebaserc default. */
export function resolveProjectId(flagProject?: string): string {
  if (flagProject) return flagProject
  const env = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT
  if (env) return env
  try {
    const rc = JSON.parse(readFileSync(new URL('../../.firebaserc', import.meta.url), 'utf8'))
    const def = rc?.projects?.default
    if (def && def !== 'ams-REPLACE-ME') return def
  } catch { /* ignore */ }
  throw new Error(
    'No project id. Pass --project <id>, set GOOGLE_CLOUD_PROJECT, or set .firebaserc default.')
}

export function initAdmin(flagProject?: string): AdminCtx {
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST
  const projectId = usingEmulator
    ? (flagProject || process.env.GOOGLE_CLOUD_PROJECT || 'demo-ams')
    : resolveProjectId(flagProject)

  if (getApps().length === 0) {
    if (usingEmulator) {
      initializeApp({ projectId })
    } else {
      const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
      const credential = saPath
        ? cert(JSON.parse(readFileSync(saPath, 'utf8')))
        : applicationDefault()
      initializeApp({ credential, projectId })
    }
  }
  return { db: getFirestore(), auth: getAuth(), projectId }
}

export { Timestamp }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json` (or root `npm run typecheck`)
Expected: no errors from `scripts/seed/adminApp.ts`.
(If `scripts/**` is outside the tsconfig include, the devops task adds a
`tsconfig` include or a dedicated check; for now ensure the file is valid TS.)

- [ ] **Step 3: Commit**

```bash
git add scripts/seed/adminApp.ts
git commit -m "feat(seed): admin SDK init + credential/project resolution"
```

---

### Task 5: Seed CLI runner (create-if-absent, --force, --dry-run, flags)

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: Implement `scripts/seed.ts`**

```ts
// scripts/seed.ts
// CLI: idempotent, non-destructive seeder. Admin SDK bypasses rules (bootstrap).
import { initAdmin, Timestamp } from './seed/adminApp'
import { buildSeedDocs, type SeedDoc } from './seed/buildSeed'

interface Flags {
  force: boolean; dryRun: boolean; demo: boolean; allCategories: boolean
  project?: string; domains?: string[]
}
function parseFlags(argv: string[]): Flags {
  const f: Flags = { force: false, dryRun: false, demo: false, allCategories: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') f.force = true
    else if (a === '--dry-run') f.dryRun = true
    else if (a === '--demo') f.demo = true
    else if (a === '--all-categories') f.allCategories = true
    else if (a === '--project') f.project = argv[++i]
    else if (a === '--domains') f.domains = (argv[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean)
  }
  return f
}

/** ISO → Admin Timestamp inside the data payload (createdAt/updatedAt fields). */
function withTimestamps(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data }
  for (const k of ['createdAt', 'updatedAt']) {
    if (typeof out[k] === 'string') out[k] = Timestamp.fromDate(new Date(out[k] as string))
  }
  return out
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  const { db, projectId } = initAdmin(flags.project)
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST

  const domains = flags.domains
    ?? (process.env.SEED_ALLOWED_DOMAINS
      ? process.env.SEED_ALLOWED_DOMAINS.split(',').map(s => s.trim()).filter(Boolean)
      : undefined)

  const docs: SeedDoc[] = buildSeedDocs({
    nowIso: new Date().toISOString(),
    allowedEmailDomains: domains,
    allCategories: flags.allCategories,
    demo: flags.demo,
  })

  console.log(`AMS seeder → project="${projectId}"${usingEmulator ? ' (EMULATOR)' : ''}`)
  console.log(`mode: ${flags.dryRun ? 'DRY-RUN' : flags.force ? 'FORCE (overwrite reference docs)' : 'create-if-absent'}`)
  if (!domains || domains.length === 0) {
    console.warn('\n  WARNING: settings/auth.allowedEmailDomains will be EMPTY.')
    console.warn('  beforeCreate FAILS CLOSED — ALL sign-ups are blocked until a super_admin')
    console.warn('  sets allowed domains (Settings screen) or you re-run with --domains.\n')
  }

  let created = 0, skipped = 0, overwritten = 0
  for (const d of docs) {
    const ref = db.collection(d.collection).doc(d.id)
    const data = withTimestamps(d.data)
    if (flags.dryRun) { console.log(`  would write ${d.collection}/${d.id}`); continue }
    const snap = await ref.get()
    if (snap.exists && !flags.force) { skipped++; continue }
    await ref.set(data, { merge: flags.force }) // merge on force (preserve extra fields), full set on create
    if (snap.exists) overwritten++; else created++
  }

  console.log(`\nDone. created=${created} overwritten=${overwritten} skipped=${skipped} total=${docs.length}`)
  if (flags.dryRun) console.log('(dry-run — nothing written)')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Dry-run against the emulator (manual smoke; documented in runbook)**

This is verified by the devops task once npm scripts + tsx exist:
`npm run seed:emulator -- --dry-run` should list `would write ...` lines.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): idempotent admin-SDK seed CLI runner"
```

---

### Task 6: First-super-admin bootstrap CLI

**Files:**
- Create: `scripts/grant-super-admin.ts`

- [ ] **Step 1: Implement `scripts/grant-super-admin.ts`**

```ts
// scripts/grant-super-admin.ts
// ONE-TIME bootstrap: mint the first super_admin. Admin SDK bypasses rules.
// Usage: tsx scripts/grant-super-admin.ts <uid|email> [--project <id>]
import { initAdmin, Timestamp } from './seed/adminApp'

async function main() {
  const args = process.argv.slice(2)
  let project: string | undefined
  const positionals: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') project = args[++i]
    else positionals.push(args[i]!)
  }
  const target = positionals[0]
  if (!target) {
    console.error('Usage: tsx scripts/grant-super-admin.ts <uid|email> [--project <id>]')
    process.exit(2)
  }

  const { db, auth, projectId } = initAdmin(project)

  // Resolve email → uid if needed.
  let uid = target
  let email = ''
  let displayName = ''
  try {
    const rec = target.includes('@') ? await auth.getUserByEmail(target) : await auth.getUser(target)
    uid = rec.uid; email = rec.email ?? ''; displayName = rec.displayName ?? ''
  } catch {
    console.error(`No Firebase Auth user found for "${target}" in project "${projectId}".`)
    console.error('The person must sign in to the app ONCE first (creates their auth record).')
    process.exit(1)
  }

  console.log(`Project: ${projectId}`)
  console.log(`Granting super_admin to: uid=${uid} email=${email} name="${displayName}"`)

  const ref = db.collection('users').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) {
    // The user self-claims a no-role doc on first sign-in; if absent, create a complete one.
    await ref.set({
      email, displayName, role: 'super_admin', status: 'active',
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    })
    console.log('Created users/%s with role=super_admin (no prior self-claim doc existed).', uid)
  } else {
    await ref.set({ role: 'super_admin', status: 'active', updatedAt: Timestamp.now() }, { merge: true })
    console.log('Updated users/%s → role=super_admin, status=active.', uid)
  }
  console.log('\nDone. Sign out and back in to refresh the in-app role.')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Typecheck the file**

Run: `npx tsc --noEmit` (root) — expect no new errors. (devops task ensures
`scripts/**` is type-checked.)

- [ ] **Step 3: Commit**

```bash
git add scripts/grant-super-admin.ts
git commit -m "feat(seed): one-time first-super-admin bootstrap CLI"
```

---

## DEVOPS TASKS (dispatch: devops-engineer)

### Task 7: Add tsx + npm scripts + scripts typecheck

**Files:**
- Modify: `package.json`
- Create/Modify: `tsconfig.scripts.json` (if `scripts/**` not covered by existing tsconfig)

- [ ] **Step 1: Add `tsx` dev-dependency**

Run: `npm install --save-dev tsx@^4`
Expected: `tsx` appears in `package.json` devDependencies; `package-lock.json` updated.

- [ ] **Step 2: Add npm scripts** to `package.json` `scripts`:

```jsonc
"seed": "tsx scripts/seed.ts",
"seed:emulator": "FIRESTORE_EMULATOR_HOST=localhost:8080 GOOGLE_CLOUD_PROJECT=demo-ams tsx scripts/seed.ts",
"grant:super-admin": "tsx scripts/grant-super-admin.ts",
"deploy:indexes": "npx firebase deploy --only firestore:indexes",
"deploy:all": "npx firebase deploy --only firestore:rules,storage:rules,firestore:indexes,functions",
"typecheck:scripts": "tsc --noEmit -p tsconfig.scripts.json"
```

NOTE: `seed:emulator` uses an inline env var (works in bash/Git Bash). For
cross-platform, the runbook also documents `cross-env`-free PowerShell usage:
`$env:FIRESTORE_EMULATOR_HOST="localhost:8080"; $env:GOOGLE_CLOUD_PROJECT="demo-ams"; npm run seed`.

- [ ] **Step 3: Ensure `scripts/**` type-checks**

Create `tsconfig.scripts.json`:

```jsonc
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": { "noEmit": true, "types": ["node"], "module": "ESNext", "moduleResolution": "Bundler" },
  "include": ["scripts/**/*.ts", "src/domain/**/*.ts", "src/infra/repositories/inMemory*.ts"]
}
```

Run: `npm run typecheck:scripts`
Expected: PASS (no errors). Fix any path/type issues surfaced.

- [ ] **Step 4: Confirm app + functions baselines still green**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean, 806+ app tests pass (builder tests added), build green.
Run: `cd functions && npm test` — 53 pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.scripts.json
git commit -m "build(seed): tsx runner, seed/deploy npm scripts, scripts typecheck"
```

---

### Task 8: Complete `.firebaserc`, `.env.example`, deploy config

**Files:**
- Modify: `.firebaserc`
- Modify: `.env.example`

- [ ] **Step 1: `.firebaserc`** — keep placeholder, add a comment-free valid JSON
  (firebase requires pure JSON). Document setting it in the runbook instead.
  Leave as:

```json
{ "projects": { "default": "ams-REPLACE-ME" } }
```

NOTE: operator sets the real project via `firebase use --add` (documented in
runbook). Do NOT hardcode a real project id.

- [ ] **Step 2: Expand `.env.example`** with the seeder/admin vars (frontend +
  backend), all commented:

```dotenv
# AMS — Firebase environment variables
# Copy to .env.local (gitignored). For prod, set in Vercel dashboard.
# Frontend (Vite — exposed to the client bundle):
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# --- Seeder / Admin scripts (NEVER committed; used only by scripts/*.ts) ---
# Project to target (or pass --project / use .firebaserc default):
# GOOGLE_CLOUD_PROJECT=ams-yourproject
# Path to a service-account JSON for real-project seeding (gitignored pattern):
# GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json
# Emulator target (set to seed the local emulator instead of a real project):
# FIRESTORE_EMULATOR_HOST=localhost:8080
# Allowed OAuth email domains for settings/auth (comma-separated). If empty,
# beforeCreate FAILS CLOSED and blocks ALL sign-ups:
# SEED_ALLOWED_DOMAINS=yourcompany.example
```

- [ ] **Step 3: Verify nothing secret is committed**

Run: `git status --porcelain && grep -RIn "BEGIN PRIVATE KEY\|service-account" --include=*.json . | grep -v node_modules | grep -v .gitignore || true`
Expected: no service-account JSON staged; `.gitignore` already covers
`service-account*.json`, `.secrets/`, `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add .firebaserc .env.example
git commit -m "build(deploy): document project + complete .env.example for seeder/admin"
```

---

### Task 9: Operator runbook

**Files:**
- Create: `docs/RUNBOOK-go-live.md`

- [ ] **Step 1: Write `docs/RUNBOOK-go-live.md`** — fully numbered, operator-only
  steps marked [OPERATOR], Blaze steps marked [BLAZE], the fail-closed gotcha at
  the top. (Full content is delivered in the orchestrator report and committed
  verbatim — see report. Must cover, in order: install firebase-tools/login;
  create project; enable Firestore+Storage+Auth+Functions on Blaze; `firebase
  use --add`; create `.env.local`; enable Google + Email-link providers +
  authorized domains; deploy rules+indexes+functions; run the seeder WITH
  --domains; sign in once; run grant-super-admin; verify; deploy frontend to
  Vercel.)

- [ ] **Step 2: Commit**

```bash
git add docs/RUNBOOK-go-live.md
git commit -m "docs: authoritative go-live operator runbook"
```

---

## Self-Review notes

- Spec coverage: seeder (T1–T5), bootstrap (T6), deploy config (T7–T8),
  runbook (T9). Audit decision documented in builder (system sentinel). Prefix
  fork implemented (core default + --all-categories generator). Fail-closed
  warning implemented in T5 + documented T9. Demo flag T3. All covered.
- Type consistency: `SeedDoc`, `BuildSeedOptions`, `CategorySeed`, `initAdmin`,
  `Timestamp` names are consistent across T3–T6.
- No destructive ops anywhere: seeder only `get` + `set` (never delete);
  grant script only sets role/status.
