import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, limit, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type {
  AssetStatus, AssetStatusListQuery, AssetStatusRepository,
  CreateAssetStatusInput, UpdateAssetStatusInput,
} from '@/domain/asset_status'
import { EntityInUseError, SystemEntityProtectedError } from '@/domain/shared'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toAssetStatus(id: string, d: Record<string, unknown>): AssetStatus {
  return {
    id,
    name: String(d.name ?? ''),
    color: String(d.color ?? 'gray'),
    isFinal: Boolean(d.isFinal),
    isSystem: Boolean(d.isSystem),
    sortOrder: Number(d.sortOrder ?? 0),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

export class FirestoreAssetStatusRepository implements AssetStatusRepository {
  constructor(private readonly db: Firestore) {}

  private get audit() { return firestoreAuditContext(this.db) }

  async listAssetStatuses(query: AssetStatusListQuery = {}): Promise<AssetStatus[]> {
    const snap = await getDocs(collection(this.db, 'asset_statuses'))
    let rows = snap.docs.map(d => toAssetStatus(d.id, d.data() as Record<string, unknown>))
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(s => s.name.toLowerCase().includes(search))
    }
    return rows.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getAssetStatus(id: string): Promise<AssetStatus | null> {
    const snap = await getDoc(doc(this.db, 'asset_statuses', id))
    return snap.exists() ? toAssetStatus(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'asset_statuses'), where('name', '==', name.trim()), limit(2),
    ))
    return snap.docs.some(d => d.id !== exceptId)
  }

  private async anyWhere(col: string, field: string, id: string): Promise<number> {
    const snap = await getDocs(fsQuery(collection(this.db, col), where(field, '==', id), limit(1)))
    return snap.empty ? 0 : 1
  }

  async countReferences(id: string): Promise<number> {
    return this.anyWhere('assets', 'statusId', id)
  }

  async createAssetStatus(input: CreateAssetStatusInput, actor: Actor): Promise<AuditedResult<AssetStatus>> {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    // Auto-id via doc(collection(...)) — never collides with the 4 system ids (st_warehouse etc.)
    const ref = doc(collection(this.db, 'asset_statuses'))
    const data: Record<string, unknown> = {
      name: input.name.trim(),
      color: input.color,
      isFinal: input.isFinal,
      isSystem: false, // ALWAYS forced false — clients can never mint a system status
      sortOrder: input.sortOrder,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    const r = await withAudit(this.audit,
      {
        entityType: 'asset_status', entityId: ref.id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id: ref.id, name: input.name.trim() },
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, data); return { value: undefined as unknown as void } },
    )
    const created = await this.getAssetStatus(ref.id)
    if (!created) throw new Error('AssetStatus create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async updateAssetStatus(id: string, patch: UpdateAssetStatusInput, actor: Actor): Promise<AuditedResult<AssetStatus>> {
    const before = await this.getAssetStatus(id)
    if (!before) throw new Error(`AssetStatus not found: ${id}`)

    // For system statuses: strip isFinal from the applied patch (display fields only)
    // isSystem is NEVER written via update for anyone
    let effectivePatch: Record<string, unknown>
    if (before.isSystem) {
      const { isFinal: _isFinal, ...rest } = patch
      void _isFinal
      effectivePatch = rest as Record<string, unknown>
    } else {
      effectivePatch = patch as Record<string, unknown>
    }

    if (effectivePatch.name && await this.isNameTaken(String(effectivePatch.name), id)) {
      throw new Error(`Name already in use: ${String(effectivePatch.name)}`)
    }

    const ref = doc(this.db, 'asset_statuses', id)
    const fields = stripUndefinedFs({
      ...effectivePatch,
      ...(effectivePatch.name !== undefined ? { name: String(effectivePatch.name).trim() } : {}),
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    })
    const r = await withAudit(this.audit,
      {
        entityType: 'asset_status', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name, isFinal: before.isFinal },
        after: effectivePatch,
      },
      async (txn) => { (txn as unknown as Transaction).set(ref, fields, { merge: true }); return { value: undefined as unknown as void } },
    )
    const next = await this.getAssetStatus(id)
    if (!next) throw new Error('AssetStatus update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async deleteAssetStatus(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>> {
    const before = await this.getAssetStatus(id)
    if (!before) throw new Error(`AssetStatus not found: ${id}`)

    // System-protection check BEFORE withAudit — no audit row written on failure
    if (before.isSystem) throw new SystemEntityProtectedError('asset_status', id)

    // Reference check BEFORE withAudit
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('asset_status', id, count)

    const ref = doc(this.db, 'asset_statuses', id)
    return withAudit(this.audit,
      {
        entityType: 'asset_status', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: before.name },
      },
      async (txn) => { (txn as unknown as Transaction).delete(ref); return { value: { id } } },
    )
  }
}
