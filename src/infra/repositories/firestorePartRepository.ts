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
 *
 * Implementation is split into focused modules:
 *   firestorePartRepository.mappers.ts  — collection constants + domain converters
 *   firestorePartRepository.reads.ts    — read-only query functions
 *   firestorePartRepository.stock.ts    — receiveParts + createGpu transactions
 *   firestorePartRepository.install.ts  — installPart + uninstallPart transactions
 *   firestorePartRepository.service.ts  — recordService transaction
 */

import type { Firestore } from 'firebase/firestore'
import type {
  PartRepository,
  PartWriteRepository,
  PartReferenceData,
  ReceiveItem,
  InstallInput,
  UninstallInput,
  CreateGpuInput,
  ServiceRecordInput,
} from '@/domain/part/PartRepository'
import type { Part, PartMovement } from '@/domain/part/types'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import { fsLoadReferenceData, fsListMovementsForSku, fsListMovementsForAsset } from './firestorePartRepository.reads'
import { fsReceiveParts, fsCreateGpu } from './firestorePartRepository.stock'
import { fsInstallPart } from './firestorePartRepository.install'
import { fsUninstallPart } from './firestorePartRepository.uninstall'
import { fsRecordService } from './firestorePartRepository.service'

export class FirestorePartRepository implements PartRepository, PartWriteRepository {
  constructor(private readonly fsDb: Firestore) {}

  // ---- P1.3: loadReferenceData cache -----------------------------------------
  // Four full-collection reads (parts, movements, assets, categories) deduped and
  // cached with a 60-second TTL. Pattern copied from FirestoreAssetRepository
  // (src/infra/repositories/firestoreAssetRepository.ts:136-176).
  // The cache is cleared on rejection so a transient error (e.g. permission-denied
  // before rules are deployed) doesn't permanently poison the in-memory cache and
  // make subsequent calls fail without hitting Firebase.
  private refCache: Promise<PartReferenceData> | null = null
  private refCacheAt = 0
  private static readonly REF_TTL_MS = 60_000

  // ---- PartRepository (reads) -----------------------------------------------

  async loadReferenceData(): Promise<PartReferenceData> {
    const expired = Date.now() - this.refCacheAt > FirestorePartRepository.REF_TTL_MS
    if (!this.refCache || expired) {
      this.refCacheAt = Date.now()
      this.refCache = fsLoadReferenceData(this.fsDb).catch((err) => {
        this.refCache = null
        throw err
      })
    }
    return this.refCache
  }

  async listMovementsForSku(skuId: string): Promise<PartMovement[]> {
    return fsListMovementsForSku(this.fsDb, skuId)
  }

  async listMovementsForAsset(assetId: string): Promise<PartMovement[]> {
    return fsListMovementsForAsset(this.fsDb, assetId)
  }

  // ---- PartWriteRepository (writes) -----------------------------------------

  async receiveParts(
    items: ReceiveItem[],
    actor: Actor,
  ): Promise<AuditedResult<PartMovement[]>> {
    return fsReceiveParts(this.fsDb, items, actor)
  }

  async installPart(
    input: InstallInput,
    actor: Actor,
  ): Promise<AuditedResult<PartMovement>> {
    return fsInstallPart(this.fsDb, input, actor)
  }

  async uninstallPart(
    input: UninstallInput,
    actor: Actor,
  ): Promise<AuditedResult<PartMovement>> {
    return fsUninstallPart(this.fsDb, input, actor)
  }

  async recordService(
    input: ServiceRecordInput,
    actor: Actor,
  ): Promise<AuditedResult<PartMovement>> {
    return fsRecordService(this.fsDb, input, actor)
  }

  async createGpu(
    input: CreateGpuInput,
    actor: Actor,
  ): Promise<AuditedResult<Part>> {
    return fsCreateGpu(this.fsDb, input, actor)
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
