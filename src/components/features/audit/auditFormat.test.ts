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
  // (d) Zero-padding: single-digit day, hour, and minute must be padded to 2 digits
  it('locale-aware: en and ru produce different month tokens for June', () => {
    // June is 'Jun' in English short format and 'июн.' in Russian short format.
    // Both must still match the DD/Mon/YYYY HH:MM shape.
    const iso = '2026-06-15T12:30:00.000Z'
    const enOut = formatAuditTs(iso, 'en')
    const ruOut = formatAuditTs(iso, 'ru')

    // Both must match the structural shape: DD/<month>/<year> HH:MM
    expect(enOut).toMatch(/^\d{2}\/.+\/\d{4} \d{2}:\d{2}$/)
    expect(ruOut).toMatch(/^\d{2}\/.+\/\d{4} \d{2}:\d{2}$/)

    // The month tokens must differ between locales for June
    const enMonth = enOut.split('/')[1]!
    const ruMonth = ruOut.split('/')[1]!
    expect(enMonth).not.toBe(ruMonth)

    // Spot-check known tokens (Intl short month for June):
    // en → 'Jun', ru → 'июн.'
    expect(enMonth).toBe('Jun')
    expect(ruMonth).toMatch(/июн/i)
  })

  it('zero-pads a single-digit day', () => {
    // Use a date where the local day is 1 — pick a UTC midnight that stays day-1 in any tz within ±14h
    // 2026-01-15T00:00:00Z is day 14 or 15 depending on tz; instead we use getDate() from the result.
    const out = formatAuditTs('2026-03-01T00:00:00.000Z')
    // The day portion must be exactly 2 chars before the first "/"
    const dayPart = out.split('/')[0]!
    expect(dayPart).toHaveLength(2)
    // It must be purely numeric
    expect(/^\d{2}$/.test(dayPart)).toBe(true)
  })
  it('zero-pads single-digit hour and minute', () => {
    // We construct an ISO string where we know h and m before local-tz shift.
    // The safe approach: parse the output and verify the HH:MM segment is always 2-digit:2-digit.
    const out = formatAuditTs('2026-06-15T04:07:00.000Z')
    const timePart = out.split(' ')[1]!
    const [hh, mm] = timePart.split(':')
    expect(hh).toHaveLength(2)
    expect(mm).toHaveLength(2)
    expect(/^\d{2}$/.test(hh!)).toBe(true)
    expect(/^\d{2}$/.test(mm!)).toBe(true)
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
  // (a) Identical before/after for a key produces NO diff row for that key
  it('omits keys whose value is unchanged', () => {
    const before = { name: 'Laptop', statusId: 'st_warehouse' }
    const after = { name: 'Laptop', statusId: 'st_assigned' }
    const diff = computeDiff(before, after)
    const keys = diff.map(d => d.key)
    expect(keys).not.toContain('name')
    expect(keys).toContain('statusId')
    expect(diff).toHaveLength(1)
  })
  // (b) Nested object (assignment) stringified; masked-secret value passes through verbatim — no unmasking
  it('stringifies a nested assignment object to JSON', () => {
    const nestedAfter = { mode: 'employee', employeeId: 'e_42' }
    const diff = computeDiff({ assignment: null }, { assignment: nestedAfter })
    expect(diff[0]!.after).toBe(JSON.stringify(nestedAfter))
  })
  it('passes masked-secret values through verbatim without unmasking', () => {
    const maskedValue = '****-****-****-5592'
    const diff = computeDiff(
      { licenseKey: maskedValue },
      { licenseKey: maskedValue },
    )
    // Identical masked values → no diff row (key omitted)
    expect(diff).toHaveLength(0)
    // Changed masked values appear verbatim — no decoding/unmasking
    const diff2 = computeDiff(
      { licenseKey: '****-****-****-1111' },
      { licenseKey: maskedValue },
    )
    expect(diff2).toHaveLength(1)
    expect(diff2[0]!.before).toBe('****-****-****-1111')
    expect(diff2[0]!.after).toBe(maskedValue)
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
  it('links user entities to /employees/:id (shared uid space)', () => {
    const log = { entityType: 'user', entityId: 'u_99' } as AuditLog
    expect(entityLink(log)).toBe('/employees/u_99')
  })
  // (c) All non-routable entity types return null
  it.each([
    'assignment',
    'upgrade',
    'license',
    'branch',
    'department',
    'category',
    'asset_status',
  ] as const)('returns null for non-routable entity type "%s"', (entityType) => {
    const log = { entityType, entityId: 'x_1' } as AuditLog
    expect(entityLink(log)).toBeNull()
  })
})
