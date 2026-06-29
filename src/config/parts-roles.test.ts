/**
 * Role-gate test: /parts route access matrix.
 *
 * Asserts that routeRoles('parts') yields exactly the three admin roles
 * and that 'employee' is excluded. This is a lightweight config test that
 * reads src/config/access.ts (which derives its map from nav.ts) — no React,
 * no Firebase, no i18n needed.
 *
 * Locking this test locks the role matrix for the parts feature so it cannot
 * silently change during nav refactors.
 */
import { describe, it, expect } from 'vitest'
import { routeRoles, canAccess } from './access'

describe('parts route role matrix', () => {
  it('routeRoles("parts") contains exactly super_admin, asset_admin, tech_admin', () => {
    // Arrange + Act
    const roles = routeRoles('parts')

    // Assert — order-independent comparison
    expect(roles.slice().sort()).toEqual(['asset_admin', 'super_admin', 'tech_admin'])
  })

  it('routeRoles("parts") does NOT contain employee', () => {
    expect(routeRoles('parts')).not.toContain('employee')
  })

  it('super_admin can access /parts', () => {
    expect(canAccess('super_admin', 'parts')).toBe(true)
  })

  it('asset_admin can access /parts', () => {
    expect(canAccess('asset_admin', 'parts')).toBe(true)
  })

  it('tech_admin can access /parts', () => {
    expect(canAccess('tech_admin', 'parts')).toBe(true)
  })

  it('employee cannot access /parts', () => {
    expect(canAccess('employee', 'parts')).toBe(false)
  })
})
