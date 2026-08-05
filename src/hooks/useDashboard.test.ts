import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDashboard } from './useDashboard'
import type { DashboardRepository } from '@/domain/dashboard'
import { emptyAssetStats } from '@/domain/dashboard'

const emptyCountsRes = {
  counts: { partsUnits: 0, branches: 0, departments: 0, subscriptions: 0 },
  partNames: {},
}

function fakeRepo(overrides: Partial<DashboardRepository> = {}): DashboardRepository {
  return {
    loadAssetStats: vi.fn().mockResolvedValue(emptyAssetStats()),
    loadWorkstationLicenseStats: vi.fn().mockResolvedValue({ total: 0, free: 0, inUse: 0, retired: 0 }),
    loadPeopleStats: vi.fn().mockResolvedValue({ employeeCount: 0, activeEmployeeIds: [] }),
    loadRecentEvents: vi.fn().mockResolvedValue([]),
    loadRecentPartInstalls: vi.fn().mockResolvedValue([]),
    loadDomainCounts: vi.fn().mockResolvedValue(emptyCountsRes),
    ...overrides,
  }
}

describe('useDashboard', () => {
  it('calls all 6 methods for super_admin', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'super_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(repo.loadAssetStats).toHaveBeenCalled()
    expect(repo.loadWorkstationLicenseStats).toHaveBeenCalled()
    expect(repo.loadPeopleStats).toHaveBeenCalled()
    expect(repo.loadRecentEvents).toHaveBeenCalled()
    expect(repo.loadRecentPartInstalls).toHaveBeenCalled()
    expect(repo.loadDomainCounts).toHaveBeenCalled()
  })

  it('calls all 6 methods for asset_admin', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'asset_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(repo.loadAssetStats).toHaveBeenCalled()
    expect(repo.loadWorkstationLicenseStats).toHaveBeenCalled()
    expect(repo.loadPeopleStats).toHaveBeenCalled()
    expect(repo.loadRecentEvents).toHaveBeenCalled()
    expect(repo.loadRecentPartInstalls).toHaveBeenCalled()
    expect(repo.loadDomainCounts).toHaveBeenCalled()
    expect(result.current.data.workstationLicenses).not.toBeNull()
    expect(result.current.data.people).not.toBeNull()
  })

  it('calls all 6 methods for tech_admin', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'tech_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(repo.loadAssetStats).toHaveBeenCalled()
    expect(repo.loadWorkstationLicenseStats).toHaveBeenCalled()
    expect(repo.loadPeopleStats).toHaveBeenCalled()
    expect(repo.loadRecentEvents).toHaveBeenCalled()
    expect(repo.loadRecentPartInstalls).toHaveBeenCalled()
    expect(repo.loadDomainCounts).toHaveBeenCalled()
    expect(result.current.data.people).not.toBeNull()
  })

  it('a failing section leaves its slot null and does not blank others', async () => {
    const repo = fakeRepo({ loadWorkstationLicenseStats: vi.fn().mockRejectedValue(new Error('x')) })
    const { result } = renderHook(() => useDashboard(repo, 'tech_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data.assets).not.toBeNull()
    expect(result.current.data.workstationLicenses).toBeNull()
    expect(result.current.error).toBe(true)
  })

  it('counts slot is null when loadDomainCounts rejects', async () => {
    const repo = fakeRepo({ loadDomainCounts: vi.fn().mockRejectedValue(new Error('perm denied')) })
    const { result } = renderHook(() => useDashboard(repo, 'asset_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data.counts).toBeNull()
    expect(result.current.error).toBe(true)
    // Other sections still load
    expect(result.current.data.assets).not.toBeNull()
  })

  it('boxes are null when loadRecentEvents rejects', async () => {
    const repo = fakeRepo({ loadRecentEvents: vi.fn().mockRejectedValue(new Error('denied')) })
    const { result } = renderHook(() => useDashboard(repo, 'super_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data.boxes).toBeNull()
    expect(result.current.error).toBe(true)
  })

  it('all fulfilled → data.boxes has exactly 6 keys', async () => {
    const repo = fakeRepo()
    const { result } = renderHook(() => useDashboard(repo, 'super_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.data.boxes).not.toBeNull()
    expect(Object.keys(result.current.data.boxes!)).toHaveLength(6)
    const keys = Object.keys(result.current.data.boxes!)
    expect(keys).toContain('assets')
    expect(keys).toContain('employees')
    expect(keys).toContain('parts')
    expect(keys).toContain('subscriptions')
    expect(keys).toContain('branches')
    expect(keys).toContain('departments')
  })

  it('loadDomainCounts rejected → data.counts === null, boxes still computed with empty partNames', async () => {
    const repo = fakeRepo({ loadDomainCounts: vi.fn().mockRejectedValue(new Error('perm denied')) })
    const { result } = renderHook(() => useDashboard(repo, 'super_admin'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    // counts is null because loadDomainCounts rejected
    expect(result.current.data.counts).toBeNull()
    // boxes still computed (events fulfilled) with partNames defaulting to {}
    expect(result.current.data.boxes).not.toBeNull()
    expect(Object.keys(result.current.data.boxes!)).toHaveLength(6)
    // error flag set
    expect(result.current.error).toBe(true)
  })
})
