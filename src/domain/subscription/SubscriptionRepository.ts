import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type { Subscription, CreateSubscriptionInput } from './Subscription'

/** Filters for the subscription list. */
export interface SubscriptionListQuery {
  search?: string
}

/**
 * The ONLY subscription port.
 *
 * `super_admin` and `tech_admin` may write; all admins may read.
 * Every mutating method writes exactly one audit entry and returns an
 * {@link AuditedResult}.
 *
 * There are no secret-key methods — subscriptions have no license key.
 */
export interface SubscriptionRepository {
  listSubscriptions(q?: SubscriptionListQuery): Promise<Subscription[]>
  getSubscription(id: string): Promise<Subscription | null>
  createSubscription(input: CreateSubscriptionInput, actor: Actor): Promise<AuditedResult<Subscription>>
  updateAssignees(id: string, employeeIds: string[], actor: Actor): Promise<AuditedResult<Subscription>>
}
