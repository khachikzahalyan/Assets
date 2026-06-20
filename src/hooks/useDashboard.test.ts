import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDashboard } from './useDashboard'
import type { DashboardRepository } from '@/domain/dashboard'
import { emptyAssetStats } from '@/domain/dashboard'

function fakeRepo(overrides: Partial<DashboardRepository> = {}): DashboardRepository {
  return {
    loadAssetStats: vi.fn().mockResolvedValue(emptyAssetStats()),
    loadAssignmentActivity: vi.fn().mockResolvedValue([]),
    loadWorkstationLicenseStats: vi.fn().mockResolvedValue({ total: 0, free: 0, inUse: 0, retired: 0 }),
    loadServerLicenseCount: vi.fn().mockResolvedValue(0),
    loadPeopleStats: vi.fn().mockResolvedValue({ employeeCount: 0, pendingUsersCount: null }),
    loadRecentAudit: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

describe('useDashboard role gating', () => {
  it('super_admin calls every section', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'super_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(repo.loadAssetStats).toHaveBeenCalled()
    expect(repo.loadAssignmentActivity).toHaveBeenCalled()
    expect(repo.loadWorkstationLicenseStats).toHaveBeenCalled()
    expect(repo.loadServerLicenseCount).toHaveBeenCalled()
    expect(repo.loadPeopleStats).toHaveBeenCalledWith(true)
    expect(repo.loadRecentAudit).toHaveBeenCalled()
    expect(result.current.data.serverLicenseCount).toBe(0)
    expect(result.current.data.recentAudit).toEqual([])
  })

  it('asset_admin: assets+assignments+people(no pending); NO licenses/server/audit', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'asset_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(repo.loadAssetStats).toHaveBeenCalled()
    expect(repo.loadAssignmentActivity).toHaveBeenCalled()
    expect(repo.loadPeopleStats).toHaveBeenCalledWith(false)
    expect(repo.loadWorkstationLicenseStats).not.toHaveBeenCalled()
    expect(repo.loadServerLicenseCount).not.toHaveBeenCalled()
    expect(repo.loadRecentAudit).not.toHaveBeenCalled()
    expect(result.current.data.workstationLicenses).toBeNull()
    expect(result.current.data.serverLicenseCount).toBeNull()
    expect(result.current.data.people).not.toBeNull()
  })

  it('tech_admin: assets+assignments+workstation licenses; NO server/people/audit', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'tech_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(repo.loadWorkstationLicenseStats).toHaveBeenCalled()
    expect(repo.loadServerLicenseCount).not.toHaveBeenCalled()
    expect(repo.loadPeopleStats).not.toHaveBeenCalled()
    expect(repo.loadRecentAudit).not.toHaveBeenCalled()
    expect(result.current.data.people).toBeNull()
  })

  it('fills currentlyOut from asset byStatus.st_assigned', async () => {
    const stats = emptyAssetStats(); stats.byStatus.st_assigned = 9
    const repo = fakeRepo({ loadAssetStats: vi.fn().mockResolvedValue(stats) })
    const { result } = renderHook(() => useDashboard(repo, 'asset_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data.assignments?.currentlyOut).toBe(9)
  })

  it('a failing section leaves its slot null and does not blank others', async () => {
    const repo = fakeRepo({ loadWorkstationLicenseStats: vi.fn().mockRejectedValue(new Error('x')) })
    const { result } = renderHook(() => useDashboard(repo, 'tech_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data.assets).not.toBeNull()
    expect(result.current.data.workstationLicenses).toBeNull()
    expect(result.current.error).toBe(true)
  })
})
