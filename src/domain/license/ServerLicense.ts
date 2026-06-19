import type { MaskedKey } from '@/lib/audit/maskSecrets'

/** License product flavour for server / infrastructure licenses. */
export type ServerLicenseType = 'Server' | 'Global' | 'Infrastructure'

/**
 * A server license. Completely INDEPENDENT from WorkstationLicense — there is no
 * shared base interface and no discriminated union linking the two.
 *
 * Owned by the company; NEVER assigned to a person or an asset. By construction
 * this interface has NO `assignedTo*` and NO `assignmentType` field, so an
 * assignment is impossible at the type level.
 */
export interface ServerLicense {
  id: string
  name: string
  vendor: string | null
  type: ServerLicenseType
  environment?: string | null
  host?: string | null
  expiresAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/**
 * Audit-safe projection of a server license.
 * `key` is typed as {@link MaskedKey} so the compiler refuses a raw license key.
 */
export interface ServerLicenseAuditView {
  id: string
  name: string
  key?: MaskedKey
}

/**
 * Input to create a server license.
 * NOTE: `rawKey` is written ONLY to `secrets/current` and is NEVER persisted on
 * the license document itself.
 */
export interface CreateServerLicenseInput {
  name: string
  vendor?: string | null
  type: ServerLicenseType
  environment?: string | null
  host?: string | null
  expiresAt?: string | null
  /** Raw license key — written ONLY to secrets/current, never to the doc. */
  rawKey?: string | null
}
