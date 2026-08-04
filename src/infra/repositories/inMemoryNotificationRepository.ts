import type {
  AppNotification, NotificationAudience,
  NotificationRepository, CreateRoleActivatedInput,
} from '@/domain/notification'

/** Test double for the /notifications bell events. */
export class InMemoryNotificationRepository implements NotificationRepository {
  constructor(public readonly docs: AppNotification[] = []) {}

  async listRecent(audiences: NotificationAudience[], sinceIso: string): Promise<AppNotification[]> {
    if (audiences.length === 0) return []
    return this.docs
      .filter(n => audiences.includes(n.audience) && n.createdAt >= sinceIso)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
  }

  async markRead(ids: string[], uid: string): Promise<void> {
    for (const id of ids) {
      const n = this.docs.find(d => d.id === id)
      if (n && !n.readBy.includes(uid)) n.readBy.push(uid)
    }
  }

  async createRoleActivated(input: CreateRoleActivatedInput): Promise<void> {
    this.docs.push({
      id: `ntf_${this.docs.length + 1}`,
      type: 'role_activated',
      audience: 'super_admin',
      createdAt: new Date().toISOString(),
      readBy: [],
      userUid: input.userUid,
      userName: input.userName,
      userEmail: input.userEmail,
      roleId: input.roleId,
    })
  }
}
