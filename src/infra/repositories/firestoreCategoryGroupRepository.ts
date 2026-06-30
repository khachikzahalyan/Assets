import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, limit, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type {
  CategoryGroup, CategoryGroupBehavior, CategoryGroupRepository,
  CreateCategoryGroupInput, UpdateCategoryGroupInput,
} from '@/domain/category'
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

function toCategoryGroup(id: string, d: Record<string, unknown>): CategoryGroup {
  return {
    id,
    name: String(d.name ?? ''),
    behavior: (d.behavior as CategoryGroupBehavior) ?? 'devices',
    lucideIcon: String(d.lucideIcon ?? 'package'),
    color: String(d.color ?? 'gray'),
    order: Number(d.order ?? 0),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

export class FirestoreCategoryGroupRepository implements CategoryGroupRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async listCategoryGroups(): Promise<CategoryGroup[]> {
    const snap = await getDocs(collection(this.db, 'categoryGroups'))
    const rows = snap.docs.map(d => toCategoryGroup(d.id, d.data() as Record<string, unknown>))
    return rows.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.name.localeCompare(b.name, 'ru')
    })
  }

  async getCategoryGroup(id: string): Promise<CategoryGroup | null> {
    const snap = await getDoc(doc(this.db, 'categoryGroups', id))
    return snap.exists() ? toCategoryGroup(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'categoryGroups'), where('name', '==', name.trim()), limit(2),
    ))
    return snap.docs.some(d => d.id !== exceptId)
  }

  private async anyWhere(col: string, field: string, id: string): Promise<number> {
    const snap = await getDocs(fsQuery(collection(this.db, col), where(field, '==', id), limit(1)))
    return snap.empty ? 0 : 1
  }

  async countReferences(id: string): Promise<number> {
    return this.anyWhere('categories', 'categoryGroupId', id)
  }

  async createCategoryGroup(
    input: CreateCategoryGroupInput, actor: Actor,
  ): Promise<AuditedResult<CategoryGroup>> {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    const ref = doc(collection(this.db, 'categoryGroups'))
    const data: Record<string, unknown> = stripUndefinedFs({
      name: input.name.trim(),
      behavior: input.behavior ?? 'devices',
      lucideIcon: input.lucideIcon ?? 'package',
      color: input.color ?? 'gray',
      order: input.order ?? 0,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    const r = await withAudit(this.audit,
      {
        entityType: 'categoryGroup', entityId: ref.id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id: ref.id, name: input.name.trim() },
      },
      async (txn) => {
        ;(txn as unknown as Transaction).set(ref, data as Parameters<Transaction['set']>[1])
        return { value: undefined as unknown as void }
      },
    )
    const created = await this.getCategoryGroup(ref.id)
    if (!created) throw new Error('CategoryGroup create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async updateCategoryGroup(
    id: string, patch: UpdateCategoryGroupInput, actor: Actor,
  ): Promise<AuditedResult<CategoryGroup>> {
    const before = await this.getCategoryGroup(id)
    if (!before) throw new Error(`CategoryGroup not found: ${id}`)

    if (patch.name && await this.isNameTaken(patch.name, id)) {
      throw new Error(`Name already in use: ${patch.name}`)
    }

    const ref = doc(this.db, 'categoryGroups', id)
    const fields = stripUndefinedFs({
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    })
    const r = await withAudit(this.audit,
      {
        entityType: 'categoryGroup', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name },
        after: patch as Record<string, unknown>,
      },
      async (txn) => {
        ;(txn as unknown as Transaction).set(
          ref, fields as Parameters<Transaction['set']>[1], { merge: true },
        )
        return { value: undefined as unknown as void }
      },
    )
    const next = await this.getCategoryGroup(id)
    if (!next) throw new Error('CategoryGroup update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async deleteCategoryGroup(
    id: string, actor: Actor,
  ): Promise<AuditedResult<{ id: string }>> {
    const before = await this.getCategoryGroup(id)
    if (!before) throw new Error(`CategoryGroup not found: ${id}`)
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('categoryGroup', id, count)
    const ref = doc(this.db, 'categoryGroups', id)
    return withAudit(this.audit,
      {
        entityType: 'categoryGroup', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: before.name },
      },
      async (txn) => {
        ;(txn as unknown as Transaction).delete(ref)
        return { value: { id } }
      },
    )
  }
}
