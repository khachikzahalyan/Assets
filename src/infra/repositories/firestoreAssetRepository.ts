import {
  collection, getDocs, getDoc, doc, query as fsQuery, where, orderBy, limit, serverTimestamp,
  type Firestore, type QueryConstraint, type Transaction,
} from 'firebase/firestore'
import type {
  Asset, AssetListQuery, AssetSort, CategoryRow, StatusRow, RefRow, EmployeeRow,
  AssetStatusId, AssetAssignment, AssetSpecs,
} from '@/domain/asset'
import type {
  AssetRepository, AssetReferenceData, AssetWriteRepository,
  CreateAssetInput, UpdateAssetInput, ChangeStatusOpts, Actor,
  SelfServiceRefData,
} from '@/domain/asset'
import type { UpgradeComponent, UpgradeEvent } from '@/domain/asset'
import { deriveCreateStatus, isSpecTracked, SPEC_KEY } from '@/domain/asset'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import type { AuditedResult, AuditLog } from '@/domain/audit'
import type { WorkstationLicenseRepository } from '@/domain/license'

const SERVER_SORT: Record<AssetSort, [string, 'asc' | 'desc']> = {
  updated_desc: ['updatedAt', 'desc'],
  updated_asc: ['updatedAt', 'asc'],
  name_asc: ['brand', 'asc'],
  name_desc: ['brand', 'desc'],
  inv_asc: ['invCode', 'asc'],
}

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toAsset(id: string, d: Record<string, unknown>): Asset {
  return {
    id,
    categoryId: String(d.categoryId ?? ''),
    brand: (d.brand as string | null) ?? null,
    model: (d.model as string | null) ?? null,
    type: (d.type as string | null) ?? null,
    invCode: String(d.invCode ?? ''),
    serial: (d.serial as string | null) ?? null,
    statusId: String(d.statusId ?? ''),
    assignment: (d.assignment as Asset['assignment']) ?? null,
    branchId: String(d.branchId ?? ''),
    deptId: (d.deptId as string | null) ?? null,
    updatedAt: toIso(d.updatedAt),
    currentSpecs: (d.currentSpecs as Asset['currentSpecs']) ?? null,
    condition: (d.condition as Asset['condition']) ?? null,
    purchaseDate: (d.purchaseDate as string | null) ?? null,
    warrantyEndsAt: (d.warrantyEndsAt as string | null) ?? null,
  }
}

/**
 * Maps a raw Firestore category document to a CategoryRow.
 *
 * Resolution: the four capability flags (hasSpecs, hasOemLicense, requiresSerial,
 * hasTypeField) are preserved ONLY when the doc carries an explicit boolean value.
 * When a flag is absent from the doc, the key is omitted entirely so that
 * `resolveCategoryCapabilities()` can fall through to the static taxonomy /
 * heuristic fallback. exactOptionalPropertyTypes is ON — never assign undefined;
 * use conditional spread so the key is absent when not present.
 *
 * Shared between loadSelfServiceRefData() and fetchReferenceData() to prevent drift.
 */
function mapCategory(d: Record<string, unknown>): Omit<CategoryRow, 'id'> {
  return {
    name: String(d.name ?? ''),
    group: (d.group as CategoryRow['group']) ?? 'devices',
    lucideIcon: String(d.lucideIcon ?? 'package'),
    ...(typeof d.hasSpecs === 'boolean' ? { hasSpecs: d.hasSpecs } : {}),
    ...(typeof d.hasOemLicense === 'boolean' ? { hasOemLicense: d.hasOemLicense } : {}),
    ...(typeof d.requiresSerial === 'boolean' ? { requiresSerial: d.requiresSerial } : {}),
    ...(typeof d.hasTypeField === 'boolean' ? { hasTypeField: d.hasTypeField } : {}),
  }
}

/**
 * Production read adapter. Status + branch equality filters and the sort field run
 * server-side (composite indexes — see firestore.indexes.json). Group (needs a
 * category lookup) and free-text search run client-side over the returned set,
 * matching the org-scale dataset (hundreds of assets).
 */
export class FirestoreAssetRepository implements AssetRepository, AssetWriteRepository {
  constructor(
    private readonly db: Firestore,
    /**
     * Optional workstation-license repository. When provided, `createAsset` creates
     * or re-binds a device-bound OEM license whenever `input.oemLicense` is set.
     * The license doc is written as a SEPARATE audited call after the asset transaction
     * (not inside the same `runTransaction`). The raw OEM secret is persisted by the
     * `setLicenseKey` callable in the create page — never in this repo.
     *
     * Asset + license-doc are created as sequential audited writes; the raw OEM secret
     * is persisted by the setLicenseKey callable in the create page. A future hardening
     * could merge the two doc writes into one runTransaction.
     */
    private readonly licenses?: WorkstationLicenseRepository,
  ) {}

  // Lazy audit context — avoids constructing the context (and any circular import
  // evaluation) until the first write call.
  private get audit() { return firestoreAuditContext(this.db) }

  // FIX 4: instance-level cache so loadReferenceData() is fetched at most once
  // per repository instance, regardless of how many callers (listAssets group filter
  // + useAssets hook) call it concurrently.
  private refCache: Promise<AssetReferenceData> | null = null

  async listAssets(query: AssetListQuery): Promise<Asset[]> {
    const cons: QueryConstraint[] = []
    if (query.statusId && query.statusId !== 'all') cons.push(where('statusId', '==', query.statusId))
    if (query.branchId && query.branchId !== 'all') cons.push(where('branchId', '==', query.branchId))
    const [field, dir] = SERVER_SORT[query.sort ?? 'updated_desc']
    cons.push(orderBy(field, dir))
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), ...cons))
    let rows = snap.docs.map(d => toAsset(d.id, d.data() as Record<string, unknown>))

    if (query.group && query.group !== 'all') {
      const ref = await this.loadReferenceData()
      const catGroup = new Map(ref.categories.map(c => [c.id, c.group]))
      rows = rows.filter(a => catGroup.get(a.categoryId) === query.group)
    }
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(a =>
        [a.invCode, a.brand, a.model, a.serial].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
    }
    return rows
  }

  async loadReferenceData(): Promise<AssetReferenceData> {
    if (!this.refCache) this.refCache = this.fetchReferenceData()
    return this.refCache
  }

  async listAssetsForEmployee(employeeId: string): Promise<Asset[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'assets'), where('assignment.employeeId', '==', employeeId),
    ))
    return snap.docs.map(d => toAsset(d.id, d.data() as Record<string, unknown>))
  }

  async loadSelfServiceRefData(): Promise<SelfServiceRefData> {
    const [statuses, categories, branches, departments] = await Promise.all([
      this.readCol<StatusRow>('asset_statuses', d => ({ name: String(d.name ?? ''), color: String(d.color ?? 'gray') })),
      this.readCol<CategoryRow>('categories', mapCategory),
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<RefRow>('departments', d => ({ name: String(d.name ?? '') })),
    ])
    return { statuses, categories, branches, departments }
  }

  private async fetchReferenceData(): Promise<AssetReferenceData> {
    const [statuses, branches, departments, categories, employees] = await Promise.all([
      this.readCol<StatusRow>('asset_statuses', d => ({ name: String(d.name ?? ''), color: String(d.color ?? 'gray') })),
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<RefRow>('departments', d => ({ name: String(d.name ?? '') })),
      this.readCol<CategoryRow>('categories', mapCategory),
      this.readCol<EmployeeRow>('employees', d => ({
        firstName: (d.firstName as string | null) ?? null,
        lastName: (d.lastName as string | null) ?? null,
        email: (d.email as string | null) ?? null,
        departmentId: (d.departmentId as string | null) ?? null,
        position: (d.position as string | null) ?? null,
      })),
    ])
    return { statuses, branches, departments, categories, employees }
  }

  // FIX 7: mapper returns Omit<T,'id'> — no id:'' placeholder needed.
  // The id is always spread in from d.id after mapping.
  private async readCol<T extends { id: string }>(
    name: string, map: (d: Record<string, unknown>) => Omit<T, 'id'>,
  ): Promise<T[]> {
    const snap = await getDocs(collection(this.db, name))
    return snap.docs.map(d => ({ ...map(d.data() as Record<string, unknown>), id: d.id } as T))
  }

  async getAsset(id: string): Promise<Asset | null> {
    const snap = await getDoc(doc(this.db, 'assets', id))
    return snap.exists() ? toAsset(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async isInvCodeTaken(invCode: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('invCode', '==', invCode), limit(2)))
    return snap.docs.some(d => d.id !== exceptId)
  }

  async isSerialTaken(serial: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('serial', '==', serial), limit(2)))
    return snap.docs.some(d => d.id !== exceptId)
  }

  async createAsset(input: CreateAssetInput, actor: Actor): Promise<AuditedResult<Asset>> {
    if (await this.isInvCodeTaken(input.invCode)) throw new Error(`Inventory code already in use: ${input.invCode}`)
    if (input.serial && await this.isSerialTaken(input.serial)) throw new Error(`Serial already in use: ${input.serial}`)
    const statusId = deriveCreateStatus(input.assignment)
    const ref = doc(collection(this.db, 'assets'))
    const data: Record<string, unknown> = stripUndefinedFs({
      categoryId: input.categoryId, brand: input.brand, model: input.model,
      type: input.type,
      invCode: input.invCode, serial: input.serial, statusId,
      assignment: input.assignment, branchId: input.branchId, deptId: input.deptId,
      currentSpecs: input.currentSpecs ?? null,
      condition: input.condition,
      purchaseDate: input.condition === 'new' ? input.purchaseDate : null,
      warrantyEndsAt: input.condition === 'new' ? input.warrantyEndsAt : null,
      createdBy: actor.uid, updatedBy: actor.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    const r = await withAudit(this.audit,
      { entityType: 'asset', entityId: ref.id, action: 'created', actorUid: actor.uid, actorRole: actor.role,
        after: { invCode: input.invCode, statusId } },
      async (txn) => {
        ;(txn as unknown as Transaction).set(ref, data)
        return { value: undefined as unknown as void }
      })
    const created = await this.getAsset(ref.id)
    if (!created) throw new Error('Asset create succeeded but readback failed')

    // License coupling — runs AFTER the asset transaction so the new asset id is stable.
    // The license doc (and its masked audit entry) are written by the license repo in a
    // separate audited call. The raw OEM secret is NOT written here — the create page
    // calls the setLicenseKey Cloud Function after this method returns.
    // Asset + license-doc are created as sequential audited writes; a future hardening
    // could merge the two doc writes into one runTransaction.
    if (input.oemLicense && this.licenses) {
      if ('kind' in input.oemLicense && input.oemLicense.kind === 'manual') {
        // Manual/retail product key — type:'Retail', isReusable:true
        const manualName = [input.brand, input.model].filter(Boolean).join(' ').trim()
          ? `${[input.brand, input.model].filter(Boolean).join(' ')} — Ключ продукта`
          : 'Лицензия ОС'
        await this.licenses.createLicense({
          name: manualName,
          type: 'Retail',
          isReusable: true,
          rawKey: input.oemLicense.rawKey,
          assign: { to: 'device', assetId: ref.id },
        }, actor)
      } else if ('kind' in input.oemLicense && input.oemLicense.kind === 'oem-digital') {
        // Firmware-embedded OEM — type:'OEM', isReusable:false, NO rawKey
        const oemName = ['OEM —', input.brand, input.model].filter(Boolean).join(' ').trim()
          || 'OEM License'
        await this.licenses.createLicense({
          name: oemName,
          type: 'OEM',
          isReusable: false,
          assign: { to: 'device', assetId: ref.id },
        }, actor)
      } else if ('existingLicenseId' in input.oemLicense) {
        // existingLicenseId branch — re-bind an existing unassigned license to this device
        await this.licenses.assignLicense(
          input.oemLicense.existingLicenseId,
          { to: 'device', assetId: ref.id },
          actor,
        )
      }
    }

    return { value: created, auditId: r.auditId }
  }

  /**
   * Group registration. Dual uniqueness is enforced up-front (GOLDEN RULE):
   *  - within-batch duplicates of invCode/serial are rejected before any write;
   *  - each invCode/serial is checked against existing assets via Firestore queries.
   * Then each asset is created with its own audited transaction (createAsset).
   * NOTE: a server-side guarantee (Firestore rule / Cloud Function) is the eventual
   * hardening — not deployable now (no Blaze). Client-side checks are the current line.
   */
  async createAssetsBatch(inputs: CreateAssetInput[], actor: Actor): Promise<Asset[]> {
    assertBatchUnique(inputs)
    for (const input of inputs) {
      if (await this.isInvCodeTaken(input.invCode)) throw new Error(`Inventory code already in use: ${input.invCode}`)
      if (input.serial && await this.isSerialTaken(input.serial)) throw new Error(`Serial already in use: ${input.serial}`)
    }
    const created: Asset[] = []
    for (const input of inputs) {
      const r = await this.createAsset(input, actor)
      created.push(r.value)
    }
    return created
  }

  async updateAsset(id: string, patch: UpdateAssetInput, actor: Actor): Promise<AuditedResult<Asset>> {
    const before = await this.getAsset(id)
    if (!before) throw new Error(`Asset not found: ${id}`)
    if (patch.serial && await this.isSerialTaken(patch.serial, id)) throw new Error(`Serial already in use: ${patch.serial}`)
    const ref = doc(this.db, 'assets', id)
    const fields = stripUndefinedFs({ ...patch, updatedBy: actor.uid, updatedAt: serverTimestamp() })
    const r = await withAudit(this.audit,
      { entityType: 'asset', entityId: id, action: 'updated', actorUid: actor.uid, actorRole: actor.role,
        before: { brand: before.brand, model: before.model, serial: before.serial },
        after: patch as Record<string, unknown> },
      async (txn) => { ;(txn as unknown as Transaction).set(ref, fields, { merge: true }); return { value: undefined as unknown as void } })
    const next = await this.getAsset(id)
    if (!next) throw new Error('Asset update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async changeStatus(id: string, toStatusId: AssetStatusId, actor: Actor, opts?: ChangeStatusOpts): Promise<AuditedResult<Asset>> {
    const before = await this.getAsset(id)
    if (!before) throw new Error(`Asset not found: ${id}`)
    const ref = doc(this.db, 'assets', id)
    const patch: Record<string, unknown> = { statusId: toStatusId, updatedBy: actor.uid, updatedAt: serverTimestamp() }
    if (opts && 'assignment' in opts) patch.assignment = opts.assignment ?? null
    const hasAssignment = !!opts && 'assignment' in opts
    const auditBefore: Record<string, unknown> = {
      statusId: before.statusId,
      ...(hasAssignment ? { assignment: before.assignment ?? null } : {}),
    }
    const auditAfter: Record<string, unknown> = {
      statusId: toStatusId,
      ...(hasAssignment ? { assignment: opts!.assignment ?? null } : {}),
    }
    const r = await withAudit(this.audit,
      { entityType: 'asset', entityId: id, action: 'status_changed', actorUid: actor.uid, actorRole: actor.role,
        before: auditBefore, after: auditAfter, comment: opts?.comment ?? null },
      async (txn) => { ;(txn as unknown as Transaction).set(ref, patch, { merge: true }); return { value: undefined as unknown as void } })
    const next = await this.getAsset(id)
    if (!next) throw new Error('Asset status change succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async addUpgrade(id: string, ev: { component: UpgradeComponent; after: string }, actor: Actor): Promise<AuditedResult<UpgradeEvent>> {
    const asset = await this.getAsset(id)
    if (!asset) throw new Error(`Asset not found: ${id}`)
    const before = isSpecTracked(ev.component) ? (asset.currentSpecs?.[SPEC_KEY[ev.component]] ?? null) : null
    const upRef = doc(collection(this.db, 'assets', id, 'upgrades'))
    const assetRef = doc(this.db, 'assets', id)
    const r = await withAudit(this.audit,
      { entityType: 'upgrade', entityId: id, action: 'upgrade_added', actorUid: actor.uid, actorRole: actor.role,
        before: before === null ? null : { value: before }, after: { component: ev.component, value: ev.after } },
      async (txn) => {
        const t = txn as unknown as Transaction
        t.set(upRef, { component: ev.component, before, after: ev.after, changedBy: actor.uid, changedAt: serverTimestamp() })
        if (isSpecTracked(ev.component)) {
          const specs: AssetSpecs = { ...(asset.currentSpecs ?? {}) }
          specs[SPEC_KEY[ev.component]] = ev.after
          t.set(assetRef, { currentSpecs: specs, updatedAt: serverTimestamp(), updatedBy: actor.uid }, { merge: true })
        }
        return { value: undefined as unknown as void }
      })
    const upgrade: UpgradeEvent = { id: upRef.id, component: ev.component, before, after: ev.after, changedAt: new Date().toISOString(), changedBy: actor.uid }
    return { value: upgrade, auditId: r.auditId }
  }

  async listUpgrades(id: string): Promise<UpgradeEvent[]> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets', id, 'upgrades'), orderBy('changedAt', 'desc')))
    return snap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return { id: d.id, component: x.component as UpgradeComponent, before: (x.before as string | null) ?? null,
        after: String(x.after ?? ''), changedAt: toIso(x.changedAt), changedBy: String(x.changedBy ?? '') }
    })
  }

  async bulkChangeAssignment(
    ids: string[],
    assignment: AssetAssignment,
    actor: Actor,
    comment?: string,
  ): Promise<{ assetId: string; auditId: string }[]> {
    // Bounded concurrency: each changeStatus runs its own runTransaction (2 reads + 1
    // audited write). Firing all N at once can saturate the browser's HTTP/2 limit and
    // trigger spurious RESOURCE_EXHAUSTED at large batch sizes. Process in chunks of 5.
    const CHUNK = 5
    const results: { assetId: string; auditId: string }[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const part = await Promise.all(
        slice.map(async (id) => {
          const r = await this.changeStatus(id, 'st_assigned', actor, { assignment, ...(comment !== undefined ? { comment } : {}) })
          return { assetId: id, auditId: r.auditId }
        }),
      )
      results.push(...part)
    }
    return results
  }

  async listAudit(entityId: string): Promise<AuditLog[]> {
    const snap = await getDocs(fsQuery(collection(this.db, 'audit_logs'),
      where('entityId', '==', entityId), orderBy('at', 'desc')))
    return snap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return {
        id: d.id,
        entityType: x.entityType as AuditLog['entityType'],
        entityId: String(x.entityId ?? ''),
        action: x.action as AuditLog['action'],
        actorUid: String(x.actorUid ?? ''),
        actorRole: x.actorRole as AuditLog['actorRole'],
        before: (x.before as AuditLog['before']) ?? null,
        after: (x.after as AuditLog['after']) ?? null,
        comment: (x.comment as string | null) ?? null,
        at: toIso(x.at),
      }
    })
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

/** Throws on the first within-batch duplicate inventory code or serial (GOLDEN RULE). */
export function assertBatchUnique(inputs: CreateAssetInput[]): void {
  const codes = new Set<string>()
  const serials = new Set<string>()
  for (const input of inputs) {
    const code = input.invCode.trim()
    if (codes.has(code)) throw new Error(`Inventory code already in use: ${code}`)
    codes.add(code)
    const serial = input.serial?.trim()
    if (serial) {
      if (serials.has(serial)) throw new Error(`Serial already in use: ${serial}`)
      serials.add(serial)
    }
  }
}
