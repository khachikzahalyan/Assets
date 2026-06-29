import { useEffect, useState, useCallback } from 'react'
import type { Role } from '@/config/roles'
import type { DashboardRepository, DashboardData } from '@/domain/dashboard'

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
    pending: role === 'super_admin',
    recentAudit: role === 'super_admin',
  }
}

/**
 * Loads dashboard sections the role is permitted to see, in parallel.
 * Sections a role cannot access are NEVER fetched — this is the security gate.
 *
 * @param repo MUST be a stable reference (memoized) — same contract as useAssets.
 * @param role The current user's role.
 */
export function useDashboard(repo: DashboardRepository, role: Role): UseDashboardResult {
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let active = true
    const p = permissions(role)
    setLoading(true)
    setError(false)
    setData(EMPTY)

    void (async () => {
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

      if (p.assets) run(() => repo.loadAssetStats(5), v => { next.assets = v })
      if (p.assignments) run(() => repo.loadAssignmentActivity(8), v => {
        next.assignments = { currentlyOut: 0, recent: v }
      })
      if (p.workstationLicenses) run(() => repo.loadWorkstationLicenseStats(), v => { next.workstationLicenses = v })
      if (p.serverLicense) run(() => repo.loadServerLicenseCount(), v => { next.serverLicenseCount = v })
      if (p.people) run(() => repo.loadPeopleStats(p.pending), v => { next.people = v })
      if (p.recentAudit) run(() => repo.loadRecentAuditRows(8), v => { next.recentAudit = v })

      await Promise.allSettled(tasks)

      if (!active) return

      // Derive currentlyOut from assetStats.byStatus to avoid a double-count.
      if (next.assignments !== null && next.assets !== null) {
        next.assignments = {
          ...next.assignments,
          currentlyOut: next.assets.byStatus.st_assigned,
        }
      }

      setData(next)
      setError(anyError)
      setLoading(false)
    })()

    return () => { active = false }
  }, [repo, role, tick])

  return { data, loading, error, reload }
}
