/**
 * Firestore adapter for the parts warehouse (production).
 *
 * Implements both PartRepository (reads) and PartWriteRepository (writes).
 * All mutating methods run inside withAudit(firestoreAuditContext(db), ...) so the
 * data write(s) and exactly one audit_logs entry land in the same Firestore transaction.
 *
 * Resolution §9.A (currentSpecs vs upgradeCurrent):
 *   The production Asset type carries `upgradeCurrent?: UpgradeSlot[]` as an additive
 *   optional field (src/domain/asset/types.ts). Install/uninstall reads the asset doc
 *   inside the transaction, mutates upgradeCurrent in memory, and writes back to the
 *   asset doc using { merge: true }. currentSpecs (the create-form spec object) is
 *   intentionally NOT touched.
 *
 * Resolution §9.B (deleteGpu in Firestore):
 *   The Firestore security rules deny client-side deletes on /parts (allow delete: if false).
 *   deleteGpu is therefore NOT implemented in this adapter — it throws immediately with a
 *   clear error message. The in-memory adapter provides full deleteGpu for tests. The UI
 *   should hide or disable the delete GPU button for production sessions. This is documented
 *   as an MVP boundary; a future plan can route deletion through a Cloud Function.
 */

import {
  collection,
  doc,
  getDocs,
  query as fsQuery,
  orderBy,
  serverTimestamp,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import type { PartRepository, PartWriteRepository, PartReferenceData, ReceiveItem, InstallInput, UninstallInput, CreateGpuInput } from '@/domain/part/PartRepository'
import type { Part, PartMovement, PartsAsset, UpgradeSlot } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import { withAudit, firestoreAuditContext } from '@/lib/audit'
import {
  deriveStock,
  slotKindForSku,
  storageTypeForSku,
  assetFamilyOf,
  currentPartsForSkuCategory,
  isServiceOnly,
  resolveUpgradeCurrent,
  DESKTOP_CATEGORY_IDS,
} from '@/domain/part/partStock'
import type { AssetSpecs } from '@/domain/asset/types'
import { SERVER_CATEGORY_IDS, LAPTOP_CATEGORY_IDS } from '@/domain/asset/categoryCapabilities'

// ---- Collection names -------------------------------------------------------

const COL_PARTS = 'parts'
const COL_MOVEMENTS = 'part_movements'
const COL_ASSETS = 'assets'
const COL_CATEGORIES = 'categories'

// ---- Upgradeable category ids (must match assetFamilyOf non-null set) -------
// These are the LAPTOP + DESKTOP + SERVER category ids as defined in partStock.ts
// and categoryCapabilities.ts. We query all assets and filter client-side because
// Firestore doesn't support OR across multiple categoryId values efficiently at MVP scale.
// Phase 2 note: consider a `isUpgradeable` field on the category doc for a server-side filter.

/** All upgradeable category ids = laptop + desktop + server. */
const UPGRADEABLE_CATEGORY_IDS: ReadonlySet<string> = new Set([
  ...LAPTOP_CATEGORY_IDS,
  ...DESKTOP_CATEGORY_IDS,
  ...SERVER_CATEGORY_IDS,
])

// ---- Converters -------------------------------------------------------------

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date().toISOString()
}

function toPart(id: string, d: Record<string, unknown>): Part {
  return {
    id,
    name: String(d['name'] ?? ''),
    category: d['category'] as Part['category'],
    variantId: (d['variantId'] as string | null) ?? null,
    variantLabel: (d['variantLabel'] as string | null) ?? null,
    ddr: (d['ddr'] as string | null) ?? null,
    unit: String(d['unit'] ?? 'шт'),
    onHand: Number(d['onHand'] ?? 0),
    broken: Number(d['broken'] ?? 0),
    lowStockThreshold: Number(d['lowStockThreshold'] ?? 5),
    createdAt: toIso(d['createdAt']),
    updatedAt: toIso(d['updatedAt']),
    createdBy: String(d['createdBy'] ?? ''),
    updatedBy: String(d['updatedBy'] ?? ''),
  }
}

function toMovement(id: string, d: Record<string, unknown>): PartMovement {
  return {
    id,
    type: d['type'] as PartMovement['type'],
    skuId: String(d['skuId'] ?? ''),
    qty: Number(d['qty'] ?? 0),
    broken: Boolean(d['broken']),
    assetId: (d['assetId'] as string | null) ?? null,
    assetInvCode: (d['assetInvCode'] as string | null) ?? null,
    serviceReplace: Boolean(d['serviceReplace']),
    kindId: (d['kindId'] as string | null) ?? null,
    kindLabel: (d['kindLabel'] as string | null) ?? null,
    note: (d['note'] as string | null) ?? null,
    reason: (d['reason'] as string | null) ?? null,
    actorUid: String(d['actorUid'] ?? ''),
    actorRole: d['actorRole'] as PartMovement['actorRole'],
    at: toIso(d['at']),
  }
}

function toUpgradeSlots(raw: unknown): UpgradeSlot[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[]).map((s): UpgradeSlot => {
    const o = s as Record<string, unknown>
    return {
      kind: String(o['kind'] ?? ''),
      spec: String(o['spec'] ?? ''),
      storageType: (o['storageType'] as string | null) ?? null,
      installedAt: (o['installedAt'] as string | null) ?? null,
      replaced: Boolean(o['replaced']),
    }
  })
}

// ---- class -----------------------------------------------------------------

export class FirestorePartRepository implements PartRepository, PartWriteRepository {
  constructor(private readonly fsDb: Firestore) {}

  private get audit() { return firestoreAuditContext(this.fsDb) }

  // ---- PartRepository (reads) -----------------------------------------------

  async loadReferenceData(): Promise<PartReferenceData> {
    // Read parts, movements, upgradeable assets, and categories in parallel.
    const [partsSnap, movementsSnap, assetsSnap, categoriesSnap] = await Promise.all([
      getDocs(collection(this.fsDb, COL_PARTS)),
      getDocs(fsQuery(collection(this.fsDb, COL_MOVEMENTS), orderBy('at', 'desc'))),
      getDocs(collection(this.fsDb, COL_ASSETS)),
      getDocs(collection(this.fsDb, COL_CATEGORIES)),
    ])

    // categoryId → { name, lucideIcon } so device cards match the Assets page exactly.
    const categoryMeta = new Map<string, { name: string; icon: string }>()
    for (const c of categoriesSnap.docs) {
      const cd = c.data() as Record<string, unknown>
      categoryMeta.set(c.id, {
        name: String(cd['name'] ?? ''),
        icon: String(cd['lucideIcon'] ?? ''),
      })
    }

    const movements: PartMovement[] = movementsSnap.docs.map(d =>
      toMovement(d.id, d.data() as Record<string, unknown>),
    )

    // Recompute stock snapshots from the authoritative journal
    const stockMap = deriveStock(movements)

    const parts: Part[] = partsSnap.docs.map(d => {
      const p = toPart(d.id, d.data() as Record<string, unknown>)
      const s = stockMap[p.id] ?? { onHand: 0, broken: 0 }
      return { ...p, onHand: s.onHand, broken: s.broken }
    })

    // Build partsAssets projection: only upgradeable categories
    const partsAssets: PartsAsset[] = []
    for (const d of assetsSnap.docs) {
      const data = d.data() as Record<string, unknown>
      const categoryId = String(data['categoryId'] ?? '')
      if (!UPGRADEABLE_CATEGORY_IDS.has(categoryId)) continue

      const family = assetFamilyOf(categoryId)
      const kind = family === 'server' ? 'Сетевые Устройство' : categoryId

      const brand = (data['brand'] as string | null) ?? ''
      const model = (data['model'] as string | null) ?? ''
      const name = [brand, model].filter(Boolean).join(' ') || d.id

      // User: try assignment.employeeId display or fallback to empty
      const assignment = (data['assignment'] as Record<string, unknown> | null) ?? null
      const user = (assignment?.['employeeId'] as string | null) ?? ''

      const catMeta = categoryMeta.get(categoryId)

      partsAssets.push({
        id: String(data['invCode'] ?? d.id),
        assetId: d.id,
        categoryId,
        kind,
        name,
        user,
        // exactOptionalPropertyTypes: omit the key entirely rather than assign undefined
        ...(catMeta?.name ? { categoryName: catMeta.name } : {}),
        ...(catMeta?.icon ? { categoryIcon: catMeta.icon } : {}),
        // Prefer the asset's explicit upgradeCurrent (mutated by install/uninstall).
        // When empty (asset created via the Assets form, which only stores
        // currentSpecs), synthesize the slots from currentSpecs + factory defaults
        // so the «Установлено» tab shows what was created in the Assets section.
        upgradeCurrent: resolveUpgradeCurrent(
          categoryId,
          (data['currentSpecs'] as AssetSpecs | null | undefined) ?? null,
          toUpgradeSlots(data['upgradeCurrent']),
        ),
      })
    }

    return { parts, movements, partsAssets }
  }

  async listMovementsForSku(skuId: string): Promise<PartMovement[]> {
    // Uses the composite index (skuId, at desc)
    // Note: Firestore where() requires an index — caller must ensure it exists.
    // For MVP simplicity, load all and filter (index on at desc is still used).
    const snap = await getDocs(
      fsQuery(collection(this.fsDb, COL_MOVEMENTS), orderBy('at', 'desc')),
    )
    return snap.docs
      .map(d => toMovement(d.id, d.data() as Record<string, unknown>))
      .filter(m => m.skuId === skuId)
  }

  async listMovementsForAsset(assetId: string): Promise<PartMovement[]> {
    const snap = await getDocs(
      fsQuery(collection(this.fsDb, COL_MOVEMENTS), orderBy('at', 'desc')),
    )
    return snap.docs
      .map(d => toMovement(d.id, d.data() as Record<string, unknown>))
      .filter(m => m.assetId === assetId)
  }

  // ---- PartWriteRepository (writes) -----------------------------------------

  /**
   * receiveParts — port of prototype handleAddConfirm (parts.html 3315-3354).
   * One 'receive' movement per item; recompute snapshot for affected SKUs.
   * ONE withAudit transaction.
   */
  async receiveParts(
    items: ReceiveItem[],
    actor: Actor,
  ): Promise<AuditedResult<PartMovement[]>> {
    const validItems = items.filter(i => i.qty >= 1)
    if (validItems.length === 0) throw new Error('receiveParts: no items with qty >= 1')

    // Pre-load affected SKU docs so we can recompute their snapshots inside the txn.
    const affectedSkuIds = [...new Set(validItems.map(i => i.skuId))]
    const skuRefs = affectedSkuIds.map(id => doc(this.fsDb, COL_PARTS, id))

    // Load existing movements for affected SKUs for stock recomputation.
    // We load ALL movements in a single query then filter (MVP: acceptable volume).
    const allMovementsSnap = await getDocs(collection(this.fsDb, COL_MOVEMENTS))
    const allMovements = allMovementsSnap.docs.map(d =>
      toMovement(d.id, d.data() as Record<string, unknown>),
    )

    const newMovements: PartMovement[] = []
    const at = new Date().toISOString()

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part_movement',
        entityId: doc(collection(this.fsDb, COL_MOVEMENTS)).id, // stable id for audit
        action: 'part_received',
        actorUid: actor.uid,
        actorRole: actor.role,
        before: null,
        after: {
          items: validItems.map(i => ({ skuId: i.skuId, qty: i.qty })),
          totalQty: validItems.reduce((s, i) => s + i.qty, 0),
        },
      },
      async (txn) => {
        const t = txn as unknown as Transaction

        // Read current SKU docs inside txn (required for transactional snapshot update)
        const skuSnaps = await Promise.all(skuRefs.map(r => t.get(r)))

        // Write movement docs
        const pendingMovements = validItems.map(item => {
          const mvRef = doc(collection(this.fsDb, COL_MOVEMENTS))
          const mv: PartMovement = {
            id: mvRef.id,
            type: 'receive',
            skuId: item.skuId,
            qty: item.qty,
            broken: false,
            assetId: null,
            assetInvCode: null,
            serviceReplace: false,
            note: null,
            reason: 'Поставка',
            actorUid: actor.uid,
            actorRole: actor.role,
            at,
          }
          t.set(mvRef, {
            type: mv.type, skuId: mv.skuId, qty: mv.qty, broken: mv.broken,
            assetId: mv.assetId, assetInvCode: mv.assetInvCode,
            serviceReplace: mv.serviceReplace, note: mv.note, reason: mv.reason,
            actorUid: mv.actorUid, actorRole: mv.actorRole, at: serverTimestamp(),
          })
          newMovements.push(mv)
          return mv
        })

        // Recompute snapshots for affected SKUs
        const combinedMovements = [...allMovements, ...pendingMovements]
        const stockMap = deriveStock(combinedMovements)

        for (const skuSnap of skuSnaps) {
          if (!skuSnap.exists()) continue
          const skuId = skuSnap.id
          const s = stockMap[skuId] ?? { onHand: 0, broken: 0 }
          t.set(skuSnap.ref, {
            onHand: s.onHand,
            broken: s.broken,
            updatedAt: serverTimestamp(),
            updatedBy: actor.uid,
          }, { merge: true })
        }

        return { value: newMovements }
      },
    )
    return r
  }

  /**
   * installPart — port of prototype handleInstallConfirm (parts.html 3211-3312).
   *
   * ONE transaction: reads asset doc (for upgradeCurrent), reads SKU doc, appends
   * movement doc, updates asset.upgradeCurrent, updates SKU stock snapshot, writes
   * audit_logs entry (via withAudit).
   */
  async installPart(
    input: InstallInput,
    actor: Actor,
  ): Promise<AuditedResult<PartMovement>> {
    const skuRef = doc(this.fsDb, COL_PARTS, input.skuId)
    const assetRef = doc(this.fsDb, COL_ASSETS, input.assetId)
    const mvRef = doc(collection(this.fsDb, COL_MOVEMENTS))

    // Load existing movements for recomputation (outside txn — acceptable for snapshot math)
    const allMovementsSnap = await getDocs(collection(this.fsDb, COL_MOVEMENTS))
    const allMovements = allMovementsSnap.docs.map(d =>
      toMovement(d.id, d.data() as Record<string, unknown>),
    )

    const serviceReplace = isServiceOnly(input.assetCategoryId) || input.serviceReplace
    const family = assetFamilyOf(input.assetCategoryId)

    let reason: string
    if (serviceReplace) {
      reason = 'Заменено через сервис'
    } else if (input.action === 'replace') {
      reason = input.oldIsBroken
        ? 'Установка взамен неисправного'
        : 'Установка взамен (плановая замена)'
    } else {
      reason = 'Установка в актив'
    }

    let auditAction: 'part_installed' | 'part_returned' | 'part_scrapped'
    if (input.action === 'replace') {
      auditAction = input.oldIsBroken ? 'part_scrapped' : 'part_returned'
    } else {
      auditAction = 'part_installed'
    }

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part',
        entityId: input.assetId,
        action: auditAction,
        actorUid: actor.uid,
        actorRole: actor.role,
        before: null, // filled from txn reads below
        after: null,
      },
      async (txn) => {
        const t = txn as unknown as Transaction

        // Read SKU + asset inside txn
        const [skuSnap, assetSnap] = await Promise.all([
          t.get(skuRef),
          t.get(assetRef),
        ])
        if (!skuSnap.exists()) throw new Error(`installPart: SKU not found: ${input.skuId}`)
        if (!assetSnap.exists()) throw new Error(`installPart: asset not found: ${input.assetId}`)

        const partData = skuSnap.data() as Record<string, unknown>
        const partName = String(partData['name'] ?? '')
        const variantLabel = (partData['variantLabel'] as string | null) ?? null
        const partCategory = partData['category'] as Part['category']

        const assetData = assetSnap.data() as Record<string, unknown>
        const upgradeCurrent: UpgradeSlot[] = resolveUpgradeCurrent(
          input.assetCategoryId,
          (assetData['currentSpecs'] as AssetSpecs | null | undefined) ?? null,
          toUpgradeSlots(assetData['upgradeCurrent']),
        )

        const ucBefore = upgradeCurrent.map(s => ({ ...s }))

        // Build newSpec and slot metadata
        const newSpec = partName + (variantLabel ? ' ' + variantLabel : '')
        const slotKind = slotKindForSku(partCategory, family)
        const stType = storageTypeForSku(partCategory)
        const at = new Date().toISOString()

        // Mutate upgradeCurrent copy
        const ucMutated = [...upgradeCurrent.map(s => ({ ...s }))]
        if (
          input.action === 'replace' &&
          input.replaceUcIndex !== null &&
          input.replaceUcIndex >= 0 &&
          input.replaceUcIndex < ucMutated.length
        ) {
          const slot = ucMutated[input.replaceUcIndex]!
          slot.spec = newSpec
          slot.replaced = true
          slot.installedAt = at
          if (stType) slot.storageType = stType
        } else {
          const newSlot: UpgradeSlot = {
            kind: slotKind ?? 'storage',
            spec: newSpec,
            installedAt: at,
            replaced: false,
          }
          if (stType) newSlot.storageType = stType
          ucMutated.push(newSlot)
        }

        const ucAfter = ucMutated.map(s => ({ ...s }))

        // 1. Write movement
        const mv: PartMovement = {
          id: mvRef.id,
          type: 'install',
          skuId: input.skuId,
          qty: 1,
          broken: false,
          assetId: input.assetId,
          assetInvCode: input.assetInvCode,
          serviceReplace,
          note: input.note ?? null,
          reason,
          actorUid: actor.uid,
          actorRole: actor.role,
          at,
        }
        t.set(mvRef, {
          type: mv.type, skuId: mv.skuId, qty: mv.qty, broken: mv.broken,
          assetId: mv.assetId, assetInvCode: mv.assetInvCode,
          serviceReplace: mv.serviceReplace, note: mv.note, reason: mv.reason,
          actorUid: mv.actorUid, actorRole: mv.actorRole, at: serverTimestamp(),
        })

        // 2. Update asset.upgradeCurrent
        t.set(assetRef, {
          upgradeCurrent: ucMutated,
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
        }, { merge: true })

        // 3. Recompute snapshot (service: serviceReplace movements skipped by deriveStock)
        const combinedMovements = [...allMovements, mv]
        const stockMap = deriveStock(combinedMovements)
        const s = stockMap[input.skuId] ?? { onHand: 0, broken: 0 }
        t.set(skuRef, {
          onHand: s.onHand,
          broken: s.broken,
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
        }, { merge: true })

        return {
          value: mv,
          before: { upgradeCurrent: ucBefore } as unknown as Record<string, unknown>,
          after: { upgradeCurrent: ucAfter } as unknown as Record<string, unknown>,
        }
      },
    )
    return r
  }

  /**
   * uninstallPart — port of prototype handleUninstallConfirm (parts.html 3411-3463).
   *
   * ONE transaction: reads asset doc + SKU doc, appends uninstall movement, removes
   * matching upgradeCurrent slot, recomputes stock snapshot (if in-house).
   */
  async uninstallPart(
    input: UninstallInput,
    actor: Actor,
  ): Promise<AuditedResult<PartMovement>> {
    const skuRef = doc(this.fsDb, COL_PARTS, input.skuId)
    const assetRef = doc(this.fsDb, COL_ASSETS, input.assetId)
    const mvRef = doc(collection(this.fsDb, COL_MOVEMENTS))

    const allMovementsSnap = await getDocs(collection(this.fsDb, COL_MOVEMENTS))
    const allMovements = allMovementsSnap.docs.map(d =>
      toMovement(d.id, d.data() as Record<string, unknown>),
    )

    const serviceReplace = isServiceOnly(input.assetCategoryId) || input.serviceReplace
    const family = assetFamilyOf(input.assetCategoryId)

    const auditAction = input.broken ? 'part_scrapped' : 'part_returned'

    let reason: string
    if (serviceReplace) {
      reason = 'Снято как заменённое через сервис'
    } else if (input.broken) {
      reason = 'Снято как неисправное'
    } else {
      reason = 'Снятие с актива · возврат на склад'
    }

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part',
        entityId: input.assetId,
        action: auditAction,
        actorUid: actor.uid,
        actorRole: actor.role,
        before: null,
        after: null,
      },
      async (txn) => {
        const t = txn as unknown as Transaction

        const [skuSnap, assetSnap] = await Promise.all([
          t.get(skuRef),
          t.get(assetRef),
        ])
        if (!skuSnap.exists()) throw new Error(`uninstallPart: SKU not found: ${input.skuId}`)
        if (!assetSnap.exists()) throw new Error(`uninstallPart: asset not found: ${input.assetId}`)

        const partData = skuSnap.data() as Record<string, unknown>
        const partCategory = partData['category'] as Part['category']

        const assetData = assetSnap.data() as Record<string, unknown>
        const upgradeCurrent: UpgradeSlot[] = resolveUpgradeCurrent(
          input.assetCategoryId,
          (assetData['currentSpecs'] as AssetSpecs | null | undefined) ?? null,
          toUpgradeSlots(assetData['upgradeCurrent']),
        )
        const ucBefore = upgradeCurrent.map(s => ({ ...s }))

        const at = new Date().toISOString()
        const mv: PartMovement = {
          id: mvRef.id,
          type: 'uninstall',
          skuId: input.skuId,
          qty: 1,
          broken: serviceReplace ? false : input.broken,
          assetId: input.assetId,
          assetInvCode: input.assetInvCode,
          serviceReplace,
          note: input.note ?? null,
          reason,
          actorUid: actor.uid,
          actorRole: actor.role,
          at,
        }
        t.set(mvRef, {
          type: mv.type, skuId: mv.skuId, qty: mv.qty, broken: mv.broken,
          assetId: mv.assetId, assetInvCode: mv.assetInvCode,
          serviceReplace: mv.serviceReplace, note: mv.note, reason: mv.reason,
          actorUid: mv.actorUid, actorRole: mv.actorRole, at: serverTimestamp(),
        })

        // Remove matching slot from upgradeCurrent
        const ucMutated = [...upgradeCurrent.map(s => ({ ...s }))]
        const slotKind = slotKindForSku(partCategory, family)
        if (slotKind) {
          const candidates = currentPartsForSkuCategory(ucMutated, partCategory, family)
          const occupied = candidates.filter(c => !c.isEmpty)
          const target = occupied.length > 0
            ? occupied[occupied.length - 1]!
            : candidates[candidates.length - 1]
          if (target) ucMutated.splice(target.idx, 1)
        }

        const ucAfter = ucMutated.map(s => ({ ...s }))

        // Write updated asset.upgradeCurrent
        t.set(assetRef, {
          upgradeCurrent: ucMutated,
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
        }, { merge: true })

        // Recompute stock snapshot
        const combinedMovements = [...allMovements, mv]
        const stockMap = deriveStock(combinedMovements)
        const s = stockMap[input.skuId] ?? { onHand: 0, broken: 0 }
        t.set(skuRef, {
          onHand: s.onHand,
          broken: s.broken,
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
        }, { merge: true })

        return {
          value: mv,
          before: { upgradeCurrent: ucBefore } as unknown as Record<string, unknown>,
          after: { upgradeCurrent: ucAfter } as unknown as Record<string, unknown>,
        }
      },
    )
    return r
  }

  /**
   * recordService — port of prototype handleServiceConfirm (parts.html ~3465-3487).
   *
   * Records a SKU-less maintenance event as a `type:'service'` journal movement.
   * Stock-neutral: skuId is empty, qty=0, broken=false, serviceReplace=false.
   * Does NOT mutate asset.upgradeCurrent (a service record is a maintenance log, not a part swap).
   * Does NOT recompute SKU stock snapshots (no stock change — deriveStock already ignores
   * service movements).
   * ONE withAudit transaction writes exactly one part_movements doc + one audit_logs entry.
   */
  async recordService(
    input: import('@/domain/part/PartRepository').ServiceRecordInput,
    actor: Actor,
  ): Promise<AuditedResult<PartMovement>> {
    const mvRef = doc(collection(this.fsDb, COL_MOVEMENTS))
    const at = new Date().toISOString()

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part_movement',
        entityId: mvRef.id,
        action: 'part_serviced',
        actorUid: actor.uid,
        actorRole: actor.role,
        before: null,
        after: {
          assetId: input.assetId,
          kindId: input.kindId,
          kindLabel: input.kindLabel,
        },
      },
      async (txn) => {
        const t = txn as unknown as Transaction

        const mv: PartMovement = {
          id: mvRef.id,
          type: 'service',
          skuId: '',
          qty: 0,
          broken: false,
          assetId: input.assetId,
          assetInvCode: input.assetInvCode,
          serviceReplace: false,
          kindId: input.kindId,
          kindLabel: input.kindLabel,
          note: input.note ?? null,
          reason: input.kindLabel,
          actorUid: actor.uid,
          actorRole: actor.role,
          at,
        }

        // Write movement doc. No SKU snapshot update (stock-neutral).
        // No asset.upgradeCurrent update (not a part swap).
        t.set(mvRef, {
          type: mv.type,
          skuId: mv.skuId,
          qty: mv.qty,
          broken: mv.broken,
          assetId: mv.assetId,
          assetInvCode: mv.assetInvCode,
          serviceReplace: mv.serviceReplace,
          kindId: mv.kindId,
          kindLabel: mv.kindLabel,
          note: mv.note,
          reason: mv.reason,
          actorUid: mv.actorUid,
          actorRole: mv.actorRole,
          at: serverTimestamp(),
        })

        return { value: mv }
      },
    )
    return r
  }

  /**
   * createGpu — port of prototype handleGpuAdd (parts.html 3360-3387).
   * Creates a new GPU SKU doc; if initialQty > 0 appends a 'receive' movement.
   * ONE withAudit transaction.
   */
  async createGpu(
    input: CreateGpuInput,
    actor: Actor,
  ): Promise<AuditedResult<Part>> {
    const skuRef = doc(collection(this.fsDb, COL_PARTS))
    const id = skuRef.id

    let resultPart!: Part

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part',
        entityId: id,
        action: 'gpu_created',
        actorUid: actor.uid,
        actorRole: actor.role,
        before: null,
        after: null,
      },
      async (txn) => {
        const t = txn as unknown as Transaction

        const partDoc = {
          name: input.name,
          category: 'gpu' as const,
          unit: 'шт',
          onHand: 0,
          broken: 0,
          lowStockThreshold: 5,
          createdBy: actor.uid,
          updatedBy: actor.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
        t.set(skuRef, partDoc)

        if (input.initialQty > 0) {
          const mvRef = doc(collection(this.fsDb, COL_MOVEMENTS))
          t.set(mvRef, {
            type: 'receive',
            skuId: id,
            qty: input.initialQty,
            broken: false,
            assetId: null,
            assetInvCode: null,
            serviceReplace: false,
            note: null,
            reason: 'Поставка',
            actorUid: actor.uid,
            actorRole: actor.role,
            at: serverTimestamp(),
          })
          // Update snapshot: onHand = initialQty (only this SKU has movements at creation)
          t.set(skuRef, {
            onHand: input.initialQty,
            updatedAt: serverTimestamp(),
            updatedBy: actor.uid,
          }, { merge: true })
        }

        const now = new Date().toISOString()
        resultPart = {
          id,
          name: input.name,
          category: 'gpu',
          unit: 'шт',
          onHand: input.initialQty > 0 ? input.initialQty : 0,
          broken: 0,
          lowStockThreshold: 5,
          createdAt: now,
          updatedAt: now,
          createdBy: actor.uid,
          updatedBy: actor.uid,
        }

        return {
          value: resultPart,
          after: { ...resultPart } as unknown as Record<string, unknown>,
        }
      },
    )
    return r
  }

  /**
   * deleteGpu — NOT SUPPORTED in the Firestore adapter (MVP).
   *
   * The Firestore security rules for /parts have `allow delete: if false`, so a client-side
   * delete would be denied. Routing deletion through a Cloud Function is deferred to a
   * post-MVP plan. The UI should hide or disable the "delete GPU" button when running
   * against the production Firestore backend.
   *
   * The in-memory adapter (inMemoryPartRepository.ts) provides a full implementation
   * for test coverage — all deleteGpu tests must use the in-memory adapter.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteGpu(_skuId: string, _actor: Actor): Promise<AuditedResult<void>> {
    throw new Error(
      'deleteGpu is not supported in MVP — /parts client delete is denied by Firestore rules. ' +
      'Route GPU deletion through a Cloud Function in a post-MVP plan, or use the in-memory ' +
      'adapter for testing this flow.',
    )
  }
}
