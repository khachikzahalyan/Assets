import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type { Subscription, CreateSubscriptionInput } from '@/domain/subscription'
import type { SubscriptionRepository, SubscriptionListQuery } from '@/domain/subscription'
import {
  withAudit,
  type AuditContext,
} from '@/lib/audit'
import { sanitizeLicenseAuditPayload } from '@/lib/audit'

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private docs = new Map<string, Subscription>()
  private seq = 0

  constructor(
    private readonly ctx: AuditContext,
    seed: Subscription[] = [],
  ) {
    for (const s of seed) {
      this.docs.set(s.id, { ...s })
    }
  }

  // ---- Helpers ---------------------------------------------------------------

  private nextId(): string {
    return `sub_${++this.seq}`
  }

  private cloneDoc(s: Subscription): Subscription {
    return { ...s, assignedEmployeeIds: [...s.assignedEmployeeIds] }
  }

  // ---- Reads -----------------------------------------------------------------

  async getSubscription(id: string): Promise<Subscription | null> {
    const s = this.docs.get(id)
    return s ? this.cloneDoc(s) : null
  }

  async listSubscriptions(q?: SubscriptionListQuery): Promise<Subscription[]> {
    let results = Array.from(this.docs.values()).map(s => this.cloneDoc(s))

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
    const id = this.nextId()
    const now = new Date().toISOString()
    const ids = input.assignedEmployeeIds ?? []

    const doc: Subscription = {
      id,
      name: input.name,
      vendorEmail: input.vendorEmail ?? null,
      seatsTotal: input.seatsTotal,
      assignedEmployeeIds: [...ids],
      purchaseDate: input.purchaseDate ?? null,
      expiryDate: input.expiryDate ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
      updatedBy: actor.uid,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'subscription' as const,
      entityId: id,
      action: 'subscription_created' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: {
        id,
        name: doc.name,
        seatsTotal: doc.seatsTotal,
        assignedCount: ids.length,
      } as Record<string, unknown>,
    })

    return withAudit(this.ctx, safeSpec, async () => {
      this.docs.set(id, doc)
      return { value: this.cloneDoc(doc) }
    })
  }

  async updateAssignees(
    id: string,
    employeeIds: string[],
    actor: Actor,
  ): Promise<AuditedResult<Subscription>> {
    const existing = this.docs.get(id)
    if (!existing) throw new Error(`Subscription not found: ${id}`)

    const now = new Date().toISOString()
    const updated: Subscription = {
      ...existing,
      assignedEmployeeIds: [...employeeIds],
      updatedAt: now,
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

    return withAudit(this.ctx, safeSpec, async () => {
      this.docs.set(id, updated)
      return { value: this.cloneDoc(updated) }
    })
  }
}
