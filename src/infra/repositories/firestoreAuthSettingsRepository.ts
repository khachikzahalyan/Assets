import {
  doc, getDoc, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { AuthSettings, AuthSettingsRepository } from '@/domain/settings'
import { normalizeDomain, dedupeDomains } from '@/domain/settings'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import { firestoreAuditContext, withAudit } from '@/lib/audit'

function toAuthSettings(d: Record<string, unknown> | undefined): AuthSettings {
  const raw = d?.allowedEmailDomains
  const allowedEmailDomains = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string')
    : []
  const out: AuthSettings = { allowedEmailDomains }
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
        actorRole: actor.role,
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
}
