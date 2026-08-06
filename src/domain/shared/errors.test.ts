import { describe, it, expect } from 'vitest'
import { EntityInUseError, SystemEntityProtectedError, PrefixLockedError, isCatalogError, isQuotaExceededError } from './errors'

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

describe('isQuotaExceededError', () => {
  // (a) FirebaseError-shaped object with code 'resource-exhausted' → true
  it('returns true for an object with code "resource-exhausted"', () => {
    expect(isQuotaExceededError({ code: 'resource-exhausted', message: 'Quota exceeded.' })).toBe(true)
  })

  // (b) Error with message 'Quota exceeded.' → true
  it('returns true for an Error with message "Quota exceeded."', () => {
    expect(isQuotaExceededError(new Error('Quota exceeded.'))).toBe(true)
  })

  // (c) Error whose message contains 'RESOURCE_EXHAUSTED' (case-insensitive) → true
  it('returns true for an Error whose message contains RESOURCE_EXHAUSTED (case-insensitive)', () => {
    expect(isQuotaExceededError(new Error('gRPC error: RESOURCE_EXHAUSTED'))).toBe(true)
    expect(isQuotaExceededError(new Error('resource_exhausted details here'))).toBe(true)
  })

  // (d) Error with unrelated code or message → false
  it('returns false for an object with code "permission-denied"', () => {
    expect(isQuotaExceededError({ code: 'permission-denied', message: 'Denied.' })).toBe(false)
  })
  it('returns false for an Error with an unrelated message', () => {
    expect(isQuotaExceededError(new Error('Network error'))).toBe(false)
  })

  // (e) non-Error primitives → false
  it('returns false for null', () => {
    expect(isQuotaExceededError(null)).toBe(false)
  })
  it('returns false for undefined', () => {
    expect(isQuotaExceededError(undefined)).toBe(false)
  })
  it('returns false for a plain string', () => {
    expect(isQuotaExceededError('resource-exhausted')).toBe(false)
  })

  // (f) object with code 'permission-denied' (no message match) → false
  it('returns false for a plain object with code "permission-denied" and no matching message', () => {
    const e = { code: 'permission-denied' }
    expect(isQuotaExceededError(e)).toBe(false)
  })
})
