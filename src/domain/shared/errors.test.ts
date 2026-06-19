import { describe, it, expect } from 'vitest'
import { EntityInUseError, SystemEntityProtectedError, PrefixLockedError, isCatalogError } from './errors'

describe('catalog errors', () => {
  it('EntityInUseError carries the reference count and a stable code', () => {
    const e = new EntityInUseError('branch', 'b1', 3)
    expect(e.code).toBe('entity_in_use')
    expect(e.count).toBe(3)
    expect(e.entityType).toBe('branch')
    expect(isCatalogError(e)).toBe(true)
    expect(e).toBeInstanceOf(Error)
  })
  it('SystemEntityProtectedError has a stable code', () => {
    const e = new SystemEntityProtectedError('asset_status', 'st_warehouse')
    expect(e.code).toBe('system_protected')
    expect(isCatalogError(e)).toBe(true)
  })
  it('PrefixLockedError has a stable code and carries the count', () => {
    const e = new PrefixLockedError('cat_1', 5)
    expect(e.code).toBe('prefix_locked')
    expect(e.count).toBe(5)
    expect(isCatalogError(e)).toBe(true)
  })
  it('isCatalogError is false for a plain Error', () => {
    expect(isCatalogError(new Error('x'))).toBe(false)
  })
})
