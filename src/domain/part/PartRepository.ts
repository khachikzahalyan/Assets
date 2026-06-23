import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import type { Part, PartMovement, PartsAsset } from './types'

/** Reference data needed to render the parts warehouse + devices tab without N+1 reads. */
export interface PartReferenceData {
  parts: Part[]                 // catalog with derived onHand/broken snapshots
  movements: PartMovement[]     // full journal (MVP: load all; Phase 2 paginate)
  partsAssets: PartsAsset[]     // upgradeable-asset projection for the Devices tab
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
  createGpu(input: CreateGpuInput, actor: Actor): Promise<AuditedResult<Part>>
  /** GPU-only. Blocked if any asset currently has the SKU installed. */
  deleteGpu(skuId: string, actor: Actor): Promise<AuditedResult<void>>
}
