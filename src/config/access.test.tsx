import { describe, it, expect } from 'vitest'
import { routeRoles } from './access'

describe('routeRoles(scan)', () => {
  it('allows super_admin, asset_admin, tech_admin', () => {
    expect(routeRoles('scan').sort()).toEqual(['asset_admin', 'super_admin', 'tech_admin'])
  })
})
