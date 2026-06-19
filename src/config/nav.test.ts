import { describe, it, expect } from 'vitest'
import { navForRole, defaultRouteForRole, PHASE_STUB_ROUTES } from './nav'

describe('navForRole', () => {
  it('super_admin sees all 5 admin groups', () => { expect(navForRole('super_admin')).toHaveLength(5) })
  it('tech_admin does NOT see employees but DOES see repairs', () => {
    const ids = navForRole('tech_admin').flatMap((g) => g.items.map((i) => i.id))
    expect(ids).not.toContain('employees')
    expect(ids).toContain('repairs')
  })
  it('asset_admin sees employees but not repairs', () => {
    const ids = navForRole('asset_admin').flatMap((g) => g.items.map((i) => i.id))
    expect(ids).toContain('employees')
    expect(ids).not.toContain('repairs')
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

describe('employees + self-service routes are real', () => {
  it('removes employees/my-assets/my-acts/profile from the stub list', () => {
    for (const id of ['employees', 'my-assets', 'my-acts', 'profile']) {
      expect(PHASE_STUB_ROUTES).not.toContain(id)
    }
  })
})

describe('pending-users nav gating', () => {
  it('pending-users is visible to super_admin only', () => {
    const su = navForRole('super_admin').flatMap(g => g.items).map(i => i.id)
    expect(su).toContain('pending-users')
    for (const r of ['asset_admin', 'tech_admin', 'employee'] as const) {
      const ids = navForRole(r).flatMap(g => g.items).map(i => i.id)
      expect(ids).not.toContain('pending-users')
    }
  })
})
