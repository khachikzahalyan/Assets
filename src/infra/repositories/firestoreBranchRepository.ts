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

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

export class FirestoreBranchRepository implements BranchRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async listBranches(query: BranchListQuery = {}): Promise<Branch[]> {
    const snap = await getDocs(collection(this.db, 'branches'))
    let rows = snap.docs.map(d => toBranch(d.id, d.data() as Record<string, unknown>))
    if (query.type && query.type !== 'all') rows = rows.filter(b => b.type === query.type)
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(b =>
        [b.name, b.city, b.address].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  async getBranch(id: string): Promise<Branch | null> {
    const snap = await getDoc(doc(this.db, 'branches', id))
    return snap.exists() ? toBranch(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'branches'), where('name', '==', name.trim()), limit(2),
    ))
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
      name: input.name.trim(),
      type: input.type,
      city: input.city ?? null,
      address: input.address ?? null,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    })
    const r = await withAudit(this.audit,
      {
        entityType: 'branch', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name, type: before.type },
        after: patch as Record<string, unknown>,
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
