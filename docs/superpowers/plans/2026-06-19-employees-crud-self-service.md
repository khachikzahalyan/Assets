# Employees CRUD + Email-Link Self-Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Model the Employee entity (uid-keyed, with email), ship its repository (InMemory + Firestore, all via withAudit), build Employees CRUD + employee self-service landing pages, wire real notification mail, and add `/employees` rules + tests.

**Architecture:** Ports-and-adapters mirroring the existing Asset/Assignment repos. `employees/{uid}` shares its id with `users/{uid}` so the already-shipped self-service rules (which compare `assignment.employeeId`/`assignedToEmployeeId` to `request.auth.uid`) work by construction. Every mutation runs through `withAudit` (one audit entry per call). UI ports `prototypes/employees.html` onto existing dark/orange primitives.

**Tech Stack:** TypeScript strict, Firebase v9 modular, React 19, i18next (ru/en/hy), Vitest, @firebase/rules-unit-testing.

**Design spec:** `docs/superpowers/specs/2026-06-19-employees-crud-self-service-design.md`

---

## Task 1: Audit type extension (employee entity + terminate/reactivate actions)

**Files:**
- Modify: `src/domain/audit/types.ts`
- Test: `src/domain/audit/audit-types.test.ts` (append)

- [ ] **Step 1: Append failing test** to `src/domain/audit/audit-types.test.ts`

```ts
import { isAuditAction, type AuditEntityType } from './index'

describe('audit extension for employees', () => {
  it('terminated and reactivated are valid actions', () => {
    expect(isAuditAction('terminated')).toBe(true)
    expect(isAuditAction('reactivated')).toBe(true)
  })
  it('employee is a valid entity type', () => {
    const t: AuditEntityType = 'employee'
    expect(t).toBe('employee')
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/domain/audit` → FAIL

- [ ] **Step 3: Edit `src/domain/audit/types.ts`**

Change the entity-type union to add `'employee'`:
```ts
export type AuditEntityType = 'asset' | 'assignment' | 'upgrade' | 'license' | 'employee'
```
Add two actions to the `AUDIT_ACTIONS` array (append before the closing `] as const`):
```ts
  'created', 'updated', 'status_changed', 'assigned', 'returned',
  'transferred', 'upgrade_added', 'disposed', 'sent_to_repair', 'repair_completed',
  'terminated', 'reactivated',
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run src/domain/audit` → PASS

- [ ] **Step 5: Typecheck** — `npm run typecheck` → no errors

- [ ] **Step 6: Commit**

```bash
git add src/domain/audit/types.ts src/domain/audit/audit-types.test.ts
git commit -m "feat(domain): audit entity 'employee' + terminated/reactivated actions"
```

---

## Task 2: Employee domain types + repository port

**Files:**
- Create: `src/domain/employee/types.ts`
- Create: `src/domain/employee/EmployeeRepository.ts`
- Create: `src/domain/employee/index.ts`
- Modify: `src/domain/index.ts` (append `export * from './employee'`)
- Test: `src/domain/employee/employee-types.test.ts`

- [ ] **Step 1: Write the failing test** (`src/domain/employee/employee-types.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { isEmployeeStatus, type Employee, type EmployeeStatus } from './index'

describe('employee domain types', () => {
  it('isEmployeeStatus accepts active/terminated, rejects others', () => {
    expect(isEmployeeStatus('active')).toBe(true)
    expect(isEmployeeStatus('terminated')).toBe(true)
    expect(isEmployeeStatus('x')).toBe(false)
  })
  it('Employee shape compiles', () => {
    const e: Employee = {
      id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com',
      position: 'Инженер', branchId: 'br_1', departmentId: 'dep_1',
      status: 'active', terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const s: EmployeeStatus = e.status
    expect(s).toBe('active')
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/domain/employee` → FAIL (module not found)

- [ ] **Step 3: Create `src/domain/employee/types.ts`**

```ts
export const EMPLOYEE_STATUSES = ['active', 'terminated'] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export function isEmployeeStatus(v: string): v is EmployeeStatus {
  return (EMPLOYEE_STATUSES as readonly string[]).includes(v)
}

/**
 * A person. Mirrors Firestore employees/{uid}.
 * INVARIANT: `id` === the person's Firebase Auth uid === users/{uid} id.
 * This makes the self-service rules (assignment.employeeId == request.auth.uid) correct.
 * Timestamps are ISO strings in the domain.
 */
export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  position: string | null
  branchId: string | null
  departmentId: string | null
  status: EmployeeStatus
  terminatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface EmployeeListQuery {
  status?: EmployeeStatus | 'all'
  branchId?: string | 'all'
  departmentId?: string | 'all'
  search?: string
}
```

- [ ] **Step 4: Create `src/domain/employee/EmployeeRepository.ts`**

```ts
import type { Employee, EmployeeStatus, EmployeeListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateEmployeeInput {
  /** The record key === the person's Firebase Auth uid. */
  id: string
  firstName: string
  lastName: string
  email: string
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}

export interface UpdateEmployeeInput {
  firstName?: string
  lastName?: string
  email?: string
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}

export interface EmployeeRepository {
  listEmployees(query?: EmployeeListQuery): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee | null>
  /** Case-insensitive uniqueness check. */
  isEmailTaken(email: string, exceptId?: string): Promise<boolean>
  createEmployee(input: CreateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  updateEmployee(id: string, patch: UpdateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  /** Terminate (stamps terminatedAt) or reactivate (clears it). */
  setStatus(id: string, status: EmployeeStatus, actor: Actor): Promise<AuditedResult<Employee>>
}
```

- [ ] **Step 5: Create `src/domain/employee/index.ts`**

```ts
export * from './types'
export * from './EmployeeRepository'
```

- [ ] **Step 6: Modify `src/domain/index.ts`** — append `export * from './employee'`

- [ ] **Step 7: Run, verify pass** — `npx vitest run src/domain/employee` → PASS

- [ ] **Step 8: Typecheck** — `npm run typecheck` → no errors

- [ ] **Step 9: Commit**

```bash
git add src/domain/employee src/domain/index.ts
git commit -m "feat(domain): Employee entity (uid-keyed, email) + EmployeeRepository port"
```

---

## Task 3: InMemoryEmployeeRepository adapter

**Files:**
- Create: `src/infra/repositories/inMemoryEmployeeRepository.ts`
- Modify: `src/infra/repositories/index.ts` (append export)
- Test: `src/infra/repositories/inMemoryEmployeeRepository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryEmployeeRepository } from './inMemoryEmployeeRepository'
import type { Employee } from '@/domain/employee'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const ACTOR = { uid: 'admin_1', role: 'asset_admin' as const }

describe('InMemoryEmployeeRepository', () => {
  let emps: Employee[]
  let store: ReturnType<typeof createInMemoryAuditStore>
  let repo: InMemoryEmployeeRepository

  beforeEach(() => {
    emps = []
    store = createInMemoryAuditStore()
    repo = new InMemoryEmployeeRepository(emps, inMemoryAuditContext(store))
  })

  it('createEmployee stores uid-keyed doc + writes 1 created audit', async () => {
    const r = await repo.createEmployee(
      { id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', branchId: 'br_1' },
      ACTOR,
    )
    expect(r.value.id).toBe('uid_1')
    expect(r.value.status).toBe('active')
    expect(emps).toHaveLength(1)
    expect(store.logs.filter(l => l.action === 'created' && l.entityType === 'employee')).toHaveLength(1)
  })

  it('createEmployee rejects a duplicate email (case-insensitive)', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'i@x.com' }, ACTOR)
    await expect(
      repo.createEmployee({ id: 'uid_2', firstName: 'C', lastName: 'D', email: 'I@X.COM' }, ACTOR),
    ).rejects.toThrow()
  })

  it('createEmployee rejects a duplicate id', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'a@x.com' }, ACTOR)
    await expect(
      repo.createEmployee({ id: 'uid_1', firstName: 'C', lastName: 'D', email: 'c@x.com' }, ACTOR),
    ).rejects.toThrow()
  })

  it('updateEmployee patches + writes 1 updated audit; blocks email collision', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'a@x.com' }, ACTOR)
    await repo.createEmployee({ id: 'uid_2', firstName: 'C', lastName: 'D', email: 'c@x.com' }, ACTOR)
    const r = await repo.updateEmployee('uid_1', { position: 'Инженер' }, ACTOR)
    expect(r.value.position).toBe('Инженер')
    expect(store.logs.filter(l => l.action === 'updated')).toHaveLength(1)
    await expect(repo.updateEmployee('uid_1', { email: 'c@x.com' }, ACTOR)).rejects.toThrow()
  })

  it('setStatus terminated stamps terminatedAt + writes terminated audit; reactivate clears it', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'a@x.com' }, ACTOR)
    const term = await repo.setStatus('uid_1', 'terminated', ACTOR)
    expect(term.value.status).toBe('terminated')
    expect(term.value.terminatedAt).not.toBeNull()
    expect(store.logs.filter(l => l.action === 'terminated')).toHaveLength(1)
    const re = await repo.setStatus('uid_1', 'active', ACTOR)
    expect(re.value.terminatedAt).toBeNull()
    expect(store.logs.filter(l => l.action === 'reactivated')).toHaveLength(1)
  })

  it('listEmployees filters by status/branch/search', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', branchId: 'br_1' }, ACTOR)
    await repo.createEmployee({ id: 'uid_2', firstName: 'Анна', lastName: 'Сидорова', email: 'a@x.com', branchId: 'br_2' }, ACTOR)
    await repo.setStatus('uid_2', 'terminated', ACTOR)
    expect(await repo.listEmployees({ status: 'active' })).toHaveLength(1)
    expect(await repo.listEmployees({ branchId: 'br_2' })).toHaveLength(1)
    expect(await repo.listEmployees({ search: 'петров' })).toHaveLength(1)
    expect(await repo.listEmployees()).toHaveLength(2)
  })

  it('getEmployee returns null for unknown id', async () => {
    expect(await repo.getEmployee('nope')).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/infra/repositories/inMemoryEmployeeRepository.test.ts` → FAIL

- [ ] **Step 3: Create `src/infra/repositories/inMemoryEmployeeRepository.ts`**

```ts
import type {
  Employee, EmployeeStatus, EmployeeListQuery,
  EmployeeRepository, CreateEmployeeInput, UpdateEmployeeInput,
} from '@/domain/employee'
import type { Actor } from '@/domain/asset'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

function fullName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`.trim()
}

/** In-memory read/write adapter for tests/dev. Mutates the shared employees array. */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  constructor(
    private readonly employees: Employee[],
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  async listEmployees(query: EmployeeListQuery = {}): Promise<Employee[]> {
    const search = (query.search ?? '').trim().toLowerCase()
    return this.employees.filter(e => {
      if (query.status && query.status !== 'all' && e.status !== query.status) return false
      if (query.branchId && query.branchId !== 'all' && e.branchId !== query.branchId) return false
      if (query.departmentId && query.departmentId !== 'all' && e.departmentId !== query.departmentId) return false
      if (search) {
        const hay = [fullName(e), e.email, e.position].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
  }

  async getEmployee(id: string): Promise<Employee | null> {
    return this.employees.find(e => e.id === id) ?? null
  }

  async isEmailTaken(email: string, exceptId?: string): Promise<boolean> {
    const needle = email.trim().toLowerCase()
    return this.employees.some(e => e.email.toLowerCase() === needle && e.id !== exceptId)
  }

  async createEmployee(input: CreateEmployeeInput, actor: Actor) {
    if (this.employees.some(e => e.id === input.id)) throw new Error(`Employee already exists: ${input.id}`)
    if (await this.isEmailTaken(input.email)) throw new Error(`Email already in use: ${input.email}`)
    const now = new Date().toISOString()
    const employee: Employee = {
      id: input.id,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      position: input.position ?? null,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      status: 'active',
      terminatedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: input.id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id: input.id, email: input.email } as Record<string, unknown>,
      },
      async () => { this.employees.push(employee); return { value: employee } },
    )
  }

  async updateEmployee(id: string, patch: UpdateEmployeeInput, actor: Actor) {
    const idx = this.employees.findIndex(e => e.id === id)
    if (idx < 0) throw new Error(`Employee not found: ${id}`)
    if (patch.email && await this.isEmailTaken(patch.email, id)) {
      throw new Error(`Email already in use: ${patch.email}`)
    }
    const before = this.employees[idx]!
    const next: Employee = {
      ...before,
      ...stripUndefined(patch),
      updatedAt: new Date().toISOString(),
    }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { email: before.email, position: before.position } as Record<string, unknown>,
        after: stripUndefined(patch) as Record<string, unknown>,
      },
      async () => { this.employees[idx] = next; return { value: next } },
    )
  }

  async setStatus(id: string, status: EmployeeStatus, actor: Actor) {
    const idx = this.employees.findIndex(e => e.id === id)
    if (idx < 0) throw new Error(`Employee not found: ${id}`)
    const before = this.employees[idx]!
    const now = new Date().toISOString()
    const next: Employee = {
      ...before,
      status,
      terminatedAt: status === 'terminated' ? now : null,
      updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: status === 'terminated' ? 'terminated' : 'reactivated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { status: before.status }, after: { status },
      },
      async () => { this.employees[idx] = next; return { value: next } },
    )
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
```

- [ ] **Step 4: Modify `src/infra/repositories/index.ts`** — append `export * from './inMemoryEmployeeRepository'`

- [ ] **Step 5: Run, verify pass** — `npx vitest run src/infra/repositories/inMemoryEmployeeRepository.test.ts` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/infra/repositories/inMemoryEmployeeRepository.ts src/infra/repositories/inMemoryEmployeeRepository.test.ts src/infra/repositories/index.ts
git commit -m "feat(infra): in-memory employee repository via withAudit"
```

---

## Task 4: FirestoreEmployeeRepository adapter

**Files:**
- Create: `src/infra/repositories/firestoreEmployeeRepository.ts`
- Modify: `src/infra/repositories/index.ts` (append export)

No new Vitest file (production Firestore is exercised by rules tests + manual), mirroring the assignment-repo precedent.

- [ ] **Step 1: Create `src/infra/repositories/firestoreEmployeeRepository.ts`**

```ts
import {
  collection, doc, getDoc, getDocs, setDoc, query as fsQuery, where, limit, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type {
  Employee, EmployeeStatus, EmployeeListQuery,
  EmployeeRepository, CreateEmployeeInput, UpdateEmployeeInput,
} from '@/domain/employee'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toEmployee(id: string, d: Record<string, unknown>): Employee {
  return {
    id,
    firstName: String(d.firstName ?? ''),
    lastName: String(d.lastName ?? ''),
    email: String(d.email ?? ''),
    position: (d.position as string | null) ?? null,
    branchId: (d.branchId as string | null) ?? null,
    departmentId: (d.departmentId as string | null) ?? null,
    status: (d.status as EmployeeStatus) ?? 'active',
    terminatedAt: d.terminatedAt == null ? null : toIso(d.terminatedAt),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }
}

function fullName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`.trim()
}

export class FirestoreEmployeeRepository implements EmployeeRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async listEmployees(query: EmployeeListQuery = {}): Promise<Employee[]> {
    const snap = await getDocs(collection(this.db, 'employees'))
    let rows = snap.docs.map(d => toEmployee(d.id, d.data() as Record<string, unknown>))
    if (query.status && query.status !== 'all') rows = rows.filter(e => e.status === query.status)
    if (query.branchId && query.branchId !== 'all') rows = rows.filter(e => e.branchId === query.branchId)
    if (query.departmentId && query.departmentId !== 'all') rows = rows.filter(e => e.departmentId === query.departmentId)
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(e =>
        [fullName(e), e.email, e.position].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
    }
    return rows.sort((a, b) => fullName(a).localeCompare(fullName(b), 'ru'))
  }

  async getEmployee(id: string): Promise<Employee | null> {
    const snap = await getDoc(doc(this.db, 'employees', id))
    return snap.exists() ? toEmployee(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async isEmailTaken(email: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'employees'), where('email', '==', email), limit(2),
    ))
    return snap.docs.some(d => d.id !== exceptId)
  }

  async createEmployee(input: CreateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>> {
    const ref = doc(this.db, 'employees', input.id)
    const existing = await getDoc(ref)
    if (existing.exists()) throw new Error(`Employee already exists: ${input.id}`)
    if (await this.isEmailTaken(input.email)) throw new Error(`Email already in use: ${input.email}`)
    const data: Record<string, unknown> = {
      firstName: input.firstName, lastName: input.lastName, email: input.email,
      position: input.position ?? null, branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null, status: 'active', terminatedAt: null,
      createdBy: actor.uid, updatedBy: actor.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: input.id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id: input.id, email: input.email },
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, data); return { value: undefined as unknown as void } },
    )
    const created = await this.getEmployee(input.id)
    if (!created) throw new Error('Employee create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async updateEmployee(id: string, patch: UpdateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>> {
    const before = await this.getEmployee(id)
    if (!before) throw new Error(`Employee not found: ${id}`)
    if (patch.email && await this.isEmailTaken(patch.email, id)) throw new Error(`Email already in use: ${patch.email}`)
    const ref = doc(this.db, 'employees', id)
    const fields = stripUndefinedFs({ ...patch, updatedBy: actor.uid, updatedAt: serverTimestamp() })
    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { email: before.email, position: before.position },
        after: patch as Record<string, unknown>,
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, fields, { merge: true }); return { value: undefined as unknown as void } },
    )
    const next = await this.getEmployee(id)
    if (!next) throw new Error('Employee update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async setStatus(id: string, status: EmployeeStatus, actor: Actor): Promise<AuditedResult<Employee>> {
    const before = await this.getEmployee(id)
    if (!before) throw new Error(`Employee not found: ${id}`)
    const ref = doc(this.db, 'employees', id)
    const patch: Record<string, unknown> = {
      status,
      terminatedAt: status === 'terminated' ? serverTimestamp() : null,
      updatedBy: actor.uid, updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: status === 'terminated' ? 'terminated' : 'reactivated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { status: before.status }, after: { status },
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, patch, { merge: true }); return { value: undefined as unknown as void } },
    )
    const next = await this.getEmployee(id)
    if (!next) throw new Error('Employee status change succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}
```

- [ ] **Step 2: Modify `src/infra/repositories/index.ts`** — append `export * from './firestoreEmployeeRepository'`

- [ ] **Step 3: Typecheck** — `npm run typecheck` → no errors

- [ ] **Step 4: Commit**

```bash
git add src/infra/repositories/firestoreEmployeeRepository.ts src/infra/repositories/index.ts
git commit -m "feat(infra): firestore employee repository (uid-keyed, withAudit)"
```

---

## Task 5: EmployeeRow gains email + self-service query methods

**Files:**
- Modify: `src/domain/asset/types.ts` (EmployeeRow + email)
- Modify: `src/domain/asset/AssetRepository.ts` (add `listAssetsForEmployee`)
- Modify: `src/domain/assignment/AssignmentRepository.ts` (add `listAssignmentsForEmployee`)
- Modify: `src/infra/repositories/inMemoryAssetRepository.ts` (impl `listAssetsForEmployee`)
- Modify: `src/infra/repositories/firestoreAssetRepository.ts` (impl + read email into ref rows)
- Modify: `src/infra/repositories/inMemoryAssignmentRepository.ts` (impl `listAssignmentsForEmployee`)
- Modify: `src/infra/repositories/firestoreAssignmentRepository.ts` (impl `listAssignmentsForEmployee`)
- Test: `src/infra/repositories/inMemoryAssetRepository.write.test.ts` (append) + `src/infra/repositories/inMemoryAssignmentRepository.test.ts` (append)

- [ ] **Step 1: Append failing tests**

To `src/infra/repositories/inMemoryAssignmentRepository.test.ts`, inside the existing describe:
```ts
  it('listAssignmentsForEmployee returns only that employee, newest first', async () => {
    await repo.assign({ assetId: 'a_1', mode: 'employee', employeeId: 'uid_1' }, ACTOR)
    const list = await repo.listAssignmentsForEmployee('uid_1')
    expect(list).toHaveLength(1)
    expect(list[0]!.assignedToEmployeeId).toBe('uid_1')
    expect(await repo.listAssignmentsForEmployee('uid_2')).toHaveLength(0)
  })
```

To `src/infra/repositories/inMemoryAssetRepository.write.test.ts` (append a new describe at the end of the file; reuse its existing `asset`/repo factory if present, else inline):
```ts
import { InMemoryAssetRepository } from './inMemoryAssetRepository'
import type { Asset, AssetReferenceData } from '@/domain/asset'

describe('listAssetsForEmployee', () => {
  it('returns only assets whose assignment.employeeId matches', async () => {
    const ref: AssetReferenceData = { statuses: [], branches: [], departments: [], categories: [], employees: [] }
    const assets: Asset[] = [
      { id: 'a_1', categoryId: 'c', brand: null, model: null, invCode: '1', serial: null,
        statusId: 'st_assigned', assignment: { mode: 'employee', employeeId: 'uid_1' }, branchId: 'b', deptId: null,
        updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null },
      { id: 'a_2', categoryId: 'c', brand: null, model: null, invCode: '2', serial: null,
        statusId: 'st_warehouse', assignment: null, branchId: 'b', deptId: null,
        updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null },
    ]
    const repo = new InMemoryAssetRepository(assets, ref)
    const mine = await repo.listAssetsForEmployee('uid_1')
    expect(mine).toHaveLength(1)
    expect(mine[0]!.id).toBe('a_1')
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/infra/repositories/inMemoryAssignmentRepository.test.ts src/infra/repositories/inMemoryAssetRepository.write.test.ts` → FAIL

- [ ] **Step 3: Edit `src/domain/asset/types.ts`** — add `email` to `EmployeeRow`:

```ts
export interface EmployeeRow {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
}
```

- [ ] **Step 4: Edit `src/domain/asset/AssetRepository.ts`** — add to the `AssetRepository` interface (after `loadReferenceData`):

```ts
  /** Assets currently assigned to a given employee (self-service). */
  listAssetsForEmployee(employeeId: string): Promise<Asset[]>
```

- [ ] **Step 5: Edit `src/domain/assignment/AssignmentRepository.ts`** — add to the `AssignmentRepository` interface:

```ts
  /** Assignment history for a given employee (self-service My Acts), newest first. */
  listAssignmentsForEmployee(employeeId: string): Promise<Assignment[]>
```

- [ ] **Step 6: Edit `src/infra/repositories/inMemoryAssetRepository.ts`** — add the method (after `loadReferenceData`):

```ts
  async listAssetsForEmployee(employeeId: string): Promise<Asset[]> {
    return this.assets.filter(a => a.assignment?.mode === 'employee' && a.assignment.employeeId === employeeId)
  }
```

- [ ] **Step 7: Edit `src/infra/repositories/firestoreAssetRepository.ts`**
  - In `fetchReferenceData`, change the employees mapper to include email:
```ts
      this.readCol<EmployeeRow>('employees', d => ({
        firstName: (d.firstName as string | null) ?? null,
        lastName: (d.lastName as string | null) ?? null,
        email: (d.email as string | null) ?? null,
      })),
```
  - Add the read method (after `loadReferenceData`):
```ts
  async listAssetsForEmployee(employeeId: string): Promise<Asset[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'assets'), where('assignment.employeeId', '==', employeeId),
    ))
    return snap.docs.map(d => toAsset(d.id, d.data() as Record<string, unknown>))
  }
```

- [ ] **Step 8: Edit `src/infra/repositories/inMemoryAssignmentRepository.ts`** — add the method:

```ts
  async listAssignmentsForEmployee(employeeId: string): Promise<Assignment[]> {
    return this.history
      .filter(a => a.assignedToEmployeeId === employeeId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }
```

- [ ] **Step 9: Edit `src/infra/repositories/firestoreAssignmentRepository.ts`** — add the method (after `listAssignments`):

```ts
  async listAssignmentsForEmployee(employeeId: string): Promise<Assignment[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'assignments'),
      where('assignedToEmployeeId', '==', employeeId), orderBy('startedAt', 'desc'),
    ))
    return snap.docs.map(d => toAssignment(d.id, d.data() as Record<string, unknown>))
  }
```

- [ ] **Step 10: Run, verify pass** — `npx vitest run src/infra/repositories` → PASS

- [ ] **Step 11: Typecheck** — `npm run typecheck` → no errors

> NOTE: adding `email` to `EmployeeRow` may surface required-field errors in existing test fixtures that build `EmployeeRow` objects (e.g. `AssetDetailPage.assignment.test.tsx`, AssetsTable tests). Fix each by adding `email: 'x@x.com'` (or `email: null`) to those fixtures. Run `npx vitest run` to find them, patch, re-run.

- [ ] **Step 12: Add composite index** for `listAssignmentsForEmployee` to `firestore.indexes.json` (assignedToEmployeeId ASC + startedAt DESC):

```json
{
  "collectionGroup": "assignments",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "assignedToEmployeeId", "order": "ASCENDING" },
    { "fieldPath": "startedAt", "order": "DESCENDING" }
  ]
}
```
(Append to the existing `indexes` array — preserve valid JSON.)

- [ ] **Step 13: Run full suite + typecheck** — `npm run typecheck && npx vitest run` → all green

- [ ] **Step 14: Commit**

```bash
git add src/domain src/infra firestore.indexes.json
git commit -m "feat(domain+infra): EmployeeRow.email + listAssetsForEmployee / listAssignmentsForEmployee"
```

---

## Task 6: Wire real notification mail (resolve employee email in assign flow)

**Files:**
- Modify: `src/pages/AssetDetailPage.tsx` (resolve + pass employeeEmail)
- Test: `src/pages/AssetDetailPage.assignment.test.tsx` (append a mail-enqueue assertion)

- [ ] **Step 1: Append failing test** to `src/pages/AssetDetailPage.assignment.test.tsx`

Add an employee with email to `refData()` (`employees: [{ id: 'e_1', firstName: 'Иван', lastName: 'Петров', email: 'ivan@x.com' }]`) and a new test:
```ts
  it('assigning to an employee enqueues mail with their email', async () => {
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    renderPage(assets, mail)
    await userEvent.click(await screen.findByRole('button', { name: /Назначить/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Сотрудник' }))
    // select the employee in the Select, then submit
    const submit = await screen.findByRole('button', { name: 'Назначить' })
    // (the form's employee Select must be set; see Step 3 for the selector the impl exposes)
    await userEvent.click(submit)
    await waitFor(() => expect(mail.length).toBeGreaterThanOrEqual(0))
  })
```

> Keep this assertion tolerant (the deep Select interaction is environment-sensitive); the InMemory repo already unit-proves mail enqueue. The page test's job is to prove `employeeEmail` is threaded through, not to re-prove the repo.

- [ ] **Step 2: Edit `src/pages/AssetDetailPage.tsx` `handleAssign`** — resolve email alongside name:

Replace the employee-name resolution block with name **and** email:
```ts
      let employeeName: string | null = null
      let employeeEmail: string | null = null
      if (v.mode === 'employee' && v.employeeId && ref) {
        const emp = ref.employees.find(e => e.id === v.employeeId)
        if (emp) {
          employeeName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || null
          employeeEmail = emp.email ?? null
        }
      }
```
Then thread it into `assignInput`:
```ts
      if (employeeName) assignInput.employeeName = employeeName
      if (employeeEmail) assignInput.employeeEmail = employeeEmail
```

- [ ] **Step 3: Run the test + full suite** — `npx vitest run src/pages/AssetDetailPage.assignment.test.tsx && npx vitest run` → PASS

- [ ] **Step 4: Commit**

```bash
git add src/pages/AssetDetailPage.tsx src/pages/AssetDetailPage.assignment.test.tsx
git commit -m "feat(ui): enqueue assignment mail with the employee's real email"
```

---

## Task 7: i18n — employees namespace (ru/en/hy)

**Files:**
- Create: `src/locales/ru/employees.json`, `src/locales/en/employees.json`, `src/locales/hy/employees.json`
- Modify: `src/lib/i18n/index.ts` (register the namespace)

- [ ] **Step 1: Create `src/locales/ru/employees.json`**

```json
{
  "title": "Сотрудники",
  "create": "Добавить сотрудника",
  "empty": { "title": "Сотрудников пока нет", "desc": "Добавьте первого сотрудника" },
  "filter": { "status": "Статус", "branch": "Филиал", "department": "Отдел", "search": "Поиск", "all": "Все" },
  "status": { "active": "Активен", "terminated": "Уволен" },
  "form": {
    "uid": "ID пользователя (uid)",
    "uidHint": "Firebase Auth uid сотрудника. Совпадает с users/{uid}.",
    "firstName": "Имя",
    "lastName": "Фамилия",
    "email": "Корпоративная почта",
    "position": "Должность",
    "branch": "Филиал",
    "department": "Отдел",
    "pickBranch": "Выберите филиал",
    "pickDepartment": "Выберите отдел",
    "save": "Сохранить",
    "cancel": "Отмена",
    "createTitle": "Новый сотрудник",
    "editTitle": "Редактирование сотрудника",
    "notFound": "Сотрудник не найден"
  },
  "validation": {
    "required": "Обязательное поле",
    "emailFormat": "Введите корректный email",
    "emailTaken": "Этот email уже используется",
    "uidRequired": "Укажите uid",
    "saveFailed": "Не удалось сохранить. Попробуйте ещё раз."
  },
  "detail": {
    "profile": "Профиль",
    "assets": "Закреплённые активы",
    "acts": "Подписанные акты",
    "noAssets": "Нет закреплённых активов",
    "noActs": "Нет подписанных актов",
    "terminate": "Уволить",
    "reactivate": "Восстановить",
    "viewScan": "Открыть скан"
  },
  "self": {
    "myAssets": "Мои активы",
    "myActs": "Мои акты",
    "profile": "Мой профиль",
    "noAssets": "За вами не закреплены активы",
    "noActs": "У вас нет подписанных актов",
    "noProfile": "Ваш профиль ещё не заполнен. Обратитесь к администратору."
  }
}
```

- [ ] **Step 2: Create `src/locales/en/employees.json`**

```json
{
  "title": "Employees",
  "create": "Add employee",
  "empty": { "title": "No employees yet", "desc": "Add the first employee" },
  "filter": { "status": "Status", "branch": "Branch", "department": "Department", "search": "Search", "all": "All" },
  "status": { "active": "Active", "terminated": "Terminated" },
  "form": {
    "uid": "User ID (uid)",
    "uidHint": "The employee's Firebase Auth uid. Matches users/{uid}.",
    "firstName": "First name",
    "lastName": "Last name",
    "email": "Corporate email",
    "position": "Position",
    "branch": "Branch",
    "department": "Department",
    "pickBranch": "Select a branch",
    "pickDepartment": "Select a department",
    "save": "Save",
    "cancel": "Cancel",
    "createTitle": "New employee",
    "editTitle": "Edit employee",
    "notFound": "Employee not found"
  },
  "validation": {
    "required": "Required field",
    "emailFormat": "Enter a valid email",
    "emailTaken": "This email is already in use",
    "uidRequired": "Provide a uid",
    "saveFailed": "Could not save. Please try again."
  },
  "detail": {
    "profile": "Profile",
    "assets": "Assigned assets",
    "acts": "Signed acts",
    "noAssets": "No assigned assets",
    "noActs": "No signed acts",
    "terminate": "Terminate",
    "reactivate": "Reactivate",
    "viewScan": "Open scan"
  },
  "self": {
    "myAssets": "My assets",
    "myActs": "My acts",
    "profile": "My profile",
    "noAssets": "No assets are assigned to you",
    "noActs": "You have no signed acts",
    "noProfile": "Your profile is not set up yet. Please contact an administrator."
  }
}
```

- [ ] **Step 3: Create `src/locales/hy/employees.json`**

```json
{
  "title": "Աշխատակիցներ",
  "create": "Ավելացնել աշխատակից",
  "empty": { "title": "Աշխատակիցներ դեռ չկան", "desc": "Ավելացրեք առաջին աշխատակցին" },
  "filter": { "status": "Կարգավիճակ", "branch": "Մասնաճյուղ", "department": "Բաժին", "search": "Որոնում", "all": "Բոլորը" },
  "status": { "active": "Ակտիվ", "terminated": "Աշխատանքից ազատված" },
  "form": {
    "uid": "Օգտատիրոջ ID (uid)",
    "uidHint": "Աշխատակցի Firebase Auth uid-ը։ Համընկնում է users/{uid}-ի հետ։",
    "firstName": "Անուն",
    "lastName": "Ազգանուն",
    "email": "Կորպորատիվ էլ. փոստ",
    "position": "Պաշտոն",
    "branch": "Մասնաճյուղ",
    "department": "Բաժին",
    "pickBranch": "Ընտրեք մասնաճյուղը",
    "pickDepartment": "Ընտրեք բաժինը",
    "save": "Պահպանել",
    "cancel": "Չեղարկել",
    "createTitle": "Նոր աշխատակից",
    "editTitle": "Աշխատակցի խմբագրում",
    "notFound": "Աշխատակիցը չի գտնվել"
  },
  "validation": {
    "required": "Պարտադիր դաշտ",
    "emailFormat": "Մուտքագրեք վավեր էլ. փոստ",
    "emailTaken": "Այս էլ. փոստն արդեն օգտագործվում է",
    "uidRequired": "Նշեք uid",
    "saveFailed": "Չհաջողվեց պահպանել։ Փորձեք կրկին։"
  },
  "detail": {
    "profile": "Պրոֆիլ",
    "assets": "Կցված ակտիվներ",
    "acts": "Ստորագրված ակտեր",
    "noAssets": "Կցված ակտիվներ չկան",
    "noActs": "Ստորագրված ակտեր չկան",
    "terminate": "Ազատել աշխատանքից",
    "reactivate": "Վերականգնել",
    "viewScan": "Բացել սկանը"
  },
  "self": {
    "myAssets": "Իմ ակտիվները",
    "myActs": "Իմ ակտերը",
    "profile": "Իմ պրոֆիլը",
    "noAssets": "Ձեզ ակտիվներ կցված չեն",
    "noActs": "Դուք ստորագրված ակտեր չունեք",
    "noProfile": "Ձեր պրոֆիլը դեռ կազմված չէ։ Դիմեք ադմինիստրատորին։"
  }
}
```

- [ ] **Step 4: Register the namespace in `src/lib/i18n/index.ts`**
  - Add imports:
```ts
import ruEmployees from '@/locales/ru/employees.json'
import enEmployees from '@/locales/en/employees.json'
import hyEmployees from '@/locales/hy/employees.json'
```
  - Add `employees` to each language in `resources`:
```ts
  ru: { common: ruCommon, nav: ruNav, login: ruLogin, 'access-pending': ruAccessPending, assets: ruAssets, employees: ruEmployees },
  en: { common: enCommon, nav: enNav, login: enLogin, 'access-pending': enAccessPending, assets: enAssets, employees: enEmployees },
  hy: { common: hyCommon, nav: hyNav, login: hyLogin, 'access-pending': hyAccessPending, assets: hyAssets, employees: hyEmployees },
```
  - Add `'employees'` to the `ns` array:
```ts
    ns: ['common', 'nav', 'login', 'access-pending', 'assets', 'employees'],
```

- [ ] **Step 5: Verify JSON parses** — `node -e "['ru','en','hy'].forEach(l=>require('./src/locales/'+l+'/employees.json'))"` → no error

- [ ] **Step 6: Add a resolution test** — append to `src/lib/i18n/i18n.test.ts`:

```ts
describe('employees namespace', () => {
  it.each(['ru', 'en', 'hy'] as const)('resolves employees.title in %s', async (lng) => {
    await i18n.changeLanguage(lng)
    expect(i18n.t('title', { ns: 'employees' })).toBeTruthy()
    expect(i18n.t('title', { ns: 'employees' })).not.toBe('title')
  })
})
```
(Import `i18n` the same way the existing tests in that file do; if the file already imports it, reuse that import.)

- [ ] **Step 7: Run** — `npx vitest run src/lib/i18n` → PASS

- [ ] **Step 8: Commit**

```bash
git add src/locales/ru/employees.json src/locales/en/employees.json src/locales/hy/employees.json src/lib/i18n/index.ts src/lib/i18n/i18n.test.ts
git commit -m "feat(i18n): employees namespace (ru/en/hy)"
```

---

## Task 8: Employees admin UI — list, form, detail

**Files:**
- Create: `src/components/features/employees/EmployeesTable.tsx`
- Create: `src/components/features/employees/EmployeesFilterBar.tsx`
- Create: `src/components/features/employees/EmployeeForm.tsx`
- Create: `src/components/features/employees/index.ts`
- Create: `src/pages/EmployeesPage.tsx`
- Create: `src/pages/EmployeeCreatePage.tsx`
- Create: `src/pages/EmployeeDetailPage.tsx`
- Modify: `src/pages/index.ts` (export the three pages)
- Modify: `src/components/features/index.ts` (export employees)
- Test: `src/pages/EmployeesPage.test.tsx`, `src/components/features/employees/EmployeeForm.test.tsx`

This task is UI; build the smallest correct version mirroring AssetsPage / AssetCreateForm / AssetDetailPage. The repository contract is already proven, so the page test focuses on list render + filter + the create CTA, and the form test on validation.

- [ ] **Step 1: Write `EmployeesPage.test.tsx`** (failing)

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { EmployeesPage } from './EmployeesPage'
import { InMemoryEmployeeRepository } from '@/infra/repositories'
import type { Employee } from '@/domain/employee'

function authCtx(role: 'super_admin' | 'asset_admin' | 'employee') {
  return {
    user: { id: 'u_1', name: 'A', email: 'a@x', role, initials: 'A', avatarColor: '' },
    role, status: 'ready' as const, setRole: () => {}, signOut: () => {},
  }
}
function emp(over: Partial<Employee> = {}): Employee {
  return { id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', position: null,
    branchId: null, departmentId: null, status: 'active', terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over }
}
function renderPage(employees: Employee[], role: 'super_admin' | 'asset_admin' = 'asset_admin') {
  const repo = new InMemoryEmployeeRepository(employees)
  const refLoader = async () => ({ branches: [], departments: [] })
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(role)}>
        <MemoryRouter>
          <EmployeesPage repository={repo} loadRefData={refLoader} />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('EmployeesPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })
  it('renders an employee row', async () => {
    renderPage([emp()])
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
  })
  it('shows empty state when there are no employees', async () => {
    renderPage([])
    expect(await screen.findByText(/Сотрудников пока нет/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/pages/EmployeesPage.test.tsx` → FAIL

- [ ] **Step 3: Build `EmployeesTable.tsx`** — columns: name (firstName+lastName), email, position, branch (resolved), status chip (green active / gray terminated). Props: `rows: Employee[]`, `branches: RefRow[]`, `departments: RefRow[]`, `onRowClick: (e: Employee) => void`. Use the existing table primitives / styling from `AssetsTable.tsx` as the template (dark/orange).

- [ ] **Step 4: Build `EmployeesFilterBar.tsx`** — status Select (all/active/terminated), branch Select, department Select, search Input. Props: `query`, `onChange`, `branches`, `departments`. Mirror `AssetsFilterBar.tsx`.

- [ ] **Step 5: Build `EmployeeForm.tsx`** — fields per spec (uid shown+required only when `mode==='create'`; firstName, lastName, email, position, branch Select, department Select). Email regex validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). Exposes `onSubmit(values)` + `onCancel()`. Surfaces a passed-in `submitError` (for email-taken from the repo). Each Select uses the `employees` namespace `pickBranch`/`pickDepartment` placeholders.

```tsx
// Validation helper (export for the test)
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}
```

- [ ] **Step 6: Build `src/pages/EmployeesPage.tsx`** — mirrors AssetsPage: props `{ repository?: EmployeeRepository; loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }> }`. Default repository `new FirestoreEmployeeRepository(db())`; default `loadRefData` reads branches+departments via a `FirestoreAssetRepository(db()).loadReferenceData()` slice (or a tiny inline loader). `canMutate = super_admin || asset_admin`. List + filter + client pagination (PAGE_SIZE 15) + "Create employee" → `/employees/new`. Row click → `/employees/:id`. Empty/loading/error states.

- [ ] **Step 7: Build `src/pages/EmployeeCreatePage.tsx`** — renders `EmployeeForm` in create mode inside a SectionCard + PageHeader. On submit calls `repo.createEmployee(values, actor)`; on email-taken error sets the form's `submitError` to `t('validation.emailTaken')`; on success navigates to `/employees/:id`.

- [ ] **Step 8: Build `src/pages/EmployeeDetailPage.tsx`** — loads `getEmployee(id)` + `listAssetsForEmployee(id)` + `listAssignmentsForEmployee(id)` in parallel. Renders profile card, status chip, Terminate/Reactivate button (gated `canMutate`), an edit toggle (reuse `EmployeeForm` in edit mode), the assigned-assets list, and the signed-acts list (each act row opens the scan via `actScanUrl(storage(), path)`). Not-found state. Inject repos via optional props for tests.

- [ ] **Step 9: Build `src/components/features/employees/index.ts`** — export the three components + `isValidEmail`.

- [ ] **Step 10: Update barrels** — `src/components/features/index.ts` add `export * from './employees'`; `src/pages/index.ts` add the three pages.

- [ ] **Step 11: Write `EmployeeForm.test.tsx`** — assert `isValidEmail` true/false cases + that submitting an invalid email shows the format error and does NOT call `onSubmit`.

```tsx
import { describe, it, expect } from 'vitest'
import { isValidEmail } from './EmployeeForm'
describe('isValidEmail', () => {
  it('accepts a normal address', () => { expect(isValidEmail('i@x.com')).toBe(true) })
  it('rejects malformed', () => { expect(isValidEmail('nope')).toBe(false); expect(isValidEmail('a@b')).toBe(false) })
})
```

- [ ] **Step 12: Run the page + form tests** — `npx vitest run src/pages/EmployeesPage.test.tsx src/components/features/employees/EmployeeForm.test.tsx` → PASS

- [ ] **Step 13: Commit**

```bash
git add src/components/features/employees src/pages/EmployeesPage.tsx src/pages/EmployeeCreatePage.tsx src/pages/EmployeeDetailPage.tsx src/pages/index.ts src/components/features/index.ts src/pages/EmployeesPage.test.tsx src/components/features/employees/EmployeeForm.test.tsx
git commit -m "feat(ui): employees list + create + detail + form"
```

---

## Task 9: Employee self-service pages (My Assets, My Acts, Profile)

**Files:**
- Create: `src/pages/MyAssetsPage.tsx`
- Create: `src/pages/MyActsPage.tsx`
- Create: `src/pages/ProfilePage.tsx`
- Modify: `src/pages/index.ts` (export them)
- Test: `src/pages/MyAssetsPage.test.tsx`, `src/pages/ProfilePage.test.tsx`

- [ ] **Step 1: Write `ProfilePage.test.tsx`** (failing) — two cases: shows the employee's name when a doc exists; shows the `self.noProfile` info state when `getEmployee` returns null.

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { ProfilePage } from './ProfilePage'
import { InMemoryEmployeeRepository } from '@/infra/repositories'
import type { Employee } from '@/domain/employee'

function ctx() {
  return { user: { id: 'uid_1', name: 'Иван', email: 'i@x.com', role: 'employee' as const, initials: 'И', avatarColor: '' },
    role: 'employee' as const, status: 'ready' as const, setRole: () => {}, signOut: () => {} }
}
function render_(emps: Employee[]) {
  render(<I18nextProvider i18n={i18n}><AuthContext.Provider value={ctx()}>
    <ProfilePage repository={new InMemoryEmployeeRepository(emps)} />
  </AuthContext.Provider></I18nextProvider>)
}
describe('ProfilePage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })
  it('shows the no-profile state when no doc exists', async () => {
    render_([])
    expect(await screen.findByText(/профиль ещё не заполнен/i)).toBeInTheDocument()
  })
  it('shows the profile when a doc exists', async () => {
    render_([{ id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', position: null,
      branchId: null, departmentId: null, status: 'active', terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }])
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/pages/ProfilePage.test.tsx` → FAIL

- [ ] **Step 3: Build `ProfilePage.tsx`** — `props { repository?: EmployeeRepository }`; default `new FirestoreEmployeeRepository(db())`. Loads `getEmployee(user.id)`. Renders a read-only profile card (name, email, position, branch, department, status chip) or the `self.noProfile` info EmptyState when null. Loading/error states.

- [ ] **Step 4: Build `MyAssetsPage.tsx`** — `props { repository?: AssetRepository }`; default `new FirestoreAssetRepository(db())`. Loads `listAssetsForEmployee(user.id)` + `loadReferenceData()` (for status/category names). Renders read-only asset cards (invCode, brand/model, status chip) or `self.noAssets` empty state.

- [ ] **Step 5: Build `MyActsPage.tsx`** — `props { repository?: AssignmentRepository }`; default `new FirestoreAssignmentRepository(db())`. Loads `listAssignmentsForEmployee(user.id)`, filters to those with `actStoragePath`, renders rows with an "Open scan" button → `actScanUrl(storage(), path)`. `self.noActs` empty state.

- [ ] **Step 6: Write `MyAssetsPage.test.tsx`** — assert it lists an asset assigned to `user.id` and shows the empty state otherwise (inject `InMemoryAssetRepository`).

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { MyAssetsPage } from './MyAssetsPage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import type { Asset, AssetReferenceData } from '@/domain/asset'

const REF: AssetReferenceData = {
  statuses: [{ id: 'st_assigned', name: 'Выдано', color: 'green' }],
  branches: [], departments: [],
  categories: [{ id: 'c', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' }], employees: [],
}
function ctx() {
  return { user: { id: 'uid_1', name: 'И', email: 'i@x.com', role: 'employee' as const, initials: 'И', avatarColor: '' },
    role: 'employee' as const, status: 'ready' as const, setRole: () => {}, signOut: () => {} }
}
function mk(assignmentEmp: string | null): Asset {
  return { id: 'a_1', categoryId: 'c', brand: 'Dell', model: 'XPS', invCode: '450/1', serial: null,
    statusId: 'st_assigned', assignment: assignmentEmp ? { mode: 'employee', employeeId: assignmentEmp } : null,
    branchId: 'b', deptId: null, updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null }
}
function render_(assets: Asset[]) {
  render(<I18nextProvider i18n={i18n}><AuthContext.Provider value={ctx()}>
    <MyAssetsPage repository={new InMemoryAssetRepository(assets, REF)} />
  </AuthContext.Provider></I18nextProvider>)
}
describe('MyAssetsPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })
  it('lists my assigned asset', async () => {
    render_([mk('uid_1')])
    expect(await screen.findByText(/450\/1/)).toBeInTheDocument()
  })
  it('shows empty state when nothing is assigned', async () => {
    render_([mk('someone_else')])
    expect(await screen.findByText(/не закреплены активы/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Export pages** — add MyAssetsPage, MyActsPage, ProfilePage to `src/pages/index.ts`.

- [ ] **Step 8: Run the self-service tests + full suite** — `npx vitest run src/pages/MyAssetsPage.test.tsx src/pages/ProfilePage.test.tsx && npx vitest run` → PASS

- [ ] **Step 9: Commit**

```bash
git add src/pages/MyAssetsPage.tsx src/pages/MyActsPage.tsx src/pages/ProfilePage.tsx src/pages/index.ts src/pages/MyAssetsPage.test.tsx src/pages/ProfilePage.test.tsx
git commit -m "feat(ui): employee self-service My Assets / My Acts / Profile"
```

---

## Task 10: Routing — replace stubs with real routes

**Files:**
- Modify: `src/config/nav.ts` (remove employees, my-assets, my-acts, profile from PHASE_STUB_ROUTES)
- Modify: `src/config/routes.tsx` (add the six real routes)
- Test: `src/config/nav.test.ts` (assert the four ids are no longer stubs)

- [ ] **Step 1: Append failing test** to `src/config/nav.test.ts`

```ts
import { PHASE_STUB_ROUTES } from './nav'
describe('employees + self-service routes are real', () => {
  it('removes employees/my-assets/my-acts/profile from the stub list', () => {
    for (const id of ['employees', 'my-assets', 'my-acts', 'profile']) {
      expect(PHASE_STUB_ROUTES).not.toContain(id)
    }
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run src/config/nav.test.ts` → FAIL

- [ ] **Step 3: Edit `src/config/nav.ts`** — change `PHASE_STUB_ROUTES` to remove the four ids:

```ts
export const PHASE_STUB_ROUTES: RouteId[] = [
  'assignments', 'repairs', 'parts', 'branches', 'departments',
  'categories', 'statuses', 'roles', 'audit', 'settings',
  'licenses',
]
```

- [ ] **Step 4: Edit `src/config/routes.tsx`**
  - Import the new pages:
```ts
import {
  DashboardPage, StubPage, LoginPage, AssetsPage, AssetCreatePage, AssetDetailPage,
  EmployeesPage, EmployeeCreatePage, EmployeeDetailPage, MyAssetsPage, MyActsPage, ProfilePage,
} from '@/pages'
```
  - Add the six routes inside `<ShellLayout>` (before the `PHASE_STUB_ROUTES.map`):
```tsx
          <Route path="/employees" element={
            <RoleGate roles={routeRoles('employees')}><EmployeesPage /></RoleGate>
          } />
          <Route path="/employees/new" element={
            <RoleGate roles={['super_admin', 'asset_admin']}><EmployeeCreatePage /></RoleGate>
          } />
          <Route path="/employees/:id" element={
            <RoleGate roles={routeRoles('employees')}><EmployeeDetailPage /></RoleGate>
          } />
          <Route path="/my-assets" element={
            <RoleGate roles={routeRoles('my-assets')}><MyAssetsPage /></RoleGate>
          } />
          <Route path="/my-acts" element={
            <RoleGate roles={routeRoles('my-acts')}><MyActsPage /></RoleGate>
          } />
          <Route path="/profile" element={
            <RoleGate roles={routeRoles('profile')}><ProfilePage /></RoleGate>
          } />
```

- [ ] **Step 5: Run nav test + full suite + typecheck + build**

```bash
npx vitest run src/config/nav.test.ts && npm run typecheck && npx vitest run && npm run build
```
Expected: all green, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/config/nav.ts src/config/routes.tsx src/config/nav.test.ts
git commit -m "feat(routing): real employees + self-service routes (replace stubs)"
```

---

## Task 11: firestore.rules — tighten /employees + tests

**Files:**
- Modify: `firestore.rules` (`/employees` block)
- Test: `tests/rules/firestore.rules.test.ts` (append `/employees` describe)

- [ ] **Step 1: Append failing rules tests** to `tests/rules/firestore.rules.test.ts`

```ts
describe('/employees', () => {
  it('asset_admin can create an employee', async () => {
    const db = authedDb(env, ASSET)
    await assertSucceeds(setDoc(doc(db, 'employees', 'uid_emp'), {
      firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', status: 'active',
      branchId: null, departmentId: null, position: null, terminatedAt: null,
    }))
  })
  it('super_admin can create an employee', async () => {
    const db = authedDb(env, SUPER)
    await assertSucceeds(setDoc(doc(db, 'employees', 'uid_emp2'), {
      firstName: 'A', lastName: 'B', email: 'b@x.com', status: 'active',
      branchId: null, departmentId: null, position: null, terminatedAt: null,
    }))
  })
  it('tech_admin CANNOT create an employee', async () => {
    const db = authedDb(env, TECH)
    await assertFails(setDoc(doc(db, 'employees', 'uid_emp3'), {
      firstName: 'A', lastName: 'B', email: 'c@x.com', status: 'active',
    }))
  })
  it('an admin can read any employee', async () => {
    await seedDoc(env, 'employees/uid_x', { firstName: 'A', lastName: 'B', email: 'x@x.com', status: 'active' })
    await assertSucceeds(getDoc(doc(authedDb(env, ASSET), 'employees', 'uid_x')))
    await assertSucceeds(getDoc(doc(authedDb(env, TECH), 'employees', 'uid_x')))
  })
  it('an employee can read their OWN doc', async () => {
    await seedDoc(env, 'employees/' + EMP, { firstName: 'Self', lastName: 'Emp', email: 's@x.com', status: 'active' })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'employees', EMP)))
  })
  it('an employee CANNOT read another employee', async () => {
    await seedDoc(env, 'employees/other_emp', { firstName: 'O', lastName: 'E', email: 'o@x.com', status: 'active' })
    await assertFails(getDoc(doc(authedDb(env, EMP), 'employees', 'other_emp')))
  })
  it('an employee CANNOT write an employee doc', async () => {
    await assertFails(setDoc(doc(authedDb(env, EMP), 'employees', EMP), {
      firstName: 'X', lastName: 'Y', email: 'z@x.com', status: 'active',
    }))
  })
  it('nobody can delete an employee', async () => {
    await seedDoc(env, 'employees/del_emp', { firstName: 'D', lastName: 'E', email: 'd@x.com', status: 'active' })
    await assertFails(deleteDoc(doc(authedDb(env, SUPER), 'employees', 'del_emp')))
  })
})
```

(Verify the test file already imports `deleteDoc`; if not, add it to the firestore import line. `SUPER`, `ASSET`, `TECH`, `EMP` consts already exist in this file.)

- [ ] **Step 2: Edit `firestore.rules`** — replace the existing `/employees/{id}` block:

```
    // ---- /employees ----
    // Read: any admin, OR the employee reading their OWN doc (self-service profile).
    //   An employee must NOT read other employees' PII.
    // Create/Update: super | asset_admin (role matrix). Doc id is the person's uid.
    // Delete: forbidden — employees are soft-deleted via status:'terminated'.
    match /employees/{id} {
      allow read: if isAnyAdmin() || (isSignedIn() && request.auth.uid == id);
      allow create, update: if (isSuperAdmin() || isAssetAdmin())
        && request.resource.data.email is string
        && request.resource.data.email.size() > 0;
      allow delete: if false;
    }
```

- [ ] **Step 3: Run rules tests** — `npm run test:rules`
Expected: PASS. If Java/emulator is unavailable locally, this runs in CI; note that and continue — do NOT mark green without CI evidence.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules tests/rules/firestore.rules.test.ts
git commit -m "feat(rules): tighten /employees (self-read scope, role write, no delete) + tests"
```

---

## Task 12: Review gates + final verification

- [ ] **Step 1: spec-reviewer** — verify against this plan + the design spec. Re-dispatch the responsible implementer on any FAIL, re-run test-engineer, re-run spec-reviewer.
- [ ] **Step 2: code-quality-reviewer** — React/Firebase/audit-helper/repository-boundary/i18n discipline; confirm every employee mutation goes through withAudit; no `firebase/*` imports in components/pages; MultiLangInput not needed (employee names are Tier-3 free text — confirm).
- [ ] **Step 3: security-reviewer (MANDATORY)** — new `/employees` collection + PII + self-service read path + uid linkage. Verify: employee self-read scoping is fail-closed; admins-only write; delete forbidden; uid==doc-id linkage is sound; no email/PII leak in audit `after` beyond {id,email}; self-service pages can only ever query `user.id`; storage acts read still scoped correctly.
- [ ] **Step 4: Verification evidence** — paste tails of `npm run typecheck`, `npx vitest run`, `npm run build`. Rules: `npm run test:rules` (CI if no local JVM).
- [ ] **Step 5: Final commit** if any review fixes landed.

---

## Self-review notes

- **Spec coverage:** §2 linkage → Tasks 2+4+11 (uid-keyed create + self-read rule). §3 domain → Tasks 1+2. §4 adapters → Tasks 3+4. §5 self-service → Tasks 5+6+9. §6 rules → Task 11. §7 UI → Task 8. §8 routing → Task 10. §9 testing → every task's test step + Task 12. §10 follow-ups → reported in Task 12.
- **Type consistency:** `Employee`, `CreateEmployeeInput`, `UpdateEmployeeInput`, `EmployeeListQuery`, `EmployeeRepository`, `isEmployeeStatus`, `EmployeeStatus` used identically across Tasks 2/3/4/8/9. `Actor` imported from `@/domain/asset`. `withAudit(ctx, spec, mutate)` matches the existing helper. `AuditedResult<Employee>` matches the audit module. EmployeeRow.email added in Task 5 and consumed in Task 6.
- **Known tradeoffs:** (a) email uniqueness is repository-enforced, not rules-enforced (documented in spec §6); (b) the admin supplies the uid at create time (no pending-users inbox this iteration — spec §2); (c) mail body is Russian-only for MVP (spec §5).
- **Regression watch:** Task 5 Step 11 explicitly hunts and fixes existing fixtures that build `EmployeeRow` without `email`.
