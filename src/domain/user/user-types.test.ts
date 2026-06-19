import { describe, it, expect } from 'vitest'
import { USER_STATUSES, isUserStatus, type User } from './index'

describe('user domain types', () => {
  it('USER_STATUSES includes no-role, active, terminated', () => {
    expect(USER_STATUSES).toContain('no-role')
    expect(USER_STATUSES).toContain('active')
    expect(USER_STATUSES).toContain('terminated')
  })
  it('isUserStatus narrows valid strings', () => {
    expect(isUserStatus('no-role')).toBe(true)
    expect(isUserStatus('nope')).toBe(false)
  })
  it('a no-role user has a null role', () => {
    const u: User = {
      id: 'u1', email: 'a@x.com', displayName: 'A',
      role: null, status: 'no-role', createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(u.role).toBeNull()
  })
})
