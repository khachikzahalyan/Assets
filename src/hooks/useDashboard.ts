import type { Role } from '@/config/roles'
import type { DashboardRepository, DashboardData } from '@/domain/dashboard'
import {
  groupDomainEvents,
  DASHBOARD_WINDOW_DAYS,
} from '@/domain/dashboard'
import { useCachedResource, cacheIdentity } from './useCachedResource'

const EMPTY: DashboardData = {
  assets: null,
  workstationLicenses: null,
  people: null,
  counts: null,
  boxes: null,
}

export interface UseDashboardResult {
  data: DashboardData
  loading: boolean
  /** True if ANY section failed (per-section nulls remain). */
  error: boolean
  reload: () => void
}

/**
 * Loads all dashboard sections in parallel. SWR-cached per (repo, role) pair.
 * Role-gating of individual calls is REMOVED: all 6 methods are called for all
 * 3 admin roles. Role stays in the cache key so a role-switch invalidates.
 *
 * Degradation: each section is independently Promise.allSettled — a rejected
 * section leaves its slot null and sets error=true while the others still render.
 *
 * @param repo MUST be a stable reference (memoized / singleton).
 * @param role The current user's role.
 */
export function useDashboard(repo: DashboardRepository, role: Role): UseDashboardResult {
  const key = `dashboard:${cacheIdentity(repo)}:${role}`

  const { data: cached, loading, error: fetchErr, reload } = useCachedResource(
    key,
    async () => {
      const next: DashboardData = { ...EMPTY }
      let anyError = false

      const since = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 86_400_000).toISOString()

      const [assets, lic, people, events, installs, countsRes] = await Promise.allSettled([
        repo.loadAssetStats(5),
        repo.loadWorkstationLicenseStats(),
        repo.loadPeopleStats(),
        repo.loadRecentEvents(since),
        repo.loadRecentPartInstalls(since),
        repo.loadDomainCounts(),
      ])

      if (assets.status === 'fulfilled') {
        next.assets = assets.value
      } else {
        anyError = true
      }

      if (lic.status === 'fulfilled') {
        next.workstationLicenses = lic.value
      } else {
        anyError = true
      }

      if (people.status === 'fulfilled') {
        next.people = people.value
      } else {
        anyError = true
      }

      if (countsRes.status === 'fulfilled') {
        next.counts = countsRes.value.counts
      } else {
        anyError = true
      }

      if (events.status === 'fulfilled') {
        next.boxes = groupDomainEvents({
          auditLogs: events.value,
          partInstalls: installs.status === 'fulfilled' ? installs.value : [],
          partNames: countsRes.status === 'fulfilled' ? countsRes.value.partNames : {},
        })
      } else {
        anyError = true
      }

      // installs rejection is only marked if events also failed (boxes covers both);
      // if events succeeded but installs failed, boxes still renders with empty installs.
      if (installs.status === 'rejected' && events.status === 'rejected') {
        anyError = true
      }

      return { data: next, anyError }
    },
  )

  return {
    data: cached?.data ?? EMPTY,
    loading,
    error: (cached?.anyError ?? false) || fetchErr !== null,
    reload,
  }
}
