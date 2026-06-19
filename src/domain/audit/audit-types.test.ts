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

describe('audit extension for catalogs', () => {
  it('accepts the deleted action and catalog entity types', () => {
    expect(isAuditAction('deleted')).toBe(true)
    const types: AuditEntityType[] = ['branch', 'department', 'category', 'asset_status']
    expect(types.length).toBe(4)
  })
})

describe('audit extension for licenses', () => {
  it('license audit extensions present', () => {
    expect(AUDIT_ACTIONS).toContain('key_revealed')
    expect(AUDIT_ACTIONS).toContain('license_decoupled')
    expect(AUDIT_ACTIONS).toContain('license_retired_with_asset')
    expect(AUDIT_ACTIONS).toContain('key_rotated')
    const t: AuditEntityType = 'server_license'
    expect(t).toBe('server_license')
  })
})
