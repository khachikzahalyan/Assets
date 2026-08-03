import { describe, it, expect } from 'vitest'
import { emptyAssetStats, EMPTY_STATUS_COUNTS, DOMAIN_BOX_KEYS } from './types'
import type { DashboardData, DomainCounts, DomainCountsResult } from './types'

describe('dashboard types helpers', () => {
  it('emptyAssetStats has all four status keys zeroed', () => {
    const s = emptyAssetStats()
    expect(s.total).toBe(0)
    expect(s.byStatus).toEqual({
      st_warehouse: 0, st_pending: 0, st_assigned: 0, st_repair: 0, st_disposed: 0,
    })
    expect(s.byGroup).toEqual([
      { group: 'devices', count: 0 },
      { group: 'network', count: 0 },
      { group: 'furniture', count: 0 },
    ])
    expect(s.topBranches).toEqual([])
  })

  it('EMPTY_STATUS_COUNTS template is not shared-mutable', () => {
    const a = { ...EMPTY_STATUS_COUNTS }
    a.st_warehouse = 5
    expect(EMPTY_STATUS_COUNTS.st_warehouse).toBe(0)
  })

  it('DashboardData contract includes counts and boxes fields (new post-T4 contract)', () => {
    // Type-level check: construct a valid DashboardData with null slots (initial state).
    const empty: DashboardData = {
      assets: null,
      workstationLicenses: null,
      people: null,
      counts: null,
      boxes: null,
    }
    expect(empty.counts).toBeNull()
    expect(empty.boxes).toBeNull()
  })

  it('DomainCounts allows null per-field (per-count degradation contract)', () => {
    // Each field can individually degrade to null
    const degraded: DomainCounts = {
      partsUnits: null,
      branches: 4,
      departments: 3,
      subscriptions: null,
    }
    expect(degraded.partsUnits).toBeNull()
    expect(degraded.subscriptions).toBeNull()
    expect(degraded.branches).toBe(4)
  })

  it('DomainCountsResult has counts + partNames', () => {
    const res: DomainCountsResult = {
      counts: { partsUnits: 15, branches: 4, departments: 3, subscriptions: 7 },
      partNames: { 'sku_1': 'RAM 8GB', 'sku_2': 'SSD 512' },
    }
    expect(res.counts.partsUnits).toBe(15)
    expect(res.partNames['sku_1']).toBe('RAM 8GB')
  })

  it('DOMAIN_BOX_KEYS has exactly 6 entries matching the DashboardData.boxes shape', () => {
    expect(DOMAIN_BOX_KEYS).toHaveLength(6)
    expect(DOMAIN_BOX_KEYS).toContain('assets')
    expect(DOMAIN_BOX_KEYS).toContain('employees')
    expect(DOMAIN_BOX_KEYS).toContain('parts')
    expect(DOMAIN_BOX_KEYS).toContain('subscriptions')
    expect(DOMAIN_BOX_KEYS).toContain('branches')
    expect(DOMAIN_BOX_KEYS).toContain('departments')
  })
})
