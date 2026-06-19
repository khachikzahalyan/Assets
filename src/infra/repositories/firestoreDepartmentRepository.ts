import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, limit, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type {
  Department, DepartmentListQuery,
  DepartmentRepository, CreateDepartmentInput, UpdateDepartmentInput,
} from '@/domain/department'
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

function toDepartment(id: string, d: Record<string, unknown>): Department {
  return {
    id,
    name: String(d.name ?? ''),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

export class FirestoreDepartmentRepository implements DepartmentRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async listDepartments(query: DepartmentListQuery = {}): Promise<Department[]> {
    const snap = await getDocs(collection(this.db, 'departments'))
    let rows = snap.docs.map(d => toDepartment(d.id, d.data() as Record<string, unknown>))
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(d => d.name.toLowerCase().includes(search))
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  async getDepartment(id: string): Promise<Department | null> {
    const snap = await getDoc(doc(this.db, 'departments', id))
    return snap.exists() ? toDepartment(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'departments'), where('name', '==', name.trim()), limit(2),
    ))
    return snap.docs.some(d => d.id !== exceptId)
  }

  private async anyWhere(col: string, field: string, id: string): Promise<number> {
    const snap = await getDocs(fsQuery(collection(this.db, col), where(field, '==', id), limit(1)))
    return snap.empty ? 0 : 1
  }

  async countReferences(id: string): Promise<number> {
    const [a, e] = await Promise.all([
      this.anyWhere('assets', 'deptId', id),
      this.anyWhere('employees', 'departmentId', id),
    ])
    return a + e
  }

  async createDepartment(input: CreateDepartmentInput, actor: Actor): Promise<AuditedResult<Department>> {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    const ref = doc(collection(this.db, 'departments'))
    const data: Record<string, unknown> = {
      name: input.name.trim(),
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'department', entityId: ref.id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id: ref.id, name: input.name.trim() },
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, data); return { value: undefined as unknown as void } },
    )
    const created = await this.getDepartment(ref.id)
    if (!created) throw new Error('Department create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async updateDepartment(id: string, patch: UpdateDepartmentInput, actor: Actor): Promise<AuditedResult<Department>> {
    const before = await this.getDepartment(id)
    if (!before) throw new Error(`Department not found: ${id}`)
    if (patch.name && await this.isNameTaken(patch.name, id)) throw new Error(`Name already in use: ${patch.name}`)
    const ref = doc(this.db, 'departments', id)
    const fields = stripUndefinedFs({
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    })
    const r = await withAudit(this.audit,
      {
        entityType: 'department', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name },
        after: patch as Record<string, unknown>,
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, fields, { merge: true }); return { value: undefined as unknown as void } },
    )
    const next = await this.getDepartment(id)
    if (!next) throw new Error('Department update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async deleteDepartment(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>> {
    const before = await this.getDepartment(id)
    if (!before) throw new Error(`Department not found: ${id}`)
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('department', id, count)
    const ref = doc(this.db, 'departments', id)
    return withAudit(this.audit,
      {
        entityType: 'department', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: before.name },
      },
      async (txn) => { (txn as unknown as Transaction).delete(ref); return { value: { id } } },
    )
  }
}
