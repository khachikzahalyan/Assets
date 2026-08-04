import type { AppNotification, NotificationAudience } from './types'

export interface CreateRoleActivatedInput {
  userUid: string
  userName: string
  userEmail: string
  roleId: string
}

export interface NotificationRepository {
  /**
   * Recent events for the given audiences, newest first, capped at ~50.
   * `sinceIso` bounds the window (createdAt >= sinceIso).
   */
  listRecent(audiences: NotificationAudience[], sinceIso: string): Promise<AppNotification[]>

  /** Adds `uid` to readBy of each doc. Best-effort per doc — never throws. */
  markRead(ids: string[], uid: string): Promise<void>

  /**
   * Self-reported «role claimed on first sign-in» event (audience super_admin).
   * Allowed by rules only for the caller's own uid.
   */
  createRoleActivated(input: CreateRoleActivatedInput): Promise<void>
}
