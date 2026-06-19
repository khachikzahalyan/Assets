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
  createLicense(input: CreateWorkstationLicenseInput, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
  assignLicense(id: string, input: AssignWorkstationLicenseInput, actor: Actor): Promise<AuditedResult<WorkstationLicense>>
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
