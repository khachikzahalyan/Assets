import {
  doc, getDoc, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { AuthSettings, AuthSettingsRepository } from '@/domain/settings'
import { normalizeDomain, dedupeDomains } from '@/domain/settings'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import { firestoreAuditContext, withAudit } from '@/lib/audit'

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

function toAuthSettings(d: Record<string, unknown> | undefined): AuthSettings {
  const rawDomains = d?.allowedEmailDomains
  const allowedEmailDomains = Array.isArray(rawDomains)
    ? rawDomains.filter((x): x is string => typeof x === 'string')
    : []

  const rawSeed = d?.seedSuperAdmins
  const seedSuperAdmins: string[] = Array.isArray(rawSeed)
    ? rawSeed.filter((x): x is string => typeof x === 'string')
    : []

  const out: AuthSettings = { allowedEmailDomains, seedSuperAdmins }
  if (typeof d?.emailLinkActionUrl === 'string') out.emailLinkActionUrl = d.emailLinkActionUrl
  if (typeof d?.googleClientId === 'string') out.googleClientId = d.googleClientId
  if (typeof d?.updatedAt === 'string') out.updatedAt = d.updatedAt
  if (typeof d?.updatedBy === 'string') out.updatedBy = d.updatedBy
  return out
}

export class FirestoreAuthSettingsRepository implements AuthSettingsRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async getAuthSettings(): Promise<AuthSettings> {
    const snap = await getDoc(doc(this.db, 'settings', 'auth'))
    return toAuthSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)
  }

  async updateAllowedDomains(domains: string[], actor: Actor): Promise<AuditedResult<AuthSettings>> {
    const before = await this.getAuthSettings()
    const next = dedupeDomains(domains.map(normalizeDomain).filter(Boolean))
    const ref = doc(this.db, 'settings', 'auth')
    return withAudit(
      this.audit,
      {
        entityType: 'settings',
        entityId: 'auth',
        action: 'updated',
        actorUid: actor.uid,
        actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { allowedEmailDomains: before.allowedEmailDomains },
        after: { allowedEmailDomains: next },
      },
      async (txn) => {
        ;(txn as unknown as Transaction).set(
          ref,
          { allowedEmailDomains: next, updatedBy: actor.uid, updatedAt: serverTimestamp() },
          { merge: true },
        )
        const value: AuthSettings = {
          ...before,
          allowedEmailDomains: next,
          updatedBy: actor.uid,
        }
        return { value }
      },
    )
  }

  async updateSeedAdmins(emails: string[], actor: Actor): Promise<AuditedResult<AuthSettings>> {
    const before = await this.getAuthSettings()
    const next = normalizeSeedEmails(emails)
    const ref = doc(this.db, 'settings', 'auth')
    return withAudit(
      this.audit,
      {
        entityType: 'settings',
        entityId: 'auth',
        action: 'updated',
        actorUid: actor.uid,
        actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { seedSuperAdmins: before.seedSuperAdmins ?? [] },
        after: { seedSuperAdmins: next },
      },
      async (txn) => {
        ;(txn as unknown as Transaction).set(
          ref,
          { seedSuperAdmins: next, updatedBy: actor.uid, updatedAt: serverTimestamp() },
          { merge: true },
        )
        const value: AuthSettings = {
          ...before,
          seedSuperAdmins: next,
          updatedBy: actor.uid,
        }
        return { value }
      },
    )
  }
}
