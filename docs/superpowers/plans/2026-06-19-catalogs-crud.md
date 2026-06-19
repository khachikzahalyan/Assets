# Super-Admin Catalogs CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Branches, Departments, Categories, and Asset-Statuses management surfaces (domain + InMemory/Firestore repos via withAudit + RoleGate CRUD pages) so assets/employees reference real managed catalogs.

**Architecture:** Mirror the shipped Employee vertical exactly — domain port + InMemory/Firestore adapters, every mutation through `withAudit` (one `audit_logs` entry/txn), repo-factory pages that import no Firebase. Catalogs use a single list page + create/edit modal + delete-with-confirm (lighter than Assets/Employees detail routes). Referential integrity blocks delete when referenced; the 4 system statuses are protected at UI+repo+rules layers; category prefix is locked once assets exist.

**Tech Stack:** React 19 + Vite + TypeScript (strict) + Firebase v9 modular + i18next (ru/en/hy) + Vitest + @testing-library/react. Dark/orange theme, shadcn-style primitives from `@/components/ui`.

**Reference files (read before coding):**
- Domain pattern: `src/domain/employee/{types.ts,EmployeeRepository.ts,index.ts}`
- Adapters: `src/infra/repositories/{inMemoryEmployeeRepository.ts,firestoreEmployeeRepository.ts}`
- Audit chokepoint: `src/lib/audit/withAudit.ts`; types `src/domain/audit/types.ts`
- Page pattern: `src/pages/EmployeesPage.tsx`, `src/pages/EmployeeCreatePage.tsx`
- Feature components: `src/components/features/employees/{EmployeesTable.tsx,EmployeeForm.tsx,EmployeesFilterBar.tsx}`
- Routing/access/nav: `src/config/{routes.tsx,access.ts,nav.ts}`
- Rules: `firestore.rules`
- UI primitives barrel: `src/components/ui/index.ts` (PageHeader, SectionCard, Btn, Icon, Chip, IconBtn, Field, Input, Select, EmptyState, LoadingState, ErrorState)

### VERIFIED PRIMITIVE APIs (do NOT guess — these are read from source)

- `Input`: props `{ value?: string; onChange?: (v: string) => void; placeholder?; type?; mono?; disabled?; autoFocus?; id? }`. **`onChange` receives the STRING value, not an event.** Use `onChange={setName}` — NEVER `onChange={e => setName(e.target.value)}`.
- `Select`: props `{ id?; value?; onChange?: (v: string) => void; options: SelectOption[]; placeholder?; disabled? }` where `SelectOption = { value: string; label: string }`. **Renders options from the `options` prop — NO `<option>` children.** `onChange` receives the string value.
- `Field`: props `{ label?; required?; hint?; children }`. **No `error` prop.** For errors, render an inline `<p className="mt-1 text-[12px] text-[#FDA4AF]">{err}</p>` AFTER the input (the house pattern uses a `<label htmlFor>` + `<Input id>` + error `<p>`; you may use `<Field label>` for simplicity and append the error `<p>` as a sibling, OR follow the EmployeeForm `<label htmlFor>` pattern — either is acceptable).
- `IconBtn`: props `{ icon: string; onClick?; title?; size?; tone?: 'slate'|'rose'|'indigo'; disabled? }`. **No children, no `aria-label`.** Pass `icon="pencil"` / `icon="trash-2"`, `title` for the a11y label, `tone="rose"` for delete. (In tests, query by `title` via `getByTitle`.)
- `Btn`: props `{ children; onClick?; variant?: 'primary'|'secondary'|'ghost'|'danger'; size?; disabled?; type?; title? }`. `variant="danger"` EXISTS. `onClick` is a bare `() => void`.
- `Chip`: props `{ color?: ChipColor; dot?; size?; children }`. `ChipColor` includes `gray|green|blue|red|amber|orange|indigo|violet|teal|cyan`. (Use `color="orange"` etc.; `'sky'` is NOT a token — map sky→`blue`.)
- `PageHeader`: `{ icon?; title; count?; description?; actions? }` — confirmed.
- `SectionCard`: `{ title?; icon?; action?; children; noHeader?; className? }` — confirmed.
- `EmptyState`: `{ icon?; title?; description?; action? }` — confirmed (`description`, not `desc`).
- Submit-error banner house pattern: `<p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{submitError}</p>`.
- i18n in component/page tests: import the app i18n init once. Existing component tests are pure-function tests; page tests render under i18n. **Bootstrap i18n in page tests by importing `@/lib/i18n` at top of the test file** (its module side-effect calls `i18n.init`). If a test asserts on translated text, prefer matching the RU string OR a regex across ru/en/hy.
- Rules tests live in **`tests/rules/`** (NOT `firestore-tests/`). Harness helpers in `tests/rules/helpers.ts` (`makeTestEnv`, `authedDb`, `seedUser`, `seedDoc`). npm script `test:rules` already exists. The default `vitest run` EXCLUDES `tests/rules/**`.

---

## Task 1: Shared catalog errors + audit-type extensions

**Files:**
- Create: `src/domain/shared/errors.ts`
- Create: `src/domain/shared/index.ts`
- Modify: `src/domain/audit/types.ts` (add `'deleted'` action; add 4 entity types)
- Test: `src/domain/shared/errors.test.ts`, `src/domain/audit/audit-types.test.ts` (extend)

- [ ] **Step 1: Write failing test** `src/domain/shared/errors.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { EntityInUseError, SystemEntityProtectedError, PrefixLockedError, isCatalogError } from './errors'

describe('catalog errors', () => {
  it('EntityInUseError carries the reference count and a stable code', () => {
    const e = new EntityInUseError('branch', 'b1', 3)
    expect(e.code).toBe('entity_in_use')
    expect(e.count).toBe(3)
    expect(e.entityType).toBe('branch')
    expect(isCatalogError(e)).toBe(true)
    expect(e).toBeInstanceOf(Error)
  })
  it('SystemEntityProtectedError has a stable code', () => {
    const e = new SystemEntityProtectedError('asset_status', 'st_warehouse')
    expect(e.code).toBe('system_protected')
    expect(isCatalogError(e)).toBe(true)
  })
  it('PrefixLockedError has a stable code and carries the count', () => {
    const e = new PrefixLockedError('cat_1', 5)
    expect(e.code).toBe('prefix_locked')
    expect(e.count).toBe(5)
    expect(isCatalogError(e)).toBe(true)
  })
  it('isCatalogError is false for a plain Error', () => {
    expect(isCatalogError(new Error('x'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — `npm test -- --run src/domain/shared/errors.test.ts` → "Cannot find module './errors'".

- [ ] **Step 3: Implement** `src/domain/shared/errors.ts`

```ts
export type CatalogErrorCode = 'entity_in_use' | 'system_protected' | 'prefix_locked'

abstract class CatalogError extends Error {
  abstract readonly code: CatalogErrorCode
}

export class EntityInUseError extends CatalogError {
  readonly code = 'entity_in_use' as const
  constructor(readonly entityType: string, readonly entityId: string, readonly count: number) {
    super(`${entityType} ${entityId} is referenced by ${count} record(s)`)
    this.name = 'EntityInUseError'
  }
}

export class SystemEntityProtectedError extends CatalogError {
  readonly code = 'system_protected' as const
  constructor(readonly entityType: string, readonly entityId: string) {
    super(`${entityType} ${entityId} is a protected system entity`)
    this.name = 'SystemEntityProtectedError'
  }
}

export class PrefixLockedError extends CatalogError {
  readonly code = 'prefix_locked' as const
  constructor(readonly entityId: string, readonly count: number) {
    super(`category ${entityId} prefix is locked: ${count} asset(s) reference it`)
    this.name = 'PrefixLockedError'
  }
}

export function isCatalogError(e: unknown): e is CatalogError {
  return e instanceof CatalogError
}
```

And `src/domain/shared/index.ts`:

```ts
export * from './errors'
```

- [ ] **Step 4: Extend** `src/domain/audit/types.ts` — change the entity type union and add `'deleted'`:

```ts
export type AuditEntityType =
  | 'asset' | 'assignment' | 'upgrade' | 'license' | 'employee' | 'user'
  | 'branch' | 'department' | 'category' | 'asset_status'
```

and add `'deleted'` to the `AUDIT_ACTIONS` array (append after `'role_assigned'`):

```ts
  'terminated', 'reactivated', 'role_assigned', 'deleted',
```

- [ ] **Step 5: Extend** `src/domain/audit/audit-types.test.ts` — add a case asserting `isAuditAction('deleted') === true` and that the four new entity types are assignable (a `const x: AuditEntityType = 'branch'` compile check inside the test).

- [ ] **Step 6: Run both, expect PASS** — `npm test -- --run src/domain/shared/errors.test.ts src/domain/audit/audit-types.test.ts`.

- [ ] **Step 7: Add to domain barrel** `src/domain/index.ts`: append `export * from './shared'`.

- [ ] **Step 8: Typecheck** — `npm run -s typecheck` (or `npx tsc --noEmit`). Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/domain/shared src/domain/audit src/domain/index.ts
git commit -m "feat(catalogs): shared catalog errors + audit entity/action extensions"
```

---

## Task 2: Branch domain + repository port

**Files:**
- Create: `src/domain/branch/types.ts`, `src/domain/branch/BranchRepository.ts`, `src/domain/branch/index.ts`
- Test: `src/domain/branch/branch-types.test.ts`

- [ ] **Step 1: Write failing test** `src/domain/branch/branch-types.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { isBranchType, BRANCH_TYPES } from './types'

describe('branch types', () => {
  it('BRANCH_TYPES is branch + warehouse', () => {
    expect([...BRANCH_TYPES]).toEqual(['branch', 'warehouse'])
  })
  it('isBranchType guards correctly', () => {
    expect(isBranchType('branch')).toBe(true)
    expect(isBranchType('warehouse')).toBe(true)
    expect(isBranchType('office')).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/domain/branch/types.ts`

```ts
export const BRANCH_TYPES = ['branch', 'warehouse'] as const
export type BranchType = (typeof BRANCH_TYPES)[number]

export function isBranchType(v: string): v is BranchType {
  return (BRANCH_TYPES as readonly string[]).includes(v)
}

export interface Branch {
  id: string
  name: string
  type: BranchType
  city: string | null
  address: string | null
  createdAt: string
  updatedAt: string
}

export interface BranchListQuery {
  type?: BranchType | 'all'
  search?: string
}
```

- [ ] **Step 4: Implement** `src/domain/branch/BranchRepository.ts`

```ts
import type { Branch, BranchType, BranchListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateBranchInput {
  name: string
  type: BranchType
  city?: string | null
  address?: string | null
}
export interface UpdateBranchInput {
  name?: string
  type?: BranchType
  city?: string | null
  address?: string | null
}

export interface BranchRepository {
  listBranches(query?: BranchListQuery): Promise<Branch[]>
  getBranch(id: string): Promise<Branch | null>
  isNameTaken(name: string, exceptId?: string): Promise<boolean>
  /** Count of docs referencing this branch (assets.branchId, employees.branchId, assignments.assignedToBranchId). */
  countReferences(id: string): Promise<number>
  createBranch(input: CreateBranchInput, actor: Actor): Promise<AuditedResult<Branch>>
  updateBranch(id: string, patch: UpdateBranchInput, actor: Actor): Promise<AuditedResult<Branch>>
  /** Throws EntityInUseError when countReferences > 0; otherwise deletes + one audit entry. */
  deleteBranch(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>>
}
```

- [ ] **Step 5: Implement** `src/domain/branch/index.ts`

```ts
export * from './types'
export * from './BranchRepository'
```

- [ ] **Step 6: Add to domain barrel** `src/domain/index.ts`: append `export * from './branch'`.

- [ ] **Step 7: Run test + typecheck, expect PASS/clean.**

- [ ] **Step 8: Commit**

```bash
git add src/domain/branch src/domain/index.ts
git commit -m "feat(branches): branch domain entity + repository port"
```

---

## Task 3: Branch InMemory adapter (TDD, full coverage)

**Files:**
- Create: `src/infra/repositories/inMemoryBranchRepository.ts`
- Test: `src/infra/repositories/inMemoryBranchRepository.test.ts`

The adapter constructor signature MUST accept its own data array + optional refs for `countReferences` + optional audit context, mirroring `InMemoryEmployeeRepository`:

```ts
constructor(
  private readonly branches: Branch[],
  private readonly refs: { assets?: { branchId?: string }[]; employees?: { branchId?: string|null }[] } = {},
  private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
) {}
```

- [ ] **Step 1: Write failing test** `src/infra/repositories/inMemoryBranchRepository.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { InMemoryBranchRepository } from './inMemoryBranchRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { isCatalogError } from '@/domain/shared'
import type { Branch } from '@/domain/branch'

const actor = { uid: 'u_super', role: 'super_admin' as const }
function seed(): Branch[] {
  return [
    { id: 'b1', name: 'Main Office', type: 'branch', city: 'Yerevan', address: null, createdAt: 't', updatedAt: 't' },
    { id: 'b2', name: 'Central WH', type: 'warehouse', city: null, address: null, createdAt: 't', updatedAt: 't' },
  ]
}

describe('InMemoryBranchRepository', () => {
  it('lists, filters by type, and searches', async () => {
    const repo = new InMemoryBranchRepository(seed())
    expect((await repo.listBranches()).length).toBe(2)
    expect((await repo.listBranches({ type: 'warehouse' })).map(b => b.id)).toEqual(['b2'])
    expect((await repo.listBranches({ search: 'main' })).map(b => b.id)).toEqual(['b1'])
  })

  it('creates with one audit entry and rejects duplicate name (case-insensitive)', async () => {
    const store = createInMemoryAuditStore()
    const data = seed()
    const repo = new InMemoryBranchRepository(data, {}, inMemoryAuditContext(store))
    const { value, auditId } = await repo.createBranch({ name: 'North', type: 'branch' }, actor)
    expect(value.name).toBe('North')
    expect(auditId).toBeTruthy()
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.entityType).toBe('branch')
    expect(store.logs[0]!.action).toBe('created')
    await expect(repo.createBranch({ name: 'main office', type: 'branch' }, actor)).rejects.toThrow()
  })

  it('updates with one audit entry', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryBranchRepository(seed(), {}, inMemoryAuditContext(store))
    const { value } = await repo.updateBranch('b1', { city: 'Gyumri' }, actor)
    expect(value.city).toBe('Gyumri')
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.action).toBe('updated')
  })

  it('counts references and BLOCKS delete when in use', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryBranchRepository(
      seed(),
      { assets: [{ branchId: 'b1' }], employees: [{ branchId: 'b1' }] },
      inMemoryAuditContext(store),
    )
    expect(await repo.countReferences('b1')).toBe(2)
    let caught: unknown
    try { await repo.deleteBranch('b1', actor) } catch (e) { caught = e }
    expect(isCatalogError(caught)).toBe(true)
    expect(store.logs.length).toBe(0) // no audit on blocked delete
  })

  it('deletes an unreferenced branch with one audit entry', async () => {
    const store = createInMemoryAuditStore()
    const data = seed()
    const repo = new InMemoryBranchRepository(data, {}, inMemoryAuditContext(store))
    const { value } = await repo.deleteBranch('b2', actor)
    expect(value.id).toBe('b2')
    expect(data.find(b => b.id === 'b2')).toBeUndefined()
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.action).toBe('deleted')
  })
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** `src/infra/repositories/inMemoryBranchRepository.ts`

```ts
import type {
  Branch, BranchListQuery, BranchRepository, CreateBranchInput, UpdateBranchInput,
} from '@/domain/branch'
import type { Actor } from '@/domain/asset'
import { EntityInUseError } from '@/domain/shared'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

interface BranchRefs {
  assets?: { branchId?: string }[]
  employees?: { branchId?: string | null }[]
  assignments?: { assignedToBranchId?: string | null }[]
}

export class InMemoryBranchRepository implements BranchRepository {
  constructor(
    private readonly branches: Branch[],
    private readonly refs: BranchRefs = {},
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  async listBranches(query: BranchListQuery = {}): Promise<Branch[]> {
    const search = (query.search ?? '').trim().toLowerCase()
    return this.branches.filter(b => {
      if (query.type && query.type !== 'all' && b.type !== query.type) return false
      if (search) {
        const hay = [b.name, b.city, b.address].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
  }

  async getBranch(id: string): Promise<Branch | null> {
    return this.branches.find(b => b.id === id) ?? null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const needle = name.trim().toLowerCase()
    return this.branches.some(b => b.name.trim().toLowerCase() === needle && b.id !== exceptId)
  }

  async countReferences(id: string): Promise<number> {
    const a = (this.refs.assets ?? []).filter(x => x.branchId === id).length
    const e = (this.refs.employees ?? []).filter(x => x.branchId === id).length
    const g = (this.refs.assignments ?? []).filter(x => x.assignedToBranchId === id).length
    return a + e + g
  }

  async createBranch(input: CreateBranchInput, actor: Actor) {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    const now = new Date().toISOString()
    const id = `br_${Math.random().toString(36).slice(2, 10)}`
    const branch: Branch = {
      id, name: input.name.trim(), type: input.type,
      city: input.city ?? null, address: input.address ?? null,
      createdAt: now, updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'branch', entityId: id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id, name: branch.name, type: branch.type } as Record<string, unknown>,
      },
      async () => { this.branches.push(branch); return { value: branch } },
    )
  }

  async updateBranch(id: string, patch: UpdateBranchInput, actor: Actor) {
    const idx = this.branches.findIndex(b => b.id === id)
    if (idx < 0) throw new Error(`Branch not found: ${id}`)
    if (patch.name && await this.isNameTaken(patch.name, id)) throw new Error(`Name already in use: ${patch.name}`)
    const before = this.branches[idx]!
    const next: Branch = { ...before, ...stripUndefined(patch), updatedAt: new Date().toISOString() }
    if (patch.name !== undefined) next.name = patch.name.trim()
    return withAudit(this.audit,
      {
        entityType: 'branch', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name, type: before.type } as Record<string, unknown>,
        after: stripUndefined(patch) as Record<string, unknown>,
      },
      async () => { this.branches[idx] = next; return { value: next } },
    )
  }

  async deleteBranch(id: string, actor: Actor) {
    const idx = this.branches.findIndex(b => b.id === id)
    if (idx < 0) throw new Error(`Branch not found: ${id}`)
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('branch', id, count)
    return withAudit(this.audit,
      {
        entityType: 'branch', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: this.branches[idx]!.name } as Record<string, unknown>,
      },
      async () => { this.branches.splice(idx, 1); return { value: { id } } },
    )
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
```

- [ ] **Step 4: Run test + typecheck, expect PASS/clean.**

- [ ] **Step 5: Commit**

```bash
git add src/infra/repositories/inMemoryBranchRepository.ts src/infra/repositories/inMemoryBranchRepository.test.ts
git commit -m "feat(branches): in-memory branch repository (withAudit, ref-guarded delete)"
```

---

## Task 4: Branch Firestore adapter

**Files:**
- Create: `src/infra/repositories/firestoreBranchRepository.ts`
- Modify: `src/infra/repositories/index.ts` (add export)

No unit test (Firestore path is exercised via emulator in CI; mirrors how `firestoreEmployeeRepository` has no local unit test). Typecheck is the gate.

- [ ] **Step 1: Implement** `src/infra/repositories/firestoreBranchRepository.ts` — mirror `firestoreEmployeeRepository.ts` structure (toIso, serverTimestamp, `firestoreAuditContext`, readback after write). `countReferences` runs three `limit(1)` queries and sums presence:

```ts
import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, limit, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type {
  Branch, BranchType, BranchListQuery,
  BranchRepository, CreateBranchInput, UpdateBranchInput,
} from '@/domain/branch'
import { EntityInUseError } from '@/domain/shared'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toBranch(id: string, d: Record<string, unknown>): Branch {
  return {
    id,
    name: String(d.name ?? ''),
    type: (d.type as BranchType) ?? 'branch',
    city: (d.city as string | null) ?? null,
    address: (d.address as string | null) ?? null,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }
}

export class FirestoreBranchRepository implements BranchRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async listBranches(query: BranchListQuery = {}): Promise<Branch[]> {
    const snap = await getDocs(collection(this.db, 'branches'))
    let rows = snap.docs.map(d => toBranch(d.id, d.data() as Record<string, unknown>))
    if (query.type && query.type !== 'all') rows = rows.filter(b => b.type === query.type)
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) rows = rows.filter(b => [b.name, b.city, b.address].filter(Boolean).join(' ').toLowerCase().includes(search))
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  async getBranch(id: string): Promise<Branch | null> {
    const snap = await getDoc(doc(this.db, 'branches', id))
    return snap.exists() ? toBranch(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(collection(this.db, 'branches'), where('name', '==', name.trim()), limit(2)))
    return snap.docs.some(d => d.id !== exceptId)
  }

  private async anyWhere(col: string, field: string, id: string): Promise<number> {
    const snap = await getDocs(fsQuery(collection(this.db, col), where(field, '==', id), limit(1)))
    return snap.empty ? 0 : 1
  }

  async countReferences(id: string): Promise<number> {
    const [a, e, g] = await Promise.all([
      this.anyWhere('assets', 'branchId', id),
      this.anyWhere('employees', 'branchId', id),
      this.anyWhere('assignments', 'assignedToBranchId', id),
    ])
    return a + e + g
  }

  async createBranch(input: CreateBranchInput, actor: Actor): Promise<AuditedResult<Branch>> {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    const ref = doc(collection(this.db, 'branches'))
    const data: Record<string, unknown> = {
      name: input.name.trim(), type: input.type, city: input.city ?? null, address: input.address ?? null,
      createdBy: actor.uid, updatedBy: actor.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'branch', entityId: ref.id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id: ref.id, name: input.name.trim(), type: input.type },
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, data); return { value: undefined as unknown as void } },
    )
    const created = await this.getBranch(ref.id)
    if (!created) throw new Error('Branch create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async updateBranch(id: string, patch: UpdateBranchInput, actor: Actor): Promise<AuditedResult<Branch>> {
    const before = await this.getBranch(id)
    if (!before) throw new Error(`Branch not found: ${id}`)
    if (patch.name && await this.isNameTaken(patch.name, id)) throw new Error(`Name already in use: ${patch.name}`)
    const ref = doc(this.db, 'branches', id)
    const fields = stripUndefinedFs({
      ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      updatedBy: actor.uid, updatedAt: serverTimestamp(),
    })
    const r = await withAudit(this.audit,
      {
        entityType: 'branch', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name, type: before.type }, after: patch as Record<string, unknown>,
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, fields, { merge: true }); return { value: undefined as unknown as void } },
    )
    const next = await this.getBranch(id)
    if (!next) throw new Error('Branch update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async deleteBranch(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>> {
    const before = await this.getBranch(id)
    if (!before) throw new Error(`Branch not found: ${id}`)
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('branch', id, count)
    const ref = doc(this.db, 'branches', id)
    return withAudit(this.audit,
      {
        entityType: 'branch', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: before.name },
      },
      async (txn) => { (txn as unknown as Transaction).delete(ref); return { value: { id } } },
    )
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}
```

> NOTE: `TxnLike` in `withAudit.ts` only declares `set`. The delete path casts to `Transaction` (which has `.delete`) exactly as the employee adapter casts to `Transaction` for `.set`. This is the established pattern.

- [ ] **Step 2: Export** — add to `src/infra/repositories/index.ts`: `export * from './inMemoryBranchRepository'` and `export * from './firestoreBranchRepository'`.

- [ ] **Step 3: Typecheck, expect clean.**

- [ ] **Step 4: Commit**

```bash
git add src/infra/repositories/firestoreBranchRepository.ts src/infra/repositories/index.ts
git commit -m "feat(branches): firestore branch repository (withAudit, ref-guarded delete)"
```

---

## Task 5: Catalog shared UI — generic table + form-dialog + delete-confirm + i18n (branches namespace)

**Files:**
- Create: `src/components/features/catalogs/CatalogTable.tsx` (generic columns-driven table)
- Create: `src/components/features/catalogs/ConfirmDeleteDialog.tsx`
- Create: `src/components/features/catalogs/index.ts`
- Create: `src/components/features/branches/BranchFormDialog.tsx`
- Create: `src/components/features/branches/index.ts`
- Create: `src/locales/{ru,en,hy}/branches.json`
- Modify: `src/lib/i18n/index.ts` (register `branches` namespace — and the other 3 namespaces now, to avoid 4 edits: add `branches`, `departments`, `categories`, `statuses`)
- Test: `src/components/features/branches/BranchFormDialog.test.tsx`

> First read `src/components/features/employees/EmployeeForm.tsx` and `EmployeesTable.tsx` for the exact primitive imports, prop conventions (`Field`, `Input`, `Select`, `Btn`, `Icon`), dark-theme class tokens (`#2A2F36` borders, `#64748B` muted), and modal/overlay convention if one exists; if no modal primitive exists, build a lightweight controlled overlay (`fixed inset-0` + card) consistent with the theme.

- [ ] **Step 1:** Inspect i18n config to learn the namespace registration shape:

Run: `cat src/lib/i18n/index.ts`

- [ ] **Step 2: Create locale files.** `src/locales/ru/branches.json`:

```json
{
  "title": "Филиалы",
  "create": "Добавить филиал",
  "empty": { "title": "Филиалов пока нет", "desc": "Добавьте первый филиал" },
  "filter": { "all": "Все", "type": "Тип", "search": "Поиск" },
  "type": { "branch": "Филиал", "warehouse": "Склад" },
  "col": { "name": "Название", "type": "Тип", "city": "Город", "actions": "" },
  "form": {
    "createTitle": "Новый филиал", "editTitle": "Редактирование филиала",
    "name": "Название", "type": "Тип", "city": "Город", "address": "Адрес",
    "save": "Сохранить", "cancel": "Отмена",
    "pickType": "Выберите тип"
  },
  "delete": {
    "title": "Удалить филиал?", "confirm": "Удалить", "cancel": "Отмена",
    "body": "Действие нельзя отменить.",
    "inUse": "Нельзя удалить: на этот филиал ссылается {{count}} записей."
  },
  "validation": {
    "required": "Обязательное поле", "nameTaken": "Такое название уже используется",
    "saveFailed": "Не удалось сохранить. Попробуйте ещё раз."
  },
  "pagination": { "range": "{{from}}–{{to}} / {{total}}" }
}
```

`src/locales/en/branches.json` (same keys, English values: "Branches", "Add branch", "Branches yet", "Add the first branch", "All"/"Type"/"Search", "Branch"/"Warehouse", "Name"/"Type"/"City", "New branch"/"Edit branch"/"Name"/"Type"/"City"/"Address"/"Save"/"Cancel"/"Select type", "Delete branch?"/"Delete"/"Cancel"/"This cannot be undone."/"Cannot delete: {{count}} record(s) reference this branch.", "Required"/"This name is already in use"/"Could not save. Try again.", "{{from}}–{{to}} / {{total}}").

`src/locales/hy/branches.json` (same keys, Armenian values: "Մասնաճյուղեր", "Ավելացնել մասնաճյուղ", "Դեռ մասնաճյուղեր չկան", "Ավելացրեք առաջին մասնաճյուղը", "Բոլորը"/"Տեսակ"/"Որոնում", "Մասնաճյուղ"/"Պահեստ", "Անվանում"/"Տեսակ"/"Քաղաք", "Նոր մասնաճյուղ"/"Մասնաճյուղի խմբագրում"/"Անվանում"/"Տեսակ"/"Քաղաք"/"Հասցե"/"Պահպանել"/"Չեղարկել"/"Ընտրեք տեսակը", "Ջնջե՞լ մասնաճյուղը"/"Ջնջել"/"Չեղարկել"/"Գործողությունը հնարավոր չէ հետարկել։"/"Հնարավոր չէ ջնջել. այս մասնաճյուղին հղվում է {{count}} գրառում։", "Պարտադիր դաշտ"/"Այս անվանումն արդեն օգտագործվում է"/"Չհաջողվեց պահպանել։ Փորձեք կրկին։", "{{from}}–{{to}} / {{total}}").

- [ ] **Step 3: Register namespaces** in `src/lib/i18n/index.ts` following the existing pattern (import the 12 new JSON files and add `branches`, `departments`, `categories`, `statuses` to each language's `resources` map). The departments/categories/statuses JSON files are created in their own tasks; to avoid a missing-import compile error, create **stub** files now for those three namespaces in all three languages containing at minimum `{ "title": "" }` — they are fully populated in Tasks 8/11/14. (Alternatively register only `branches` here and register each later namespace in its own task — choose whichever keeps typecheck green; document the choice in the commit.)

> Decision for the implementer: register **only `branches`** here, and register each subsequent namespace inside its own task (Tasks 8, 11, 14). This avoids stub files. Update this step to import + register `branches` alone.

- [ ] **Step 4: Build `CatalogTable.tsx`** — a generic, columns-driven table:

```tsx
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBtn } from '@/components/ui'

export interface CatalogColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

export interface CatalogTableProps<T extends { id: string }> {
  rows: T[]
  columns: CatalogColumn<T>[]
  canMutate: boolean
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  /** Optional: hide delete for a given row (e.g. system statuses). */
  canDeleteRow?: (row: T) => boolean
}

export function CatalogTable<T extends { id: string }>(props: CatalogTableProps<T>) {
  const { rows, columns, canMutate, onEdit, onDelete, canDeleteRow } = props
  const { t } = useTranslation('common')
  const editLabel = t('actions.edit', { defaultValue: 'Edit' })
  const deleteLabel = t('actions.delete', { defaultValue: 'Delete' })
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-[#64748B] border-b border-[#2A2F36]">
            {columns.map(c => <th key={c.key} className={`py-2 pr-4 font-medium ${c.className ?? ''}`}>{c.header}</th>)}
            {canMutate && <th className="py-2 w-[80px]" />}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-[#1F242B] hover:bg-[#161A20]">
              {columns.map(c => <td key={c.key} className={`py-2.5 pr-4 ${c.className ?? ''}`}>{c.render(row)}</td>)}
              {canMutate && (
                <td className="py-2.5">
                  <div className="flex items-center gap-1 justify-end">
                    <IconBtn icon="pencil" title={editLabel} tone="slate" onClick={() => onEdit(row)} />
                    {(canDeleteRow ? canDeleteRow(row) : true) && (
                      <IconBtn icon="trash-2" title={deleteLabel} tone="rose" onClick={() => onDelete(row)} />
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

> Verify `IconBtn` accepts `aria-label` + `onClick` + children by reading `src/components/ui/icon-btn.tsx`. If its API differs, adapt. If `pencil`/`trash-2` aren't valid icon names in the project's icon set, read `src/components/ui/icon.tsx` for the available set and pick the closest (`edit`, `trash`).

- [ ] **Step 5: Build `ConfirmDeleteDialog.tsx`** — controlled overlay with title/body/confirm/cancel + an optional `blockedMessage` (when set, the confirm button is hidden and the message shown instead):

```tsx
import { Btn } from '@/components/ui'

export interface ConfirmDeleteDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  blockedMessage?: string | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteDialog(p: ConfirmDeleteDialogProps) {
  if (!p.open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={p.onCancel}>
      <div className="w-[400px] rounded-lg border border-[#2A2F36] bg-[#0F1318] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-[#E6EAF0] mb-2">{p.title}</h3>
        <p className="text-[13px] text-[#94A3B8] mb-4">{p.blockedMessage ?? p.body}</p>
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{p.cancelLabel}</Btn>
          {!p.blockedMessage && (
            <Btn variant="danger" size="sm" disabled={p.busy} onClick={p.onConfirm}>{p.confirmLabel}</Btn>
          )}
        </div>
      </div>
    </div>
  )
}
```

> Verify `Btn` supports `variant="danger"` by reading `src/components/ui/btn.tsx`. If not, use the closest destructive variant or add the variant in that file (small, isolated). Document if you change `btn.tsx`.

- [ ] **Step 6: Build `BranchFormDialog.tsx`** — controlled modal with name/type/city/address, a `submitError` display, and `onSubmit(values)`:

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, Select } from '@/components/ui'
import type { Branch, BranchType } from '@/domain/branch'
import { BRANCH_TYPES } from '@/domain/branch'

export interface BranchFormValues { name: string; type: BranchType; city: string | null; address: string | null }
export interface BranchFormDialogProps {
  open: boolean
  initial?: Branch | null
  submitting?: boolean
  submitError?: string | null
  onSubmit: (v: BranchFormValues) => void
  onCancel: () => void
}

export function BranchFormDialog(p: BranchFormDialogProps) {
  const { t } = useTranslation('branches')
  const [name, setName] = useState(p.initial?.name ?? '')
  const [type, setType] = useState<BranchType>(p.initial?.type ?? 'branch')
  const [city, setCity] = useState(p.initial?.city ?? '')
  const [address, setAddress] = useState(p.initial?.address ?? '')
  const [touched, setTouched] = useState(false)

  if (!p.open) return null
  const nameError = touched && !name.trim() ? t('validation.required') : null

  function submit() {
    setTouched(true)
    if (!name.trim()) return
    p.onSubmit({ name: name.trim(), type, city: city.trim() || null, address: address.trim() || null })
  }

  const typeOptions = BRANCH_TYPES.map(bt => ({ value: bt, label: t(`type.${bt}`) }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={p.onCancel}>
      <div className="w-[440px] rounded-lg border border-[#2A2F36] bg-[#1B1F24] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-[#F8FAFC] mb-4">
          {p.initial ? t('form.editTitle') : t('form.createTitle')}
        </h3>
        <div className="space-y-3">
          {p.submitError && <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{p.submitError}</p>}
          <div>
            <Field label={t('form.name')} required>
              <Input value={name} onChange={setName} autoFocus />
            </Field>
            {nameError && <p className="mt-1 text-[12px] text-[#FDA4AF]">{nameError}</p>}
          </div>
          <Field label={t('form.type')}>
            <Select value={type} onChange={v => setType(v as BranchType)} options={typeOptions} />
          </Field>
          <Field label={t('form.city')}>
            <Input value={city} onChange={setCity} />
          </Field>
          <Field label={t('form.address')}>
            <Input value={address} onChange={setAddress} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{t('form.cancel')}</Btn>
          <Btn variant="primary" size="sm" disabled={p.submitting} onClick={submit}>{t('form.save')}</Btn>
        </div>
      </div>
    </div>
  )
}
```

> Verify `Field` accepts an `error` prop and `Select`/`Input` are uncontrolled-friendly by reading `src/components/ui/{field,select,input}.tsx`. Adapt prop names to the real API.

- [ ] **Step 7: Barrels** — `src/components/features/catalogs/index.ts` exports `CatalogTable`, `CatalogColumn`, `CatalogTableProps`, `ConfirmDeleteDialog`. `src/components/features/branches/index.ts` exports `BranchFormDialog`, `BranchFormValues`.

- [ ] **Step 8: Write test** `src/components/features/branches/BranchFormDialog.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BranchFormDialog } from './BranchFormDialog'
import '@/lib/i18n' // ensure i18next initialized for tests (mirror existing component tests)

describe('BranchFormDialog', () => {
  it('does not render when closed', () => {
    const { container } = render(<BranchFormDialog open={false} onSubmit={() => {}} onCancel={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
  it('blocks submit when name empty and submits trimmed values', () => {
    const onSubmit = vi.fn()
    render(<BranchFormDialog open onSubmit={onSubmit} onCancel={() => {}} />)
    // find the Save button by role and click without a name
    const buttons = screen.getAllByRole('button')
    const save = buttons[buttons.length - 1]!
    fireEvent.click(save)
    expect(onSubmit).not.toHaveBeenCalled()
    // type a name then submit
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: '  North  ' } })
    fireEvent.click(save)
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'North', type: 'branch', city: null, address: null }))
  })
})
```

> Read an existing component test (`src/components/features/employees/EmployeeForm.test.tsx`) for the exact i18n bootstrap convention in tests — match it (the import path / setup file may differ from `@/lib/i18n`).

- [ ] **Step 9: Run test + typecheck, expect PASS/clean.**

- [ ] **Step 10: Commit**

```bash
git add src/components/features/catalogs src/components/features/branches src/locales/*/branches.json src/lib/i18n/index.ts
git commit -m "feat(catalogs): generic catalog table/dialog + branches form + branches i18n"
```

---

## Task 6: Branches page + route wiring

**Files:**
- Create: `src/pages/BranchesPage.tsx`
- Modify: `src/pages/index.ts`, `src/config/routes.tsx`, `src/config/nav.ts` (remove `'branches'` from `PHASE_STUB_ROUTES`)
- Test: `src/pages/BranchesPage.test.tsx`

- [ ] **Step 1: Write failing test** `src/pages/BranchesPage.test.tsx` — render with an injected `InMemoryBranchRepository`, assert rows render; assert create modal submit calls repo; assert an `asset_admin` sees the create button (branches are super|asset_admin):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BranchesPage } from './BranchesPage'
import { InMemoryBranchRepository } from '@/infra/repositories'
import type { Branch } from '@/domain/branch'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u_super' }, role: 'super_admin' }),
}))

function seed(): Branch[] {
  return [{ id: 'b1', name: 'Main Office', type: 'branch', city: 'Yerevan', address: null, createdAt: 't', updatedAt: 't' }]
}

describe('BranchesPage', () => {
  beforeEach(() => vi.clearAllMocks())
  it('renders branches from the injected repo', async () => {
    const repo = new InMemoryBranchRepository(seed())
    render(<MemoryRouter><BranchesPage repository={repo} /></MemoryRouter>)
    expect(await screen.findByText('Main Office')).toBeInTheDocument()
  })
  it('creates a branch via the modal', async () => {
    const data = seed()
    const repo = new InMemoryBranchRepository(data)
    render(<MemoryRouter><BranchesPage repository={repo} /></MemoryRouter>)
    await screen.findByText('Main Office')
    // open create modal
    fireEvent.click(screen.getByText(/Добавить филиал|Add branch|Ավելացնել/))
    const inputs = await screen.findAllByRole('textbox')
    fireEvent.change(inputs[0]!, { target: { value: 'North' } })
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[buttons.length - 1]!) // Save
    await waitFor(() => expect(data.some(b => b.name === 'North')).toBe(true))
  })
})
```

- [ ] **Step 2: Run, expect FAIL** (page missing).

- [ ] **Step 3: Implement `BranchesPage.tsx`** — mirror `EmployeesPage.tsx` skeleton (PageHeader + SectionCard + filter + table + pagination), using the catalog generics. State: `query`, `branches`, `loading`, `error`, plus modal state (`editing: Branch | null | 'new'`) and delete state (`deleting: Branch | null`, `blockedMsg`). Repo-factory: `repository ?? new FirestoreBranchRepository(db())`. `canMutate = role === 'super_admin' || role === 'asset_admin'`. Columns: name (with type chip), city. On delete: call `repo.countReferences`; if `>0` open the dialog with `blockedMessage = t('delete.inUse', { count })`; else open with confirm. On confirm: `repo.deleteBranch` then reload; catch `EntityInUseError` (defensive) → show blocked message. Use `isCatalogError`/`instanceof EntityInUseError` from `@/domain/shared`. After any successful create/update/delete, reload the list.

Full reference implementation (the implementer adapts imports/props to verified primitive APIs):

```tsx
import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, SectionCard, Btn, Icon, Chip, EmptyState, LoadingState, ErrorState } from '@/components/ui'
import { CatalogTable, ConfirmDeleteDialog, type CatalogColumn } from '@/components/features/catalogs'
import { BranchFormDialog, type BranchFormValues } from '@/components/features/branches'
import type { Branch, BranchListQuery, BranchRepository } from '@/domain/branch'
import { FirestoreBranchRepository } from '@/infra/repositories'
import { EntityInUseError } from '@/domain/shared'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 15

export interface BranchesPageProps { repository?: BranchRepository }

export function BranchesPage({ repository }: BranchesPageProps) {
  const { t } = useTranslation('branches')
  const { user, role } = useAuth()
  const defaultRepo = useMemo<BranchRepository>(() => new FirestoreBranchRepository(db()), [])
  const repo = repository ?? defaultRepo
  const canMutate = role === 'super_admin' || role === 'asset_admin'

  const [query, setQuery]   = useState<BranchListQuery>({ type: 'all', search: '' })
  const [page, setPage]     = useState(1)
  const [rows, setRows]     = useState<Branch[]>([])
  const [loading, setLoad]  = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [editing, setEditing] = useState<Branch | 'new' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<Branch | null>(null)
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null)
  const [delBusy, setDelBusy]       = useState(false)

  const load = useCallback(async () => {
    setLoad(true); setError(null)
    try { setRows(await repo.listBranches(query)) }
    catch { setError(t('validation.saveFailed')) }
    finally { setLoad(false) }
  }, [repo, query, t])
  useEffect(() => { void load() }, [load])

  const total = rows.length
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: CatalogColumn<Branch>[] = [
    { key: 'name', header: t('col.name'), render: b => <span className="text-[#E6EAF0]">{b.name}</span> },
    { key: 'type', header: t('col.type'), render: b => <Chip>{t(`type.${b.type}`)}</Chip> },
    { key: 'city', header: t('col.city'), render: b => <span className="text-[#94A3B8]">{b.city ?? '—'}</span> },
  ]

  async function handleSubmit(v: BranchFormValues) {
    setSubmitting(true); setSaveError(null)
    try {
      if (editing && editing !== 'new') await repo.updateBranch(editing.id, v, { uid: user.id, role })
      else await repo.createBranch(v, { uid: user.id, role })
      setEditing(null); await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveError(/name already in use/i.test(msg) ? t('validation.nameTaken') : t('validation.saveFailed'))
    } finally { setSubmitting(false) }
  }

  async function askDelete(b: Branch) {
    setBlockedMsg(null)
    const count = await repo.countReferences(b.id)
    if (count > 0) setBlockedMsg(t('delete.inUse', { count }))
    setDeleting(b)
  }
  async function confirmDelete() {
    if (!deleting) return
    setDelBusy(true)
    try { await repo.deleteBranch(deleting.id, { uid: user.id, role }); setDeleting(null); await load() }
    catch (e) {
      if (e instanceof EntityInUseError) setBlockedMsg(t('delete.inUse', { count: e.count }))
      else { setDeleting(null); setError(t('validation.saveFailed')) }
    } finally { setDelBusy(false) }
  }

  function body() {
    if (loading) return <LoadingState rows={6} />
    if (error) return <ErrorState onRetry={load} />
    if (rows.length === 0) return <EmptyState icon="building" title={t('empty.title')} description={t('empty.desc')} />
    return (
      <>
        <CatalogTable
          rows={pageRows} columns={columns} canMutate={canMutate}
          onEdit={b => { setSaveError(null); setEditing(b) }}
          onDelete={askDelete}
        />
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4 border-t border-[#2A2F36] mt-2">
            <span className="text-[12px] text-[#64748B]">{t('pagination.range', { from, to, total })}</span>
            <div className="flex gap-2">
              <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><Icon name="chevron-right" size={13} className="rotate-180" /></Btn>
              <Btn variant="secondary" size="sm" disabled={to >= total} onClick={() => setPage(p => p + 1)}><Icon name="chevron-right" size={13} /></Btn>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader
        icon="building" title={t('title')} {...(!loading ? { count: total } : {})}
        {...(canMutate ? { actions: (
          <Btn variant="primary" size="md" onClick={() => { setSaveError(null); setEditing('new') }}>
            <Icon name="building" size={14} />{t('create')}
          </Btn>
        ) } : {})}
      />
      <SectionCard noHeader><div className="space-y-4">{body()}</div></SectionCard>

      <BranchFormDialog
        open={editing !== null}
        initial={editing && editing !== 'new' ? editing : null}
        submitting={submitting} submitError={saveError}
        onSubmit={handleSubmit} onCancel={() => setEditing(null)}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title={t('delete.title')} body={t('delete.body')}
        confirmLabel={t('delete.confirm')} cancelLabel={t('delete.cancel')}
        blockedMessage={blockedMsg} busy={delBusy}
        onConfirm={confirmDelete} onCancel={() => { setDeleting(null); setBlockedMsg(null) }}
      />
    </div>
  )
}
```

> Verify `Chip`, `EmptyState` (`icon`/`title`/`description`), `PageHeader` (`count`/`actions`), `SectionCard` (`noHeader`) props against their primitive files. The `building` icon is used by the branches nav item already, so it's valid.

- [ ] **Step 4: Wire route** in `src/config/routes.tsx`: import `BranchesPage` from `@/pages`; add a `<Route path="/branches" element={<RoleGate roles={routeRoles('branches')}><BranchesPage /></RoleGate>} />`. Export `BranchesPage` from `src/pages/index.ts`.

- [ ] **Step 5: Remove stub** — in `src/config/nav.ts`, delete `'branches'` from `PHASE_STUB_ROUTES`.

- [ ] **Step 6: Run page test + full suite + typecheck.** `npm test -- --run` (expect baseline+new, all green) and `npm run -s typecheck`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/BranchesPage.tsx src/pages/BranchesPage.test.tsx src/pages/index.ts src/config/routes.tsx src/config/nav.ts
git commit -m "feat(branches): branches CRUD page + route wiring (de-stubbed)"
```

---

## Task 7: Department domain + InMemory + Firestore adapters

**Files:**
- Create: `src/domain/department/{types.ts,DepartmentRepository.ts,index.ts}`
- Create: `src/infra/repositories/{inMemoryDepartmentRepository.ts,firestoreDepartmentRepository.ts}`
- Modify: `src/domain/index.ts`, `src/infra/repositories/index.ts`
- Test: `src/infra/repositories/inMemoryDepartmentRepository.test.ts`

Department has only `name`. Refs: `assets.deptId`, `employees.departmentId`. Write gate is super-only (UI gates it; rules already super-only).

- [ ] **Step 1:** `src/domain/department/types.ts`

```ts
export interface Department {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}
export interface DepartmentListQuery { search?: string }
```

- [ ] **Step 2:** `src/domain/department/DepartmentRepository.ts` — same port shape as Branch (list/get/isNameTaken/countReferences/create/update/delete) with `CreateDepartmentInput { name }`, `UpdateDepartmentInput { name? }`, entityType `'department'`. `countReferences` covers `assets.deptId` + `employees.departmentId`.

- [ ] **Step 3:** `src/domain/department/index.ts` barrel; add `export * from './department'` to `src/domain/index.ts`.

- [ ] **Step 4: Write failing test** `inMemoryDepartmentRepository.test.ts` — same shape as the branch test: list/search, create+audit+dup-name reject, update+audit, countReferences over `{ assets:[{deptId}], employees:[{departmentId}] }`, in-use delete BLOCK (no audit), unreferenced delete (one audit `deleted`).

```ts
import { describe, it, expect } from 'vitest'
import { InMemoryDepartmentRepository } from './inMemoryDepartmentRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { isCatalogError } from '@/domain/shared'
import type { Department } from '@/domain/department'

const actor = { uid: 'u', role: 'super_admin' as const }
const seed = (): Department[] => [
  { id: 'd1', name: 'IT', createdAt: 't', updatedAt: 't' },
  { id: 'd2', name: 'HR', createdAt: 't', updatedAt: 't' },
]

describe('InMemoryDepartmentRepository', () => {
  it('creates with one audit + rejects dup name', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryDepartmentRepository(seed(), {}, inMemoryAuditContext(store))
    await repo.createDepartment({ name: 'Finance' }, actor)
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.entityType).toBe('department')
    await expect(repo.createDepartment({ name: 'it' }, actor)).rejects.toThrow()
  })
  it('blocks delete when referenced', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryDepartmentRepository(seed(), { assets: [{ deptId: 'd1' }] }, inMemoryAuditContext(store))
    expect(await repo.countReferences('d1')).toBe(1)
    let caught: unknown
    try { await repo.deleteDepartment('d1', actor) } catch (e) { caught = e }
    expect(isCatalogError(caught)).toBe(true)
    expect(store.logs.length).toBe(0)
  })
  it('deletes unreferenced with one audit', async () => {
    const store = createInMemoryAuditStore()
    const data = seed()
    const repo = new InMemoryDepartmentRepository(data, {}, inMemoryAuditContext(store))
    await repo.deleteDepartment('d2', actor)
    expect(data.find(d => d.id === 'd2')).toBeUndefined()
    expect(store.logs[0]!.action).toBe('deleted')
  })
})
```

- [ ] **Step 5: Run, expect FAIL → implement `inMemoryDepartmentRepository.ts`** mirroring the branch InMemory adapter (refs `{ assets?: {deptId?}[]; employees?: {departmentId?:string|null}[] }`; id prefix `dp_`; methods `createDepartment`/`updateDepartment`/`deleteDepartment`).

- [ ] **Step 6: Implement `firestoreDepartmentRepository.ts`** mirroring the branch Firestore adapter (`countReferences` = `anyWhere('assets','deptId',id) + anyWhere('employees','departmentId',id)`).

- [ ] **Step 7: Export** both from `src/infra/repositories/index.ts`.

- [ ] **Step 8: Run test + typecheck.**

- [ ] **Step 9: Commit**

```bash
git add src/domain/department src/infra/repositories/*Department* src/domain/index.ts src/infra/repositories/index.ts
git commit -m "feat(departments): department domain + in-memory/firestore repos (withAudit)"
```

---

## Task 8: Departments page + form + i18n + route

**Files:**
- Create: `src/components/features/departments/{DepartmentFormDialog.tsx,index.ts}`
- Create: `src/pages/DepartmentsPage.tsx`
- Create: `src/locales/{ru,en,hy}/departments.json`
- Modify: `src/lib/i18n/index.ts`, `src/pages/index.ts`, `src/config/routes.tsx`, `src/config/nav.ts`
- Test: `src/pages/DepartmentsPage.test.tsx`

Write gate: **super_admin only** (`canMutate = role === 'super_admin'`).

- [ ] **Step 1:** Create `departments.json` (ru/en/hy) — keys: `title`, `create`, `empty.{title,desc}`, `filter.search`, `col.name`, `form.{createTitle,editTitle,name,save,cancel}`, `delete.{title,confirm,cancel,body,inUse}`, `validation.{required,nameTaken,saveFailed}`, `pagination.range`. (ru: "Отделы"/"Добавить отдел"/…; en: "Departments"/…; hy: "Բաժիններ"/…). Register `departments` namespace in i18n.

- [ ] **Step 2:** `DepartmentFormDialog.tsx` — single `name` field (mirror BranchFormDialog minus type/city/address). `index.ts` barrel.

- [ ] **Step 3: Write failing test** `DepartmentsPage.test.tsx` — same shape as BranchesPage test but mock `useAuth` role `super_admin`, and add a case asserting an `asset_admin` does NOT see the create button (departments are super-only):

```tsx
// second test file-level describe block — re-mock useAuth per case using vi.mocked or separate files
```

> Implementer note: to test two roles, either use two test files or `vi.doMock`/`vi.resetModules`. Simplest: one file mocks `super_admin` and asserts create button present + create works; a second test file `DepartmentsPage.roles.test.tsx` mocks `asset_admin` and asserts the create button is absent (`expect(screen.queryByText(/Добавить отдел|Add department/)).toBeNull()`).

- [ ] **Step 4:** Implement `DepartmentsPage.tsx` mirroring BranchesPage; columns = name only; icon `network`; `canMutate = role === 'super_admin'`.

- [ ] **Step 5:** Wire route `/departments` (RoleGate `routeRoles('departments')`), export from `pages/index.ts`, remove `'departments'` from `PHASE_STUB_ROUTES`.

- [ ] **Step 6: Run tests + full suite + typecheck.**

- [ ] **Step 7: Commit**

```bash
git add src/components/features/departments src/pages/Departments* src/locales/*/departments.json src/lib/i18n/index.ts src/pages/index.ts src/config/routes.tsx src/config/nav.ts
git commit -m "feat(departments): departments CRUD page + route (de-stubbed, super-only writes)"
```

---

## Task 9: Category domain + InMemory + Firestore adapters (with prefix lock)

**Files:**
- Create: `src/domain/category/{types.ts,CategoryRepository.ts,index.ts}`
- Create: `src/infra/repositories/{inMemoryCategoryRepository.ts,firestoreCategoryRepository.ts}`
- Modify: `src/domain/index.ts`, `src/infra/repositories/index.ts`
- Test: `src/infra/repositories/inMemoryCategoryRepository.test.ts`

- [ ] **Step 1:** `src/domain/category/types.ts`

```ts
export const CATEGORY_GROUPS = ['devices', 'network', 'furniture'] as const
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]

export function isCategoryGroup(v: string): v is CategoryGroup {
  return (CATEGORY_GROUPS as readonly string[]).includes(v)
}

export interface Category {
  id: string
  name: string
  group: CategoryGroup
  prefix: string
  hasSpecs: boolean
  lucideIcon: string
  createdAt: string
  updatedAt: string
}
export interface CategoryListQuery { group?: CategoryGroup | 'all'; search?: string }
```

- [ ] **Step 2:** `src/domain/category/CategoryRepository.ts`:

```ts
import type { Category, CategoryGroup, CategoryListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateCategoryInput {
  name: string; group: CategoryGroup; prefix: string; hasSpecs: boolean; lucideIcon?: string
}
export interface UpdateCategoryInput {
  name?: string; group?: CategoryGroup; prefix?: string; hasSpecs?: boolean; lucideIcon?: string
}

export interface CategoryRepository {
  listCategories(query?: CategoryListQuery): Promise<Category[]>
  getCategory(id: string): Promise<Category | null>
  isNameTaken(name: string, exceptId?: string): Promise<boolean>
  isPrefixTaken(prefix: string, exceptId?: string): Promise<boolean>
  /** Count of assets with this categoryId. Also gates prefix edits + delete. */
  countReferences(id: string): Promise<number>
  createCategory(input: CreateCategoryInput, actor: Actor): Promise<AuditedResult<Category>>
  /** Throws PrefixLockedError if patch.prefix changes the prefix while assets exist. */
  updateCategory(id: string, patch: UpdateCategoryInput, actor: Actor): Promise<AuditedResult<Category>>
  deleteCategory(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>>
}
```

- [ ] **Step 3:** barrels (`category/index.ts`, add to `domain/index.ts`).

- [ ] **Step 4: Write failing test** `inMemoryCategoryRepository.test.ts` — list/group-filter/search; create+audit; dup name reject; dup prefix reject; **prefix-lock** (update prefix while assets exist → throws, no audit; updating non-prefix fields while referenced is allowed → one audit); in-use delete BLOCK; unreferenced delete (one audit). Key cases:

```ts
import { describe, it, expect } from 'vitest'
import { InMemoryCategoryRepository } from './inMemoryCategoryRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { PrefixLockedError, EntityInUseError, isCatalogError } from '@/domain/shared'
import type { Category } from '@/domain/category'

const actor = { uid: 'u', role: 'super_admin' as const }
const seed = (): Category[] => [
  { id: 'c1', name: 'Laptop', group: 'devices', prefix: '450', hasSpecs: true, lucideIcon: 'laptop', createdAt: 't', updatedAt: 't' },
  { id: 'c2', name: 'Chair', group: 'furniture', prefix: '900', hasSpecs: false, lucideIcon: 'armchair', createdAt: 't', updatedAt: 't' },
]

describe('InMemoryCategoryRepository', () => {
  it('rejects duplicate prefix', async () => {
    const repo = new InMemoryCategoryRepository(seed())
    await expect(repo.createCategory({ name: 'PC', group: 'devices', prefix: '450', hasSpecs: true }, actor)).rejects.toThrow()
  })
  it('locks prefix edit when assets exist but allows other edits', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryCategoryRepository(seed(), { assets: [{ categoryId: 'c1' }] }, inMemoryAuditContext(store))
    let caught: unknown
    try { await repo.updateCategory('c1', { prefix: '451' }, actor) } catch (e) { caught = e }
    expect(caught instanceof PrefixLockedError).toBe(true)
    expect(store.logs.length).toBe(0)
    // editing name is fine even when referenced
    await repo.updateCategory('c1', { name: 'Laptop Pro' }, actor)
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.action).toBe('updated')
  })
  it('blocks delete when referenced', async () => {
    const repo = new InMemoryCategoryRepository(seed(), { assets: [{ categoryId: 'c1' }] })
    let caught: unknown
    try { await repo.deleteCategory('c1', actor) } catch (e) { caught = e }
    expect(caught instanceof EntityInUseError).toBe(true)
  })
  it('allows prefix edit when NOT referenced', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryCategoryRepository(seed(), {}, inMemoryAuditContext(store))
    const { value } = await repo.updateCategory('c1', { prefix: '451' }, actor)
    expect(value.prefix).toBe('451')
  })
})
```

- [ ] **Step 5: Implement `inMemoryCategoryRepository.ts`** — refs `{ assets?: { categoryId?: string }[] }`; `countReferences` = assets with matching `categoryId`. In `updateCategory`, if `patch.prefix !== undefined && patch.prefix.trim() !== before.prefix`, call `countReferences`; if `>0` throw `PrefixLockedError(id, count)` BEFORE entering `withAudit`. In `deleteCategory`, block via `EntityInUseError` like Branch. `lucideIcon` defaults to `'package'` when omitted. id prefix `cat_`.

- [ ] **Step 6: Implement `firestoreCategoryRepository.ts`** — `toCategory` reads `name/group/prefix/hasSpecs/lucideIcon` with the SAME field names the live reference reads use (`name`, `group`, `lucideIcon`) PLUS the new `prefix`, `hasSpecs`. `isPrefixTaken` queries `where('prefix','==',prefix.trim())`. `countReferences` = `anyWhere('assets','categoryId',id)`. Prefix-lock + delete-block identical logic to InMemory.

- [ ] **Step 7: Export, run test, typecheck.**

- [ ] **Step 8: Commit**

```bash
git add src/domain/category src/infra/repositories/*Category* src/domain/index.ts src/infra/repositories/index.ts
git commit -m "feat(categories): category domain + repos (prefix-lock, ref-guarded delete, withAudit)"
```

---

## Task 10: Categories page + form + i18n + route

**Files:**
- Create: `src/components/features/categories/{CategoryFormDialog.tsx,index.ts}`
- Create: `src/pages/CategoriesPage.tsx`
- Create: `src/locales/{ru,en,hy}/categories.json`
- Modify: `src/lib/i18n/index.ts`, `src/pages/index.ts`, `src/config/routes.tsx`, `src/config/nav.ts`
- Test: `src/pages/CategoriesPage.test.tsx`

Write gate: **super_admin only**.

- [ ] **Step 1:** `categories.json` (ru/en/hy) — keys: `title`, `create`, `empty.{title,desc}`, `filter.{all,group,search}`, `group.{devices,network,furniture}`, `col.{name,group,prefix,specs}`, `specs.{yes,no}`, `form.{createTitle,editTitle,name,group,prefix,prefixLocked,hasSpecs,icon,save,cancel}`, `delete.{title,confirm,cancel,body,inUse}`, `validation.{required,nameTaken,prefixTaken,saveFailed}`, `pagination.range`. ru group labels: "Устройства"/"Сетевые"/"Мебель". `form.prefixLocked`: "Префикс нельзя изменить — есть активы в этой категории." Register namespace.

- [ ] **Step 2:** `CategoryFormDialog.tsx` — fields: name (text), group (select over `CATEGORY_GROUPS`), prefix (text; **disabled in edit mode when `prefixLocked` prop is true**, with the `form.prefixLocked` hint shown), hasSpecs (checkbox/toggle), lucideIcon (text, optional, default `package`). The page passes `prefixLocked` (computed from `countReferences > 0` when editing). `index.ts` barrel.

- [ ] **Step 3: Write failing test** `CategoriesPage.test.tsx` — render with InMemory repo (role super_admin), assert rows render (name + group chip + prefix), create works, and that editing a referenced category disables the prefix input. Provide the repo seeded with a referencing asset to exercise the lock:

```tsx
// repo = new InMemoryCategoryRepository(seed(), { assets: [{ categoryId: 'c1' }] })
// open edit on c1 → prefix input has the `disabled` attribute
```

- [ ] **Step 4:** Implement `CategoriesPage.tsx` — columns: name, group (Chip), prefix (mono), specs (yes/no Chip). Icon `tags`. On edit, before opening the dialog call `repo.countReferences(cat.id)` and pass `prefixLocked={count > 0}`. Map repo error messages: `prefix already in use` → `validation.prefixTaken`; `PrefixLockedError` (if thrown on submit despite the disabled field) → show `form.prefixLocked` inline. `canMutate = role === 'super_admin'`.

- [ ] **Step 5:** Wire route `/categories`, export, remove `'categories'` from `PHASE_STUB_ROUTES`.

- [ ] **Step 6: Run tests + full suite + typecheck.**

- [ ] **Step 7: Commit**

```bash
git add src/components/features/categories src/pages/Categories* src/locales/*/categories.json src/lib/i18n/index.ts src/pages/index.ts src/config/routes.tsx src/config/nav.ts
git commit -m "feat(categories): categories CRUD page + route (prefix-lock UI, super-only)"
```

---

## Task 11: AssetStatus domain + InMemory + Firestore adapters (system-protection)

**Files:**
- Create: `src/domain/asset_status/{types.ts,AssetStatusRepository.ts,index.ts}`
- Create: `src/infra/repositories/{inMemoryAssetStatusRepository.ts,firestoreAssetStatusRepository.ts}`
- Modify: `src/domain/index.ts`, `src/infra/repositories/index.ts`
- Test: `src/infra/repositories/inMemoryAssetStatusRepository.test.ts`

- [ ] **Step 1:** `src/domain/asset_status/types.ts`

```ts
export interface AssetStatus {
  id: string
  name: string
  color: string
  isFinal: boolean
  isSystem: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}
export interface AssetStatusListQuery { search?: string }

/** The four canonical system statuses (CONFIRMED v8). */
export const SYSTEM_STATUS_IDS = ['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'] as const
export function isSystemStatusId(v: string): boolean {
  return (SYSTEM_STATUS_IDS as readonly string[]).includes(v)
}
```

- [ ] **Step 2:** `AssetStatusRepository.ts` port — `list/get/isNameTaken/countReferences/create/update/delete`. `CreateAssetStatusInput { name; color; isFinal; sortOrder }` (created statuses are always `isSystem:false`). `UpdateAssetStatusInput { name?; color?; isFinal?; sortOrder? }`. `countReferences` = assets with this `statusId`. Doc comment: delete throws `SystemEntityProtectedError` for system docs and `EntityInUseError` when referenced; update of a system doc silently ignores `isFinal` changes (display fields only).

- [ ] **Step 3:** barrels.

- [ ] **Step 4: Write failing test** `inMemoryAssetStatusRepository.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { InMemoryAssetStatusRepository } from './inMemoryAssetStatusRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { SystemEntityProtectedError, EntityInUseError } from '@/domain/shared'
import type { AssetStatus } from '@/domain/asset_status'

const actor = { uid: 'u', role: 'super_admin' as const }
const seed = (): AssetStatus[] => [
  { id: 'st_warehouse', name: 'Warehouse', color: 'gray', isFinal: false, isSystem: true, sortOrder: 0, createdAt: 't', updatedAt: 't' },
  { id: 'st_disposed', name: 'Disposed', color: 'red', isFinal: true, isSystem: true, sortOrder: 3, createdAt: 't', updatedAt: 't' },
]

describe('InMemoryAssetStatusRepository', () => {
  it('refuses to delete a system status', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAssetStatusRepository(seed(), {}, inMemoryAuditContext(store))
    let caught: unknown
    try { await repo.deleteAssetStatus('st_warehouse', actor) } catch (e) { caught = e }
    expect(caught instanceof SystemEntityProtectedError).toBe(true)
    expect(store.logs.length).toBe(0)
  })
  it('does NOT change isFinal on a system status update (display fields only)', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAssetStatusRepository(seed(), {}, inMemoryAuditContext(store))
    const { value } = await repo.updateAssetStatus('st_warehouse', { name: 'Stock', isFinal: true }, actor)
    expect(value.name).toBe('Stock')
    expect(value.isFinal).toBe(false) // isFinal change ignored for system status
    expect(store.logs.length).toBe(1)
  })
  it('creates a non-system status (always isSystem:false) with one audit', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAssetStatusRepository(seed(), {}, inMemoryAuditContext(store))
    const { value } = await repo.createAssetStatus({ name: 'Lost', color: 'amber', isFinal: true, sortOrder: 4 }, actor)
    expect(value.isSystem).toBe(false)
    expect(store.logs.length).toBe(1)
    // a non-system status is deletable + editable freely
    await repo.deleteAssetStatus(value.id, actor)
    expect(store.logs.length).toBe(2)
  })
  it('blocks delete of a non-system status that is in use', async () => {
    const data = seed()
    const repo0 = new InMemoryAssetStatusRepository(data, {})
    const { value } = await repo0.createAssetStatus({ name: 'Lost', color: 'amber', isFinal: false, sortOrder: 4 }, actor)
    const repo = new InMemoryAssetStatusRepository(data, { assets: [{ statusId: value.id }] })
    let caught: unknown
    try { await repo.deleteAssetStatus(value.id, actor) } catch (e) { caught = e }
    expect(caught instanceof EntityInUseError).toBe(true)
  })
})
```

- [ ] **Step 5: Implement `inMemoryAssetStatusRepository.ts`** — refs `{ assets?: { statusId?: string }[] }`. `createAssetStatus` forces `isSystem:false`, id prefix `st_custom_` (NEVER collides with system ids). `updateAssetStatus`: load target; if `target.isSystem`, drop `isFinal` from the patch before applying (display-only). `deleteAssetStatus`: if `target.isSystem` throw `SystemEntityProtectedError`; else if `countReferences>0` throw `EntityInUseError`; else delete + audit. `listAssetStatuses` sorts by `sortOrder`.

- [ ] **Step 6: Implement `firestoreAssetStatusRepository.ts`** — `toAssetStatus` reads `name/color/isFinal/isSystem/sortOrder` (the live reference read currently only reads `name`+`color`; we add the rest). Same protection logic. `countReferences = anyWhere('assets','statusId',id)`.

- [ ] **Step 7: Export, run test, typecheck.**

- [ ] **Step 8: Commit**

```bash
git add src/domain/asset_status src/infra/repositories/*AssetStatus* src/domain/index.ts src/infra/repositories/index.ts
git commit -m "feat(statuses): asset-status domain + repos (system-protection, ref-guarded, withAudit)"
```

---

## Task 12: Asset Statuses page + form + i18n + route

**Files:**
- Create: `src/components/features/statuses/{AssetStatusFormDialog.tsx,index.ts}`
- Create: `src/pages/StatusesPage.tsx`
- Create: `src/locales/{ru,en,hy}/statuses.json`
- Modify: `src/lib/i18n/index.ts`, `src/pages/index.ts`, `src/config/routes.tsx`, `src/config/nav.ts`
- Test: `src/pages/StatusesPage.test.tsx`

Write gate: **super_admin only**. The page hides Delete for system rows (`canDeleteRow={s => !s.isSystem}`) and the form disables `isFinal` + shows a lock badge for system rows.

- [ ] **Step 1:** `statuses.json` (ru/en/hy) — keys: `title`, `create`, `empty.{title,desc}`, `filter.search`, `col.{name,color,final,system,order}`, `final.{yes,no}`, `systemBadge`, `form.{createTitle,editTitle,name,color,isFinal,sortOrder,systemLocked,save,cancel}`, `delete.{title,confirm,cancel,body,inUse,systemProtected}`, `validation.{required,nameTaken,saveFailed}`, `pagination.range`. `systemBadge` ru: "Системный". `form.systemLocked` ru: "Системный статус: можно изменить только название, цвет и порядок." Register namespace.

- [ ] **Step 2:** `AssetStatusFormDialog.tsx` — fields: name, color (select over a small token list: `gray|green|orange|red|amber|sky|indigo`), isFinal (checkbox — **disabled when `initial.isSystem`**), sortOrder (number). When `initial?.isSystem`, render the `form.systemLocked` hint + a "Системный" badge.

- [ ] **Step 3: Write failing test** `StatusesPage.test.tsx` — seed system + one custom status; assert system row has NO delete button and custom row DOES; assert editing a system row disables the isFinal checkbox; assert create works. Mock `useAuth` super_admin.

- [ ] **Step 4:** Implement `StatusesPage.tsx` — columns: name, color (a Chip using the color token), final (yes/no), system (badge when isSystem). `canDeleteRow={s => !s.isSystem}`. Icon `circle-dot`. Map repo errors: `SystemEntityProtectedError` → `delete.systemProtected`; `EntityInUseError` → `delete.inUse`. `canMutate = role === 'super_admin'`.

- [ ] **Step 5:** Wire route `/statuses`, export, remove `'statuses'` from `PHASE_STUB_ROUTES`.

- [ ] **Step 6: Run tests + full suite + typecheck.**

- [ ] **Step 7: Commit**

```bash
git add src/components/features/statuses src/pages/Statuses* src/locales/*/statuses.json src/lib/i18n/index.ts src/pages/index.ts src/config/routes.tsx src/config/nav.ts
git commit -m "feat(statuses): asset-statuses CRUD page + route (system-protection UI, super-only)"
```

---

## Task 13: Firestore rules — asset_status system-protection + rules tests

**Files:**
- Modify: `firestore.rules` (the `/asset_statuses/{id}` block)
- Create: `tests/rules/asset_statuses.rules.test.ts` (CI-only; Java emulator unavailable locally — authored + committed, not run here)

- [ ] **Step 1: Read** the existing harness `tests/rules/helpers.ts` and `tests/rules/firestore.rules.test.ts`. Reuse `makeTestEnv`, `authedDb`, `unauthedDb`, `seedUser`, `seedDoc`. The `test:rules` npm script already exists and `vitest run` already excludes `tests/rules/**` — no config change needed.

- [ ] **Step 2: Replace** the `/asset_statuses/{id}` block in `firestore.rules` with system-protection:

```
    match /asset_statuses/{id} {
      allow read: if isSignedIn();
      // create: super only; new docs must be non-system (clients cannot mint system statuses)
      allow create: if isSuperAdmin()
        && (!('isSystem' in request.resource.data) || request.resource.data.isSystem == false);
      // update: super only; for a system doc, isSystem must stay true AND isFinal must not change
      allow update: if isSuperAdmin()
        && (
          resource.data.isSystem != true
          || (
            request.resource.data.isSystem == true
            && request.resource.data.isFinal == resource.data.isFinal
          )
        );
      // delete: super only AND never a system doc
      allow delete: if isSuperAdmin() && resource.data.isSystem != true;
    }
```

> Rationale: defense-in-depth mirror of the repository guard. A super_admin client cannot delete a system status, cannot flip a system status's `isSystem`/`isFinal`, and cannot create a doc claiming `isSystem:true`. Display fields (name/color/sortOrder) on system docs remain editable.

- [ ] **Step 3: Author** `tests/rules/asset_statuses.rules.test.ts` (CI) covering: super can create non-system; super CANNOT create `isSystem:true`; super CANNOT delete a system doc; super CAN delete a non-system doc; super CANNOT flip `isFinal` on a system doc; super CAN change `name`/`color` on a system doc; non-super CANNOT write; any signed-in CAN read. Use `makeTestEnv`/`authedDb`/`seedUser`/`seedDoc` exactly as `tests/rules/firestore.rules.test.ts` does (`assertFails`/`assertSucceeds` from `@firebase/rules-unit-testing`).

- [ ] **Step 4: Verify** the rest of rules unaffected — `branches`/`departments`/`categories` blocks already correct (no change needed). Confirm by re-reading the file.

- [ ] **Step 5: Typecheck** — `npm run -s typecheck`. (Rules tests are TS; they compile under the existing config.) Do NOT run `npm run test:rules` (no local JVM emulator).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/asset_statuses.rules.test.ts
git commit -m "feat(rules): asset_status system-protection guards + rules tests (CI)"
```

---

## Task 14: Final verification + de-stub audit

**Files:** none (verification only)

- [ ] **Step 1:** Confirm `PHASE_STUB_ROUTES` no longer contains `branches`, `departments`, `categories`, `statuses` (only `assignments, repairs, parts, roles, audit, settings, licenses` remain).

- [ ] **Step 2:** Confirm nav renders the four catalog items for the right roles (they already exist in `ADMIN_NAV`; no change). The `routes.test.tsx`/`nav.test.ts` may assert stub membership — update those assertions if they hard-code the four ids as stubs.

- [ ] **Step 3:** Full verification:

```bash
npm test -- --run
npm run -s typecheck
npm run -s build
```

Expected: all tests pass (≥ 229 baseline + new), typecheck clean, build green.

- [ ] **Step 4:** Paste last 10 lines of each into the delivery report.

- [ ] **Step 5: Commit** any test-assertion fixes from Step 2.

```bash
git add -A
git commit -m "test(catalogs): update stub-route assertions; final verification"
```

---

## Self-review notes

- **Spec coverage:** Branch/Dept/Category/Status each get domain (T2,7,9,11) + InMemory+Firestore (T3,4,7,9,11) + page (T6,8,10,12). Referential integrity = `countReferences` + `EntityInUseError` (all). System-status invariant = T11 repo + T12 UI + T13 rules. Prefix-lock = T9 repo + T10 UI. Audit per-mutation = withAudit everywhere, asserted in InMemory tests. i18n ru/en/hy = T5,8,10,12. Role gates = page `canMutate` + existing rules. De-stub = T6,8,10,12 + audit T14.
- **Type consistency:** repo method names are `<verb><Entity>` (createBranch, updateDepartment, deleteCategory, deleteAssetStatus); ports all expose `countReferences`/`isNameTaken`; errors are `EntityInUseError`/`SystemEntityProtectedError`/`PrefixLockedError` from `@/domain/shared`. `Actor` imported from `@/domain/asset`. `AuditedResult` from `@/domain/audit`.
- **Placeholder scan:** none — every step has concrete code or concrete commands. The en/hy locale VALUES are specified inline in T5 and described key-for-key in T8/10/12 (the i18n-engineer fills exact strings from the listed key set + the ru reference).
- **Primitive-API caveat:** several UI steps say "verify prop X against the primitive file" — this is deliberate (the plan author hasn't read every primitive). The implementer reads `src/components/ui/*` and adapts. This is guidance, not a placeholder.
