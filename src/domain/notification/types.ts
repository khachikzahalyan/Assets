/**
 * App notifications — persistent bell events (Firestore /notifications).
 *
 * Two event types for now:
 *  - receipt_confirmed: an employee confirmed asset receipt (email magic link or
 *    the in-app «Мои активы» button). Audience: ALL admins.
 *  - role_activated: an invited user claimed their preassigned role on first
 *    sign-in. Audience: super_admin only.
 *
 * Read state is per-admin: `readBy` collects the uids that have seen the event
 * (the bell marks everything visible as read when opened — owner decision,
 * 2026-08-04). Events older than 30 days are not shown (docs stay in Firestore;
 * audit_logs remain the permanent history).
 */

export type AppNotificationType = 'receipt_confirmed' | 'role_activated'

/** Who may see the event. Drives both the Firestore rules and the client query. */
export type NotificationAudience = 'admins' | 'super_admin'

export interface AppNotification {
  id: string
  type: AppNotificationType
  audience: NotificationAudience
  /** ISO timestamp of the event. */
  createdAt: string
  /** Uids of admins who have seen this event in the bell. */
  readBy: string[]

  // receipt_confirmed payload
  assetId?: string
  /** Display label — brand+model or category name. */
  assetTitle?: string
  invCode?: string
  employeeName?: string

  // role_activated payload
  userUid?: string
  userName?: string
  userEmail?: string
  roleId?: string
}

/** Bell window: events older than this many days are hidden (docs are kept). */
export const NOTIFICATION_WINDOW_DAYS = 30
