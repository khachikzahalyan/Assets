import {
  collection, doc, getDoc, getDocs, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type { Subscription, CreateSubscriptionInput } from '@/domain/subscription'
import type { SubscriptionRepository, SubscriptionListQuery } from '@/domain/subscription'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import { sanitizeLicenseAuditPayload } from '@/lib/audit'

const COL = 'subscriptions'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toSubscription(id: string, d: Record<string, unknown>): Subscription {
  return {
    id,
    name: String(d.name ?? ''),
    vendorEmail: (d.vendorEmail as string | null) ?? null,
    seatsTotal: typeof d.seatsTotal === 'number' ? d.seatsTotal : 0,
    assignedEmployeeIds: Array.isArray(d.assignedEmployeeIds)
      ? (d.assignedEmployeeIds as string[])
      : [],
    purchaseDate: (d.purchaseDate as string | null) ?? null,
    expiryDate: (d.expiryDate as string | null) ?? null,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    createdBy: String(d.createdBy ?? ''),
    updatedBy: String(d.updatedBy ?? ''),
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

export class FirestoreSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  // ---- Reads -----------------------------------------------------------------

  async getSubscription(id: string): Promise<Subscription | null> {
    const snap = await getDoc(doc(this.db, COL, id))
    return snap.exists() ? toSubscription(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async listSubscriptions(q?: SubscriptionListQuery): Promise<Subscription[]> {
    const snap = await getDocs(collection(this.db, COL))
    let results = snap.docs.map(d => toSubscription(d.id, d.data() as Record<string, unknown>))

    if (q?.search) {
      const term = q.search.trim().toLowerCase()
      results = results.filter(s =>
        [s.name, s.vendorEmail].filter(Boolean).join(' ').toLowerCase().includes(term),
      )
    }

    return results.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  // ---- Mutations -------------------------------------------------------------

  async createSubscription(
    input: CreateSubscriptionInput,
    actor: Actor,
  ): Promise<AuditedResult<Subscription>> {
    const ref = doc(collection(this.db, COL))
    const id = ref.id
    const ids = input.assignedEmployeeIds ?? []

    const docData: Record<string, unknown> = stripUndefinedFs({
      name: input.name,
      vendorEmail: input.vendorEmail ?? null,
      seatsTotal: input.seatsTotal,
      assignedEmployeeIds: ids,
      purchaseDate: input.purchaseDate ?? null,
      expiryDate: input.expiryDate ?? null,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'subscription' as const,
      entityId: id,
      action: 'subscription_created' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: {
        id,
        name: input.name,
        seatsTotal: input.seatsTotal,
        assignedCount: ids.length,
      } as Record<string, unknown>,
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, docData)
      return { value: undefined as unknown as void }
    })

    const created = await this.getSubscription(id)
    if (!created) throw new Error('Subscription create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async updateAssignees(
    id: string,
    employeeIds: string[],
    actor: Actor,
  ): Promise<AuditedResult<Subscription>> {
    const existing = await this.getSubscription(id)
    if (!existing) throw new Error(`Subscription not found: ${id}`)

    const ref = doc(this.db, COL, id)
    const patch: Record<string, unknown> = {
      assignedEmployeeIds: employeeIds,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'subscription' as const,
      entityId: id,
      action: 'subscription_assignees_changed' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: { assignedCount: existing.assignedEmployeeIds.length } as Record<string, unknown>,
      after: { assignedCount: employeeIds.length } as Record<string, unknown>,
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, patch, { merge: true })
      return { value: undefined as unknown as void }
    })

    const next = await this.getSubscription(id)
    if (!next) throw new Error('Subscription updateAssignees succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }
}
