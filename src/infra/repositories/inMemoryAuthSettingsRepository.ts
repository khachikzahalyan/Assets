import type { AuthSettings, AuthSettingsRepository } from '@/domain/settings'
import { normalizeDomain, dedupeDomains } from '@/domain/settings'
import type { Actor } from '@/domain/asset'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

/** Normalise and dedupe a list of seed email addresses. */
function normalizeSeedEmails(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of raw) {
    const key = e.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

export class InMemoryAuthSettingsRepository implements AuthSettingsRepository {
  private doc: AuthSettings
  constructor(
    initial: AuthSettings = { allowedEmailDomains: [] },
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {
    this.doc = {
      ...initial,
      allowedEmailDomains: [...initial.allowedEmailDomains],
      ...(initial.seedSuperAdmins !== undefined
        ? { seedSuperAdmins: [...initial.seedSuperAdmins] }
        : {}),
    }
  }

  async getAuthSettings(): Promise<AuthSettings> {
    return {
      ...this.doc,
      allowedEmailDomains: [...this.doc.allowedEmailDomains],
      ...(this.doc.seedSuperAdmins !== undefined
        ? { seedSuperAdmins: [...this.doc.seedSuperAdmins] }
        : {}),
    }
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
        actorRole: actor.role, actorName: actor.displayName ?? null,
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

  async updateSeedAdmins(emails: string[], actor: Actor) {
    const before = [...(this.doc.seedSuperAdmins ?? [])]
    const next = normalizeSeedEmails(emails)
    return withAudit(
      this.audit,
      {
        entityType: 'settings',
        entityId: 'auth',
        action: 'updated',
        actorUid: actor.uid,
        actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { seedSuperAdmins: before },
        after: { seedSuperAdmins: next },
      },
      async () => {
        this.doc = {
          ...this.doc,
          seedSuperAdmins: next,
          updatedBy: actor.uid,
          updatedAt: new Date().toISOString(),
        }
        return { value: { ...this.doc, seedSuperAdmins: [...next] } }
      },
    )
  }
}
