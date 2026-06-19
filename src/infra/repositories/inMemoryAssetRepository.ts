import type {
  Asset, AssetListQuery, AssetSort, AssetGroupFilter,
} from '@/domain/asset'
import type { AssetRepository, AssetReferenceData } from '@/domain/asset'
import {
  deriveCreateStatus, isSpecTracked, SPEC_KEY,
  type AssetWriteRepository, type CreateAssetInput, type UpdateAssetInput,
  type ChangeStatusOpts, type Actor, type AssetStatusId, type AssetSpecs,
  type UpgradeComponent, type UpgradeEvent,
} from '@/domain/asset'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AuditLog } from '@/domain/audit'

const SORTERS: Record<AssetSort, (a: Asset, b: Asset) => number> = {
  updated_desc: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  updated_asc: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
  name_asc: (a, b) => nameOf(a).localeCompare(nameOf(b), 'ru'),
  name_desc: (a, b) => nameOf(b).localeCompare(nameOf(a), 'ru'),
  inv_asc: (a, b) => a.invCode.localeCompare(b.invCode),
}
function nameOf(a: Asset): string {
  return [a.brand, a.model].filter(Boolean).join(' ') || a.invCode
}

/** In-memory read/write adapter for tests/dev. Same query semantics as the Firestore adapter. */
export class InMemoryAssetRepository implements AssetRepository, AssetWriteRepository {
  constructor(
    private readonly assets: Asset[],
    private readonly ref: AssetReferenceData,
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  private seq = 0
  private readonly upgradeStore = new Map<string, UpgradeEvent[]>()
  private readonly auditMirror: AuditLog[] = []

  private mirror(
    entityId: string,
    r: { auditId: string },
    action: AuditLog['action'],
    actorUid: string,
    actorRole: AuditLog['actorRole'],
    before: AuditLog['before'],
    after: AuditLog['after'],
  ) {
    this.auditMirror.push({
      id: r.auditId,
      entityType: 'asset',
      entityId,
      action,
      actorUid,
      actorRole,
      before,
      after,
      comment: null,
      at: new Date().toISOString(),
    })
  }

  // ---- Read methods -------------------------------------------------------

  async listAssets(query: AssetListQuery): Promise<Asset[]> {
    const group: AssetGroupFilter = query.group ?? 'all'
    const catGroup = new Map(this.ref.categories.map(c => [c.id, c.group]))
    const search = (query.search ?? '').trim().toLowerCase()
    const result = this.assets.filter(a => {
      if (group !== 'all' && catGroup.get(a.categoryId) !== group) return false
      if (query.statusId && query.statusId !== 'all' && a.statusId !== query.statusId) return false
      if (query.branchId && query.branchId !== 'all' && a.branchId !== query.branchId) return false
      if (search) {
        const hay = [a.invCode, a.brand, a.model, a.serial].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
    return [...result].sort(SORTERS[query.sort ?? 'updated_desc'])
  }

  async loadReferenceData(): Promise<AssetReferenceData> {
    return this.ref
  }

  async listAssetsForEmployee(employeeId: string): Promise<Asset[]> {
    return this.assets.filter(a => a.assignment?.mode === 'employee' && a.assignment.employeeId === employeeId)
  }

  // ---- Write methods ------------------------------------------------------

  async getAsset(id: string): Promise<Asset | null> {
    return this.assets.find(a => a.id === id) ?? null
  }

  async isInvCodeTaken(invCode: string, exceptId?: string): Promise<boolean> {
    return this.assets.some(a => a.invCode === invCode && a.id !== exceptId)
  }

  async isSerialTaken(serial: string, exceptId?: string): Promise<boolean> {
    return this.assets.some(a => a.serial != null && a.serial === serial && a.id !== exceptId)
  }

  async createAsset(input: CreateAssetInput, actor: Actor) {
    if (await this.isInvCodeTaken(input.invCode)) {
      throw new Error(`Inventory code already in use: ${input.invCode}`)
    }
    if (input.serial && await this.isSerialTaken(input.serial)) {
      throw new Error(`Serial already in use: ${input.serial}`)
    }
    const id = `a_${++this.seq}`
    const statusId = deriveCreateStatus(input.assignment)
    const asset: Asset = {
      id,
      categoryId: input.categoryId,
      brand: input.brand,
      model: input.model,
      invCode: input.invCode,
      serial: input.serial,
      statusId,
      assignment: input.assignment,
      branchId: input.branchId,
      deptId: input.deptId,
      updatedAt: new Date().toISOString(),
      currentSpecs: input.currentSpecs ?? null,
    }
    const r = await withAudit(
      this.audit,
      {
        entityType: 'asset', entityId: id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { ...asset } as Record<string, unknown>,
      },
      async () => {
        this.assets.push(asset)
        return { value: asset }
      },
    )
    this.mirror(id, r, 'created', actor.uid, actor.role, null, { ...asset } as Record<string, unknown>)
    return r
  }

  async updateAsset(id: string, patch: UpdateAssetInput, actor: Actor) {
    const idx = this.assets.findIndex(a => a.id === id)
    if (idx < 0) throw new Error(`Asset not found: ${id}`)
    const before = { ...this.assets[idx]! }
    if (patch.serial && await this.isSerialTaken(patch.serial, id)) {
      throw new Error(`Serial already in use: ${patch.serial}`)
    }
    const next: Asset = { ...before, ...stripUndefined(patch), updatedAt: new Date().toISOString() }
    const r = await withAudit(
      this.audit,
      {
        entityType: 'asset', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { ...before } as Record<string, unknown>,
        after: { ...next } as Record<string, unknown>,
      },
      async () => {
        this.assets[idx] = next
        return { value: next }
      },
    )
    this.mirror(id, r, 'updated', actor.uid, actor.role,
      { ...before } as Record<string, unknown>,
      { ...next } as Record<string, unknown>)
    return r
  }

  async changeStatus(id: string, toStatusId: AssetStatusId, actor: Actor, opts?: ChangeStatusOpts) {
    const idx = this.assets.findIndex(a => a.id === id)
    if (idx < 0) throw new Error(`Asset not found: ${id}`)
    const before = { ...this.assets[idx]! }
    const next: Asset = {
      ...before,
      statusId: toStatusId,
      assignment: opts && 'assignment' in opts ? (opts.assignment ?? null) : before.assignment,
      updatedAt: new Date().toISOString(),
    }
    const r = await withAudit(
      this.audit,
      {
        entityType: 'asset', entityId: id, action: 'status_changed',
        actorUid: actor.uid, actorRole: actor.role,
        before: { statusId: before.statusId },
        after: { statusId: toStatusId },
        comment: opts?.comment ?? null,
      },
      async () => {
        this.assets[idx] = next
        return { value: next }
      },
    )
    this.mirror(id, r, 'status_changed', actor.uid, actor.role,
      { statusId: before.statusId },
      { statusId: toStatusId })
    return r
  }

  async addUpgrade(id: string, ev: { component: UpgradeComponent; after: string }, actor: Actor) {
    const idx = this.assets.findIndex(a => a.id === id)
    if (idx < 0) throw new Error(`Asset not found: ${id}`)
    const asset = this.assets[idx]!
    const before = isSpecTracked(ev.component)
      ? (asset.currentSpecs?.[SPEC_KEY[ev.component]] ?? null)
      : null
    const upgrade: UpgradeEvent = {
      id: `up_${++this.seq}`,
      component: ev.component,
      before,
      after: ev.after,
      changedAt: new Date().toISOString(),
      changedBy: actor.uid,
    }
    const r = await withAudit(
      this.audit,
      {
        entityType: 'upgrade', entityId: id, action: 'upgrade_added',
        actorUid: actor.uid, actorRole: actor.role,
        before: before === null ? null : { value: before },
        after: { component: ev.component, value: ev.after },
      },
      async () => {
        const list = this.upgradeStore.get(id) ?? []
        list.push(upgrade)
        this.upgradeStore.set(id, list)
        if (isSpecTracked(ev.component)) {
          const specs: AssetSpecs = { ...(asset.currentSpecs ?? {}) }
          specs[SPEC_KEY[ev.component]] = ev.after
          this.assets[idx] = { ...asset, currentSpecs: specs, updatedAt: new Date().toISOString() }
        }
        return { value: upgrade }
      },
    )
    this.mirror(id, r, 'upgrade_added', actor.uid, actor.role,
      before === null ? null : { value: before },
      { component: ev.component, value: ev.after })
    return r
  }

  async listUpgrades(id: string): Promise<UpgradeEvent[]> {
    return [...(this.upgradeStore.get(id) ?? [])]
  }

  async listAudit(entityId: string): Promise<AuditLog[]> {
    return this.auditMirror.filter(l => l.entityId === entityId)
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as Partial<T>
}
