/**
 * In-memory adapter for the parts warehouse (tests / dev environment).
 *
 * Implements both PartRepository (reads) and PartWriteRepository (writes).
 * Every mutating method runs inside withAudit so data writes and the audit_logs
 * entry are co-committed — the same invariant as the Firestore adapter.
 *
 * Resolution §9.A (currentSpecs vs upgradeCurrent):
 *   The production Asset type carries an additive optional `upgradeCurrent?: UpgradeSlot[]`.
 *   This adapter reads and writes that field on the matching PartsAsset in its in-memory
 *   partsAssets array. `currentSpecs` (the create-form spec object) is intentionally NOT
 *   touched by install/uninstall — the two fields are complementary.
 *
 * Resolution §9.B (deleteGpu/deleteModelSku in Firestore):
 *   deleteModelSku (and its legacy alias deleteGpu) are fully implemented here
 *   (in-memory) for test coverage. The Firestore adapter throws 'not supported in MVP'
 *   because /parts client delete is denied by security rules. See firestorePartRepository.ts.
 */

import type { PartRepository, PartWriteRepository, PartReferenceData, ReceiveItem, InstallInput, UninstallInput, CreateGpuInput, CreateModelSkuInput } from '@/domain/part/PartRepository'
import type { Part, PartMovement, PartsAsset, UpgradeSlot } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import {
  withAudit,
  type AuditContext,
  createInMemoryAuditStore,
  inMemoryAuditContext,
} from '@/lib/audit'
import {
  deriveStock,
  slotKindForSku,
  storageTypeForSku,
  assetFamilyOf,
  currentPartsForSkuCategory,
  isServiceOnly,
} from '@/domain/part/partStock'
import { InsufficientStockError, InvalidCategoryBehaviorError } from '@/domain/part/errors'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'

const FALLBACK_ISO = '1970-01-01T00:00:00.000Z'

/** DEFAULT_PART_CATEGORY_DEFS stamped with a fixed ISO timestamp for deterministic tests. */
const DEFAULT_CATEGORY_DEFS_WITH_TIMESTAMPS: PartCategoryDef[] = DEFAULT_PART_CATEGORY_DEFS.map(d => ({
  ...d,
  createdAt: FALLBACK_ISO,
  updatedAt: FALLBACK_ISO,
}))

// ---- helpers ---------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString()
}

/** slug-safe id fragment: lower-case, spaces+special → dash, max 40 chars. */
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яёА-ЯЁ]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

// ---- class -----------------------------------------------------------------

export class InMemoryPartRepository implements PartRepository, PartWriteRepository {
  private seq = 0
  private readonly partCategories: PartCategoryDef[]

  constructor(
    private readonly parts: Part[],
    private readonly movements: PartMovement[],
    private readonly partsAssets: PartsAsset[],
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
    /**
     * Optional catalog injection. When omitted, DEFAULT_PART_CATEGORY_DEFS (with fixed
     * timestamps) are used so tests and unseeded projects behave identically to the legacy
     * hardcoded catalog. Pass a custom array to test non-standard categories.
     */
    partCategories?: PartCategoryDef[],
  ) {
    this.partCategories = partCategories ?? DEFAULT_CATEGORY_DEFS_WITH_TIMESTAMPS
  }

  // ---- private helpers -------------------------------------------------------

  private nextId(prefix: string): string {
    return `${prefix}_${++this.seq}`
  }

  /**
   * Recompute onHand + broken for every SKU in affectedSkuIds and update the parts array
   * in-place. Called inside the mutate callback (audit transaction) so the snapshot is
   * always consistent with movements at time-of-write.
   */
  private recomputeSnapshots(affectedSkuIds: ReadonlySet<string>): void {
    const stockMap = deriveStock(this.movements)
    for (const part of this.parts) {
      if (!affectedSkuIds.has(part.id)) continue
      const s = stockMap[part.id] ?? { onHand: 0, broken: 0 }
      part.onHand = s.onHand
      part.broken = s.broken
      part.updatedAt = nowIso()
    }
  }

  /** Find PartsAsset by assetId (internal slug). */
  private findPartsAsset(assetId: string): PartsAsset | undefined {
    return this.partsAssets.find(a => a.assetId === assetId)
  }

  // ---- PartRepository (reads) -----------------------------------------------

  async loadReferenceData(): Promise<PartReferenceData> {
    // Return freshly-recomputed snapshots (mirrors what the Firestore adapter does).
    const stockMap = deriveStock(this.movements)
    const freshParts = this.parts.map(p => {
      const s = stockMap[p.id] ?? { onHand: 0, broken: 0 }
      return { ...p, onHand: s.onHand, broken: s.broken }
    })
    return {
      parts: freshParts,
      movements: [...this.movements].reverse(), // newest-first
      partsAssets: this.partsAssets.map(a => ({ ...a, upgradeCurrent: [...a.upgradeCurrent] })),
      // Return a sorted shallow copy; never the mutable internal array.
      partCategories: [...this.partCategories].sort((a, b) => a.order - b.order),
    }
  }

  async listMovementsForSku(skuId: string): Promise<PartMovement[]> {
    return this.movements.filter(m => m.skuId === skuId).slice().reverse()
  }

  async listMovementsForAsset(assetId: string): Promise<PartMovement[]> {
    return this.movements.filter(m => m.assetId === assetId).slice().reverse()
  }

  // ---- PartWriteRepository (writes) -----------------------------------------

  /**
   * receiveParts — port of prototype handleAddConfirm (parts.html 3315-3354).
   * One 'receive' movement per item with qty >= 1.
   * One audit entry (part_received, entityType 'part_movement').
   */
  async receiveParts(
    items: ReceiveItem[],
    actor: Actor,
  ): Promise<AuditedResult<PartMovement[]>> {
    const validItems = items.filter(i => i.qty >= 1)
    if (validItems.length === 0) throw new Error('receiveParts: no items with qty >= 1')

    const newMovements: PartMovement[] = []
    const affectedSkuIds = new Set<string>()

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part_movement',
        entityId: this.nextId('recv'),
        action: 'part_received',
        actorUid: actor.uid,
        actorRole: actor.role, actorName: actor.displayName ?? null,
        before: null,
        after: {
          items: validItems.map(i => ({ skuId: i.skuId, qty: i.qty })),
          totalQty: validItems.reduce((s, i) => s + i.qty, 0),
        },
      },
      async () => {
        const at = nowIso()
        for (const item of validItems) {
          const mv: PartMovement = {
            id: this.nextId('mv'),
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
          this.movements.push(mv)
          newMovements.push(mv)
          affectedSkuIds.add(item.skuId)
        }
        this.recomputeSnapshots(affectedSkuIds)
        return { value: newMovements }
      },
    )
    return r
  }

  /**
   * installPart — port of prototype handleInstallConfirm (parts.html 3211-3312).
   *
   * 1. Append one 'install' movement.
   * 2. Mutate the partsAsset.upgradeCurrent (replace in-place or push new slot).
   * 3. Recompute stock snapshot (service: unchanged; in-house: debits onHand).
   * 4. ONE withAudit transaction wraps all writes.
   */
  async installPart(
    input: InstallInput,
    actor: Actor,
  ): Promise<AuditedResult<PartMovement>> {
    const part = this.parts.find(p => p.id === input.skuId)
    if (!part) throw new Error(`installPart: SKU not found: ${input.skuId}`)

    const pa = this.findPartsAsset(input.assetId)
    if (!pa) throw new Error(`installPart: partsAsset not found: ${input.assetId}`)

    const family = assetFamilyOf(input.assetCategoryId)
    const serviceReplace = isServiceOnly(input.assetCategoryId) || input.serviceReplace

    // Server-side stock guard: in-house installs require at least 1 unit on hand.
    // serviceReplace operations bypass this — they never touch warehouse stock.
    if (!serviceReplace && part.onHand < 1) {
      throw new InsufficientStockError(input.skuId, part.onHand, 1)
    }

    // Determine reason string (prototype 3246-3260)
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

    // Build the new slot spec (prototype 3281)
    const newSpec = part.name + (part.variantLabel ? ' ' + part.variantLabel : '')
    const slotKind = slotKindForSku(part.category, family)
    const stType = storageTypeForSku(part.category)

    // Audit before/after (upgradeCurrent snapshots)
    const ucBefore = pa.upgradeCurrent.map(s => ({ ...s }))

    // Determine audit action per plan §1.5
    let auditAction: 'part_installed' | 'part_returned' | 'part_scrapped'
    if (input.action === 'replace') {
      auditAction = input.oldIsBroken ? 'part_scrapped' : 'part_returned'
    } else {
      auditAction = 'part_installed'
    }

    let movement!: PartMovement

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part',
        entityId: input.assetId,
        action: auditAction,
        actorUid: actor.uid,
        actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { upgradeCurrent: ucBefore },
        after: null, // filled in inside mutate via spec.after override — set after mutation
      },
      async () => {
        const at = nowIso()

        // 1. Append movement
        movement = {
          id: this.nextId('mv'),
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
        this.movements.push(movement)

        // 2. Mutate upgradeCurrent
        if (
          input.action === 'replace' &&
          input.replaceUcIndex !== null &&
          input.replaceUcIndex >= 0 &&
          input.replaceUcIndex < pa.upgradeCurrent.length
        ) {
          // In-place overwrite of existing slot (prototype 3265-3278)
          const slot = pa.upgradeCurrent[input.replaceUcIndex]!
          slot.spec = newSpec
          slot.replaced = true
          slot.installedAt = at
          if (stType) slot.storageType = stType
        } else {
          // Push new slot
          const newSlot: UpgradeSlot = {
            kind: slotKind ?? 'storage',
            spec: newSpec,
            installedAt: at,
            replaced: false,
          }
          if (stType) newSlot.storageType = stType
          pa.upgradeCurrent.push(newSlot)
        }

        const ucAfter = pa.upgradeCurrent.map(s => ({ ...s }))

        // 3. Recompute snapshot (service movements are skipped by deriveStock)
        this.recomputeSnapshots(new Set([input.skuId]))

        return {
          value: movement,
          after: { upgradeCurrent: ucAfter } as unknown as Record<string, unknown>,
        }
      },
    )
    return r
  }

  /**
   * uninstallPart — port of prototype handleUninstallConfirm (parts.html 3411-3463).
   *
   * - service → 'uninstall' movement with serviceReplace=true; snapshot unchanged.
   * - in-house → 'uninstall' movement; recompute (broken→+broken, else +onHand);
   *   remove matching slot from upgradeCurrent.
   */
  async uninstallPart(
    input: UninstallInput,
    actor: Actor,
  ): Promise<AuditedResult<PartMovement>> {
    const part = this.parts.find(p => p.id === input.skuId)
    if (!part) throw new Error(`uninstallPart: SKU not found: ${input.skuId}`)

    const pa = this.findPartsAsset(input.assetId)
    if (!pa) throw new Error(`uninstallPart: partsAsset not found: ${input.assetId}`)

    const family = assetFamilyOf(input.assetCategoryId)
    const serviceReplace = isServiceOnly(input.assetCategoryId) || input.serviceReplace

    const ucBefore = pa.upgradeCurrent.map(s => ({ ...s }))

    // Audit action: returned vs scrapped
    const auditAction = input.broken ? 'part_scrapped' : 'part_returned'

    // Reason string
    let reason: string
    if (serviceReplace) {
      reason = 'Снято как заменённое через сервис'
    } else if (input.broken) {
      reason = 'Снято как неисправное'
    } else {
      reason = 'Снятие с актива · возврат на склад'
    }

    let movement!: PartMovement

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part',
        entityId: input.assetId,
        action: auditAction,
        actorUid: actor.uid,
        actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { upgradeCurrent: ucBefore },
        after: null,
      },
      async () => {
        const at = nowIso()

        movement = {
          id: this.nextId('mv'),
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
        this.movements.push(movement)

        // Remove matching slot from upgradeCurrent (find by slotKind)
        const slotKind = slotKindForSku(part.category, family)
        if (slotKind) {
          const candidates = currentPartsForSkuCategory(pa.upgradeCurrent, part.category, family)
          // Remove the last non-empty slot of this kind (most recently installed), or
          // if none non-empty, the last empty slot.
          const occupied = candidates.filter(c => !c.isEmpty)
          const target = occupied.length > 0
            ? occupied[occupied.length - 1]!
            : candidates[candidates.length - 1]
          if (target) {
            pa.upgradeCurrent.splice(target.idx, 1)
          }
        }

        const ucAfter = pa.upgradeCurrent.map(s => ({ ...s }))

        // Recompute snapshot (service: unchanged since serviceReplace skipped by deriveStock)
        this.recomputeSnapshots(new Set([input.skuId]))

        return {
          value: movement,
          after: { upgradeCurrent: ucAfter } as unknown as Record<string, unknown>,
        }
      },
    )
    return r
  }

  /**
   * Create a SKU in any models-behavior category.
   *
   * Id scheme: `<categoryId>_<slug>_<seq>` — for categoryId 'gpu' this is IDENTICAL
   * to the legacy createGpu id scheme so no data migration is needed.
   *
   * Audit action:
   *   - categoryId === 'gpu'  → 'gpu_created'  (byte-for-byte backward compat)
   *   - any other category    → 'model_sku_created'
   *
   * Validation: resolves the category from this.partCategories by id.
   * If missing AND categoryId === 'gpu', the create is allowed (legacy fallback).
   * If missing for any other category, throws InvalidCategoryBehaviorError.
   */
  async createModelSku(
    input: CreateModelSkuInput,
    actor: Actor,
  ): Promise<AuditedResult<Part>> {
    const { categoryId } = input

    // Validate category behavior.
    const catDef = this.partCategories.find(c => c.id === categoryId)
    if (!catDef) {
      // Legacy fallback: gpu is always models even without a catalog entry.
      if (categoryId !== 'gpu') {
        throw new InvalidCategoryBehaviorError(categoryId, 'models', 'unknown (not in catalog)')
      }
    } else if (catDef.behavior !== 'models') {
      throw new InvalidCategoryBehaviorError(categoryId, 'models', catDef.behavior)
    }

    const id = `${categoryId}_${slug(input.name)}_${++this.seq}`
    const now = nowIso()

    // Audit action: 'gpu_created' for gpu (backwards compat), 'model_sku_created' for others.
    const auditAction = categoryId === 'gpu' ? 'gpu_created' as const : 'model_sku_created' as const

    let part!: Part

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part',
        entityId: id,
        action: auditAction,
        actorUid: actor.uid,
        actorRole: actor.role, actorName: actor.displayName ?? null,
        before: null,
        after: null, // set in mutate
      },
      async () => {
        part = {
          id,
          name: input.name,
          category: categoryId,
          unit: 'шт',
          onHand: 0,
          broken: 0,
          lowStockThreshold: 5,
          createdAt: now,
          updatedAt: now,
          createdBy: actor.uid,
          updatedBy: actor.uid,
        }
        this.parts.push(part)

        if (input.initialQty > 0) {
          const mv: PartMovement = {
            id: this.nextId('mv'),
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
            at: now,
          }
          this.movements.push(mv)
          this.recomputeSnapshots(new Set([id]))
        }

        const after = { ...part } as unknown as Record<string, unknown>
        return { value: part, after }
      },
    )
    return r
  }

  /**
   * @deprecated Use createModelSku({ categoryId: 'gpu', name, initialQty }, actor).
   * Legacy alias delegating to createModelSku with categoryId 'gpu'.
   * Kept for call-site compatibility until Phase-2 UI task migrates all callers.
   */
  async createGpu(
    input: CreateGpuInput,
    actor: Actor,
  ): Promise<AuditedResult<Part>> {
    return this.createModelSku({ categoryId: 'gpu', ...input }, actor)
  }

  /**
   * recordService — port of prototype handleServiceConfirm (parts.html ~3465-3487).
   *
   * Records a SKU-less maintenance event as a `type:'service'` journal movement.
   * Stock-neutral: skuId is empty, qty=0, broken=false, serviceReplace=false.
   * Does NOT mutate upgradeCurrent (a service log is NOT a part swap).
   * Does NOT call recomputeSnapshots (no stock change).
   * ONE withAudit transaction writes the movement + audit_logs entry.
   */
  async recordService(
    input: import('@/domain/part/PartRepository').ServiceRecordInput,
    actor: Actor,
  ): Promise<AuditedResult<PartMovement>> {
    let movement!: PartMovement

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part_movement',
        entityId: this.nextId('svc'),
        action: 'part_serviced',
        actorUid: actor.uid,
        actorRole: actor.role, actorName: actor.displayName ?? null,
        before: null,
        after: {
          assetId: input.assetId,
          kindId: input.kindId,
          kindLabel: input.kindLabel,
        },
      },
      async () => {
        const at = nowIso()
        movement = {
          id: this.nextId('mv'),
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
        this.movements.push(movement)
        // No recomputeSnapshots — service is stock-neutral.
        // No upgradeCurrent mutation — a service record is a maintenance log, not a part swap.
        return { value: movement }
      },
    )
    return r
  }

  /**
   * Delete a SKU from any models-behavior category.
   * Blocked if any asset currently has the SKU installed (installedCount > 0).
   *
   * This guard applies to ALL models categories (not just GPU).
   *
   * NOTE: Fully implemented in-memory for test coverage.
   * The Firestore adapter throws "not supported in MVP" because /parts client delete is
   * denied by security rules (plan §9.B resolution).
   */
  async deleteModelSku(skuId: string, actor: Actor): Promise<AuditedResult<void>> {
    const part = this.parts.find(p => p.id === skuId)
    if (!part) throw new Error(`deleteModelSku: SKU not found: ${skuId}`)

    // Block if currently installed (net install count > 0 from movements)
    const stockMap = deriveStock(this.movements)
    const stock = stockMap[skuId] ?? { onHand: 0, broken: 0 }
    // Installed count = total received - onHand - broken (units that left the shelf to a device)
    const totalReceived = this.movements
      .filter(m => m.skuId === skuId && m.type === 'receive' && !m.serviceReplace)
      .reduce((s, m) => s + m.qty, 0)
    const installedCount = totalReceived - stock.onHand - stock.broken
    if (installedCount > 0) {
      throw new Error(
        `deleteModelSku: cannot delete SKU ${skuId} — ${installedCount} unit(s) currently installed in assets`,
      )
    }

    const r = await withAudit(
      this.audit,
      {
        entityType: 'part',
        entityId: skuId,
        action: 'deleted',
        actorUid: actor.uid,
        actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { ...part } as unknown as Record<string, unknown>,
        after: null,
      },
      async () => {
        const idx = this.parts.findIndex(p => p.id === skuId)
        if (idx >= 0) this.parts.splice(idx, 1)
        return { value: undefined as void }
      },
    )
    return r
  }

  /**
   * @deprecated Use deleteModelSku. Legacy alias kept for call-site compatibility until
   * Phase-2 UI task migrates all callers; removal is a later cleanup.
   *
   * NOTE: The old deleteGpu enforced `part.category !== 'gpu'` as a guard.
   * deleteModelSku removes that guard because any models-category SKU is deletable —
   * the protection is the install-count check, not the category type check.
   * For GPU skus the behavior is IDENTICAL to before (same guard path, same audit action).
   */
  async deleteGpu(skuId: string, actor: Actor): Promise<AuditedResult<void>> {
    // Legacy compatibility: enforce that the SKU is a GPU before delegating,
    // matching the old `part.category !== 'gpu'` check exactly.
    const part = this.parts.find(p => p.id === skuId)
    if (part && part.category !== 'gpu') {
      throw new Error(`deleteGpu: SKU is not a GPU: ${skuId}`)
    }
    return this.deleteModelSku(skuId, actor)
  }
}
