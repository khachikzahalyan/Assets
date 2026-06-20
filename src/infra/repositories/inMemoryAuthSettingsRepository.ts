import type { AuthSettings, AuthSettingsRepository } from '@/domain/settings'
import { normalizeDomain, dedupeDomains } from '@/domain/settings'
import type { Actor } from '@/domain/asset'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

export class InMemoryAuthSettingsRepository implements AuthSettingsRepository {
  private doc: AuthSettings
  constructor(
    initial: AuthSettings = { allowedEmailDomains: [] },
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {
    this.doc = { ...initial, allowedEmailDomains: [...initial.allowedEmailDomains] }
  }

  async getAuthSettings(): Promise<AuthSettings> {
    return { ...this.doc, allowedEmailDomains: [...this.doc.allowedEmailDomains] }
  }

  async updateAllowedDomains(domains: string[], actor: Actor) {
    const before = [...this.doc.allowedEmailDomains]
    const next = dedupeDomains(domains.map(normalizeDomain).filter(Boolean))
    return withAudit(
      this.audit,
      {
        entityType: 'settings',
        entityId: 'auth',
        action: 'updated',
        actorUid: actor.uid,
        actorRole: actor.role,
        before: { allowedEmailDomains: before },
        after: { allowedEmailDomains: next },
      },
      async () => {
        this.doc = {
          ...this.doc,
          allowedEmailDomains: next,
          updatedBy: actor.uid,
          updatedAt: new Date().toISOString(),
        }
        return { value: { ...this.doc, allowedEmailDomains: [...next] } }
      },
    )
  }
}
