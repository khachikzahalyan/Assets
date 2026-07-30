import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, limit, serverTimestamp, deleteField,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type {
  Employee, EmployeeStatus, EmployeeListQuery,
  EmployeeRepository, CreateEmployeeInput, UpdateEmployeeInput,
  LastSuperAdminCheck, ActiveAssetsCheck,
} from '@/domain/employee'
import { EmployeeArchiveError, EmployeeEmailTerminatedError } from '@/domain/employee'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'

/**
 * Called after a successful updateEmployee when departmentId changes.
 * Receives the employee id and the NEW departmentId (null = no department).
 * Implementations should update the denormalized deptId field on all assets
 * currently assigned to the employee.
 * This is NOT wrapped in a per-asset audit entry: deptId is a denormalized
 * reflection of employee.departmentId, not an independent asset business event.
 * The change is already captured in the employee 'updated' audit row.
 */
export type OnEmployeeDeptChange = (employeeId: string, newDeptId: string | null) => Promise<void>

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
    preassignedRole: (d.preassignedRole as Employee['preassignedRole']) ?? null,
    terminatedAt: d.terminatedAt == null ? null : toIso(d.terminatedAt),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }
}

function fullName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`.trim()
}

export class FirestoreEmployeeRepository implements EmployeeRepository {
  constructor(
    private readonly db: Firestore,
    private readonly lastSuperAdminCheck?: LastSuperAdminCheck,
    private readonly activeAssetsCheck?: ActiveAssetsCheck,
    private readonly onDeptChange?: OnEmployeeDeptChange,
  ) {}
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
    // Primary: employees collection docs with status === 'terminated'
    const empSnap = await getDocs(collection(this.db, 'employees'))
    const inPlaceTerminated = empSnap.docs
      .map(d => toEmployee(d.id, d.data() as Record<string, unknown>))
      .filter(e => e.status === 'terminated')

    // Legacy fallback: former_employees collection (backward compat for old archived docs)
    const legacySnap = await getDocs(collection(this.db, 'former_employees'))
    const legacyDocs = legacySnap.docs.map(d => toEmployee(d.id, d.data() as Record<string, unknown>))

    // Deduplicate: employees doc wins over legacy former_employees doc with same id
    const byId = new Map<string, Employee>()
    for (const e of legacyDocs) byId.set(e.id, e)
    for (const e of inPlaceTerminated) byId.set(e.id, e) // overwrites legacy if same id

    let rows = Array.from(byId.values())
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

  async findByEmail(email: string): Promise<Employee | null> {
    const trimmed = email.trim()
    const lower = trimmed.toLowerCase()

    // Issue both casing variants in parallel (only one query if already lowercase)
    const queries: Array<Promise<import('firebase/firestore').QuerySnapshot>> = [
      getDocs(fsQuery(collection(this.db, 'employees'), where('email', '==', trimmed), limit(5))),
    ]
    if (lower !== trimmed) {
      queries.push(getDocs(fsQuery(collection(this.db, 'employees'), where('email', '==', lower), limit(5))))
    }
    const results = await Promise.all(queries)
    for (const snap of results) {
      for (const d of snap.docs) {
        return toEmployee(d.id, d.data() as Record<string, unknown>)
      }
    }

    // Legacy fallback: former_employees collection
    const legacyQueries: Array<Promise<import('firebase/firestore').QuerySnapshot>> = [
      getDocs(fsQuery(collection(this.db, 'former_employees'), where('email', '==', trimmed), limit(5))),
    ]
    if (lower !== trimmed) {
      legacyQueries.push(
        getDocs(fsQuery(collection(this.db, 'former_employees'), where('email', '==', lower), limit(5))),
      )
    }
    const legacyResults = await Promise.all(legacyQueries)
    for (const snap of legacyResults) {
      for (const d of snap.docs) {
        return toEmployee(d.id, d.data() as Record<string, unknown>)
      }
    }

    return null
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

    // Check terminated email BEFORE generic email-taken check
    const emailMatch = await this.findByEmail(input.email)
    if (emailMatch) {
      if (emailMatch.status === 'terminated') {
        throw new EmployeeEmailTerminatedError(emailMatch.id, input.email)
      }
      throw new Error(`Email already in use: ${input.email}`)
    }

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
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
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

    // Build before-snapshot covering exactly the fields present in the patch, so
    // the audit log always shows old AND new values for every changed field.
    const beforeSnapshot: Record<string, unknown> = {}
    if (patch.email !== undefined) beforeSnapshot.email = before.email
    if (patch.position !== undefined) beforeSnapshot.position = before.position
    if (patch.phone !== undefined) beforeSnapshot.phone = before.phone
    if (patch.departmentId !== undefined) beforeSnapshot.departmentId = before.departmentId
    if (patch.branchId !== undefined) beforeSnapshot.branchId = before.branchId
    if (patch.firstName !== undefined) beforeSnapshot.firstName = before.firstName
    if (patch.lastName !== undefined) beforeSnapshot.lastName = before.lastName

    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: beforeSnapshot,
        after: patch as Record<string, unknown>,
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, fields, { merge: true }); return { value: undefined as unknown as void } },
    )
    const next = await this.getEmployee(id)
    if (!next) throw new Error('Employee update succeeded but readback failed')

    // Propagate department change to assigned assets (denormalized deptId field).
    // Done outside the employee transaction: deptId is a reflection, not an asset
    // business event, so no per-asset audit entry is written. The change is already
    // captured in the employee 'updated' audit row above.
    if (patch.departmentId !== undefined && this.onDeptChange) {
      await this.onDeptChange(id, patch.departmentId ?? null)
    }

    return { value: next, auditId: r.auditId }
  }

  async archiveEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>> {
    const before = await this.getEmployee(id)
    if (!before) throw new Error(`Employee not found: ${id}`)
    if (id === actor.uid) throw new EmployeeArchiveError('self-archive')
    if (this.lastSuperAdminCheck && await this.lastSuperAdminCheck(id)) {
      throw new EmployeeArchiveError('last-super-admin')
    }
    if (this.activeAssetsCheck && await this.activeAssetsCheck(id)) {
      throw new EmployeeArchiveError('active-assets')
    }

    // In-place status flip: merge-set on employees/{id}
    const ref = doc(this.db, 'employees', id)
    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'terminated',
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { status: before.status }, after: { status: 'terminated' },
      },
      async (txn) => {
        const t = txn as unknown as Transaction
        t.set(ref, {
          status: 'terminated',
          terminatedAt: serverTimestamp(),
          terminatedBy: actor.uid,
          updatedBy: actor.uid,
          updatedAt: serverTimestamp(),
        }, { merge: true })
        return { value: undefined as unknown as void }
      },
    )
    // Offboarding: revoke the linked login account so a fired person can no longer
    // sign in with their old role. Best-effort + idempotent (the employee flip
    // already committed); never blocks termination.
    await this.revokeLinkedAccount(id, actor)
    return { value: { ...before, status: 'terminated', terminatedAt: new Date().toISOString() }, auditId: r.auditId }
  }

  /**
   * Revoke the login account linked to a terminated employee: drop its role and
   * flip status to 'terminated' so it no longer grants access. The link is either
   * invited/linked (users.employeeId == employeeId) or legacy (users/{employeeId}).
   * De-escalation only — never touches a super_admin account, and skips the actor.
   * Best-effort: any failure is swallowed (the account can be revoked manually).
   */
  private async revokeLinkedAccount(employeeId: string, actor: Actor): Promise<void> {
    try {
      let uid: string | null = null
      const linked = await getDocs(
        fsQuery(collection(this.db, 'users'), where('employeeId', '==', employeeId), limit(1)),
      )
      if (!linked.empty) uid = linked.docs[0]!.id
      if (!uid) {
        const legacy = await getDoc(doc(this.db, 'users', employeeId))
        if (legacy.exists()) uid = employeeId
      }
      if (!uid || uid === actor.uid) return

      const snap = await getDoc(doc(this.db, 'users', uid))
      if (!snap.exists()) return
      const data = snap.data() as { role?: string; status?: string }
      if (data.role === 'super_admin') return // never revoke a super via offboarding

      const targetUid = uid
      await withAudit(this.audit,
        {
          entityType: 'user', entityId: targetUid, action: 'terminated',
          actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
          before: { role: data.role ?? null, status: data.status ?? null },
          after: { role: null, status: 'terminated' },
        },
        async (txn) => {
          const t = txn as unknown as Transaction
          t.set(
            doc(this.db, 'users', targetUid),
            { role: deleteField(), status: 'terminated', updatedAt: serverTimestamp() },
            { merge: true },
          )
          return { value: undefined as unknown as void }
        },
      )
    } catch {
      // Best-effort — the employee status flip already succeeded.
    }
  }

  async restoreEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>> {
    // Primary path: in-place terminated doc in employees collection
    const empSnap = await getDoc(doc(this.db, 'employees', id))
    if (empSnap.exists()) {
      const before = toEmployee(empSnap.id, empSnap.data() as Record<string, unknown>)
      const ref = doc(this.db, 'employees', id)
      const r = await withAudit(this.audit,
        {
          entityType: 'employee', entityId: id, action: 'reactivated',
          actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
          before: { status: 'terminated' }, after: { status: 'active' },
        },
        async (txn) => {
          const t = txn as unknown as Transaction
          t.set(ref, {
            status: 'active',
            terminatedAt: null,
            updatedBy: actor.uid,
            updatedAt: serverTimestamp(),
          }, { merge: true })
          return { value: undefined as unknown as void }
        },
      )
      return { value: { ...before, status: 'active', terminatedAt: null }, auditId: r.auditId }
    }

    // Legacy fallback: former_employees collection (backward compat for old archived docs)
    const legacySnap = await getDoc(doc(this.db, 'former_employees', id))
    if (!legacySnap.exists()) throw new Error(`Employee not found for restore: ${id}`)
    const before = toEmployee(legacySnap.id, legacySnap.data() as Record<string, unknown>)
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
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
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
