import { describe, it, expect } from 'vitest'
import { formatAuditTs, resolveActorName, computeDiff, entityLink } from './auditFormat'
import type { AuditLog } from '@/domain/audit'

describe('formatAuditTs', () => {
  it('formats as DD/Mon/YYYY HH:MM', () => {
    const out = formatAuditTs('2026-06-04T09:05:00.000Z')
    // Locale-stable assertion: contains a 2-digit day, a 3-letter month, the year.
    expect(out).toMatch(/\d{2}\/[A-Za-zА-Яа-я]{3}\/2026/)
    expect(out).toMatch(/\d{2}:\d{2}/)
  })
  it('returns the raw string on parse failure', () => {
    expect(formatAuditTs('not-a-date')).toBe('not-a-date')
  })
})

describe('resolveActorName', () => {
  const actors = [{ uid: 'u_1', displayName: 'Khach' }, { uid: 'u_2', displayName: null }]
  it('returns display name when known', () => {
    expect(resolveActorName('u_1', actors)).toBe('Khach')
  })
  it('falls back to uid when no display name', () => {
    expect(resolveActorName('u_2', actors)).toBe('u_2')
    expect(resolveActorName('u_unknown', actors)).toBe('u_unknown')
  })
})

describe('computeDiff', () => {
  it('lists added, removed, and changed keys', () => {
    const before = { statusId: 'st_warehouse', brand: 'Dell' }
    const after = { statusId: 'st_assigned', model: 'XPS' }
    const diff = computeDiff(before, after)
    const byKey = Object.fromEntries(diff.map(d => [d.key, d]))
    expect(byKey['statusId']).toEqual({ key: 'statusId', before: 'st_warehouse', after: 'st_assigned', kind: 'changed' })
    expect(byKey['brand']).toEqual({ key: 'brand', before: 'Dell', after: undefined, kind: 'removed' })
    expect(byKey['model']).toEqual({ key: 'model', before: undefined, after: 'XPS', kind: 'added' })
  })
  it('handles null before (create) and null after (delete)', () => {
    expect(computeDiff(null, { a: 1 }).map(d => d.kind)).toEqual(['added'])
    expect(computeDiff({ a: 1 }, null).map(d => d.kind)).toEqual(['removed'])
    expect(computeDiff(null, null)).toEqual([])
  })
  it('stringifies nested object values stably', () => {
    const diff = computeDiff({ assignment: null }, { assignment: { mode: 'employee', employeeId: 'e1' } })
    expect(diff[0]!.kind).toBe('changed')
    expect(typeof diff[0]!.after).toBe('string')
    expect(diff[0]!.after).toContain('employee')
  })
})

describe('entityLink', () => {
  it('links asset entities to /assets/:id', () => {
    const log = { entityType: 'asset', entityId: 'a_1' } as AuditLog
    expect(entityLink(log)).toBe('/assets/a_1')
  })
  it('links employee entities to /employees/:id', () => {
    const log = { entityType: 'employee', entityId: 'e_1' } as AuditLog
    expect(entityLink(log)).toBe('/employees/e_1')
  })
  it('returns null for entity types without a detail page', () => {
    const log = { entityType: 'category', entityId: 'c_1' } as AuditLog
    expect(entityLink(log)).toBeNull()
  })
})
