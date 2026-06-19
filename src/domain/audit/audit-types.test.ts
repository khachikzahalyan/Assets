import { describe, it, expect } from 'vitest'
import { AUDIT_ACTIONS, isAuditAction, type AuditEntityType } from './types'
describe('audit types', () => {
  it('AUDIT_ACTIONS contains the canonical actions', () => {
    expect(AUDIT_ACTIONS).toContain('created')
    expect(AUDIT_ACTIONS).toContain('status_changed')
    expect(AUDIT_ACTIONS).toContain('upgrade_added')
  })
  it('isAuditAction narrows correctly', () => {
    expect(isAuditAction('created')).toBe(true)
    expect(isAuditAction('nope')).toBe(false)
  })
})

describe('audit extension for employees', () => {
  it('terminated and reactivated are valid actions', () => {
    expect(isAuditAction('terminated')).toBe(true)
    expect(isAuditAction('reactivated')).toBe(true)
  })
  it('employee is a valid entity type', () => {
    const t: AuditEntityType = 'employee'
    expect(t).toBe('employee')
  })
  it('includes the user/role_assigned members used by promotion', () => {
    expect(AUDIT_ACTIONS).toContain('role_assigned')
    const t: AuditEntityType = 'user'
    expect(t).toBe('user')
  })
})
