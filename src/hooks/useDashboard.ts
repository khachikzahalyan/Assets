import type { Role } from '@/config/roles'
import type { DashboardRepository, DashboardData } from '@/domain/dashboard'
import { useCachedResource, cacheIdentity } from './useCachedResource'

const EMPTY: DashboardData = {
  assets: null,
  assignments: null,
  workstationLicenses: null,
  serverLicenseCount: null,
  people: null,
  recentAudit: null,
}

export interface UseDashboardResult {
  data: DashboardData
  loading: boolean
  /** True if ANY permitted section failed (per-section nulls remain). */
  error: boolean
  reload: () => void
}

/** Section permissions per role — MUST mirror nav RoleGate (see config/nav.ts). */
function permissions(role: Role) {
  return {
    assets: role === 'super_admin' || role === 'asset_admin' || role === 'tech_admin',
    assignments: role === 'super_admin' || role === 'asset_admin' || role === 'tech_admin',
    workstationLicenses: role === 'super_admin' || role === 'tech_admin',
    serverLicense: role === 'super_admin',
    people: role === 'super_admin' || role === 'asset_admin',
    recentAudit: role === 'super_admin',
  }
}

/**
 * Loads dashboard sections the role is permitted to see, in parallel. SWR-cached
 * per (repo, role) pair — repeat visits render instantly.
 *
 * Sections a role cannot access are NEVER fetched — this is the security gate.
 *
 * @param repo MUST be a stable reference (memoized / singleton).
 * @param role The current user's role.
 */
export function useDashboard(repo: DashboardRepository, role: Role): UseDashboardResult {
  const key = `dashboard:${cacheIdentity(repo)}:${role}`

  const { data: cached, loading, error: fetchErr, reload } = useCachedResource(
    key,
    async () => {
      const p = permissions(role)
      const next: DashboardData = { ...EMPTY }
      let anyError = false

      const tasks: Promise<void>[] = []

      function run<T>(fn: () => Promise<T>, assign: (v: T) => void): void {
        tasks.push(
          fn()
            .then(assign)
            .catch(() => { anyError = true }),
        )
      }

      if (p.assets)               run(() => repo.loadAssetStats(5),            v => { next.assets = v })
      if (p.assignments)          run(() => repo.loadAssignmentActivity(8),     v => {
        next.assignments = { currentlyOut: 0, recent: v }
      })
      if (p.workstationLicenses)  run(() => repo.loadWorkstationLicenseStats(), v => { next.workstationLicenses = v })
      if (p.serverLicense)        run(() => repo.loadServerLicenseCount(),       v => { next.serverLicenseCount = v })
      if (p.people)               run(() => repo.loadPeopleStats(),             v => { next.people = v })
      if (p.recentAudit)          run(() => repo.loadRecentAuditRows(8),         v => { next.recentAudit = v })

      await Promise.allSettled(tasks)

      // Derive currentlyOut from assetStats.byStatus to avoid a double-count.
      if (next.assignments !== null && next.assets !== null) {
        next.assignments = {
          ...next.assignments,
          currentlyOut: next.assets.byStatus.st_assigned,
        }
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
