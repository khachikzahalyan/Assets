import { describe, it, expect } from 'vitest'
import { routeRoles, canAccess } from './access'
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
