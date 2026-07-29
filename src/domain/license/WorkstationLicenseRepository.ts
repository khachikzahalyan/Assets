import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type {
  WorkstationLicense,
  CreateWorkstationLicenseInput,
  AssignWorkstationLicenseInput,
} from './WorkstationLicense'

/** Filters for the workstation-license list. `'all'` disables the given filter. */
export interface WorkstationLicenseListQuery {
  assignmentType?: 'employee' | 'device' | 'unassigned' | 'all'
  lifecycleStatus?: 'active' | 'retired' | 'all'
  search?: string
}

/**
 * The ONLY workstation-license port.
 *
 * Secret read/write/reveal are PRIVATE members of the implementations — they are
 * deliberately NOT on this interface, so the public surface can never read or
 * leak a raw key.
 *
 * Every mutating method writes exactly ONE audit entry and therefore returns an
 * {@link AuditedResult}.
 */
export interface WorkstationLicenseRepository {
  listLicenses(q?: WorkstationLicenseListQuery): Promise<WorkstationLicense[]>
  getLicense(id: string): Promise<WorkstationLicense | null>
  listForAsset(assetId: string): Promise<WorkstationLicense[]>
  listAssignablePool(): Promise<WorkstationLicense[]>
  /**
   * Returns all licenses that were decoupled from the given asset during write-off.
   * These are active (reusable) licenses now free in the pool, with `decoupledFromAssetId === assetId`.
   * Used to show the "freed key" card on a disposed asset's detail page.
   */
  listDecoupledFromAsset(assetId: string): Promise<WorkstationLicense[]>
  createLicense(input: CreateWorkstationLicenseInput, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  assignLicense(id: string, input: AssignWorkstationLicenseInput, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  /**
   * KEY SWAP: atomically (a) detach the OLD manually-entered license from the
   * asset — it becomes free with `decoupledFromAssetId = assetId` (the SAME
   * mechanism the write-off decouple uses, so the freed key shows its origin
   * device in the free pool), and (b) assign the NEW license to that asset.
   *
   * Writes the SAME two audit entries the standalone paths write
   * (`'license_decoupled'` for the old + `'assigned'` for the new) in one
   * atomic unit. Rejects an OEM old license (embedded keys cannot be swapped)
   * and an old license not currently bound to the given asset.
   *
   * Returns the NEW license state; `auditId` is the `'assigned'` entry.
   */
  swapDeviceKey(newLicenseId: string, oldLicenseId: string, assetId: string, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  decoupleLicense(id: string, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  /**
   * RETIRE a non-reusable license because the asset it was bound to is being
   * written off. Sets `lifecycleStatus` to `'retired'`, stamps `retiredAt` and
   * `retiredWithAssetId`, clears the assignment, and records a
   * `'license_retired_with_asset'` audit entry.
   */
  retireLicense(id: string, assetId: string, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  rotateKey(id: string, rawKey: string, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
}
