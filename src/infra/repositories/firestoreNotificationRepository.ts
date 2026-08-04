import {
  collection, doc, addDoc, updateDoc, getDocs, query as fsQuery,
  where, orderBy, limit, arrayUnion, serverTimestamp, Timestamp,
  type Firestore,
} from 'firebase/firestore'
import type {
  AppNotification, AppNotificationType, NotificationAudience,
  NotificationRepository, CreateRoleActivatedInput,
} from '@/domain/notification'
import { toIso } from './firestoreUtils'

function toNotification(id: string, d: Record<string, unknown>): AppNotification {
  const s = (k: string): string | undefined =>
    typeof d[k] === 'string' && (d[k] as string) ? (d[k] as string) : undefined
  const assetId = s('assetId'); const assetTitle = s('assetTitle')
  const invCode = s('invCode'); const employeeName = s('employeeName')
  const userUid = s('userUid'); const userName = s('userName')
  const userEmail = s('userEmail'); const roleId = s('roleId')
  return {
    id,
    type: (d['type'] as AppNotificationType) ?? 'receipt_confirmed',
    audience: (d['audience'] as NotificationAudience) ?? 'admins',
    createdAt: toIso(d['createdAt']),
    readBy: Array.isArray(d['readBy']) ? (d['readBy'] as string[]).filter(x => typeof x === 'string') : [],
    ...(assetId ? { assetId } : {}),
    ...(assetTitle ? { assetTitle } : {}),
    ...(invCode ? { invCode } : {}),
    ...(employeeName ? { employeeName } : {}),
    ...(userUid ? { userUid } : {}),
    ...(userName ? { userName } : {}),
    ...(userEmail ? { userEmail } : {}),
    ...(roleId ? { roleId } : {}),
  }
}

export class FirestoreNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Firestore) {}

  async listRecent(audiences: NotificationAudience[], sinceIso: string): Promise<AppNotification[]> {
    if (audiences.length === 0) return []
    const snap = await getDocs(fsQuery(
      collection(this.db, 'notifications'),
      where('audience', 'in', audiences),
      where('createdAt', '>=', Timestamp.fromDate(new Date(sinceIso))),
      orderBy('createdAt', 'desc'),
      limit(50),
    ))
    return snap.docs.map(d => toNotification(d.id, d.data() as Record<string, unknown>))
  }

  async markRead(ids: string[], uid: string): Promise<void> {
    for (const id of ids) {
      try {
        await updateDoc(doc(this.db, 'notifications', id), { readBy: arrayUnion(uid) })
      } catch { /* best-effort per doc — a race or revoked access never breaks the bell */ }
    }
  }

  async createRoleActivated(input: CreateRoleActivatedInput): Promise<void> {
    await addDoc(collection(this.db, 'notifications'), {
      type: 'role_activated',
      audience: 'super_admin',
      userUid: input.userUid,
      userName: input.userName,
      userEmail: input.userEmail,
      roleId: input.roleId,
      createdAt: serverTimestamp(),
      readBy: [],
    })
  }
}
