import type { AuthSettings } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface AuthSettingsRepository {
  /** Returns a normalized doc. MISSING doc → fail-closed default { allowedEmailDomains: [] }. */
  getAuthSettings(): Promise<AuthSettings>
  /** Writes a normalized+deduped domain list via withAudit (one audit row, merge write). */
  updateAllowedDomains(domains: string[], actor: Actor): Promise<AuditedResult<AuthSettings>>
  /**
   * Writes the seedSuperAdmins list (exact email bypass) via withAudit.
   * Entries are lowercased + trimmed + deduped before persisting.
   * An empty list removes all bypasses (the domain gate remains the only gate).
   */
  updateSeedAdmins(emails: string[], actor: Actor): Promise<AuditedResult<AuthSettings>>
}
