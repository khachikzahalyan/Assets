import type {
  AssetStatus, AssetStatusListQuery, AssetStatusRepository,
  CreateAssetStatusInput, UpdateAssetStatusInput,
} from '@/domain/asset_status'
import type { Actor } from '@/domain/asset'
import { EntityInUseError, SystemEntityProtectedError } from '@/domain/shared'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

interface AssetStatusRefs {
  assets?: { statusId?: string }[]
}

export class InMemoryAssetStatusRepository implements AssetStatusRepository {
  constructor(
    private readonly statuses: AssetStatus[],
    private readonly refs: AssetStatusRefs = {},
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  async listAssetStatuses(query: AssetStatusListQuery = {}): Promise<AssetStatus[]> {
    const search = (query.search ?? '').trim().toLowerCase()
    const filtered = this.statuses.filter(s => {
      if (search) {
        if (!s.name.toLowerCase().includes(search)) return false
      }
      return true
    })
    return [...filtered].sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getAssetStatus(id: string): Promise<AssetStatus | null> {
    return this.statuses.find(s => s.id === id) ?? null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const needle = name.trim().toLowerCase()
    return this.statuses.some(s => s.name.trim().toLowerCase() === needle && s.id !== exceptId)
  }

  async countReferences(id: string): Promise<number> {
    return (this.refs.assets ?? []).filter(x => x.statusId === id).length
  }

  async createAssetStatus(input: CreateAssetStatusInput, actor: Actor) {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    const now = new Date().toISOString()
    const id = `st_custom_${Math.random().toString(36).slice(2, 10)}`
    const status: AssetStatus = {
      id,
      name: input.name.trim(),
      color: input.color,
      isFinal: input.isFinal,
      isSystem: false, // ALWAYS forced false — clients can never mint a system status
      sortOrder: input.sortOrder,
      createdAt: now,
      updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'asset_status', entityId: id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id, name: status.name } as Record<string, unknown>,
      },
      async () => { this.statuses.push(status); return { value: status } },
    )
  }

  async updateAssetStatus(id: string, patch: UpdateAssetStatusInput, actor: Actor) {
    const idx = this.statuses.findIndex(s => s.id === id)
    if (idx < 0) throw new Error(`AssetStatus not found: ${id}`)
    const before = this.statuses[idx]!

    // For system statuses: strip isFinal and isSystem from the applied patch
    // (display fields only: name/color/sortOrder pass through)
    let effectivePatch: UpdateAssetStatusInput = patch
    if (before.isSystem) {
      // System statuses: only display fields (name/color/sortOrder) may change.
      const { isFinal: _isFinal, ...rest } = patch
      void _isFinal
      effectivePatch = rest
    }

    // isSystem is NEVER mutable via update for anyone — strip it too
    // (it's not in UpdateAssetStatusInput but be explicit)

    // Re-check name uniqueness if name is changing
    if (effectivePatch.name !== undefined && await this.isNameTaken(effectivePatch.name, id)) {
      throw new Error(`Name already in use: ${effectivePatch.name}`)
    }

    const applied = stripUndefined(effectivePatch)
    const next: AssetStatus = {
      ...before,
      ...applied,
      ...(effectivePatch.name !== undefined ? { name: effectivePatch.name.trim() } : {}),
      updatedAt: new Date().toISOString(),
    }

    return withAudit(this.audit,
      {
        entityType: 'asset_status', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name, isFinal: before.isFinal } as Record<string, unknown>,
        after: stripUndefined(effectivePatch) as Record<string, unknown>,
      },
      async () => { this.statuses[idx] = next; return { value: next } },
    )
  }

  async deleteAssetStatus(id: string, actor: Actor) {
    const idx = this.statuses.findIndex(s => s.id === id)
    if (idx < 0) throw new Error(`AssetStatus not found: ${id}`)
    const before = this.statuses[idx]!

    // System-protection check BEFORE withAudit — no audit row written on failure
    if (before.isSystem) throw new SystemEntityProtectedError('asset_status', id)

    // Reference check BEFORE withAudit
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('asset_status', id, count)

    return withAudit(this.audit,
      {
        entityType: 'asset_status', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: before.name } as Record<string, unknown>,
      },
      async () => { this.statuses.splice(idx, 1); return { value: { id } } },
    )
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
