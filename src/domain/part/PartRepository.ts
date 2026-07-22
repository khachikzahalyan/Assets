import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import type { Part, PartMovement, PartsAsset } from './types'
import type { PartCategoryDef } from './partCategory-types'

/**
 * Reference data needed to render the parts warehouse + devices tab without N+1 reads.
 *
 * `partCategories` is the FULL catalog including inactive entries (UI filters on `active`).
 * Implementations MUST NOT return an empty array — when the Firestore part_categories
 * collection is empty or unavailable they fall back to DEFAULT_PART_CATEGORY_DEFS (with
 * fixed ISO timestamps) so an unseeded project behaves byte-for-byte identically to the
 * old hardcoded 7-value catalog. Sorted by `order` ascending.
 *
 * Implementations MUST NOT return an empty array — fall back to DEFAULT_PART_CATEGORY_DEFS
 * (with fixed ISO timestamps) when the Firestore part_categories collection is empty/unseeded.
 */
export interface PartReferenceData {
  parts: Part[]                        // catalog with derived onHand/broken snapshots
  movements: PartMovement[]            // full journal (MVP: load all; Phase 2 paginate)
  partsAssets: PartsAsset[]            // upgradeable-asset projection for the Devices tab
  /**
   * Full category catalog including inactive entries. UI filters on `active`.
   * Sorted by `order` ascending.
   * Implementations MUST NOT return an empty array — fall back to DEFAULT_PART_CATEGORY_DEFS
   * (with fixed ISO timestamps) when the Firestore part_categories collection is empty/unseeded.
   */
  partCategories: PartCategoryDef[]
}

/**
 * Read-side port for the parts warehouse. Implementations:
 * firestorePartRepository (production), inMemoryPartRepository (tests/dev).
 */
export interface PartRepository {
  loadReferenceData(): Promise<PartReferenceData>
  listMovementsForSku(skuId: string): Promise<PartMovement[]>
  listMovementsForAsset(assetId: string): Promise<PartMovement[]>
}

export interface ReceiveItem {
  skuId: string
  qty: number
}

export interface InstallInput {
  skuId: string
  assetId: string                 // internal slug
  assetInvCode: string
  assetCategoryId: string
  action: 'install' | 'replace'
  replaceUcIndex: number | null   // index into upgradeCurrent to overwrite (replace only)
  oldIsBroken: boolean            // replace only: scrap old vs return-to-shelf
  serviceReplace: boolean
  note?: string | null
}

export interface UninstallInput {
  skuId: string
  assetId: string
  assetInvCode: string
  assetCategoryId: string
  broken: boolean
  serviceReplace: boolean
  note?: string | null
}

export interface CreateGpuInput {
  name: string
  initialQty: number
}

/**
 * Generic input for creating a SKU in any models-behavior category.
 * `categoryId` must refer to a PartCategoryDef with behavior === 'models';
 * implementations throw a domain error (InvalidCategoryBehaviorError) otherwise.
 *
 * @see createModelSku
 */
export interface CreateModelSkuInput {
  /** Id of the target PartCategoryDef. Must have behavior === 'models'. */
  categoryId: string
  name: string
  initialQty: number
}

/**
 * A SKU-less service event recorded against an asset. Produces a `type:'service'`
 * journal movement (skuId=null, qty=0) that NEVER affects warehouse stock.
 * Mirrors prototype parts.html handleServiceConfirm (~3465-3487).
 */
export interface ServiceRecordInput {
  assetId: string                 // internal asset slug
  assetInvCode: string            // denormalised for journal display
  kindId: string                  // component-kind being serviced
  kindLabel: string               // human label (also used as movement reason)
  note?: string | null
}

/**
 * Write-side port. Each method runs inside `withAudit(...)` so the data write and
 * exactly one `audit_logs` entry land in the same transaction. Install/uninstall
 * additionally mutate the target asset's hardware snapshot in the SAME transaction so
 * stock and the asset's upgrade slots can never desync.
 */
export interface PartWriteRepository {
  receiveParts(items: ReceiveItem[], actor: Actor): Promise<AuditedResult<PartMovement[]>>
  installPart(input: InstallInput, actor: Actor): Promise<AuditedResult<PartMovement>>
  uninstallPart(input: UninstallInput, actor: Actor): Promise<AuditedResult<PartMovement>>
  /**
   * Record a SKU-less service event as a `type:'service'` journal movement.
   * Stock-neutral (skuId=null, qty=0). Audited as entityType 'part_movement',
   * action 'part_serviced'.
   */
  recordService(input: ServiceRecordInput, actor: Actor): Promise<AuditedResult<PartMovement>>
  /**
   * Create a SKU in any models-behavior category.
   *
   * SKU id scheme: `<categoryId>_<slug>` — for categoryId 'gpu' this produces ids
   * IDENTICAL to the legacy createGpu pattern so no data migration is needed.
   *
   * Audit action:
   *   - categoryId === 'gpu'  → 'gpu_created'  (byte-for-byte backward compat with
   *                             existing audit_log docs)
   *   - any other category    → 'model_sku_created'
   *
   * Validation: rejects with InvalidCategoryBehaviorError when the resolved category
   * has behavior !== 'models'. Legacy fallback: if the catalog is empty (unseeded)
   * AND categoryId === 'gpu', the create is allowed (mirrors DEFAULT_PART_CATEGORY_DEFS).
   */
  createModelSku(input: CreateModelSkuInput, actor: Actor): Promise<AuditedResult<Part>>

  /**
   * Delete a SKU from any models-behavior category.
   * Blocked if any asset currently has the SKU installed (installedCount > 0).
   *
   * @deprecated Use deleteModelSku (same implementation; categoryId is derived from the
   *   Part doc). Legacy alias kept for call-site compatibility until Phase-2 UI task
   *   migrates all callers; removal is a later cleanup.
   */
  createGpu(input: CreateGpuInput, actor: Actor): Promise<AuditedResult<Part>>

  /**
   * Delete a SKU from any models-behavior category.
   * Blocked if any asset currently has the SKU installed.
   *
   * Guard applies uniformly to ALL models categories, not just GPU.
   */
  deleteModelSku(skuId: string, actor: Actor): Promise<AuditedResult<void>>

  /**
   * @deprecated Use deleteModelSku. Legacy alias delegating to deleteModelSku.
   * Kept for call-site compatibility until Phase-2 UI task migrates all callers.
   * GPU-only. Blocked if any asset currently has the SKU installed.
   */
  deleteGpu(skuId: string, actor: Actor): Promise<AuditedResult<void>>
}
