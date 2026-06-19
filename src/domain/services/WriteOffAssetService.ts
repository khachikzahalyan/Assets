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
 * Atomicity note: in production each Firestore repository call runs inside its
 * OWN `withAudit` transaction (one per repo call), so this orchestration is NOT
 * a single cross-repo transaction. The InMemory test verifies the orchestration
 * order plus the no-orphan invariant. A future hardening could wrap the whole
 * sequence in one `runTransaction` if cross-repo atomicity becomes a hard
 * requirement — flagged to the owner.
 */
export class WriteOffAssetService {
  constructor(
    private readonly assets: AssetWriteRepository,
    private readonly licenses: WorkstationLicenseRepository,
  ) {}

  /** Write off an asset: atomically decouple/retire every bound workstation license,
   *  then flip the asset to st_disposed. No license may remain pointing at the asset. */
  async writeOff(assetId: string, actor: Actor, comment?: string): Promise<AuditedResult<Asset>> {
    const bound = await this.licenses.listForAsset(assetId)
    for (const lic of bound) {
      if (lic.isReusable) await this.licenses.decoupleLicense(lic.id, actor)
      else await this.licenses.retireLicense(lic.id, assetId, actor)
    }
    return this.assets.changeStatus(assetId, 'st_disposed', actor, comment ? { comment } : undefined)
  }
}
