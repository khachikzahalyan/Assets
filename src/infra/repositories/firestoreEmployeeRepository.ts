import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, limit, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type {
  Employee, EmployeeStatus, EmployeeListQuery,
  EmployeeRepository, CreateEmployeeInput, UpdateEmployeeInput,
  LastSuperAdminCheck,
} from '@/domain/employee'
import { EmployeeArchiveError } from '@/domain/employee'
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
    phone: (d.phone as string | null) ?? null,
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
  constructor(private readonly db: Firestore, private readonly lastSuperAdminCheck?: LastSuperAdminCheck) {}
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

  async listFormerEmployees(query: EmployeeListQuery = {}): Promise<Employee[]> {
    const snap = await getDocs(collection(this.db, 'former_employees'))
    let rows = snap.docs.map(d => toEmployee(d.id, d.data() as Record<string, unknown>))
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
      phone: input.phone ?? null,
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

  async archiveEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>> {
    const before = await this.getEmployee(id)
    if (!before) throw new Error(`Employee not found: ${id}`)
    if (id === actor.uid) throw new EmployeeArchiveError('self-archive')
    if (this.lastSuperAdminCheck && await this.lastSuperAdminCheck(id)) {
      throw new EmployeeArchiveError('last-super-admin')
    }
    const oldRef = doc(this.db, 'employees', id)
    const newRef = doc(this.db, 'former_employees', id)
    const archived: Record<string, unknown> = {
      firstName: before.firstName, lastName: before.lastName, email: before.email,
      phone: before.phone, position: before.position,
      branchId: before.branchId, departmentId: before.departmentId,
      status: 'terminated',
      terminatedAt: serverTimestamp(), terminatedBy: actor.uid,
      createdAt: before.createdAt,
      updatedBy: actor.uid, updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'terminated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { status: before.status }, after: { status: 'terminated' },
      },
      async (txn) => {
        const t = txn as unknown as Transaction
        t.set(newRef, archived)
        t.delete(oldRef)
        return { value: undefined as unknown as void }
      },
    )
    return { value: { ...before, status: 'terminated', terminatedAt: new Date().toISOString() }, auditId: r.auditId }
  }

  async restoreEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>> {
    const snap = await getDoc(doc(this.db, 'former_employees', id))
    if (!snap.exists()) throw new Error(`Former employee not found: ${id}`)
    const before = toEmployee(snap.id, snap.data() as Record<string, unknown>)
    const oldRef = doc(this.db, 'former_employees', id)
    const newRef = doc(this.db, 'employees', id)
    const restored: Record<string, unknown> = {
      firstName: before.firstName, lastName: before.lastName, email: before.email,
      phone: before.phone, position: before.position,
      branchId: before.branchId, departmentId: before.departmentId,
      status: 'active', terminatedAt: null,
      createdAt: before.createdAt,
      updatedBy: actor.uid, updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'reactivated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { status: 'terminated' }, after: { status: 'active' },
      },
      async (txn) => {
        const t = txn as unknown as Transaction
        t.set(newRef, restored)
        t.delete(oldRef)
        return { value: undefined as unknown as void }
      },
    )
    return { value: { ...before, status: 'active', terminatedAt: null }, auditId: r.auditId }
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}
