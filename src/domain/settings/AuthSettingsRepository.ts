import type { AuthSettings } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface AuthSettingsRepository {
  /** Returns a normalized doc. MISSING doc → fail-closed default { allowedEmailDomains: [] }. */
  getAuthSettings(): Promise<AuthSettings>
  /** Writes a normalized+deduped domain list via withAudit (one audit row, merge write). */
  updateAllowedDomains(domains: string[], actor: Actor): Promise<AuditedResult<AuthSettings>>
}
