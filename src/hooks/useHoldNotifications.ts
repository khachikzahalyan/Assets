import { useEffect, useState, useCallback, useMemo } from 'react'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import type { AssetListQuery } from '@/domain/asset'
import { buildHoldNotifications, type HoldNotification } from '@/domain/asset'

const HOLD_QUERY: AssetListQuery = {
  group: 'all', statusId: 'all', branchId: 'all', search: '', sort: 'updated_desc',
}

export interface UseHoldNotificationsResult {
  notifications: HoldNotification[]
  count: number
  loading: boolean
  error: Error | null
  reload: () => void
}

/**
 * Loads temporary-hold notifications for the bell. Fetches on mount; call
 * reload() (e.g. on panel open) to refresh. Read-only — no audit writes.
 *
 * @param repository MUST be a stable reference (memoize via useMemo).
 */
export function useHoldNotifications(repository: AssetRepository): UseHoldNotificationsResult {
  const [notifications, setNotifications] = useState<HoldNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const assets = await repository.listAssets(HOLD_QUERY)
        if (!active) return
        setNotifications(buildHoldNotifications(assets, new Date()))
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [repository, tick])

  const count = useMemo(() => notifications.length, [notifications])
  return { notifications, count, loading, error, reload }
}
