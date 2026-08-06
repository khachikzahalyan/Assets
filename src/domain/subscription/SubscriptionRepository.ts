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

  /**
   * Self-service read path for the employee «Мои активы» page.
   *
   * Returns all subscriptions where the given employee doc id appears in
   * `assignedEmployeeIds`. The query MUST use an `array-contains` predicate
   * on `assignedEmployeeIds` so that Firestore security rules can prove the
   * self-scope (a doc-level read is allowed for an employee when the caller's
   * uid or linked employeeId is in the array). An unconstrained list query
   * against /subscriptions remains denied for employees.
   */
  listSubscriptionsForEmployee(employeeDocId: string): Promise<Subscription[]>
}
