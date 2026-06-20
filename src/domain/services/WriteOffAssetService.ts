import type { Actor, AssetWriteRepository, Asset } from '@/domain/asset'
import type { WorkstationLicenseRepository } from '@/domain/license'
import type { AuditedResult } from '@/domain/audit'

/**
 * Domain service that writes off an asset while keeping every bound workstation
 * license consistent.
 *
 * INVARIANT: after {@link writeOff} returns, NO active workstation license may
 * still point at the disposed asset (no orphan `assignedToAssetId`).
 * - reusable licenses are DECOUPLED (returned to the assignable pool);
 * - non-reusable licenses are RETIRED with the asset.
 *
 * The decision is category-agnostic: we simply run the loop over whatever
 * {@link WorkstationLicenseRepository.listForAsset} returns. If there are no
 * bound licenses the loop is a no-op and only the status change happens.
 *
 * Dispose-first + reconcile: the asset is disposed before licenses are
 * reconciled, so a mid-loop failure leaves a disposed asset whose still-bound
 * licenses are reaped on a safe, idempotent re-run (decouple/retire write
 * absolute values). A future hardening could wrap all writes in one
 * runTransaction for strict cross-repo atomicity — flagged to owner.
 */
export class WriteOffAssetService {
  constructor(
    private readonly assets: AssetWriteRepository,
    private readonly licenses: WorkstationLicenseRepository,
  ) {}

  /**
   * Write off an asset: first flip the asset to st_disposed, then
   * decouple/retire every bound workstation license.
   *
   * Ordering rationale: dispose FIRST so that a mid-loop failure leaves a
   * disposed asset with straggler licenses rather than an un-disposed asset
   * with orphaned licenses. A caller may safely re-run writeOff on an already-
   * disposed asset — the license reconciliation loop is idempotent (decouple
   * and retire write absolute values, listForAsset only returns active bindings).
   */
  async writeOff(assetId: string, actor: Actor, comment?: string): Promise<AuditedResult<Asset>> {
    const result = await this.assets.changeStatus(assetId, 'st_disposed', actor, comment ? { comment } : undefined)
    const bound = await this.licenses.listForAsset(assetId)
    for (const lic of bound) {
      if (lic.isReusable) await this.licenses.decoupleLicense(lic.id, actor)
      else await this.licenses.retireLicense(lic.id, assetId, actor)
    }
    return result
  }
}
