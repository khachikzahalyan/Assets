import { describe, it, expect } from 'vitest'
import { routeRoles, canAccess } from './access'
import { PHASE_STUB_ROUTES } from './nav'
import type { RouteId } from './nav'

describe('access map', () => {
  it('derives roles for an admin route from nav allow arrays', () => {
    expect(routeRoles('categories')).toEqual(['super_admin'])
  })
  it('assets is allowed for the three admin roles', () => {
    expect(routeRoles('assets').sort()).toEqual(['asset_admin', 'super_admin', 'tech_admin'])
  })
  it('employee routes allow only employee', () => {
    expect(routeRoles('my-assets')).toEqual(['employee'])
  })
  it('canAccess respects the matrix', () => {
    expect(canAccess('super_admin', 'categories')).toBe(true)
    expect(canAccess('tech_admin', 'categories')).toBe(false)
    expect(canAccess('employee', 'my-assets')).toBe(true)
  })
  it('profile is reachable by employee', () => {
    expect(canAccess('employee', 'profile')).toBe(true)
  })
  it('returns [] for an unregistered route id', () => {
    expect(routeRoles('does-not-exist' as RouteId)).toEqual([])
  })
})

describe('settings route guard', () => {
  it('settings is NOT in PHASE_STUB_ROUTES (it is a real route, not a stub)', () => {
    expect(PHASE_STUB_ROUTES).not.toContain('settings')
  })

  it('routeRoles("settings") is super_admin-only', () => {
    expect(routeRoles('settings')).toEqual(['super_admin'])
  })

  it('only super_admin can access /settings; all other roles cannot', () => {
    expect(canAccess('super_admin', 'settings')).toBe(true)
    expect(canAccess('asset_admin', 'settings')).toBe(false)
    expect(canAccess('tech_admin', 'settings')).toBe(false)
    expect(canAccess('employee', 'settings')).toBe(false)
  })
})
