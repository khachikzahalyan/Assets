/**
 * A SaaS / seat-based subscription license.
 *
 * `seatsUsed` is intentionally ABSENT — it is derived as
 * `assignedEmployeeIds.length` at read time and MUST NOT be stored.
 */
export interface Subscription {
  id: string
  name: string
  vendorEmail: string | null
  seatsTotal: number
  assignedEmployeeIds: string[]
  purchaseDate: string | null
  expiryDate: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/**
 * Input to create a new subscription.
 * NOTE: No `rawKey` — subscriptions have no secret key field.
 */
export interface CreateSubscriptionInput {
  name: string
  vendorEmail?: string | null
  seatsTotal: number
  assignedEmployeeIds?: string[]
  purchaseDate?: string | null
  expiryDate?: string | null
}
