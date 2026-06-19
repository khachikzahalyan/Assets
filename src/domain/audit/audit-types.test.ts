import { describe, it, expect } from 'vitest'
import { AUDIT_ACTIONS, isAuditAction } from './types'
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
