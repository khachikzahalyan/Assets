import {
  collection, doc, getDoc, getDocs, serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type {
  PartCategoryDef,
  PartCategoryBehavior,
  PartCategoryVariant,
} from '@/domain/part/partCategory-types'
import type {
  PartCategoryRepository,
  CreatePartCategoryInput,
  UpdatePartCategoryInput,
} from '@/domain/part/PartCategoryRepository'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'
import { toIso } from './firestoreUtils'

const COL = 'part_categories'

/** slug-safe id fragment: lower-case, spaces+special → dash, max 40 chars. */
function makeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яёА-ЯЁ]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function toPartCategoryDef(id: string, d: Record<string, unknown>): PartCategoryDef {
  return {
    id,
    name: (d.name as { ru: string; en: string; hy: string }) ?? { ru: '', en: '', hy: '' },
    icon: String(d.icon ?? ''),
    tintToken: String(d.tintToken ?? ''),
    order: Number(d.order ?? 0),
    behavior: (d.behavior as PartCategoryBehavior) ?? 'single',
    slotKind: String(d.slotKind ?? ''),
    storageType: (d.storageType as 'SSD' | 'HDD' | 'M.2' | null) ?? null,
    familyOverrides: (d.familyOverrides as Record<string, { slotKind: string }> | null) ?? null,
    variants: (d.variants as PartCategoryVariant[] | null) ?? null,
    generations: (d.generations as PartCategoryVariant[] | null) ?? null,
    active: Boolean(d.active ?? true),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }
}

export class FirestorePartCategoryRepository implements PartCategoryRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async listAll(): Promise<PartCategoryDef[]> {
    const snap = await getDocs(collection(this.db, COL))
    const rows = snap.docs.map(d => toPartCategoryDef(d.id, d.data() as Record<string, unknown>))
    return rows.sort((a, b) => a.order - b.order)
  }

  private async getById(id: string): Promise<PartCategoryDef | null> {
    const snap = await getDoc(doc(this.db, COL, id))
    return snap.exists() ? toPartCategoryDef(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async create(
    input: CreatePartCategoryInput, actor: Actor,
  ): Promise<AuditedResult<PartCategoryDef>> {
    // Determine the document id: explicit slug from input.id or generated from en name.
    const id = input.id ?? makeSlug(input.name.en || input.name.ru)
    if (!id) throw new Error('PartCategory id could not be derived from input name')

    // Reject duplicate id.
    const existing = await this.getById(id)
    if (existing) throw new Error(`PartCategory already exists: ${id}`)

    const ref = doc(this.db, COL, id)

    // All fields written explicitly with nulls — never undefined into Firestore.
    const data: Record<string, unknown> = {
      name: input.name,
      icon: input.icon,
      tintToken: input.tintToken,
      order: input.order,
      behavior: input.behavior,
      slotKind: input.slotKind,
      storageType: input.storageType ?? null,
      familyOverrides: null,
      variants: input.variants ?? null,
      generations: input.generations ?? null,
      active: true,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const r = await withAudit(this.audit,
      {
        entityType: 'part_category', entityId: id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: null,
        after: { id, name: input.name } as Record<string, unknown>,
      },
      async (txn) => {
        txn.set(ref, data)
        return { value: undefined as unknown as void }
      },
    )

    const created = await this.getById(id)
    if (!created) throw new Error('PartCategory create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async update(
    id: string, patch: UpdatePartCategoryInput, actor: Actor,
  ): Promise<AuditedResult<PartCategoryDef>> {
    const before = await this.getById(id)
    if (!before) throw new Error(`PartCategory not found: ${id}`)

    const ref = doc(this.db, COL, id)

    // Merge patched fields over current state. behavior, slotKind, storageType,
    // familyOverrides are NOT in UpdatePartCategoryInput — all preserved from current doc.
    const payload: Record<string, unknown> = {
      name: patch.name ?? before.name,
      icon: patch.icon ?? before.icon,
      tintToken: patch.tintToken ?? before.tintToken,
      order: patch.order ?? before.order,
      behavior: before.behavior,
      slotKind: before.slotKind,
      storageType: before.storageType,
      familyOverrides: before.familyOverrides,
      variants: patch.variants !== undefined ? (patch.variants ?? null) : before.variants,
      generations: patch.generations !== undefined ? (patch.generations ?? null) : before.generations,
      active: patch.active ?? before.active,
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    }

    const r = await withAudit(this.audit,
      {
        entityType: 'part_category', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { name: before.name, active: before.active, order: before.order } as Record<string, unknown>,
        after: patch as Record<string, unknown>,
      },
      async (txn) => {
        txn.set(ref, payload, { merge: true })
        return { value: undefined as unknown as void }
      },
    )

    const next = await this.getById(id)
    if (!next) throw new Error('PartCategory update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }
}
