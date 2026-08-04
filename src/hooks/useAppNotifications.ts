import { useEffect, useState, useCallback } from 'react'
import type {
  AppNotification, NotificationAudience, NotificationRepository,
} from '@/domain/notification'
import { NOTIFICATION_WINDOW_DAYS } from '@/domain/notification'

export interface UseAppNotificationsResult {
  events: AppNotification[]
  /** Ids that were unread for this uid when fetched — drives the row dot. */
  freshIds: Set<string>
  /** Unread count for the badge; markAllRead() zeroes it optimistically. */
  unreadCount: number
  loading: boolean
  error: Error | null
  reload: () => void
  markAllRead: () => void
}

/**
 * Loads persistent bell events (/notifications) for the given audiences.
 * `repository` null or empty `audiences` → inert (non-admin roles).
 * Events older than NOTIFICATION_WINDOW_DAYS are excluded by the query.
 *
 * @param repository MUST be a stable reference (memoize via useMemo).
 */
export function useAppNotifications(
  repository: NotificationRepository | null,
  audiences: NotificationAudience[],
  uid: string,
): UseAppNotificationsResult {
  const [events, setEvents] = useState<AppNotification[]>([])
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set())
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])
  const audKey = audiences.join(',')

  useEffect(() => {
    if (!repository || !audKey) {
      setEvents([]); setFreshIds(new Set()); setUnreadCount(0); setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    const since = new Date(Date.now() - NOTIFICATION_WINDOW_DAYS * 86_400_000).toISOString()
    void (async () => {
      try {
        const rows = await repository.listRecent(audKey.split(',') as NotificationAudience[], since)
        if (!active) return
        const fresh = new Set(rows.filter(r => !r.readBy.includes(uid)).map(r => r.id))
        setEvents(rows)
        setFreshIds(fresh)
        setUnreadCount(fresh.size)
      } catch (err) {
        if (active) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [repository, audKey, uid, tick])

  const markAllRead = useCallback(() => {
    if (!repository || unreadCount === 0) return
    setUnreadCount(0)
    void repository.markRead([...freshIds], uid)
  }, [repository, freshIds, unreadCount, uid])

  return { events, freshIds, unreadCount, loading, error, reload, markAllRead }
}
