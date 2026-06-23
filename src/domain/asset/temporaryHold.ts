import type { AssetAssignment } from './types'

export type TemporaryHoldStatus = 'active' | 'dueSoon' | 'overdue'

/** Parse an ISO date (YYYY-MM-DD or full ISO) into a local-midnight Date. */
function toDayStart(iso: string): Date | null {
  const [datePart] = iso.split('T')
  const [y, m, d] = (datePart ?? '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Derives the return-state of a temporary hold at read time. PURE — no Firebase.
 *
 * - null      — assignment is not a temporary hold, or has no expiresAt.
 * - 'overdue' — expiry day is strictly before `now`'s day.
 * - 'dueSoon' — expiry day is between today and today + dueWithinDays (inclusive).
 * - 'active'  — expiry day is further than dueWithinDays away.
 */
export function temporaryHoldStatus(
  assignment: AssetAssignment | null,
  now: Date = new Date(),
  dueWithinDays = 1,
): TemporaryHoldStatus | null {
  if (!assignment || assignment.isTemporary !== true) return null
  if (!assignment.expiresAt) return null
  const expiry = toDayStart(assignment.expiresAt)
  if (!expiry) return null
  const today = dayStart(now)
  const due = new Date(today)
  due.setDate(due.getDate() + dueWithinDays)
  if (expiry < today) return 'overdue'
  if (expiry <= due) return 'dueSoon'
  return 'active'
}
