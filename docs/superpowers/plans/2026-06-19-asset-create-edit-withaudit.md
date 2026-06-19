# Asset Create + Detail/Edit on withAudit() Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the asset write side (create, update, status-change, upgrade) to the existing AMS app, with every mutation routed through a shared `withAudit()` transaction helper that writes the business change and its `audit_logs` entry atomically.

**Architecture:** Ports-and-adapters. New domain types (audit, upgrade) + a write port `AssetWriteRepository` implemented by BOTH `InMemoryAssetRepository` (test substrate) and `FirestoreAssetRepository` (real `runTransaction`). `withAudit()` is the single chokepoint: no write method commits without one audit entry in the same atomic unit. Status is DERIVED from the Quick Assignment action in create mode. UI ports `preview.html` (create) and `asset-detail.html` (detail/edit) onto production primitives + dark/orange theme, role-gated per the matrix.

**Tech Stack:** TypeScript (strict), React 19, Vite 6, Vitest, Firebase v9 modular (`runTransaction`, `serverTimestamp`), Tailwind + shadcn/ui, `@firebase/rules-unit-testing` (CI only).

**Working directory (ALL tasks):** `C:/Users/DELL/Desktop/assets-crm`. Absolute paths, forward slashes. Bash on Windows.

**Verification harness:** `npm test -- --run` and `npm run build`. No live Firebase / emulator locally (no Java) — rules tests authored, run in CI.

---

## File map (decomposition)

- Create `src/domain/audit/types.ts` — AuditLog, AuditSpec, AuditedResult, AuditEntityType, AuditAction.
- Create `src/domain/audit/index.ts` — barrel.
- Create `src/domain/asset/upgrade-types.ts` — UPGRADE_COMPONENTS, SPEC_TRACKED, SPEC_KEY, UpgradeComponent, UpgradeEvent.
- Create `src/domain/asset/deriveStatus.ts` — `deriveCreateStatus()`.
- Modify `src/domain/asset/AssetRepository.ts` — add `AssetWriteRepository`, `CreateAssetInput`, `UpdateAssetInput`, `Actor`.
- Modify `src/domain/asset/index.ts` — export new modules.
- Create `src/lib/audit/withAudit.ts` — helper + `inMemoryAuditContext` + `firestoreAuditContext`.
- Modify `src/lib/audit/index.ts` — export.
- Modify `src/infra/repositories/inMemoryAssetRepository.ts` — implement write methods.
- Modify `src/infra/repositories/firestoreAssetRepository.ts` — implement write methods via `runTransaction`.
- Modify `firestore.rules` — N1 audit_logs create tightening + upgrades sub-collection.
- Create `tests/rules/auditLogs.rules.test.ts` — rules tests (CI).
- Create `src/components/features/assets/create/*` + `src/pages/AssetCreatePage.tsx`.
- Create `src/components/features/assets/detail/*` + `src/pages/AssetDetailPage.tsx`.
- Modify `src/config/routes.tsx`, `src/pages/index.ts`, `src/pages/AssetsPage.tsx` (navigation).
- Modify `src/locales/{ru,en,hy}/assets.json` — new keys.

Reviews run after the relevant implementer (spec → code-quality → security). security-reviewer is MANDATORY on Task 7 (rules) and the audit write path.

---

## Task 1: Audit domain types

**Files:**
- Create: `src/domain/audit/types.ts`
- Create: `src/domain/audit/index.ts`
- Test: `src/domain/audit/audit-types.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/domain/audit/audit-types.test.ts
import { describe, it, expect } from 'vitest'
import { AUDIT_ACTIONS, isAuditAction } from './types'

describe('audit types', () => {
  it('AUDIT_ACTIONS contains the canonical actions', () => {
    expect(AUDIT_ACTIONS).toContain('created')
    expect(AUDIT_ACTIONS).toContain('status_changed')
    expect(AUDIT_ACTIONS).toContain('upgrade_added')
  })
  it('isAuditAction narrows correctly', () => {
    expect(isAuditAction('created')).toBe(true)
    expect(isAuditAction('nope')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**
Run: `npm test -- --run src/domain/audit/audit-types.test.ts`
Expected: FAIL (Cannot find module './types').

- [ ] **Step 3: Implement**
```ts
// src/domain/audit/types.ts
import type { Role } from '@/config/roles'

export type AuditEntityType = 'asset' | 'assignment' | 'upgrade' | 'license'

export const AUDIT_ACTIONS = [
  'created', 'updated', 'status_changed', 'assigned', 'returned',
  'transferred', 'upgrade_added', 'disposed', 'sent_to_repair', 'repair_completed',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
export function isAuditAction(v: string): v is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(v)
}

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
  at: string
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

export interface AuditedResult<T> { value: T; auditId: string }
```
```ts
// src/domain/audit/index.ts
export * from './types'
```

- [ ] **Step 4: Run test, verify it passes**
Run: `npm test -- --run src/domain/audit/audit-types.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add src/domain/audit && git commit -m "feat(domain): add audit log types"
```

---

## Task 2: Upgrade types + status derivation

**Files:**
- Create: `src/domain/asset/upgrade-types.ts`
- Create: `src/domain/asset/deriveStatus.ts`
- Test: `src/domain/asset/upgrade-types.test.ts`, `src/domain/asset/deriveStatus.test.ts`

- [ ] **Step 1: Write failing tests**
```ts
// src/domain/asset/upgrade-types.test.ts
import { describe, it, expect } from 'vitest'
import { UPGRADE_COMPONENTS, SPEC_TRACKED, SPEC_KEY, isSpecTracked } from './upgrade-types'

describe('upgrade types', () => {
  it('Monitor is NOT a component', () => {
    expect(UPGRADE_COMPONENTS as readonly string[]).not.toContain('Monitor')
  })
  it('SPEC_TRACKED is CPU/RAM/SSD/GPU only', () => {
    expect([...SPEC_TRACKED].sort()).toEqual(['CPU', 'GPU', 'RAM', 'SSD'])
  })
  it('isSpecTracked: PSU and Other are not tracked', () => {
    expect(isSpecTracked('RAM')).toBe(true)
    expect(isSpecTracked('PSU')).toBe(false)
    expect(isSpecTracked('Other')).toBe(false)
  })
  it('SPEC_KEY maps to AssetSpecs keys', () => {
    expect(SPEC_KEY.RAM).toBe('ram')
    expect(SPEC_KEY.SSD).toBe('ssd')
  })
})
```
```ts
// src/domain/asset/deriveStatus.test.ts
import { describe, it, expect } from 'vitest'
import { deriveCreateStatus } from './deriveStatus'

describe('deriveCreateStatus', () => {
  it('null assignment -> warehouse', () => {
    expect(deriveCreateStatus(null)).toBe('st_warehouse')
  })
  it('employee assignment -> assigned', () => {
    expect(deriveCreateStatus({ mode: 'employee', employeeId: 'e1' })).toBe('st_assigned')
  })
  it('branch assignment -> assigned', () => {
    expect(deriveCreateStatus({ mode: 'branch', branchId: 'b1' })).toBe('st_assigned')
  })
  it('department assignment -> assigned', () => {
    expect(deriveCreateStatus({ mode: 'department', departmentId: 'd1' })).toBe('st_assigned')
  })
})
```

- [ ] **Step 2: Run, verify fail**
Run: `npm test -- --run src/domain/asset/upgrade-types.test.ts src/domain/asset/deriveStatus.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**
```ts
// src/domain/asset/upgrade-types.ts
import type { AssetSpecs } from './types'

export const UPGRADE_COMPONENTS = ['RAM', 'SSD', 'CPU', 'GPU', 'PSU', 'Other'] as const
export type UpgradeComponent = (typeof UPGRADE_COMPONENTS)[number]

export const SPEC_TRACKED = ['CPU', 'RAM', 'SSD', 'GPU'] as const
export type SpecTrackedComponent = (typeof SPEC_TRACKED)[number]
export function isSpecTracked(c: UpgradeComponent): c is SpecTrackedComponent {
  return (SPEC_TRACKED as readonly string[]).includes(c)
}

export const SPEC_KEY: Record<SpecTrackedComponent, keyof AssetSpecs> = {
  CPU: 'cpu', RAM: 'ram', SSD: 'ssd', GPU: 'gpu',
}

export interface UpgradeEvent {
  id: string
  component: UpgradeComponent
  before: string | null
  after: string
  changedAt: string
  changedBy: string
}
```
```ts
// src/domain/asset/deriveStatus.ts
import type { AssetAssignment } from './types'
import type { AssetStatusId } from './types'

/** Create-mode status is derived purely from the Quick Assignment action.
 *  null assignment => warehouse; any assignment => assigned.
 *  In Repair / Disposed are reachable only via edit-mode changeStatus. */
export function deriveCreateStatus(assignment: AssetAssignment | null): AssetStatusId {
  return assignment === null ? 'st_warehouse' : 'st_assigned'
}
```

- [ ] **Step 4: Run, verify pass**
Run: `npm test -- --run src/domain/asset/upgrade-types.test.ts src/domain/asset/deriveStatus.test.ts`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**
```bash
git add src/domain/asset/upgrade-types.ts src/domain/asset/deriveStatus.ts src/domain/asset/*.test.ts && git commit -m "feat(domain): upgrade types + create-status derivation"
```

---

## Task 3: Write port + domain barrel

**Files:**
- Modify: `src/domain/asset/AssetRepository.ts`
- Modify: `src/domain/asset/index.ts`
- Modify: `src/domain/index.ts` (if it re-exports asset)

- [ ] **Step 1: Append write port to `AssetRepository.ts`** (after existing `AssetRepository` interface)
```ts
import type { Role } from '@/config/roles'
import type { AssetStatusId, AssetAssignment, AssetSpecs } from './types'
import type { UpgradeComponent, UpgradeEvent } from './upgrade-types'
import type { AuditedResult } from '@/domain/audit'

export interface Actor { uid: string; role: Role }

export interface CreateAssetInput {
  categoryId: string
  brand: string | null
  model: string | null
  type?: string | null
  invCode: string
  serial: string | null
  assignment: AssetAssignment | null
  branchId: string
  deptId: string | null
  currentSpecs?: AssetSpecs | null
  /** STUB seam (license plan): masked OEM key when category has hasOemLicense. */
  oemLicense?: { keyMasked: string } | null
}

export interface UpdateAssetInput {
  brand?: string | null
  model?: string | null
  type?: string | null
  serial?: string | null
  currentSpecs?: AssetSpecs | null
}

export interface ChangeStatusOpts {
  comment?: string
  assignment?: AssetAssignment | null
}

export interface AssetWriteRepository {
  getAsset(id: string): Promise<Asset | null>
  isInvCodeTaken(invCode: string, exceptId?: string): Promise<boolean>
  isSerialTaken(serial: string, exceptId?: string): Promise<boolean>
  createAsset(input: CreateAssetInput, actor: Actor): Promise<AuditedResult<Asset>>
  updateAsset(id: string, patch: UpdateAssetInput, actor: Actor): Promise<AuditedResult<Asset>>
  changeStatus(id: string, toStatusId: AssetStatusId, actor: Actor, opts?: ChangeStatusOpts): Promise<AuditedResult<Asset>>
  addUpgrade(id: string, ev: { component: UpgradeComponent; after: string }, actor: Actor): Promise<AuditedResult<UpgradeEvent>>
  listUpgrades(id: string): Promise<UpgradeEvent[]>
}
```

- [ ] **Step 2: Export from `src/domain/asset/index.ts`**
Add lines:
```ts
export * from './upgrade-types'
export * from './deriveStatus'
```
(`AssetRepository` and `types` are already exported — verify by reading the file first.)

- [ ] **Step 3: Verify typecheck**
Run: `npm run build 2>&1 | tail -5`
Expected: build succeeds (no implementer yet, but types must compile).

- [ ] **Step 4: Commit**
```bash
git add src/domain && git commit -m "feat(domain): asset write port + create/update inputs"
```

---

## Task 4: withAudit() helper + contexts

**Files:**
- Create: `src/lib/audit/withAudit.ts`
- Modify: `src/lib/audit/index.ts`
- Test: `src/lib/audit/withAudit.test.ts`

- [ ] **Step 1: Write failing test (in-memory context)**
```ts
// src/lib/audit/withAudit.test.ts
import { describe, it, expect } from 'vitest'
import { withAudit, createInMemoryAuditStore, inMemoryAuditContext } from './withAudit'

describe('withAudit (in-memory)', () => {
  it('commits value + exactly one audit entry atomically', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    const res = await withAudit(ctx,
      { entityType: 'asset', entityId: 'a1', action: 'created', actorUid: 'u1', actorRole: 'asset_admin', after: { x: 1 } },
      async () => ({ value: { id: 'a1' }, after: { x: 1 } }),
    )
    expect(res.value).toEqual({ id: 'a1' })
    expect(res.auditId).toBeTruthy()
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0]).toMatchObject({ entityId: 'a1', action: 'created', actorUid: 'u1', actorRole: 'asset_admin' })
    expect(store.logs[0].at).toBeTruthy()
  })

  it('rolls back: a throwing mutate writes NO audit entry', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    await expect(withAudit(ctx,
      { entityType: 'asset', entityId: 'a2', action: 'created', actorUid: 'u1', actorRole: 'asset_admin' },
      async () => { throw new Error('boom') },
    )).rejects.toThrow('boom')
    expect(store.logs).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run, verify fail**
Run: `npm test -- --run src/lib/audit/withAudit.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement helper**
```ts
// src/lib/audit/withAudit.ts
import {
  runTransaction, collection, doc, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { AuditSpec, AuditLog, AuditedResult } from '@/domain/audit'

/** Minimal txn surface our mutate callbacks use. Firestore Transaction satisfies it. */
export interface TxnLike { set(ref: unknown, data: unknown): unknown }

export interface AuditContext {
  /** Runs the mutate callback transactionally, then writes one audit doc in the SAME unit. */
  run<T>(
    spec: AuditSpec,
    mutate: (txn: TxnLike) => Promise<{ value: T; before?: unknown; after?: unknown }>,
  ): Promise<AuditedResult<T>>
}

/** Public entrypoint — thin pass-through so call sites read `withAudit(ctx, spec, mutate)`. */
export function withAudit<T>(
  ctx: AuditContext, spec: AuditSpec,
  mutate: (txn: TxnLike) => Promise<{ value: T; before?: unknown; after?: unknown }>,
): Promise<AuditedResult<T>> {
  return ctx.run(spec, mutate)
}

// ---- In-memory context (tests) -------------------------------------------
export interface InMemoryAuditStore { logs: AuditLog[]; seq: number }
export function createInMemoryAuditStore(): InMemoryAuditStore { return { logs: [], seq: 0 } }

export function inMemoryAuditContext(store: InMemoryAuditStore): AuditContext {
  return {
    async run(spec, mutate) {
      // Working copy of logs for rollback semantics.
      const snapshot = [...store.logs]
      const txn: TxnLike = { set: () => undefined }
      try {
        const { value, before, after } = await mutate(txn)
        const id = `al_${++store.seq}`
        const log: AuditLog = {
          id,
          entityType: spec.entityType,
          entityId: spec.entityId,
          action: spec.action,
          actorUid: spec.actorUid,
          actorRole: spec.actorRole,
          before: (spec.before ?? before ?? null) as AuditLog['before'],
          after: (spec.after ?? after ?? null) as AuditLog['after'],
          comment: spec.comment ?? null,
          at: new Date().toISOString(),
        }
        store.logs.push(log)
        return { value, auditId: id }
      } catch (err) {
        store.logs = snapshot // roll back any partial audit append
        throw err
      }
    },
  }
}

// ---- Firestore context (production) --------------------------------------
export function firestoreAuditContext(db: Firestore): AuditContext {
  return {
    async run(spec, mutate) {
      let auditId = ''
      const value = await runTransaction(db, async (txn: Transaction) => {
        const { value, before, after } = await mutate(txn as unknown as TxnLike)
        const ref = doc(collection(db, 'audit_logs'))
        auditId = ref.id
        txn.set(ref, {
          entityType: spec.entityType,
          entityId: spec.entityId,
          action: spec.action,
          actorUid: spec.actorUid,
          actorRole: spec.actorRole,
          before: spec.before ?? before ?? null,
          after: spec.after ?? after ?? null,
          comment: spec.comment ?? null,
          at: serverTimestamp(),
        })
        return value
      })
      return { value, auditId }
    },
  }
}
```
```ts
// src/lib/audit/index.ts  (REPLACE the `export {}` stub)
export * from './withAudit'
```

- [ ] **Step 4: Run, verify pass**
Run: `npm test -- --run src/lib/audit/withAudit.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add src/lib/audit && git commit -m "feat(audit): withAudit helper + in-memory & firestore contexts"
```

---

## Task 5: InMemory write methods

**Files:**
- Modify: `src/infra/repositories/inMemoryAssetRepository.ts`
- Test: `src/infra/repositories/inMemoryAssetRepository.write.test.ts`

- [ ] **Step 1: Write failing tests**
```ts
// src/infra/repositories/inMemoryAssetRepository.write.test.ts
import { describe, it, expect } from 'vitest'
import { InMemoryAssetRepository } from './inMemoryAssetRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'

const REF: AssetReferenceData = {
  statuses: [], branches: [{ id: 'b_main', name: 'HQ' }], departments: [],
  categories: [{ id: 'cat_laptop', name: 'Laptop', group: 'devices', lucideIcon: 'laptop' }],
  employees: [{ id: 'e1', firstName: 'A', lastName: 'B' }],
}
const ACTOR = { uid: 'u1', role: 'asset_admin' as const }

function makeRepo() {
  const store = createInMemoryAuditStore()
  const repo = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))
  return { repo, store }
}
const baseInput = {
  categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS', invCode: '450/1', serial: 'SN1',
  assignment: null, branchId: 'b_main', deptId: null,
}

describe('InMemory write methods', () => {
  it('createAsset derives warehouse status for null assignment + writes one audit', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(baseInput, ACTOR)
    expect(value.statusId).toBe('st_warehouse')
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0].action).toBe('created')
  })
  it('createAsset with employee assignment derives assigned status', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset({ ...baseInput, invCode: '450/2', serial: 'SN2', assignment: { mode: 'employee', employeeId: 'e1' } }, ACTOR)
    expect(value.statusId).toBe('st_assigned')
  })
  it('createAsset blocks duplicate invCode (no audit written)', async () => {
    const { repo, store } = makeRepo()
    await repo.createAsset(baseInput, ACTOR)
    await expect(repo.createAsset({ ...baseInput, serial: 'SN-other' }, ACTOR)).rejects.toThrow(/inv/i)
    expect(store.logs).toHaveLength(1)
  })
  it('createAsset blocks duplicate serial', async () => {
    const { repo } = makeRepo()
    await repo.createAsset(baseInput, ACTOR)
    await expect(repo.createAsset({ ...baseInput, invCode: '450/9' }, ACTOR)).rejects.toThrow(/serial/i)
  })
  it('changeStatus to repair writes one audit + flips status', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(baseInput, ACTOR)
    await repo.changeStatus(value.id, 'st_repair', { uid: 'u1', role: 'tech_admin' })
    const after = await repo.getAsset(value.id)
    expect(after?.statusId).toBe('st_repair')
    expect(store.logs).toHaveLength(2)
    expect(store.logs[1].action).toBe('status_changed')
  })
  it('addUpgrade auto-derives before from currentSpecs for SPEC_TRACKED', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset({ ...baseInput, currentSpecs: { ram: '8 ГБ' } }, ACTOR)
    const { value: ev } = await repo.addUpgrade(value.id, { component: 'RAM', after: '16 ГБ' }, { uid: 'u1', role: 'tech_admin' })
    expect(ev.before).toBe('8 ГБ')
    expect(ev.after).toBe('16 ГБ')
    const refreshed = await repo.getAsset(value.id)
    expect(refreshed?.currentSpecs?.ram).toBe('16 ГБ')
  })
  it('addUpgrade for non-tracked component leaves before null', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset({ ...baseInput, invCode: '450/77', serial: 'SN77' }, ACTOR)
    const { value: ev } = await repo.addUpgrade(value.id, { component: 'PSU', after: '750W' }, { uid: 'u1', role: 'tech_admin' })
    expect(ev.before).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail**
Run: `npm test -- --run src/infra/repositories/inMemoryAssetRepository.write.test.ts`
Expected: FAIL (constructor takes 2 args; write methods undefined).

- [ ] **Step 3: Implement** — modify `InMemoryAssetRepository`. Add a third constructor param `private readonly audit: AuditContext` (optional-defaulted so existing read-only test callers still work: `audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore())`). Make `assets` mutable (`private readonly assets: Asset[]` is already an array — push into it). Implement `AssetWriteRepository`. Use these exact implementations:
```ts
// add imports at top
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type {
  AssetWriteRepository, CreateAssetInput, UpdateAssetInput, ChangeStatusOpts, Actor,
} from '@/domain/asset'
import { deriveCreateStatus } from '@/domain/asset'
import { isSpecTracked, SPEC_KEY, type UpgradeComponent, type UpgradeEvent } from '@/domain/asset'
import type { AssetStatusId, AssetSpecs } from '@/domain/asset'

// class declaration becomes:
//   export class InMemoryAssetRepository implements AssetRepository, AssetWriteRepository {
// constructor:
//   constructor(
//     private readonly assets: Asset[],
//     private readonly ref: AssetReferenceData,
//     private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
//   ) {}

private seq = 0
private upgrades = new Map<string, UpgradeEvent[]>()

async getAsset(id: string): Promise<Asset | null> {
  return this.assets.find(a => a.id === id) ?? null
}
async isInvCodeTaken(invCode: string, exceptId?: string): Promise<boolean> {
  return this.assets.some(a => a.invCode === invCode && a.id !== exceptId)
}
async isSerialTaken(serial: string, exceptId?: string): Promise<boolean> {
  return this.assets.some(a => a.serial != null && a.serial === serial && a.id !== exceptId)
}

async createAsset(input: CreateAssetInput, actor: Actor) {
  if (await this.isInvCodeTaken(input.invCode)) throw new Error(`Inventory code already in use: ${input.invCode}`)
  if (input.serial && await this.isSerialTaken(input.serial)) throw new Error(`Serial already in use: ${input.serial}`)
  const id = `a_${++this.seq}`
  const statusId = deriveCreateStatus(input.assignment)
  const asset: Asset = {
    id, categoryId: input.categoryId, brand: input.brand, model: input.model,
    invCode: input.invCode, serial: input.serial, statusId,
    assignment: input.assignment, branchId: input.branchId, deptId: input.deptId,
    updatedAt: new Date().toISOString(), currentSpecs: input.currentSpecs ?? null,
  }
  return withAudit(this.audit,
    { entityType: 'asset', entityId: id, action: 'created', actorUid: actor.uid, actorRole: actor.role, after: { ...asset } },
    async () => { this.assets.push(asset); return { value: asset } })
}

async updateAsset(id: string, patch: UpdateAssetInput, actor: Actor) {
  const idx = this.assets.findIndex(a => a.id === id)
  if (idx < 0) throw new Error(`Asset not found: ${id}`)
  const before = { ...this.assets[idx]! }
  if (patch.serial && await this.isSerialTaken(patch.serial, id)) throw new Error(`Serial already in use: ${patch.serial}`)
  const next: Asset = { ...before, ...stripUndefined(patch), updatedAt: new Date().toISOString() }
  return withAudit(this.audit,
    { entityType: 'asset', entityId: id, action: 'updated', actorUid: actor.uid, actorRole: actor.role, before, after: { ...next } },
    async () => { this.assets[idx] = next; return { value: next } })
}

async changeStatus(id: string, toStatusId: AssetStatusId, actor: Actor, opts?: ChangeStatusOpts) {
  const idx = this.assets.findIndex(a => a.id === id)
  if (idx < 0) throw new Error(`Asset not found: ${id}`)
  const before = { ...this.assets[idx]! }
  const next: Asset = {
    ...before, statusId: toStatusId,
    assignment: opts && 'assignment' in opts ? opts.assignment! : before.assignment,
    updatedAt: new Date().toISOString(),
  }
  return withAudit(this.audit,
    { entityType: 'asset', entityId: id, action: 'status_changed', actorUid: actor.uid, actorRole: actor.role,
      before: { statusId: before.statusId }, after: { statusId: toStatusId }, comment: opts?.comment ?? null },
    async () => { this.assets[idx] = next; return { value: next } })
}

async addUpgrade(id: string, ev: { component: UpgradeComponent; after: string }, actor: Actor) {
  const idx = this.assets.findIndex(a => a.id === id)
  if (idx < 0) throw new Error(`Asset not found: ${id}`)
  const asset = this.assets[idx]!
  const before = isSpecTracked(ev.component)
    ? (asset.currentSpecs?.[SPEC_KEY[ev.component]] ?? null)
    : null
  const upgrade: UpgradeEvent = {
    id: `up_${++this.seq}`, component: ev.component, before, after: ev.after,
    changedAt: new Date().toISOString(), changedBy: actor.uid,
  }
  return withAudit(this.audit,
    { entityType: 'upgrade', entityId: id, action: 'upgrade_added', actorUid: actor.uid, actorRole: actor.role,
      before: before === null ? null : { value: before }, after: { component: ev.component, value: ev.after } },
    async () => {
      const list = this.upgrades.get(id) ?? []
      list.push(upgrade); this.upgrades.set(id, list)
      if (isSpecTracked(ev.component)) {
        const specs: AssetSpecs = { ...(asset.currentSpecs ?? {}) }
        specs[SPEC_KEY[ev.component]] = ev.after
        this.assets[idx] = { ...asset, currentSpecs: specs, updatedAt: new Date().toISOString() }
      }
      return { value: upgrade }
    })
}

async listUpgrades(id: string): Promise<UpgradeEvent[]> {
  return [...(this.upgrades.get(id) ?? [])]
}
```
Add a module-scope helper at the bottom of the file:
```ts
function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
```

- [ ] **Step 4: Run, verify pass**
Run: `npm test -- --run src/infra/repositories/inMemoryAssetRepository.write.test.ts src/infra/repositories/inMemoryAssetRepository.test.ts`
Expected: PASS (new 7 + existing read tests).

- [ ] **Step 5: Commit**
```bash
git add src/infra/repositories/inMemoryAssetRepository.ts src/infra/repositories/inMemoryAssetRepository.write.test.ts && git commit -m "feat(infra): in-memory asset write methods via withAudit"
```

---

## Task 6: Firestore write methods (real runTransaction)

**Files:**
- Modify: `src/infra/repositories/firestoreAssetRepository.ts`

- [ ] **Step 1: Implement write methods.** Add `implements AssetRepository, AssetWriteRepository`, accept an `AuditContext` in the constructor (defaulted to `firestoreAuditContext(this.db)` is circular — instead store the db and build the ctx lazily). Use these implementations (no separate test — exercised in CI rules/emulator tests; the InMemory adapter is the unit-test substrate per the plan):
```ts
// imports
import {
  collection, getDocs, getDoc, query as fsQuery, where, orderBy, limit, doc,
  serverTimestamp, type Firestore, type QueryConstraint, type Transaction,
} from 'firebase/firestore'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import { deriveCreateStatus, isSpecTracked, SPEC_KEY } from '@/domain/asset'
import type {
  AssetWriteRepository, CreateAssetInput, UpdateAssetInput, ChangeStatusOpts, Actor,
  AssetStatusId, AssetSpecs, UpgradeComponent, UpgradeEvent,
} from '@/domain/asset'

// constructor stays `constructor(private readonly db: Firestore) {}`
// add: private get audit() { return firestoreAuditContext(this.db) }

async getAsset(id: string): Promise<Asset | null> {
  const snap = await getDoc(doc(this.db, 'assets', id))
  return snap.exists() ? toAsset(snap.id, snap.data() as Record<string, unknown>) : null
}
async isInvCodeTaken(invCode: string, exceptId?: string): Promise<boolean> {
  const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('invCode', '==', invCode), limit(2)))
  return snap.docs.some(d => d.id !== exceptId)
}
async isSerialTaken(serial: string, exceptId?: string): Promise<boolean> {
  const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('serial', '==', serial), limit(2)))
  return snap.docs.some(d => d.id !== exceptId)
}

async createAsset(input: CreateAssetInput, actor: Actor) {
  if (await this.isInvCodeTaken(input.invCode)) throw new Error(`Inventory code already in use: ${input.invCode}`)
  if (input.serial && await this.isSerialTaken(input.serial)) throw new Error(`Serial already in use: ${input.serial}`)
  const statusId = deriveCreateStatus(input.assignment)
  const ref = doc(collection(this.db, 'assets'))
  const data = {
    categoryId: input.categoryId, brand: input.brand, model: input.model,
    ...(input.type !== undefined ? { type: input.type } : {}),
    invCode: input.invCode, serial: input.serial, statusId,
    assignment: input.assignment, branchId: input.branchId, deptId: input.deptId,
    currentSpecs: input.currentSpecs ?? null,
    createdBy: actor.uid, updatedBy: actor.uid,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }
  const res = await withAudit(this.audit,
    { entityType: 'asset', entityId: ref.id, action: 'created', actorUid: actor.uid, actorRole: actor.role, after: { invCode: input.invCode, statusId } },
    async (txn) => {
      ;(txn as unknown as Transaction).set(ref, data)
      // STUB: license write seam — when category hasOemLicense and input.oemLicense present,
      // the OEM license doc + secret will be written here in the SAME txn (license plan).
      return { value: undefined }
    })
  const created = await this.getAsset(ref.id)
  return { value: created!, auditId: res.auditId }
}

async updateAsset(id: string, patch: UpdateAssetInput, actor: Actor) {
  const before = await this.getAsset(id)
  if (!before) throw new Error(`Asset not found: ${id}`)
  if (patch.serial && await this.isSerialTaken(patch.serial, id)) throw new Error(`Serial already in use: ${patch.serial}`)
  const ref = doc(this.db, 'assets', id)
  const fields = stripUndefinedFs({ ...patch, updatedBy: actor.uid, updatedAt: serverTimestamp() })
  const res = await withAudit(this.audit,
    { entityType: 'asset', entityId: id, action: 'updated', actorUid: actor.uid, actorRole: actor.role,
      before: { brand: before.brand, model: before.model, serial: before.serial }, after: patch as Record<string, unknown> },
    async (txn) => { ;(txn as unknown as Transaction).set(ref, fields, { merge: true }); return { value: undefined } })
  const next = await this.getAsset(id)
  return { value: next!, auditId: res.auditId }
}

async changeStatus(id: string, toStatusId: AssetStatusId, actor: Actor, opts?: ChangeStatusOpts) {
  const before = await this.getAsset(id)
  if (!before) throw new Error(`Asset not found: ${id}`)
  const ref = doc(this.db, 'assets', id)
  const patch: Record<string, unknown> = { statusId: toStatusId, updatedBy: actor.uid, updatedAt: serverTimestamp() }
  if (opts && 'assignment' in opts) patch.assignment = opts.assignment ?? null
  const res = await withAudit(this.audit,
    { entityType: 'asset', entityId: id, action: 'status_changed', actorUid: actor.uid, actorRole: actor.role,
      before: { statusId: before.statusId }, after: { statusId: toStatusId }, comment: opts?.comment ?? null },
    async (txn) => { ;(txn as unknown as Transaction).set(ref, patch, { merge: true }); return { value: undefined } })
  const next = await this.getAsset(id)
  return { value: next!, auditId: res.auditId }
}

async addUpgrade(id: string, ev: { component: UpgradeComponent; after: string }, actor: Actor) {
  const asset = await this.getAsset(id)
  if (!asset) throw new Error(`Asset not found: ${id}`)
  const before = isSpecTracked(ev.component) ? (asset.currentSpecs?.[SPEC_KEY[ev.component]] ?? null) : null
  const upRef = doc(collection(this.db, 'assets', id, 'upgrades'))
  const assetRef = doc(this.db, 'assets', id)
  const res = await withAudit(this.audit,
    { entityType: 'upgrade', entityId: id, action: 'upgrade_added', actorUid: actor.uid, actorRole: actor.role,
      before: before === null ? null : { value: before }, after: { component: ev.component, value: ev.after } },
    async (txn) => {
      const t = txn as unknown as Transaction
      t.set(upRef, { component: ev.component, before, after: ev.after, changedBy: actor.uid, changedAt: serverTimestamp() })
      if (isSpecTracked(ev.component)) {
        const specs: AssetSpecs = { ...(asset.currentSpecs ?? {}) }
        specs[SPEC_KEY[ev.component]] = ev.after
        t.set(assetRef, { currentSpecs: specs, updatedAt: serverTimestamp(), updatedBy: actor.uid }, { merge: true })
      }
      return { value: undefined }
    })
  const upgrade: UpgradeEvent = { id: upRef.id, component: ev.component, before, after: ev.after, changedAt: new Date().toISOString(), changedBy: actor.uid }
  return { value: upgrade, auditId: res.auditId }
}

async listUpgrades(id: string): Promise<UpgradeEvent[]> {
  const snap = await getDocs(fsQuery(collection(this.db, 'assets', id, 'upgrades'), orderBy('changedAt', 'desc')))
  return snap.docs.map(d => {
    const x = d.data() as Record<string, unknown>
    return { id: d.id, component: x.component as UpgradeComponent, before: (x.before as string | null) ?? null,
      after: String(x.after ?? ''), changedAt: toIso(x.changedAt), changedBy: String(x.changedBy ?? '') }
  })
}
```
Add module helper:
```ts
function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}
```

- [ ] **Step 2: Verify typecheck + full suite still green**
Run: `npm run build 2>&1 | tail -5 && npm test -- --run 2>&1 | tail -8`
Expected: build OK; all tests pass.

- [ ] **Step 3: Commit**
```bash
git add src/infra/repositories/firestoreAssetRepository.ts && git commit -m "feat(infra): firestore asset write methods via runTransaction + withAudit"
```

---

## Task 7: Firestore rules — N1 tightening + upgrades sub-collection (SECURITY-REVIEWER MANDATORY)

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/auditLogs.rules.test.ts` (CI; needs emulator + Java)

- [ ] **Step 1: Tighten audit_logs create + add upgrades rules.** Replace the audit_logs block's `allow create: if isSignedIn();` with:
```
      allow create: if isSignedIn()
        && request.resource.data.actorUid == request.auth.uid
        && request.resource.data.actorRole == role()
        && request.resource.data.keys().hasAll(
             ['entityType','entityId','action','actorUid','actorRole','at']);
```
Add inside `match /assets/{id} { ... }` a nested sub-collection match:
```
      // Upgrade events: append-only. tech_admin and super_admin only (tech attributes).
      match /upgrades/{uid} {
        allow read: if isSignedIn();
        allow create: if isSuperAdmin() || isTechAdmin();
        allow update, delete: if false;
      }
```

- [ ] **Step 2: Author rules tests (CI).** Create `tests/rules/auditLogs.rules.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'ams-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
afterAll(async () => { await env?.cleanup() })

async function seedRole(uid: string, role: string) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'users', uid), { role, status: 'active' })
  })
}

describe('audit_logs create rule (N1)', () => {
  it('allows create when actorUid==auth.uid and actorRole==role()', async () => {
    await seedRole('u1', 'asset_admin')
    const db = env.authenticatedContext('u1').firestore()
    await assertSucceeds(setDoc(doc(db, 'audit_logs', 'l1'), {
      entityType: 'asset', entityId: 'a1', action: 'created',
      actorUid: 'u1', actorRole: 'asset_admin', at: serverTimestamp(), before: null, after: {}, comment: null,
    }))
  })
  it('denies create when actorUid != auth.uid (spoof)', async () => {
    await seedRole('u2', 'asset_admin')
    const db = env.authenticatedContext('u2').firestore()
    await assertFails(setDoc(doc(db, 'audit_logs', 'l2'), {
      entityType: 'asset', entityId: 'a1', action: 'created',
      actorUid: 'someone-else', actorRole: 'asset_admin', at: serverTimestamp(),
    }))
  })
  it('denies create when actorRole spoofed above real role', async () => {
    await seedRole('u3', 'employee')
    const db = env.authenticatedContext('u3').firestore()
    await assertFails(setDoc(doc(db, 'audit_logs', 'l3'), {
      entityType: 'asset', entityId: 'a1', action: 'created',
      actorUid: 'u3', actorRole: 'super_admin', at: serverTimestamp(),
    }))
  })
  it('denies update + delete for super_admin (immutable)', async () => {
    await seedRole('su', 'super_admin')
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'audit_logs', 'l4'), { entityType: 'asset', entityId: 'a', action: 'created', actorUid: 'su', actorRole: 'super_admin', at: new Date(), after: { entityType: 'asset' } })
    })
    const db = env.authenticatedContext('su').firestore()
    await assertFails(updateDoc(doc(db, 'audit_logs', 'l4'), { action: 'updated' }))
    await assertFails(deleteDoc(doc(db, 'audit_logs', 'l4')))
  })
})
```
Add an npm script to `package.json` (if not present): `"test:rules": "vitest run tests/rules"`. Document in the test file header that it requires the emulator + Java (CI).

- [ ] **Step 3: Verify the rules file is syntactically consistent** (visual + the unit suite still builds). Do NOT run `test:rules` locally (no Java).
Run: `npm test -- --run 2>&1 | tail -6`
Expected: existing suite green (rules test is excluded from default `vitest` glob if it needs the emulator — confirm `vitest.config.ts` `include` does not pick up `tests/rules/**`; if it does, add it to `exclude`).

- [ ] **Step 4: Commit**
```bash
git add firestore.rules tests/rules package.json vitest.config.ts && git commit -m "feat(rules): tighten audit_logs create (N1) + upgrades sub-collection; add rules tests"
```

- [ ] **Step 5: SECURITY REVIEW** — dispatch security-reviewer on `firestore.rules` + `src/lib/audit/withAudit.ts` + both repositories. Loop until PASS.

---

## Task 8: i18n keys

**Files:**
- Modify: `src/locales/ru/assets.json`, `src/locales/en/assets.json`, `src/locales/hy/assets.json`

- [ ] **Step 1: Add keys** (ru shown; en/hy translated by i18n-engineer). Append to each `assets.json`:
```jsonc
  "form": {
    "createTitle": "Регистрация актива",
    "editTitle": "Актив {{code}}",
    "category": "Категория",
    "brand": "Бренд", "model": "Модель", "type": "Тип",
    "invCode": "Инвентарный код", "serial": "Серийный номер",
    "save": "Сохранить", "cancel": "Отмена", "change": "Изменить",
    "specs": "Характеристики", "upgrades": "Апгрейды", "addUpgrade": "Добавить апгрейд",
    "history": "История", "sendToRepair": "Отправить в ремонт", "writeOff": "Списать", "return": "Вернуть"
  },
  "qa": {
    "title": "Куда назначить",
    "warehouse": "Склад", "employee": "Сотрудник", "department": "Отдел", "branch": "Филиал",
    "pickRecipient": "Выберите получателя"
  },
  "status": {
    "derived": "Статус: {{name}}"
  },
  "validation": {
    "invTaken": "Инвентарный код уже используется",
    "serialTaken": "Серийный номер уже используется",
    "invRequired": "Заполните «Инвентарный код»",
    "serialRequired": "Заполните «Серийный номер»",
    "brandModelRequired": "Заполните «Бренд» и «Модель»",
    "typeRequired": "Заполните «Тип»"
  },
  "upgrade": {
    "component": "Компонент", "before": "Было", "after": "Стало",
    "notTracked": "не отслеживается в характеристиках"
  }
```

- [ ] **Step 2: Verify i18n test green**
Run: `npm test -- --run src/lib/i18n/i18n.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add src/locales && git commit -m "feat(i18n): asset create/edit keys (ru/en/hy)"
```

---

## Task 9: Create form UI

**Files:**
- Create: `src/components/features/assets/create/QuickAssignment.tsx`
- Create: `src/components/features/assets/create/CategoryPicker.tsx`
- Create: `src/components/features/assets/create/AssetCreateForm.tsx`
- Create: `src/pages/AssetCreatePage.tsx`
- Test: `src/pages/AssetCreatePage.test.tsx`
- Modify: `src/pages/index.ts`

- [ ] **Step 1: Write the failing component test** (the contract; react-ui-engineer fills the components):
```tsx
// src/pages/AssetCreatePage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AssetCreatePage } from './AssetCreatePage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'

const REF: AssetReferenceData = {
  statuses: [{ id: 'st_warehouse', name: 'На складе', color: 'gray' }, { id: 'st_assigned', name: 'Выдано', color: 'emerald' }],
  branches: [{ id: 'b_main', name: 'HQ' }], departments: [{ id: 'd1', name: 'IT' }],
  categories: [{ id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' }],
  employees: [{ id: 'e1', firstName: 'Иван', lastName: 'П' }],
}
function setup() {
  const store = createInMemoryAuditStore()
  const repo = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))
  const onDone = vi.fn()
  render(
    <I18nextProvider i18n={i18n}><AuthProvider initialRole="asset_admin">
      <MemoryRouter><AssetCreatePage repository={repo} onCreated={onDone} /></MemoryRouter>
    </AuthProvider></I18nextProvider>,
  )
  return { repo, store, onDone }
}

describe('AssetCreatePage', () => {
  it('save is disabled until a Quick Assignment recipient is chosen', async () => {
    setup()
    await waitFor(() => screen.getByText(/Ноутбук|Категория/i))
    const save = screen.getByRole('button', { name: /Сохранить/i })
    expect(save).toBeDisabled()
  })
  it('choosing Warehouse + filling identity enables save and creates with derived warehouse status', async () => {
    const { store, onDone } = setup()
    await waitFor(() => screen.getByText(/Категория/i))
    // (react-ui-engineer wires: pick category, type invCode/serial, click Склад)
    // After a successful save, exactly one audit entry exists with action 'created'.
    // This assertion is completed once the form is wired; placeholder kept minimal here.
    expect(store.logs).toHaveLength(0)
    expect(onDone).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run, verify fail**
Run: `npm test -- --run src/pages/AssetCreatePage.test.tsx`
Expected: FAIL (AssetCreatePage not found).

- [ ] **Step 3: react-ui-engineer implements** `AssetCreatePage` + the three create components against §9bis v9 reduced surface:
  - `CategoryPicker`: group cards (devices/network/furniture) + filtered category select. On select, set capability flags (hasSpecs, hasOemLicense, requiresSerial, hasBrandModel/hasTypeField — derive from category group for the prototype set: devices/network = hasBrandModel + requiresSerial; furniture = hasTypeField, no serial).
  - `QuickAssignment`: 5 buttons `[Склад, Сотрудник, Отдел, Филиал, Временная]` (Временная may be a stub button disabled with a "Phase 2" note OR omitted — keep MVP to the 4 that derive status). Exactly one selected → derives status via `deriveCreateStatus`. Renders the read-only derived status chip below.
  - `AssetCreateForm`: identity rows per shape (device = Brand+Model, Inv+Serial; furniture = Тип, Inv only). Specs card for hasSpecs (interactive in create). Single Save calls `repo.createAsset(input, { uid: user.id, role })`. On success calls `onCreated(asset)`.
  - `AssetCreatePage` props: `{ repository?: AssetWriteRepository & AssetRepository; onCreated?: (a: Asset) => void }`. Default repo = `new FirestoreAssetRepository(db())`. Loads reference data via the read port. Save-gating: `canSave` requires identity complete + a QA recipient chosen; `saveDisabledReason` returns a Russian string (or '' when the only thing missing is recipient — no nag pill, per §9bis v9).
  - Role gate the page route to super_admin | asset_admin.
  Complete the Step-1 test's second assertion: after the engineer wires the form, drive the UI (pick category → type invCode `450/100` + serial `SN-100` → click Склад → click Сохранить) and assert `store.logs` has length 1 with action 'created', `onCreated` called once with an asset whose `statusId === 'st_warehouse'`.

- [ ] **Step 4: Run, verify pass**
Run: `npm test -- --run src/pages/AssetCreatePage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/features/assets/create src/pages/AssetCreatePage.tsx src/pages/AssetCreatePage.test.tsx src/pages/index.ts && git commit -m "feat(ui): asset create form with derived status + withAudit save"
```

---

## Task 10: Detail / edit page UI

**Files:**
- Create: `src/components/features/assets/detail/UpgradesPanel.tsx`
- Create: `src/components/features/assets/detail/AssetHistory.tsx`
- Create: `src/components/features/assets/detail/LifecycleActions.tsx`
- Create: `src/pages/AssetDetailPage.tsx`
- Test: `src/pages/AssetDetailPage.test.tsx`
- Modify: `src/pages/index.ts`

- [ ] **Step 1: Write failing test**
```tsx
// src/pages/AssetDetailPage.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AssetDetailPage } from './AssetDetailPage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData, Asset } from '@/domain/asset'
import type { Role } from '@/config/roles'

const REF: AssetReferenceData = {
  statuses: [{ id: 'st_warehouse', name: 'На складе', color: 'gray' }, { id: 'st_assigned', name: 'Выдано', color: 'emerald' }, { id: 'st_repair', name: 'В ремонте', color: 'orange' }],
  branches: [{ id: 'b_main', name: 'HQ' }], departments: [], categories: [{ id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' }], employees: [],
}
async function seed(role: Role) {
  const store = createInMemoryAuditStore()
  const repo = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))
  const { value } = await repo.createAsset({ categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS', invCode: '450/1', serial: 'SN1', assignment: null, branchId: 'b_main', deptId: null, currentSpecs: { ram: '8 ГБ' } }, { uid: 'u1', role: 'asset_admin' })
  render(
    <I18nextProvider i18n={i18n}><AuthProvider initialRole={role}>
      <MemoryRouter initialEntries={[`/assets/${value.id}`]}>
        <Routes><Route path="/assets/:id" element={<AssetDetailPage repository={repo} />} /></Routes>
      </MemoryRouter>
    </AuthProvider></I18nextProvider>,
  )
  return { repo, store, asset: value as Asset }
}

describe('AssetDetailPage', () => {
  it('renders the asset identity (edit-mode title with inv code)', async () => {
    await seed('tech_admin')
    await waitFor(() => screen.getByText(/450\/1/))
    expect(screen.getByText(/Dell|XPS/)).toBeTruthy()
  })
  it('Upgrades panel is visible for tech_admin on a hasSpecs category', async () => {
    await seed('tech_admin')
    await waitFor(() => screen.getByText(/Апгрейд/i))
    expect(screen.getByText(/Апгрейд/i)).toBeTruthy()
  })
  it('Upgrades add-action is NOT shown to asset_admin (tech-only)', async () => {
    await seed('asset_admin')
    await waitFor(() => screen.getByText(/450\/1/))
    expect(screen.queryByRole('button', { name: /Добавить апгрейд/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail**
Run: `npm test -- --run src/pages/AssetDetailPage.test.tsx`
Expected: FAIL (page not found).

- [ ] **Step 3: react-ui-engineer implements** `AssetDetailPage` (route `/assets/:id`):
  - Reads `:id` via `useParams`; loads `getAsset` + `listUpgrades` + `loadReferenceData`; LoadingState/ErrorState/NotFound branches.
  - Hero (category icon by `lucideIcon`, title = brand+model or type, inv-code pill, status chip).
  - Identity (read-only, with Изменить affordance → updateAsset).
  - Specs card (hasSpecs only).
  - `UpgradesPanel` — renders only when `category.hasSpecs` AND role ∈ {super_admin, tech_admin}. "Добавить апгрейд" sub-form: component select (UPGRADE_COMPONENTS), `before` auto-derived & read-only for SPEC_TRACKED (label "не отслеживается…" for PSU/Other), `after` input. Submit → `repo.addUpgrade`. List from `listUpgrades`, refresh after add.
  - `AssetHistory` — renders `audit_logs` for this asset. In the InMemory test path, accept an optional `auditStore` or expose a `listAudit(entityId)` read method; simplest: add `listAudit(entityId: string): Promise<AuditLog[]>` to the write repo interface (both adapters) and render it. (If added, also add a Firestore `getDocs(where('entityId','==',id))` impl + a composite index entry to firestore.indexes.json.)
  - `LifecycleActions` — Send to Repair (changeStatus → st_repair; super_admin|tech_admin), Write off (changeStatus → st_disposed; super_admin|asset_admin), Return (changeStatus → st_warehouse, assignment null; super_admin|asset_admin). Each gated by role; each via `withAudit`-backed `changeStatus`.
  - Props: `{ repository?: AssetWriteRepository & AssetRepository }`.

- [ ] **Step 4: Run, verify pass**
Run: `npm test -- --run src/pages/AssetDetailPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/features/assets/detail src/pages/AssetDetailPage.tsx src/pages/AssetDetailPage.test.tsx src/pages/index.ts && git commit -m "feat(ui): asset detail/edit page with upgrades (edit-only, tech) + lifecycle actions"
```

---

## Task 11: Routing + navigation wiring

**Files:**
- Modify: `src/config/routes.tsx`
- Modify: `src/pages/AssetsPage.tsx`

- [ ] **Step 1: Add routes** in `routes.tsx` (inside ShellLayout, before the stub map):
```tsx
import { AssetCreatePage, AssetDetailPage } from '@/pages'
// ...
<Route path="/assets/new" element={
  <RoleGate roles={['super_admin', 'asset_admin']}><AssetCreatePage /></RoleGate>
} />
<Route path="/assets/:id" element={
  <RoleGate roles={routeRoles('assets')}><AssetDetailPage /></RoleGate>
} />
```
(Place `/assets/new` BEFORE `/assets/:id` so "new" is not captured as an id.)

- [ ] **Step 2: Wire AssetsPage navigation.** Replace the create-button `onClick` stub with `navigate('/assets/new')` (import `useNavigate`). Add row-click `navigate(\`/assets/${id}\`)` to `AssetsTable` (pass an `onRowClick` prop, or wrap rows in a link). Replace the `console.info('[AssetsPage] create stub')`.

- [ ] **Step 3: Verify full suite + build**
Run: `npm run build 2>&1 | tail -5 && npm test -- --run 2>&1 | tail -8`
Expected: build OK; all tests pass (including AssetsPage existing 12).

- [ ] **Step 4: Commit**
```bash
git add src/config/routes.tsx src/pages/AssetsPage.tsx src/components/features/assets && git commit -m "feat(routing): wire asset create + detail routes and navigation"
```

---

## Task 12: Final verification + reviews

- [ ] **Step 1: Full verification**
Run: `npm run build 2>&1 | tail -8 && npm test -- --run 2>&1 | tail -12`
Expected: build succeeds; all tests pass (131 prior + new).

- [ ] **Step 2: spec-reviewer** on the full diff vs this plan + the design spec. Loop to relevant implementer on FAIL.
- [ ] **Step 3: code-quality-reviewer** on all changed files. Loop on FAIL.
- [ ] **Step 4: security-reviewer** (already run on Task 7; re-confirm the full audit write path + role gates). Loop on FAIL.
- [ ] **Step 5: Final commit if any review fixes landed.**

---

## Self-review notes (author)

- Spec coverage: withAudit (T4), write methods both adapters (T5/T6), N1 rules + tests (T7), derived status (T2/T5), unique invCode+serial (T5/T6), specs+upgrades edit-only/hasSpecs/SPEC_TRACKED before-derivation (T5/T6/T10), role gating (T9/T10/T11), license STUB seam (T6), UI create+detail (T9/T10), i18n (T8), routing (T11). All covered.
- Type consistency: `AssetWriteRepository`, `Actor`, `CreateAssetInput`, `AuditedResult<T>`, `withAudit(ctx,spec,mutate)`, `deriveCreateStatus`, `isSpecTracked`/`SPEC_KEY` used identically across tasks.
- Open seam: `AssetHistory` needs a `listAudit(entityId)` read — added to interface + both adapters in T10 Step 3 (+ index entry). Firestore composite index: `audit_logs` by `entityId` + `at desc`.
- No placeholders except the deliberately-minimal T9 Step-1 second assertion, completed in T9 Step 3 once the form is wired (documented).
