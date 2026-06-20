import { describe, it, expect } from 'vitest'
import { emptyAssetStats, EMPTY_STATUS_COUNTS } from './types'

describe('dashboard types helpers', () => {
  it('emptyAssetStats has all four status keys zeroed', () => {
    const s = emptyAssetStats()
    expect(s.total).toBe(0)
    expect(s.byStatus).toEqual({
      st_warehouse: 0, st_assigned: 0, st_repair: 0, st_disposed: 0,
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
})
