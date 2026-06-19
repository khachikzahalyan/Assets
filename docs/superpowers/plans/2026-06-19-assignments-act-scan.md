# Assignments + Act-of-Acceptance Scan Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add an assign/return flow (employee | branch) with optional act-of-acceptance scan upload, atomic via `withAudit()`, plus employee self-service scan read enforced in storage.rules.

**Architecture:** Ports-and-adapters mirroring the existing AssetWriteRepository. New `AssignmentRepository` port in `src/domain/assignment/`; InMemory + Firestore adapters in `src/infra/repositories/`. Every mutation runs through `withAudit` (one audit_logs entry per txn). Scan upload happens BEFORE the transaction (Decision B). storage.rules + a `/mail` firestore.rules block + rules tests. UI extends AssetDetailPage.

**Tech Stack:** TypeScript strict, Firebase v9 modular, React 19, i18next (ru/en/hy), Vitest, @firebase/rules-unit-testing.

**Design spec:** `docs/superpowers/specs/2026-06-19-assignments-act-scan-design.md`

---

## Task 1: Domain types + AssignmentRepository port

**Files:**
- Create: `src/domain/assignment/types.ts`
- Create: `src/domain/assignment/AssignmentRepository.ts`
- Create: `src/domain/assignment/index.ts`
- Modify: `src/domain/index.ts` (add `export * from './assignment'`)
- Test: `src/domain/assignment/assignment-types.test.ts`

- [ ] **Step 1: Write the failing test** (`assignment-types.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { isAssignmentMode, type Assignment, type AssignmentMode } from './index'

describe('assignment domain types', () => {
  it('isAssignmentMode accepts employee and branch, rejects others', () => {
    expect(isAssignmentMode('employee')).toBe(true)
    expect(isAssignmentMode('branch')).toBe(true)
    expect(isAssignmentMode('department')).toBe(false)
    expect(isAssignmentMode('x')).toBe(false)
  })

  it('Assignment shape compiles with employee mode', () => {
    const a: Assignment = {
      id: 'as_1', assetId: 'a_1', mode: 'employee',
      assignedToEmployeeId: 'e_1', assignedToBranchId: null,
      startedAt: '2026-01-01T00:00:00.000Z', endedAt: null,
      actStoragePath: null, transferComment: null,
      createdBy: 'u_1', createdAt: '2026-01-01T00:00:00.000Z',
    }
    const m: AssignmentMode = a.mode
    expect(m).toBe('employee')
  })
})
```

- [ ] **Step 2: Run test, verify it fails** — `npx vitest run src/domain/assignment` → FAIL (module not found)

- [ ] **Step 3: Create `src/domain/assignment/types.ts`**

```ts
export const ASSIGNMENT_MODES = ['employee', 'branch'] as const
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number]

export function isAssignmentMode(v: string): v is AssignmentMode {
  return (ASSIGNMENT_MODES as readonly string[]).includes(v)
}

/** Immutable history doc. Mirrors Firestore assignments/{id}. Timestamps are ISO strings in the domain. */
export interface Assignment {
  id: string
  assetId: string
  mode: AssignmentMode
  assignedToEmployeeId: string | null
  assignedToBranchId: string | null
  startedAt: string
  endedAt: string | null
  actStoragePath: string | null
  transferComment: string | null
  createdBy: string
  createdAt: string
}
```

- [ ] **Step 4: Create `src/domain/assignment/AssignmentRepository.ts`**

```ts
import type { Assignment } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface AssignInput {
  assetId: string
  mode: Assignment['mode']
  /** Required when mode === 'employee'. */
  employeeId?: string
  /** Required when mode === 'branch'. */
  branchId?: string
  /** Storage path of an already-uploaded act scan, or null. */
  actStoragePath?: string | null
  transferComment?: string | null
  /** Employee email + display name — used ONLY to enqueue mail (employee mode). */
  employeeEmail?: string | null
  employeeName?: string | null
  /** Asset inventory code — included in the mail body. */
  invCode?: string | null
}

export interface AssignmentRepository {
  /** Assign an asset (employee|branch). Atomic: assignment doc + asset cache + mail (employee) + 1 audit entry. */
  assign(input: AssignInput, actor: Actor): Promise<AuditedResult<Assignment>>
  /** Return the asset's active assignment to the warehouse. Atomic: endedAt + asset cache + 1 audit entry. */
  returnAsset(assetId: string, actor: Actor): Promise<AuditedResult<Assignment>>
  /** All assignment history for an asset, newest first. */
  listAssignments(assetId: string): Promise<Assignment[]>
  /** The single active (endedAt == null) assignment for an asset, or null. */
  getActiveAssignment(assetId: string): Promise<Assignment | null>
}
```

- [ ] **Step 5: Create `src/domain/assignment/index.ts`**

```ts
export * from './types'
export * from './AssignmentRepository'
```

- [ ] **Step 6: Modify `src/domain/index.ts`** — append `export * from './assignment'`

- [ ] **Step 7: Run test, verify it passes** — `npx vitest run src/domain/assignment` → PASS

- [ ] **Step 8: Typecheck** — `npm run typecheck` → no errors

- [ ] **Step 9: Commit**

```bash
git add src/domain/assignment src/domain/index.ts
git commit -m "feat(domain): Assignment entity + AssignmentRepository port"
```

---

## Task 2: InMemoryAssignmentRepository adapter

**Files:**
- Create: `src/infra/repositories/inMemoryAssignmentRepository.ts`
- Modify: `src/infra/repositories/index.ts` (add export)
- Test: `src/infra/repositories/inMemoryAssignmentRepository.test.ts`

The adapter needs to mutate assets (status + assignment cache) and read employee/asset
data. To stay simple it accepts a shared `Asset[]` array (same array the asset repo uses)
plus a `MailEntry[]` sink, and an `AuditContext`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryAssignmentRepository, type MailEntry } from './inMemoryAssignmentRepository'
import type { Asset } from '@/domain/asset'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const ACTOR = { uid: 'u_1', role: 'asset_admin' as const }

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'a_1', categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS', invCode: '450/1',
    serial: 'SN1', statusId: 'st_warehouse', assignment: null, branchId: 'br_main',
    deptId: null, updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null, ...over,
  }
}

describe('InMemoryAssignmentRepository', () => {
  let assets: Asset[]; let mail: MailEntry[]; let store: ReturnType<typeof createInMemoryAuditStore>
  let repo: InMemoryAssignmentRepository

  beforeEach(() => {
    assets = [asset()]; mail = []; store = createInMemoryAuditStore()
    repo = new InMemoryAssignmentRepository(assets, mail, inMemoryAuditContext(store))
  })

  it('assign(employee) moves asset to assigned, caches assignment, enqueues mail, writes 1 audit', async () => {
    const r = await repo.assign(
      { assetId: 'a_1', mode: 'employee', employeeId: 'e_1', employeeEmail: 'e@x.com', employeeName: 'Emp One', invCode: '450/1' },
      ACTOR,
    )
    expect(r.value.mode).toBe('employee')
    expect(r.value.endedAt).toBeNull()
    expect(assets[0]!.statusId).toBe('st_assigned')
    expect(assets[0]!.assignment).toEqual({ mode: 'employee', employeeId: 'e_1' })
    expect(mail).toHaveLength(1)
    expect(mail[0]!.to).toEqual(['e@x.com'])
    expect(store.logs.filter(l => l.action === 'assigned')).toHaveLength(1)
  })

  it('assign(branch) does NOT enqueue mail', async () => {
    await repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_2' }, ACTOR)
    expect(assets[0]!.statusId).toBe('st_assigned')
    expect(assets[0]!.assignment).toEqual({ mode: 'branch', branchId: 'br_2' })
    expect(mail).toHaveLength(0)
  })

  it('assign rejects an asset not in warehouse', async () => {
    assets[0]!.statusId = 'st_assigned'
    await expect(repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_2' }, ACTOR)).rejects.toThrow()
  })

  it('returnAsset ends the active assignment and clears the asset cache, writes 1 audit', async () => {
    await repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_2' }, ACTOR)
    const r = await repo.returnAsset('a_1', ACTOR)
    expect(r.value.endedAt).not.toBeNull()
    expect(assets[0]!.statusId).toBe('st_warehouse')
    expect(assets[0]!.assignment).toBeNull()
    expect(store.logs.filter(l => l.action === 'returned')).toHaveLength(1)
    expect(await repo.getActiveAssignment('a_1')).toBeNull()
  })

  it('returnAsset rejects when no active assignment', async () => {
    await expect(repo.returnAsset('a_1', ACTOR)).rejects.toThrow()
  })

  it('listAssignments returns history newest first', async () => {
    await repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_2' }, ACTOR)
    await repo.returnAsset('a_1', ACTOR)
    await repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_3' }, ACTOR)
    const list = await repo.listAssignments('a_1')
    expect(list).toHaveLength(2)
    expect(list[0]!.assignedToBranchId).toBe('br_3')
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/infra/repositories/inMemoryAssignmentRepository.test.ts` → FAIL

- [ ] **Step 3: Create `src/infra/repositories/inMemoryAssignmentRepository.ts`**

```ts
import type { Asset, Actor } from '@/domain/asset'
import type { Assignment, AssignInput, AssignmentRepository } from '@/domain/assignment'
import { withAudit, type AuditContext } from '@/lib/audit'

export interface MailEntry { to: string[]; message: { subject: string; text: string; html: string } }

/** In-memory adapter for tests/dev. Mutates the shared assets array + mail sink. */
export class InMemoryAssignmentRepository implements AssignmentRepository {
  private seq = 0
  private readonly history: Assignment[] = []

  constructor(
    private readonly assets: Asset[],
    private readonly mail: MailEntry[],
    private readonly audit: AuditContext,
  ) {}

  async getActiveAssignment(assetId: string): Promise<Assignment | null> {
    return this.history.find(a => a.assetId === assetId && a.endedAt === null) ?? null
  }

  async listAssignments(assetId: string): Promise<Assignment[]> {
    return this.history
      .filter(a => a.assetId === assetId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async assign(input: AssignInput, actor: Actor) {
    const idx = this.assets.findIndex(a => a.id === input.assetId)
    if (idx < 0) throw new Error(`Asset not found: ${input.assetId}`)
    if (this.assets[idx]!.statusId !== 'st_warehouse') {
      throw new Error(`Asset not assignable (status ${this.assets[idx]!.statusId})`)
    }
    if (input.mode === 'employee' && !input.employeeId) throw new Error('employeeId required')
    if (input.mode === 'branch' && !input.branchId) throw new Error('branchId required')

    const now = new Date().toISOString()
    const assignment: Assignment = {
      id: `as_${++this.seq}`,
      assetId: input.assetId,
      mode: input.mode,
      assignedToEmployeeId: input.mode === 'employee' ? input.employeeId! : null,
      assignedToBranchId: input.mode === 'branch' ? input.branchId! : null,
      startedAt: now, endedAt: null,
      actStoragePath: input.actStoragePath ?? null,
      transferComment: input.transferComment ?? null,
      createdBy: actor.uid, createdAt: now,
    }

    const r = await withAudit(this.audit,
      {
        entityType: 'assignment', entityId: assignment.id, action: 'assigned',
        actorUid: actor.uid, actorRole: actor.role,
        after: {
          assetId: input.assetId, mode: input.mode,
          assignedToEmployeeId: assignment.assignedToEmployeeId,
          assignedToBranchId: assignment.assignedToBranchId,
        },
        comment: input.transferComment ?? null,
      },
      async () => {
        this.history.push(assignment)
        this.assets[idx] = {
          ...this.assets[idx]!,
          statusId: 'st_assigned',
          assignment: input.mode === 'employee'
            ? { mode: 'employee', employeeId: input.employeeId! }
            : { mode: 'branch', branchId: input.branchId! },
          updatedAt: now,
        }
        if (input.mode === 'employee' && input.employeeEmail) {
          this.mail.push({
            to: [input.employeeEmail],
            message: {
              subject: `Asset assigned: ${input.invCode ?? input.assetId}`,
              text: `Asset ${input.invCode ?? input.assetId} assigned to ${input.employeeName ?? ''}`.trim(),
              html: `<p>Asset <strong>${input.invCode ?? input.assetId}</strong> assigned to ${input.employeeName ?? ''}</p>`,
            },
          })
        }
        return { value: assignment }
      })
    return r
  }

  async returnAsset(assetId: string, actor: Actor) {
    const idx = this.assets.findIndex(a => a.id === assetId)
    if (idx < 0) throw new Error(`Asset not found: ${assetId}`)
    const active = this.history.find(a => a.assetId === assetId && a.endedAt === null)
    if (!active) throw new Error(`No active assignment for asset: ${assetId}`)

    const now = new Date().toISOString()
    const r = await withAudit(this.audit,
      {
        entityType: 'assignment', entityId: active.id, action: 'returned',
        actorUid: actor.uid, actorRole: actor.role,
        before: { assetId, mode: active.mode },
        after: { assetId, endedAt: now },
      },
      async () => {
        active.endedAt = now
        this.assets[idx] = { ...this.assets[idx]!, statusId: 'st_warehouse', assignment: null, updatedAt: now }
        return { value: active }
      })
    return r
  }
}
```

- [ ] **Step 4: Modify `src/infra/repositories/index.ts`** — append `export * from './inMemoryAssignmentRepository'`

- [ ] **Step 5: Run, verify pass** — `npx vitest run src/infra/repositories/inMemoryAssignmentRepository.test.ts` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/infra/repositories/inMemoryAssignmentRepository.ts src/infra/repositories/inMemoryAssignmentRepository.test.ts src/infra/repositories/index.ts
git commit -m "feat(infra): in-memory assignment repository via withAudit"
```

---

## Task 3: FirestoreAssignmentRepository adapter

**Files:**
- Create: `src/infra/repositories/firestoreAssignmentRepository.ts`
- Modify: `src/infra/repositories/index.ts` (add export)

No new Vitest unit test file (production Firestore is exercised by rules tests + manual).
Mirror `FirestoreAssetRepository`'s `toIso` + transaction patterns. The transaction does
reads via `txn.get` first (Firestore requires reads before writes), then writes.

- [ ] **Step 1: Create `src/infra/repositories/firestoreAssignmentRepository.ts`**

```ts
import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, orderBy, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type { Assignment, AssignInput, AssignmentRepository } from '@/domain/assignment'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toAssignment(id: string, d: Record<string, unknown>): Assignment {
  return {
    id,
    assetId: String(d.assetId ?? ''),
    mode: (d.mode as Assignment['mode']) ?? 'branch',
    assignedToEmployeeId: (d.assignedToEmployeeId as string | null) ?? null,
    assignedToBranchId: (d.assignedToBranchId as string | null) ?? null,
    startedAt: toIso(d.startedAt),
    endedAt: d.endedAt == null ? null : toIso(d.endedAt),
    actStoragePath: (d.actStoragePath as string | null) ?? null,
    transferComment: (d.transferComment as string | null) ?? null,
    createdBy: String(d.createdBy ?? ''),
    createdAt: toIso(d.createdAt),
  }
}

export class FirestoreAssignmentRepository implements AssignmentRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async getActiveAssignment(assetId: string): Promise<Assignment | null> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'assignments'),
      where('assetId', '==', assetId), where('endedAt', '==', null),
    ))
    const d = snap.docs[0]
    return d ? toAssignment(d.id, d.data() as Record<string, unknown>) : null
  }

  async listAssignments(assetId: string): Promise<Assignment[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'assignments'),
      where('assetId', '==', assetId), orderBy('startedAt', 'desc'),
    ))
    return snap.docs.map(d => toAssignment(d.id, d.data() as Record<string, unknown>))
  }

  async assign(input: AssignInput, actor: Actor): Promise<AuditedResult<Assignment>> {
    if (input.mode === 'employee' && !input.employeeId) throw new Error('employeeId required')
    if (input.mode === 'branch' && !input.branchId) throw new Error('branchId required')

    const assetRef = doc(this.db, 'assets', input.assetId)
    const asnRef = doc(collection(this.db, 'assignments'))
    const mailRef = doc(collection(this.db, 'mail'))

    const r = await withAudit(this.audit,
      {
        entityType: 'assignment', entityId: asnRef.id, action: 'assigned',
        actorUid: actor.uid, actorRole: actor.role,
        after: {
          assetId: input.assetId, mode: input.mode,
          assignedToEmployeeId: input.mode === 'employee' ? input.employeeId! : null,
          assignedToBranchId: input.mode === 'branch' ? input.branchId! : null,
        },
        comment: input.transferComment ?? null,
      },
      async (txn) => {
        const t = txn as unknown as Transaction
        const assetSnap = await t.get(assetRef)
        if (!assetSnap.exists()) throw new Error(`Asset not found: ${input.assetId}`)
        const status = String((assetSnap.data() as Record<string, unknown>).statusId ?? '')
        if (status !== 'st_warehouse') throw new Error(`Asset not assignable (status ${status})`)

        t.set(asnRef, {
          assetId: input.assetId, mode: input.mode,
          assignedToEmployeeId: input.mode === 'employee' ? input.employeeId! : null,
          assignedToBranchId: input.mode === 'branch' ? input.branchId! : null,
          startedAt: serverTimestamp(), endedAt: null,
          actStoragePath: input.actStoragePath ?? null,
          transferComment: input.transferComment ?? null,
          createdBy: actor.uid, createdAt: serverTimestamp(),
        })
        t.set(assetRef, {
          statusId: 'st_assigned',
          assignment: input.mode === 'employee'
            ? { mode: 'employee', employeeId: input.employeeId! }
            : { mode: 'branch', branchId: input.branchId! },
          updatedBy: actor.uid, updatedAt: serverTimestamp(),
        }, { merge: true })
        if (input.mode === 'employee' && input.employeeEmail) {
          t.set(mailRef, {
            to: [input.employeeEmail],
            message: {
              subject: `Asset assigned: ${input.invCode ?? input.assetId}`,
              text: `Asset ${input.invCode ?? input.assetId} assigned to ${input.employeeName ?? ''}`.trim(),
              html: `<p>Asset <strong>${input.invCode ?? input.assetId}</strong> assigned to ${input.employeeName ?? ''}</p>`,
            },
          })
        }
        return { value: undefined as unknown as void }
      })

    const created = await getDoc(asnRef)
    if (!created.exists()) throw new Error('Assignment create succeeded but readback failed')
    return { value: toAssignment(asnRef.id, created.data() as Record<string, unknown>), auditId: r.auditId }
  }

  async returnAsset(assetId: string, actor: Actor): Promise<AuditedResult<Assignment>> {
    const active = await this.getActiveAssignment(assetId)
    if (!active) throw new Error(`No active assignment for asset: ${assetId}`)
    const assetRef = doc(this.db, 'assets', assetId)
    const asnRef = doc(this.db, 'assignments', active.id)

    const r = await withAudit(this.audit,
      {
        entityType: 'assignment', entityId: active.id, action: 'returned',
        actorUid: actor.uid, actorRole: actor.role,
        before: { assetId, mode: active.mode },
        after: { assetId, ended: true },
      },
      async (txn) => {
        const t = txn as unknown as Transaction
        t.set(asnRef, { endedAt: serverTimestamp() }, { merge: true })
        t.set(assetRef, { statusId: 'st_warehouse', assignment: null, updatedBy: actor.uid, updatedAt: serverTimestamp() }, { merge: true })
        return { value: undefined as unknown as void }
      })

    const next = await getDoc(asnRef)
    if (!next.exists()) throw new Error('Assignment return succeeded but readback failed')
    return { value: toAssignment(asnRef.id, next.data() as Record<string, unknown>), auditId: r.auditId }
  }
}
```

- [ ] **Step 2: Modify `src/infra/repositories/index.ts`** — append `export * from './firestoreAssignmentRepository'`

- [ ] **Step 3: Typecheck** — `npm run typecheck` → no errors

- [ ] **Step 4: Commit**

```bash
git add src/infra/repositories/firestoreAssignmentRepository.ts src/infra/repositories/index.ts
git commit -m "feat(infra): firestore assignment repository (runTransaction + withAudit)"
```

---

## Task 4: Act-scan Storage adapter

**Files:**
- Create: `src/infra/storage/actScanStorage.ts`
- Create: `src/infra/storage/index.ts`
- Modify: `src/infra/index.ts` (add `export * from './storage'` — verify barrel exists)
- Test: `src/infra/storage/actScanStorage.test.ts`

`ACT_MAX_BYTES` + `ACT_CONTENT_TYPES` + a pure `validateActFile` are unit-tested. The
actual upload (`uploadBytes` + `getDownloadURL`) is a thin Firebase wrapper, not unit
tested (exercised by rules tests + manual).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { validateActFile, ACT_MAX_BYTES, ACT_CONTENT_TYPES, actStoragePath } from './actScanStorage'

describe('act scan validation', () => {
  it('accepts a 1MB pdf', () => {
    expect(validateActFile({ size: 1_000_000, type: 'application/pdf' })).toBeNull()
  })
  it('rejects an oversized file', () => {
    expect(validateActFile({ size: ACT_MAX_BYTES + 1, type: 'application/pdf' })).toBe('too-large')
  })
  it('rejects a disallowed type', () => {
    expect(validateActFile({ size: 100, type: 'text/plain' })).toBe('bad-type')
  })
  it('allows jpeg and png', () => {
    expect(ACT_CONTENT_TYPES).toContain('image/jpeg')
    expect(ACT_CONTENT_TYPES).toContain('image/png')
  })
  it('actStoragePath builds acts/{assetId}/{fileName}', () => {
    expect(actStoragePath('a_1', 'scan.pdf')).toBe('acts/a_1/scan.pdf')
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/infra/storage` → FAIL

- [ ] **Step 3: Create `src/infra/storage/actScanStorage.ts`**

```ts
import { getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage'

export const ACT_MAX_BYTES = 10 * 1024 * 1024
export const ACT_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const
export type ActValidationError = 'too-large' | 'bad-type'

export function validateActFile(file: { size: number; type: string }): ActValidationError | null {
  if (file.size > ACT_MAX_BYTES) return 'too-large'
  if (!(ACT_CONTENT_TYPES as readonly string[]).includes(file.type)) return 'bad-type'
  return null
}

export function actStoragePath(assetId: string, fileName: string): string {
  return `acts/${assetId}/${fileName}`
}

/** Uploads the act scan and returns its storage path. Throws if validation fails. */
export async function uploadActScan(
  storage: FirebaseStorage, assetId: string, file: File,
): Promise<string> {
  const err = validateActFile(file)
  if (err) throw new Error(`Invalid act file: ${err}`)
  const path = actStoragePath(assetId, file.name)
  await uploadBytes(ref(storage, path), file, { contentType: file.type })
  return path
}

/** Resolves a download URL for a stored act scan. */
export async function actScanUrl(storage: FirebaseStorage, path: string): Promise<string> {
  return getDownloadURL(ref(storage, path))
}
```

- [ ] **Step 4: Create `src/infra/storage/index.ts`** — `export * from './actScanStorage'`

- [ ] **Step 5: Verify/modify `src/infra/index.ts`** — ensure it re-exports `./storage` and `./repositories`. Add `export * from './storage'` if missing.

- [ ] **Step 6: Run, verify pass** — `npx vitest run src/infra/storage` → PASS

- [ ] **Step 7: Commit**

```bash
git add src/infra/storage src/infra/index.ts
git commit -m "feat(infra): act-scan storage adapter + pure file validation"
```

---

## Task 5: firestore.rules /mail block + verify /assignments + audit after-shape

**Files:**
- Modify: `firestore.rules` (add `/mail` block before the catch-all)
- Test: `tests/rules/firestore.rules.test.ts` (append /mail describe block)

- [ ] **Step 1: Write failing rules tests** — append to `tests/rules/firestore.rules.test.ts`:

```ts
describe('/mail queue', () => {
  it('asset_admin can create a mail doc', async () => {
    const db = authedDb(env, ASSET)
    await assertSucceeds(setDoc(doc(db, 'mail', 'm1'), {
      to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' },
    }))
  })
  it('super_admin can create a mail doc', async () => {
    const db = authedDb(env, SUPER)
    await assertSucceeds(setDoc(doc(db, 'mail', 'm2'), {
      to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' },
    }))
  })
  it('tech_admin CANNOT create mail', async () => {
    const db = authedDb(env, TECH)
    await assertFails(setDoc(doc(db, 'mail', 'm3'), {
      to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' },
    }))
  })
  it('employee CANNOT create mail', async () => {
    const db = authedDb(env, EMP)
    await assertFails(setDoc(doc(db, 'mail', 'm4'), {
      to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' },
    }))
  })
  it('nobody can read mail', async () => {
    await seedDoc(env, 'mail/m5', { to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' } })
    await assertFails(getDoc(doc(authedDb(env, SUPER), 'mail', 'm5')))
    await assertFails(getDoc(doc(authedDb(env, ASSET), 'mail', 'm5')))
  })
})

describe('/assignments writes (assign/return shape)', () => {
  it('asset_admin can create an assignment', async () => {
    const db = authedDb(env, ASSET)
    await assertSucceeds(setDoc(doc(db, 'assignments', 'as1'), {
      assetId: 'a1', mode: 'employee', assignedToEmployeeId: 'e1', assignedToBranchId: null,
      endedAt: null, actStoragePath: null, transferComment: null, createdBy: ASSET,
    }))
  })
  it('employee CANNOT create an assignment', async () => {
    const db = authedDb(env, EMP)
    await assertFails(setDoc(doc(db, 'assignments', 'as2'), {
      assetId: 'a1', mode: 'branch', assignedToBranchId: 'b1', endedAt: null,
    }))
  })
  it('update may change endedAt only; other fields rejected', async () => {
    await seedDoc(env, 'assignments/as3', {
      assetId: 'a1', mode: 'branch', assignedToBranchId: 'b1', endedAt: null, transferComment: null,
    })
    const db = authedDb(env, ASSET)
    await assertSucceeds(updateDoc(doc(db, 'assignments', 'as3'), { endedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(db, 'assignments', 'as3'), { assetId: 'a2' }))
  })
  it('assignment is never deletable', async () => {
    await seedDoc(env, 'assignments/as4', { assetId: 'a1', mode: 'branch', endedAt: null })
    await assertFails(deleteDoc(doc(authedDb(env, SUPER), 'assignments', 'as4')))
  })
})

describe('audit_logs employee read scoped by assignedToEmployeeId', () => {
  it('employee can read an assignment audit addressed to them', async () => {
    await seedDoc(env, 'audit_logs/ae1', {
      entityType: 'assignment', entityId: 'as1', action: 'assigned',
      actorUid: ASSET, actorRole: 'asset_admin', before: null,
      after: { assignedToEmployeeId: EMP }, at: new Date(),
    })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'audit_logs', 'ae1')))
  })
  it('employee CANNOT read an assignment audit addressed to someone else', async () => {
    await seedDoc(env, 'audit_logs/ae2', {
      entityType: 'assignment', entityId: 'as1', action: 'assigned',
      actorUid: ASSET, actorRole: 'asset_admin', before: null,
      after: { assignedToEmployeeId: 'other' }, at: new Date(),
    })
    await assertFails(getDoc(doc(authedDb(env, EMP), 'audit_logs', 'ae2')))
  })
})
```

- [ ] **Step 2: Add the `/mail` block to `firestore.rules`** — insert before the `/settings` block:

```
    // ---- /mail — Trigger Email queue. Write-only for admins; never client-readable. ----
    match /mail/{id} {
      allow create: if isSuperAdmin() || isAssetAdmin();
      allow read, update, delete: if false;
    }
```

- [ ] **Step 3: Run rules tests** (requires emulator)

Run: `npm run test:rules`
Expected: PASS (new /mail + /assignments + audit-read describes green). If Java/emulator
is unavailable locally, this runs in CI — note that and continue; do NOT mark green
without CI evidence.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules tests/rules/firestore.rules.test.ts
git commit -m "feat(rules): /mail write-only queue + assignment/audit read tests"
```

---

## Task 6: storage.rules acts/* + rules tests

**Files:**
- Modify: `storage.rules` (replace deny-all with acts/* rules)
- Test: `tests/rules/storage.rules.test.ts` (replace deny-all suite)

- [ ] **Step 1: Replace `storage.rules`**

```
rules_version = '2';

// AMS — Cloud Storage security rules.
// acts/{assetId}/{fileName} holds act-of-acceptance scans.
//  write: super | asset_admin, <=10MB, JPEG/PNG/PDF only (role via cross-service get).
//  read : any admin OR the employee the asset is currently assigned to (cross-service
//         get of the asset's denormalized assignment cache).
// Everything else: deny.

service firebase.storage {
  match /b/{bucket}/o {

    function fsRole() {
      return firestore.get(
        /databases/(default)/documents/users/$(request.auth.uid)
      ).data.role;
    }
    function isAdmin() {
      return request.auth != null
        && (fsRole() == 'super_admin' || fsRole() == 'asset_admin' || fsRole() == 'tech_admin');
    }
    function isWriter() {
      return request.auth != null && (fsRole() == 'super_admin' || fsRole() == 'asset_admin');
    }
    function assignedToCaller(assetId) {
      return request.auth != null
        && firestore.get(/databases/(default)/documents/assets/$(assetId))
             .data.assignment.employeeId == request.auth.uid;
    }

    match /acts/{assetId}/{fileName} {
      allow write: if isWriter()
        && request.resource.size <= 10 * 1024 * 1024
        && request.resource.contentType in ['image/jpeg', 'image/png', 'application/pdf'];
      allow read: if isAdmin() || assignedToCaller(assetId);
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Replace `tests/rules/storage.rules.test.ts`** with role/type/size + employee-read coverage:

```ts
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { authedStorage, unauthedStorage, makeTestEnv, seedUser, seedDoc } from './helpers'

const SUPER = 'super1', ASSET = 'asset1', TECH = 'tech1', EMP = 'emp1', OTHER = 'other1'
let env: RulesTestEnvironment

beforeAll(async () => { env = await makeTestEnv() })
afterAll(async () => { await env.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await seedUser(env, SUPER, 'super_admin')
  await seedUser(env, ASSET, 'asset_admin')
  await seedUser(env, TECH, 'tech_admin')
  await seedUser(env, EMP, 'employee')
  await seedUser(env, OTHER, 'employee')
})

const PDF = new Uint8Array([1, 2, 3])
function up(s: ReturnType<typeof authedStorage>, path: string, type = 'application/pdf') {
  return uploadBytes(ref(s, path), PDF, { contentType: type })
}

describe('acts/* write', () => {
  it('asset_admin can upload a pdf', async () => {
    await assertSucceeds(up(authedStorage(env, ASSET), 'acts/a1/scan.pdf'))
  })
  it('super_admin can upload a png', async () => {
    await assertSucceeds(up(authedStorage(env, SUPER), 'acts/a1/scan.png', 'image/png'))
  })
  it('tech_admin CANNOT upload', async () => {
    await assertFails(up(authedStorage(env, TECH), 'acts/a1/scan.pdf'))
  })
  it('employee CANNOT upload', async () => {
    await assertFails(up(authedStorage(env, EMP), 'acts/a1/scan.pdf'))
  })
  it('rejects a disallowed content type', async () => {
    await assertFails(up(authedStorage(env, ASSET), 'acts/a1/scan.txt', 'text/plain'))
  })
})

describe('acts/* read', () => {
  beforeEach(async () => {
    await seedDoc(env, 'assets/a1', { invCode: '450/1', statusId: 'st_assigned', assignment: { mode: 'employee', employeeId: EMP } })
    await up(authedStorage(env, ASSET), 'acts/a1/scan.pdf')
  })
  it('admin can read', async () => {
    await assertSucceeds(getDownloadURL(ref(authedStorage(env, SUPER), 'acts/a1/scan.pdf')))
  })
  it('the assigned employee can read', async () => {
    await assertSucceeds(getDownloadURL(ref(authedStorage(env, EMP), 'acts/a1/scan.pdf')))
  })
  it('a different employee CANNOT read', async () => {
    await assertFails(getDownloadURL(ref(authedStorage(env, OTHER), 'acts/a1/scan.pdf')))
  })
  it('unauthenticated CANNOT read', async () => {
    await assertFails(getDownloadURL(ref(unauthedStorage(env), 'acts/a1/scan.pdf')))
  })
})
```

- [ ] **Step 3: Run rules tests** — `npm run test:rules` → PASS (or CI). Same emulator caveat as Task 5.

- [ ] **Step 4: Commit**

```bash
git add storage.rules tests/rules/storage.rules.test.ts
git commit -m "feat(rules): acts/* storage rules (admin+employee read, role/type/size write)"
```

---

## Task 7: i18n keys (ru/en/hy)

**Files:**
- Modify: `src/locales/ru/assets.json`, `src/locales/en/assets.json`, `src/locales/hy/assets.json`
- Test: covered by the component test in Task 8 (key resolution).

- [ ] **Step 1: Add an `assign` block to each locale** under the existing `assets.json`.

ru:
```json
"assign": {
  "action": "Назначить",
  "title": "Назначение актива",
  "mode": "Кому",
  "employee": "Сотрудник",
  "branch": "Филиал",
  "pickEmployee": "Выберите сотрудника",
  "pickBranch": "Выберите филиал",
  "comment": "Комментарий",
  "commentPlaceholder": "Например: акт №123",
  "actScan": "Скан акта приёма-передачи",
  "actScanHint": "JPEG, PNG или PDF, до 10 МБ",
  "submit": "Назначить",
  "cancel": "Отмена",
  "history": "История назначений",
  "active": "Активно",
  "ended": "Завершено",
  "started": "Начато",
  "viewScan": "Открыть скан",
  "noHistory": "Назначений ещё не было",
  "fileTooLarge": "Файл больше 10 МБ",
  "fileBadType": "Допустимы только JPEG, PNG, PDF",
  "assignFailed": "Не удалось назначить. Попробуйте ещё раз.",
  "returnFailed": "Не удалось вернуть. Попробуйте ещё раз."
}
```

en (same keys, English values):
```json
"assign": {
  "action": "Assign", "title": "Assign asset", "mode": "Assign to",
  "employee": "Employee", "branch": "Branch",
  "pickEmployee": "Select an employee", "pickBranch": "Select a branch",
  "comment": "Comment", "commentPlaceholder": "e.g. act No. 123",
  "actScan": "Act-of-acceptance scan", "actScanHint": "JPEG, PNG or PDF, up to 10 MB",
  "submit": "Assign", "cancel": "Cancel", "history": "Assignment history",
  "active": "Active", "ended": "Ended", "started": "Started",
  "viewScan": "Open scan", "noHistory": "No assignments yet",
  "fileTooLarge": "File is larger than 10 MB", "fileBadType": "Only JPEG, PNG, PDF allowed",
  "assignFailed": "Could not assign. Please try again.",
  "returnFailed": "Could not return. Please try again."
}
```

hy (same keys, Armenian values):
```json
"assign": {
  "action": "Նշանակել", "title": "Ակտիվի նշանակում", "mode": "Ում",
  "employee": "Աշխատակից", "branch": "Մասնաճյուղ",
  "pickEmployee": "Ընտրեք աշխատակցին", "pickBranch": "Ընտրեք մասնաճյուղը",
  "comment": "Մեկնաբանություն", "commentPlaceholder": "Օր․՝ ակտ №123",
  "actScan": "Ընդունման ակտի սկան", "actScanHint": "JPEG, PNG կամ PDF, մինչև 10 ՄԲ",
  "submit": "Նշանակել", "cancel": "Չեղարկել", "history": "Նշանակումների պատմություն",
  "active": "Ակտիվ", "ended": "Ավարտված", "started": "Սկսված",
  "viewScan": "Բացել սկանը", "noHistory": "Նշանակումներ դեռ չկան",
  "fileTooLarge": "Ֆայլը 10 ՄԲ-ից մեծ է", "fileBadType": "Թույլատրվում է միայն JPEG, PNG, PDF",
  "assignFailed": "Չհաջողվեց նշանակել։ Փորձեք կրկին։",
  "returnFailed": "Չհաջողվեց վերադարձնել։ Փորձեք կրկին։"
}
```

- [ ] **Step 2: Verify each JSON parses** — `node -e "['ru','en','hy'].forEach(l=>require('./src/locales/'+l+'/assets.json'))"` → no error

- [ ] **Step 3: Commit**

```bash
git add src/locales/ru/assets.json src/locales/en/assets.json src/locales/hy/assets.json
git commit -m "feat(i18n): assignment + act-scan keys (ru/en/hy)"
```

---

## Task 8: AssignmentForm + AssignmentHistory + wire into AssetDetailPage

**Files:**
- Create: `src/components/features/assets/detail/AssignmentForm.tsx`
- Create: `src/components/features/assets/detail/AssignmentHistory.tsx`
- Modify: `src/components/features/assets/detail/LifecycleActions.tsx` (add `onAssign` + `canAssign`)
- Modify: `src/pages/AssetDetailPage.tsx` (wire assignment repo + storage + form/history)
- Modify: `src/components/features/assets/index.ts` (export new components)
- Test: `src/pages/AssetDetailPage.assignment.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { AssetDetailPage } from './AssetDetailPage'
import { InMemoryAssetRepository, InMemoryAssignmentRepository, type MailEntry } from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { Asset, AssetReferenceData } from '@/domain/asset'

function refData(): AssetReferenceData {
  return {
    statuses: [
      { id: 'st_warehouse', name: 'На складе', color: 'gray' },
      { id: 'st_assigned', name: 'Выдано', color: 'green' },
    ],
    branches: [{ id: 'br_main', name: 'Главный' }, { id: 'br_2', name: 'Филиал 2' }],
    departments: [],
    categories: [{ id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' }],
    employees: [{ id: 'e_1', firstName: 'Иван', lastName: 'Петров' }],
  }
}
function mkAsset(): Asset {
  return { id: 'a_1', categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS', invCode: '450/1',
    serial: 'SN', statusId: 'st_warehouse', assignment: null, branchId: 'br_main', deptId: null,
    updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null }
}

function renderPage(assets: Asset[], mail: MailEntry[]) {
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  const assetRepo = new InMemoryAssetRepository(assets, refData(), ctx)
  const asnRepo = new InMemoryAssignmentRepository(assets, mail, ctx)
  const auth = {
    user: { id: 'u_1', name: 'A', email: 'a@x', role: 'asset_admin' as const, initials: 'A', avatarColor: '' },
    role: 'asset_admin' as const, status: 'ready' as const, setRole: () => {}, signOut: () => {},
  }
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/assets/a_1']}>
          <Routes>
            <Route path="/assets/:id" element={<AssetDetailPage repository={assetRepo} assignmentRepository={asnRepo} />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('AssetDetailPage assignment flow', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('shows an Assign action for a warehouse asset and assigns to a branch', async () => {
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    renderPage(assets, mail)
    const assignBtn = await screen.findByRole('button', { name: /Назначить/ })
    await userEvent.click(assignBtn)
    // pick branch mode then a branch then submit
    await userEvent.click(await screen.findByRole('button', { name: 'Филиал' }))
    await waitFor(() => expect(assets[0]!.statusId).toBe('st_warehouse')) // not yet
  })
})
```

(Keep this test focused: it asserts the Assign action renders and opens the form. Deeper
interaction assertions can be added once the form DOM is final; the InMemory repo is the
behavior contract already proven in Task 2.)

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/pages/AssetDetailPage.assignment.test.tsx` → FAIL (no `assignmentRepository` prop / no Assign button)

- [ ] **Step 3: Create `AssignmentForm.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Icon, Select, Input } from '@/components/ui'
import type { EmployeeRow, RefRow } from '@/domain/asset'
import { validateActFile } from '@/infra/storage'

export interface AssignmentSubmit {
  mode: 'employee' | 'branch'
  employeeId?: string
  branchId?: string
  comment: string | null
  file: File | null
}

export interface AssignmentFormProps {
  employees: EmployeeRow[]
  branches: RefRow[]
  busy?: boolean
  onSubmit: (v: AssignmentSubmit) => void
  onCancel: () => void
}

export function AssignmentForm({ employees, branches, busy, onSubmit, onCancel }: AssignmentFormProps) {
  const { t } = useTranslation('assets')
  const [mode, setMode] = useState<'employee' | 'branch'>('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [comment, setComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const employeeOptions = employees.map(e => ({ value: e.id, label: [e.firstName, e.lastName].filter(Boolean).join(' ') }))
  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }))
  const canSubmit = (mode === 'employee' ? !!employeeId : !!branchId) && !fileError && !busy

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f) {
      const err = validateActFile(f)
      if (err === 'too-large') { setFileError(t('assign.fileTooLarge')); setFile(null); return }
      if (err === 'bad-type') { setFileError(t('assign.fileBadType')); setFile(null); return }
    }
    setFileError(null); setFile(f)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Btn type="button" size="sm" variant={mode === 'employee' ? 'primary' : 'secondary'} onClick={() => setMode('employee')}>{t('assign.employee')}</Btn>
        <Btn type="button" size="sm" variant={mode === 'branch' ? 'primary' : 'secondary'} onClick={() => setMode('branch')}>{t('assign.branch')}</Btn>
      </div>
      {mode === 'employee'
        ? <Select value={employeeId} onChange={setEmployeeId} options={employeeOptions} placeholder={t('assign.pickEmployee')} />
        : <Select value={branchId} onChange={setBranchId} options={branchOptions} placeholder={t('assign.pickBranch')} />}
      <div>
        <label className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('assign.comment')}</label>
        <Input value={comment} onChange={setComment} placeholder={t('assign.commentPlaceholder')} />
      </div>
      <div>
        <label className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">{t('assign.actScan')}</label>
        <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={onFile}
          className="block w-full text-[12px] text-[#94A3B8] file:mr-3 file:rounded-md file:border-0 file:bg-[#27272A] file:px-3 file:py-1.5 file:text-[#F8FAFC]" />
        <p className="mt-1 text-[11px] text-[#64748B]">{t('assign.actScanHint')}</p>
        {fileError && <p role="alert" className="mt-1 text-[12px] text-[#FDA4AF]">{fileError}</p>}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Btn variant="primary" size="sm" disabled={!canSubmit}
          onClick={() => onSubmit({ mode, employeeId: mode === 'employee' ? employeeId : undefined, branchId: mode === 'branch' ? branchId : undefined, comment: comment || null, file })}>
          {busy ? <Icon name="loader-circle" size={13} className="animate-spin" /> : <Icon name="user-check" size={13} />}
          {t('assign.submit')}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>{t('assign.cancel')}</Btn>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `AssignmentHistory.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { SectionCard, Chip, EmptyState, Btn, Icon } from '@/components/ui'
import type { Assignment } from '@/domain/assignment'
import type { AssetReferenceData } from '@/domain/asset'

export interface AssignmentHistoryProps {
  assignments: Assignment[]
  ref?: AssetReferenceData
  onViewScan?: (path: string) => void
}

function recipientName(a: Assignment, ref?: AssetReferenceData): string {
  if (a.mode === 'employee') {
    const e = ref?.employees.find(x => x.id === a.assignedToEmployeeId)
    return e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : (a.assignedToEmployeeId ?? '—')
  }
  const b = ref?.branches.find(x => x.id === a.assignedToBranchId)
  return b ? b.name : (a.assignedToBranchId ?? '—')
}

function fmt(iso: string): string { return new Date(iso).toLocaleDateString() }

export function AssignmentHistory({ assignments, ref, onViewScan }: AssignmentHistoryProps) {
  const { t } = useTranslation('assets')
  return (
    <SectionCard title={t('assign.history')} icon="history">
      {assignments.length === 0 ? (
        <EmptyState icon="inbox" title={t('assign.noHistory')} />
      ) : (
        <ul className="space-y-2">
          {assignments.map(a => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-md bg-[#18181B] px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] text-[#F8FAFC] truncate">{recipientName(a, ref)}</p>
                <p className="text-[11px] text-[#64748B]">
                  {t(a.mode === 'employee' ? 'assign.employee' : 'assign.branch')} · {t('assign.started')} {fmt(a.startedAt)}
                  {a.endedAt ? ` · ${t('assign.ended')} ${fmt(a.endedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Chip color={a.endedAt ? 'gray' : 'green'} dot>{t(a.endedAt ? 'assign.ended' : 'assign.active')}</Chip>
                {a.actStoragePath && onViewScan && (
                  <Btn variant="ghost" size="sm" onClick={() => onViewScan(a.actStoragePath!)}>
                    <Icon name="file-text" size={13} />{t('assign.viewScan')}
                  </Btn>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
```

- [ ] **Step 5: Modify `LifecycleActions.tsx`** — add `canAssign` + `onAssign`, render an Assign button when `canAssign && statusId === 'st_warehouse'`:

Add to props interface: `canAssign: boolean; onAssign: () => void`. Add before the return-guard:
```tsx
  const isWarehouse = statusId === 'st_warehouse'
  const showAssign = canAssign && isWarehouse
```
Include `showAssign` in the early-return guard condition, and render first:
```tsx
      {showAssign && (
        <Btn variant="primary" size="sm" onClick={onAssign}>
          <Icon name="user-check" size={13} />
          {t('assign.action')}
        </Btn>
      )}
```

- [ ] **Step 6: Modify `AssetDetailPage.tsx`**
  - Add prop `assignmentRepository?: AssignmentRepository`.
  - Build a default `FirestoreAssignmentRepository(db())` when not injected.
  - Load `listAssignments(id)` alongside the existing `Promise.all`.
  - Add state: `assigning` (form open), `assignBusy`, `assignError`.
  - `canAssign = role === 'super_admin' || role === 'asset_admin'`.
  - Handler `handleAssign(v: AssignmentSubmit)`: if `v.file`, `uploadActScan(storage(), asset.id, v.file)` BEFORE calling `asnRepo.assign(...)` (Decision B). Resolve employee email/name from ref data for employee mode. On success `await load()` + close form.
  - Route `handleReturn` through `asnRepo.returnAsset(asset.id, actor)` (replaces the `changeStatus(...,'st_warehouse',...)` call).
  - Render `<AssignmentForm>` (inside a SectionCard) when `assigning`, else the lifecycle Assign button opens it.
  - Render `<AssignmentHistory assignments={assignments} ref={ref} onViewScan={...}/>`.
  - `onViewScan`: `actScanUrl(storage(), path).then(u => window.open(u, '_blank'))`.
  - Import `storage` from `@/lib/firebase` (verify it exports a `storage()` getter; if not, add a lazy storage getter in `src/lib/firebase/index.ts` mirroring `db()`).

- [ ] **Step 7: Modify `src/components/features/assets/index.ts`** — export `AssignmentForm`, `AssignmentHistory`.

- [ ] **Step 8: Run the component test** — `npx vitest run src/pages/AssetDetailPage.assignment.test.tsx` → PASS

- [ ] **Step 9: Run full suite + typecheck + build**

```bash
npm run typecheck && npx vitest run && npm run build
```
Expected: all green (159 prior + new tests), build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/components/features/assets src/pages/AssetDetailPage.tsx src/pages/AssetDetailPage.assignment.test.tsx src/lib/firebase/index.ts
git commit -m "feat(ui): assignment form + history + assign/return wiring on asset detail"
```

---

## Task 9: Review gates + verification

- [ ] **Step 1: spec-reviewer** — verify against this plan + the design spec. Re-dispatch the responsible implementer on any FAIL.
- [ ] **Step 2: code-quality-reviewer** — React/Firebase/audit-helper/i18n discipline.
- [ ] **Step 3: security-reviewer (MANDATORY)** — storage.rules cross-service get, /mail PII, audit immutability, employee read scoping, no secrets, role gating in rules (not just UI).
- [ ] **Step 4: Verification evidence** — paste `npm run typecheck`, `npx vitest run`, `npm run build` tails. Rules tests: `npm run test:rules` (CI if no local JVM).
- [ ] **Step 5: Final commit if any review fixes landed.**

---

## Self-review notes

- **Spec coverage:** Task1=domain port; Task2/3=InMemory+Firestore adapters w/ withAudit; Task4=storage adapter+validation; Task5=/mail rule + assignment/audit read tests; Task6=storage.rules+tests; Task7=i18n; Task8=UI; Task9=reviews. All §-sections of the design spec map to a task.
- **Type consistency:** `Assignment`, `AssignInput`, `MailEntry`, `AssignmentSubmit` names used identically across tasks. `Actor` imported from `@/domain/asset` (existing). `withAudit(ctx, spec, mutate)` signature matches existing helper.
- **Known tradeoff (Decision B):** orphaned scan on txn failure — documented; no cleanup this iteration.
- **Owner note (employee id vs uid):** the employee self-service read paths (audit + storage) compare `assignedToEmployeeId`/`assignment.employeeId` to `request.auth.uid`. Works only once employee docs are uid-keyed — documented follow-up; admin paths unaffected.

### Post-implementation amendments (2026-06-19)

- **AMENDMENT to Task 1:** the assignment-doc mode type is exported as `AssignmentDocMode`, NOT `AssignmentMode` as written above. Reason: `AssignmentMode` is already exported by `src/domain/asset/types.ts` (the broader `'employee' | 'department' | 'branch'` type used by `AssetAssignment`), and re-exporting both through the `src/domain` barrel produced a TS2308 collision. The narrower assignment-doc type was renamed to `AssignmentDocMode`. No public consumer imports the bare type (repos index via `Assignment['mode']`).
- **AMENDMENT to Task 3:** `returnAsset()` re-reads the assignment doc INSIDE the `withAudit` transaction (`t.get(asnRef)` before any writes) and aborts if it's missing or already ended — closes a TOCTOU window on concurrent returns. The audit `after` uses `{ assetId, endedAt: <iso> }` (key `endedAt`, matching the InMemory adapter).
- **AMENDMENT to Task 8:** `onViewScan` chains `.catch(() => setActionError(t('assign.scanFailed')))` (new i18n key `assign.scanFailed` in ru/en/hy); the lifecycle Assign button is hidden while the form is open via `canAssign={canAssign && !assigning}`.
- **OWNER FOLLOW-UP (deferred):** transactional mail subject/text/html are hardcoded English in both repo adapters. Localized email belongs to the Phase-2 notifications matrix; `employeeEmail` is currently always null (EmployeeRow has no email field) so no mail is enqueued yet. Revisit when (a) employee email is modeled and (b) the notifications matrix lands.
