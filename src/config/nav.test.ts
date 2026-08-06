import { describe, it, expect } from 'vitest'
import { navForRole, defaultRouteForRole, ADMIN_NAV, EMPLOYEE_NAV } from './nav'

describe('navForRole', () => {
  it('super_admin sees all 5 admin groups', () => { expect(navForRole('super_admin')).toHaveLength(5) })
  it('tech_admin does NOT see employees but DOES see licenses', () => {
    const ids = navForRole('tech_admin').flatMap((g) => g.items.map((i) => i.id))
    expect(ids).not.toContain('employees')
    expect(ids).toContain('licenses')
  })
  it('asset_admin sees employees but not licenses', () => {
    const ids = navForRole('asset_admin').flatMap((g) => g.items.map((i) => i.id))
    expect(ids).toContain('employees')
    expect(ids).not.toContain('licenses')
  })
  it('employee gets flat IA with 3 items', () => {
    const nav = navForRole('employee')
    expect(nav).toHaveLength(1)
    expect(nav[0]!.items).toHaveLength(3)
  })
  it('filters out empty groups', () => {
    expect(navForRole('tech_admin').every((g) => g.items.length > 0)).toBe(true)
  })
  it('default route per role', () => {
    expect(defaultRouteForRole('employee')).toBe('my-assets')
    expect(defaultRouteForRole('super_admin')).toBe('dashboard')
  })
})

describe('my-assets in admin nav', () => {
  const adminRoles = ['super_admin', 'asset_admin', 'tech_admin'] as const

  for (const role of adminRoles) {
    it(`${role} nav contains my-assets exactly once`, () => {
      const nav = navForRole(role)
      const allIds = nav.flatMap((g) => g.items.map((i) => i.id))
      expect(allIds.filter((id) => id === 'my-assets')).toHaveLength(1)
    })

    it(`${role} nav has my-assets in group 'main' immediately after dashboard`, () => {
      const nav = navForRole(role)
      const mainGroup = nav.find((g) => g.id === 'main')
      expect(mainGroup).toBeDefined()
      const ids = mainGroup!.items.map((i) => i.id)
      const dashIdx = ids.indexOf('dashboard')
      const myAssetsIdx = ids.indexOf('my-assets')
      expect(dashIdx).toBeGreaterThanOrEqual(0)
      expect(myAssetsIdx).toBe(dashIdx + 1)
    })
  }

  it('employee nav still contains my-assets', () => {
    const nav = navForRole('employee')
    const allIds = nav.flatMap((g) => g.items.map((i) => i.id))
    expect(allIds).toContain('my-assets')
  })
})

describe('my-assets icon is backpack', () => {
  it('ADMIN_NAV my-assets entry uses backpack icon', () => {
    const mainGroup = ADMIN_NAV.find((g) => g.id === 'main')
    const item = mainGroup?.items.find((i) => i.id === 'my-assets')
    expect(item?.icon).toBe('backpack')
  })

  it('EMPLOYEE_NAV my-assets entry uses backpack icon', () => {
    const empGroup = EMPLOYEE_NAV.find((g) => g.id === 'employee')
    const item = empGroup?.items.find((i) => i.id === 'my-assets')
    expect(item?.icon).toBe('backpack')
  })
})

describe('no duplicate item ids per role', () => {
  const roles = ['super_admin', 'asset_admin', 'tech_admin', 'employee'] as const
  for (const role of roles) {
    it(`${role} nav has no duplicate item ids`, () => {
      const ids = navForRole(role).flatMap((g) => g.items.map((i) => i.id))
      expect(ids).toHaveLength(new Set(ids).size)
    })
  }
})
