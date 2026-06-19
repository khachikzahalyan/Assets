import type { MaskedKey } from '@/lib/audit/maskSecrets'

/** License product flavour for workstation (assignable) licenses. */
export type LicenseType = 'Default' | 'OEM' | 'Retail' | 'Volume' | 'Subscription'

/** Who/what a workstation license is currently bound to. */
export type AssignmentType = 'employee' | 'device' | 'unassigned'

/** Lifecycle state of a workstation license. */
export type LifecycleStatus = 'active' | 'retired'

/**
 * A workstation (assignable) license. Independent from {@link ServerLicense}.
 * Reference fields are FLAT optional fields (not a nested discriminated union):
 * `assignmentType` is the source of truth; only the matching `assignedTo*` field
 * is expected to be set.
 */
export interface WorkstationLicense {
  id: string
  name: string
  vendor: string | null
  type: LicenseType
  isReusable: boolean
  assignmentType: AssignmentType
  assignedToEmployeeId?: string | null
  assignedToAssetId?: string | null
  assignedAt?: string | null
  assignedBy?: string | null
  lifecycleStatus: LifecycleStatus
  retiredAt?: string | null
  retiredWithAssetId?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/**
 * Audit-safe projection of a workstation license.
 * `key` is typed as {@link MaskedKey} so the compiler refuses a raw license key
 * (or a raw license object) in audit payloads.
 */
export interface WorkstationLicenseAuditView {
  id: string
  name: string
  assignmentType: AssignmentType
  lifecycleStatus: LifecycleStatus
  key?: MaskedKey
}

/**
 * Input to create a workstation license.
 * NOTE: `rawKey` is written ONLY to `secrets/current` and is NEVER persisted on
 * the license document itself.
 */
export interface CreateWorkstationLicenseInput {
  name: string
  vendor?: string | null
  type: LicenseType
  isReusable?: boolean
  expiresAt?: string | null
  /** Raw license key — written ONLY to secrets/current, never to the doc. */
  rawKey?: string | null
  assign?:
    | { to: 'employee'; employeeId: string }
    | { to: 'device'; assetId: string }
    | { to: 'unassigned' }
}

/** Input to (re)assign or decouple a workstation license. */
export interface AssignWorkstationLicenseInput {
  to: 'employee' | 'device' | 'unassigned'
  employeeId?: string
  assetId?: string
}
