import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, limit, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type {
  Category, CategoryGroup, CategoryListQuery,
  CategoryRepository, CreateCategoryInput, UpdateCategoryInput,
} from '@/domain/category'
import { EntityInUseError, PrefixLockedError } from '@/domain/shared'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toCategory(id: string, d: Record<string, unknown>): Category {
  return {
    id,
    name: String(d.name ?? ''),
    group: (d.group as CategoryGroup) ?? 'devices',
    prefix: String(d.prefix ?? ''),
    hasSpecs: Boolean(d.hasSpecs),
    lucideIcon: String(d.lucideIcon ?? 'package'),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

export class FirestoreCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async listCategories(query: CategoryListQuery = {}): Promise<Category[]> {
    const snap = await getDocs(collection(this.db, 'categories'))
    let rows = snap.docs.map(d => toCategory(d.id, d.data() as Record<string, unknown>))
    if (query.group && query.group !== 'all') rows = rows.filter(c => c.group === query.group)
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(c =>
        [c.name, c.prefix].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  async getCategory(id: string): Promise<Category | null> {
    const snap = await getDoc(doc(this.db, 'categories', id))
    return snap.exists() ? toCategory(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'categories'), where('name', '==', name.trim()), limit(2),
    ))
    return snap.docs.some(d => d.id !== exceptId)
  }

  async isPrefixTaken(prefix: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'categories'), where('prefix', '==', prefix.trim()), limit(2),
    ))
    return snap.docs.some(d => d.id !== exceptId)
  }

  private async anyWhere(col: string, field: string, id: string): Promise<number> {
    const snap = await getDocs(fsQuery(collection(this.db, col), where(field, '==', id), limit(1)))
    return snap.empty ? 0 : 1
  }

  async countReferences(id: string): Promise<number> {
    return this.anyWhere('assets', 'categoryId', id)
  }

  async createCategory(input: CreateCategoryInput, actor: Actor): Promise<AuditedResult<Category>> {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    if (await this.isPrefixTaken(input.prefix)) throw new Error(`Prefix already in use: ${input.prefix}`)
    const ref = doc(collection(this.db, 'categories'))
    const data: Record<string, unknown> = {
      name: input.name.trim(),
      group: input.group,
      prefix: input.prefix.trim(),
      hasSpecs: input.hasSpecs,
      lucideIcon: input.lucideIcon ?? 'package',
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'category', entityId: ref.id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id: ref.id, name: input.name.trim(), prefix: input.prefix.trim() },
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, data); return { value: undefined as unknown as void } },
    )
    const created = await this.getCategory(ref.id)
    if (!created) throw new Error('Category create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async updateCategory(id: string, patch: UpdateCategoryInput, actor: Actor): Promise<AuditedResult<Category>> {
    const before = await this.getCategory(id)
    if (!before) throw new Error(`Category not found: ${id}`)

    // PREFIX-LOCK: check BEFORE entering withAudit so no audit row is written on failure
    if (patch.prefix !== undefined && patch.prefix.trim() !== before.prefix) {
      const count = await this.countReferences(id)
      if (count > 0) throw new PrefixLockedError(id, count)
    }

    if (patch.name && await this.isNameTaken(patch.name, id)) throw new Error(`Name already in use: ${patch.name}`)
    if (patch.prefix !== undefined && patch.prefix.trim() !== before.prefix && await this.isPrefixTaken(patch.prefix, id)) {
      throw new Error(`Prefix already in use: ${patch.prefix}`)
    }

    const ref = doc(this.db, 'categories', id)
    const fields = stripUndefinedFs({
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.prefix !== undefined ? { prefix: patch.prefix.trim() } : {}),
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    })
    const r = await withAudit(this.audit,
      {
        entityType: 'category', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name, prefix: before.prefix },
        after: patch as Record<string, unknown>,
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, fields, { merge: true }); return { value: undefined as unknown as void } },
    )
    const next = await this.getCategory(id)
    if (!next) throw new Error('Category update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async deleteCategory(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>> {
    const before = await this.getCategory(id)
    if (!before) throw new Error(`Category not found: ${id}`)
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('category', id, count)
    const ref = doc(this.db, 'categories', id)
    return withAudit(this.audit,
      {
        entityType: 'category', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: before.name },
      },
      async (txn) => { (txn as unknown as Transaction).delete(ref); return { value: { id } } },
    )
  }
}
