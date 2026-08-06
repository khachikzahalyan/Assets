/**
 * Pure unit tests for the domain-box helpers added to reducers.ts on 2026-07-31:
 *   bucketByDay, groupDomainEvents, assetEventLabel, employeeEventLabel,
 *   namedEntityEventLabel, partInstallLabel, isSubscriptionEvent,
 *   DASHBOARD_EVENTS_PER_BOX.
 *
 * No Firebase, no React.  All tests pass a fixed `now` so they never depend on
 * the real wall clock.
 */

import { describe, it, expect } from 'vitest'
import type { AuditLog } from '@/domain/audit/types'
import type { PartMovement } from '@/domain/part/types'
import {
  bucketByDay,
  groupDomainEvents,
  assetEventLabel,
  employeeEventLabel,
  namedEntityEventLabel,
  partInstallLabel,
  isSubscriptionEvent,
  classifyAssetEvent,
  DASHBOARD_EVENTS_PER_BOX,
  reducePeopleStats,
} from './reducers'
import type { EmployeeForStats } from './reducers'
import { ASSET_STATUS } from '@/domain/asset'

// ─── Fixed reference point ────────────────────────────────────────────────────
// 2026-07-31 noon local.  Buckets: [25th, 26th, 27th, 28th, 29th, 30th, 31st]
const NOW = new Date(2026, 6, 31, 12, 0, 0)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localIso(year: number, month: number, day: number, hour = 12, min = 0): string {
  // Returns an ISO string in local time (no UTC offset tricks needed — the
  // parser under test also uses `new Date(iso)` which is local-time for
  // date-only strings but UTC for datetime.  We use the Date constructor
  // directly to stay in local time.
  return new Date(year, month - 1, day, hour, min, 0).toISOString()
}

function makeLog(overrides: Partial<AuditLog> & Pick<AuditLog, 'entityType' | 'action'>): AuditLog {
  return {
    id: 'log-1',
    entityId: 'entity-1',
    actorUid: 'uid-1',
    actorRole: 'asset_admin',
    actorName: null,
    before: null,
    after: null,
    comment: null,
    at: localIso(2026, 7, 31),
    ...overrides,
  }
}

function makeMovement(overrides: Partial<PartMovement>): PartMovement {
  return {
    id: 'mv-1',
    type: 'install',
    skuId: 'sku-ram-16gb',
    qty: 1,
    broken: false,
    assetId: 'asset-abc',
    assetInvCode: 'LAP/00001',
    serviceReplace: false,
    note: null,
    reason: null,
    actorUid: 'uid-1',
    actorRole: 'tech_admin',
    at: localIso(2026, 7, 31),
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// bucketByDay
// ═══════════════════════════════════════════════════════════════════════════════

describe('bucketByDay', () => {
  it('empty array returns 7 zeroed buckets', () => {
    // Arrange / Act
    const result = bucketByDay([], NOW)
    // Assert
    expect(result).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(result).toHaveLength(7)
  })

  it('event today lands in bucket index 6 (last)', () => {
    // Arrange
    const today = localIso(2026, 7, 31, 10, 0) // 31 Jul 2026 — same day as NOW
    // Act
    const result = bucketByDay([today], NOW)
    // Assert
    expect(result[6]).toBe(1)
    expect(result.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('event exactly 6 local days ago lands in bucket index 0 (first)', () => {
    // Arrange — 25 Jul 2026 = NOW − 6 days
    const sixAgo = localIso(2026, 7, 25, 9, 0)
    // Act
    const result = bucketByDay([sixAgo], NOW)
    // Assert
    expect(result[0]).toBe(1)
    expect(result.slice(1)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('event 8 local days ago is ignored (outside 7-day window)', () => {
    // Arrange — 23 Jul 2026 = NOW − 8 days
    const eightAgo = localIso(2026, 7, 23, 8, 0)
    // Act
    const result = bucketByDay([eightAgo], NOW)
    // Assert
    expect(result).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('invalid ISO string is silently ignored', () => {
    // Arrange
    const ats = ['not-a-date', '', 'undefined']
    // Act
    const result = bucketByDay(ats, NOW)
    // Assert
    expect(result).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('event at 23:59 local yesterday lands in bucket index 5', () => {
    // Arrange — 30 Jul 2026 at 23:59 local → diff=1 → index 6-1=5
    const yesterday2359 = new Date(2026, 6, 30, 23, 59, 0).toISOString()
    // Act
    const result = bucketByDay([yesterday2359], NOW)
    // Assert
    expect(result[5]).toBe(1)
    expect(result[6]).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// isSubscriptionEvent
// ═══════════════════════════════════════════════════════════════════════════════

describe('isSubscriptionEvent', () => {
  it('license + created + after.type Subscription → true', () => {
    const log = makeLog({ entityType: 'license', action: 'created', after: { type: 'Subscription' } })
    expect(isSubscriptionEvent(log)).toBe(true)
  })

  it('subscription entityType + subscription_created action → true', () => {
    const log = makeLog({ entityType: 'subscription', action: 'subscription_created' })
    expect(isSubscriptionEvent(log)).toBe(true)
  })

  it('license + created + after.type OEM → false', () => {
    const log = makeLog({ entityType: 'license', action: 'created', after: { type: 'OEM' } })
    expect(isSubscriptionEvent(log)).toBe(false)
  })

  it('license + created + after.type Retail → false', () => {
    const log = makeLog({ entityType: 'license', action: 'created', after: { type: 'Retail' } })
    expect(isSubscriptionEvent(log)).toBe(false)
  })

  it('license + created + after.type Volume → false', () => {
    const log = makeLog({ entityType: 'license', action: 'created', after: { type: 'Volume' } })
    expect(isSubscriptionEvent(log)).toBe(false)
  })

  it('license + created + after.type Default → false', () => {
    const log = makeLog({ entityType: 'license', action: 'created', after: { type: 'Default' } })
    expect(isSubscriptionEvent(log)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Label extractors
// ═══════════════════════════════════════════════════════════════════════════════

describe('assetEventLabel', () => {
  it('returns "brand model" when both present', () => {
    const log = makeLog({ entityType: 'asset', action: 'created', after: { brand: 'Dell', model: 'Latitude 7420' } })
    expect(assetEventLabel(log)).toBe('Dell Latitude 7420')
  })

  it('falls back to invCode when brand and model missing', () => {
    const log = makeLog({ entityType: 'asset', action: 'created', entityId: 'eid-1', after: { invCode: 'LAP/00035' } })
    expect(assetEventLabel(log)).toBe('LAP/00035')
  })

  it('falls back to entityId when invCode also missing', () => {
    const log = makeLog({ entityType: 'asset', action: 'created', entityId: 'eid-2', after: {} })
    expect(assetEventLabel(log)).toBe('eid-2')
  })
})

describe('employeeEventLabel', () => {
  it('returns "lastName firstName" when both present', () => {
    const log = makeLog({ entityType: 'employee', action: 'created', after: { lastName: 'Petrov', firstName: 'Ivan' } })
    expect(employeeEventLabel(log)).toBe('Petrov Ivan')
  })

  it('falls back to email when names missing', () => {
    const log = makeLog({ entityType: 'employee', action: 'created', entityId: 'eid-3', after: { email: 'ivan@example.test' } })
    expect(employeeEventLabel(log)).toBe('ivan@example.test')
  })

  it('falls back to entityId when email also missing', () => {
    const log = makeLog({ entityType: 'employee', action: 'created', entityId: 'eid-4', after: {} })
    expect(employeeEventLabel(log)).toBe('eid-4')
  })
})

describe('namedEntityEventLabel', () => {
  it('returns after.name when present', () => {
    const log = makeLog({ entityType: 'branch', action: 'created', after: { name: 'Yerevan Office' } })
    expect(namedEntityEventLabel(log)).toBe('Yerevan Office')
  })

  it('falls back to entityId when after.name missing', () => {
    const log = makeLog({ entityType: 'branch', action: 'created', entityId: 'branch-7', after: {} })
    expect(namedEntityEventLabel(log)).toBe('branch-7')
  })
})

describe('partInstallLabel', () => {
  it('uses partNames[skuId] when available', () => {
    const mv = makeMovement({ skuId: 'sku-ram-16gb', qty: 1, assetInvCode: 'LAP/00001' })
    const result = partInstallLabel(mv, { 'sku-ram-16gb': 'RAM 16 ГБ DDR4' })
    expect(result).toBe('RAM 16 ГБ DDR4 ×1 → LAP/00001')
  })

  it('falls back to note when skuId not in partNames', () => {
    const mv = makeMovement({ skuId: 'sku-unknown', qty: 2, note: 'Cooling fan', assetInvCode: null })
    const result = partInstallLabel(mv, {})
    expect(result).toBe('Cooling fan ×2')
  })

  it('falls back to skuId when neither partNames entry nor note', () => {
    const mv = makeMovement({ skuId: 'sku-mystery', qty: 3, note: null, assetInvCode: null })
    const result = partInstallLabel(mv, {})
    expect(result).toBe('sku-mystery ×3')
  })

  it('formats qty with × prefix', () => {
    const mv = makeMovement({ skuId: 'sku-ssd', qty: 2, assetInvCode: null })
    const result = partInstallLabel(mv, { 'sku-ssd': 'SSD 512 GB' })
    expect(result).toContain('×2')
  })

  it('appends " → {assetInvCode}" when assetInvCode present', () => {
    const mv = makeMovement({ skuId: 'sku-ram', qty: 1, assetInvCode: 'DT/00099' })
    const result = partInstallLabel(mv, { 'sku-ram': 'RAM' })
    expect(result).toContain('→ DT/00099')
  })

  it('omits arrow suffix when assetInvCode is null', () => {
    const mv = makeMovement({ skuId: 'sku-ram', qty: 1, assetInvCode: null })
    const result = partInstallLabel(mv, { 'sku-ram': 'RAM' })
    expect(result).not.toContain('→')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// groupDomainEvents
// ═══════════════════════════════════════════════════════════════════════════════

describe('groupDomainEvents', () => {
  // ── Test 7: routing by entityType ──────────────────────────────────────────
  it('asset created event lands in assets box only', () => {
    // Arrange
    const assetLog = makeLog({ id: 'a1', entityType: 'asset', action: 'created', entityId: 'asset-1', after: { brand: 'HP', model: 'ProBook' } })
    // Act
    const result = groupDomainEvents({ auditLogs: [assetLog], partInstalls: [], partNames: {}, now: NOW })
    // Assert
    expect(result.assets.delta7d).toBe(1)
    expect(result.employees.delta7d).toBe(0)
    expect(result.branches.delta7d).toBe(0)
    expect(result.departments.delta7d).toBe(0)
    expect(result.subscriptions.delta7d).toBe(0)
    expect(result.parts.delta7d).toBe(0)
  })

  it('employee created event lands in employees box', () => {
    const empLog = makeLog({ id: 'e1', entityType: 'employee', action: 'created', entityId: 'emp-1', after: { lastName: 'Doe', firstName: 'Jane' } })
    const result = groupDomainEvents({ auditLogs: [empLog], partInstalls: [], partNames: {}, now: NOW })
    expect(result.employees.delta7d).toBe(1)
    expect(result.assets.delta7d).toBe(0)
  })

  it('branch created event lands in branches box', () => {
    const branchLog = makeLog({ id: 'b1', entityType: 'branch', action: 'created', entityId: 'br-1', after: { name: 'North' } })
    const result = groupDomainEvents({ auditLogs: [branchLog], partInstalls: [], partNames: {}, now: NOW })
    expect(result.branches.delta7d).toBe(1)
    expect(result.departments.delta7d).toBe(0)
  })

  it('department created event lands in departments box', () => {
    const deptLog = makeLog({ id: 'd1', entityType: 'department', action: 'created', entityId: 'dept-1', after: { name: 'IT' } })
    const result = groupDomainEvents({ auditLogs: [deptLog], partInstalls: [], partNames: {}, now: NOW })
    expect(result.departments.delta7d).toBe(1)
    expect(result.branches.delta7d).toBe(0)
  })

  // ── Test 8: subscription filter ────────────────────────────────────────────
  it('license created with type Subscription lands in subscriptions box', () => {
    const subLog = makeLog({ id: 's1', entityType: 'license', action: 'created', entityId: 'lic-1', after: { type: 'Subscription', name: 'Win365' } })
    const result = groupDomainEvents({ auditLogs: [subLog], partInstalls: [], partNames: {}, now: NOW })
    expect(result.subscriptions.delta7d).toBe(1)
  })

  it('license created with type OEM is excluded from subscriptions box', () => {
    const oemLog = makeLog({ id: 's2', entityType: 'license', action: 'created', entityId: 'lic-2', after: { type: 'OEM' } })
    const result = groupDomainEvents({ auditLogs: [oemLog], partInstalls: [], partNames: {}, now: NOW })
    expect(result.subscriptions.delta7d).toBe(0)
  })

  it('license created with type Retail is excluded from subscriptions box', () => {
    const retailLog = makeLog({ id: 's3', entityType: 'license', action: 'created', entityId: 'lic-3', after: { type: 'Retail' } })
    const result = groupDomainEvents({ auditLogs: [retailLog], partInstalls: [], partNames: {}, now: NOW })
    expect(result.subscriptions.delta7d).toBe(0)
  })

  it('license created with type Volume is excluded from subscriptions box', () => {
    const volLog = makeLog({ id: 's4', entityType: 'license', action: 'created', entityId: 'lic-4', after: { type: 'Volume' } })
    const result = groupDomainEvents({ auditLogs: [volLog], partInstalls: [], partNames: {}, now: NOW })
    expect(result.subscriptions.delta7d).toBe(0)
  })

  it('license created with type Default is excluded from subscriptions box', () => {
    const defLog = makeLog({ id: 's5', entityType: 'license', action: 'created', entityId: 'lic-5', after: { type: 'Default' } })
    const result = groupDomainEvents({ auditLogs: [defLog], partInstalls: [], partNames: {}, now: NOW })
    expect(result.subscriptions.delta7d).toBe(0)
  })

  it('subscription entityType with subscription_created action lands in subscriptions box', () => {
    const subCreated = makeLog({ id: 's6', entityType: 'subscription', action: 'subscription_created', entityId: 'sub-1', after: { name: 'M365' } })
    const result = groupDomainEvents({ auditLogs: [subCreated], partInstalls: [], partNames: {}, now: NOW })
    expect(result.subscriptions.delta7d).toBe(1)
  })

  // ── Test 9: cap and delta ──────────────────────────────────────────────────
  it('8 matching asset events: delta7d=8, events.length=6, sorted desc by at', () => {
    // Arrange: 8 asset-created logs on different timestamps today
    const logs: AuditLog[] = Array.from({ length: 8 }, (_, i) =>
      makeLog({
        id: `a${i}`,
        entityType: 'asset',
        action: 'created',
        entityId: `asset-${i}`,
        at: new Date(2026, 6, 31, i + 1, 0, 0).toISOString(),
        after: { brand: 'Brand', model: `Model${i}` },
      })
    )
    // Act
    const result = groupDomainEvents({ auditLogs: logs, partInstalls: [], partNames: {}, now: NOW })
    // Assert
    expect(result.assets.delta7d).toBe(8)
    expect(result.assets.events).toHaveLength(6)
    // Events sorted descending by at — first event should have the latest timestamp
    const ats = result.assets.events.map(e => e.at)
    const sorted = [...ats].sort((a, b) => b.localeCompare(a))
    expect(ats).toEqual(sorted)
    // DASHBOARD_EVENTS_PER_BOX constant must equal 6
    expect(DASHBOARD_EVENTS_PER_BOX).toBe(6)
  })

  // ── Test 10: label fallback chains ────────────────────────────────────────
  describe('label fallbacks', () => {
    it('assets: uses brand+model when both present', () => {
      const log = makeLog({ id: 'lf1', entityType: 'asset', action: 'created', entityId: 'e1', after: { brand: 'Lenovo', model: 'ThinkPad' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.events[0]?.primary).toBe('Lenovo ThinkPad')
    })

    it('assets: falls back to invCode when brand+model absent', () => {
      const log = makeLog({ id: 'lf2', entityType: 'asset', action: 'created', entityId: 'e2', after: { invCode: 'LAP/00099' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.events[0]?.primary).toBe('LAP/00099')
    })

    it('assets: falls back to entityId when invCode also absent', () => {
      const log = makeLog({ id: 'lf3', entityType: 'asset', action: 'created', entityId: 'entity-xyz', after: {} })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.events[0]?.primary).toBe('entity-xyz')
    })

    it('employees: uses lastName+firstName', () => {
      const log = makeLog({ id: 'lf4', entityType: 'employee', action: 'created', entityId: 'emp-x', after: { lastName: 'Smith', firstName: 'John' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.employees.events[0]?.primary).toBe('Smith John')
    })

    it('employees: falls back to email when names absent', () => {
      const log = makeLog({ id: 'lf5', entityType: 'employee', action: 'created', entityId: 'emp-y', after: { email: 'user@example.test' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.employees.events[0]?.primary).toBe('user@example.test')
    })

    it('employees: falls back to entityId when email also absent', () => {
      const log = makeLog({ id: 'lf6', entityType: 'employee', action: 'created', entityId: 'emp-z', after: {} })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.employees.events[0]?.primary).toBe('emp-z')
    })

    it('named entity (branch): uses after.name', () => {
      const log = makeLog({ id: 'lf7', entityType: 'branch', action: 'created', entityId: 'br-x', after: { name: 'West Branch' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.branches.events[0]?.primary).toBe('West Branch')
    })

    it('named entity (branch): falls back to entityId when after.name absent', () => {
      const log = makeLog({ id: 'lf8', entityType: 'branch', action: 'created', entityId: 'br-fallback', after: {} })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.branches.events[0]?.primary).toBe('br-fallback')
    })
  })

  // ── Test 11: partInstallLabel inside groupDomainEvents ────────────────────
  describe('parts events label', () => {
    it('uses partNames[skuId] and formats qty and assetInvCode', () => {
      const mv = makeMovement({ id: 'mv-p1', skuId: 'sku-ram', qty: 2, assetInvCode: 'DT/00010', note: null })
      const result = groupDomainEvents({ auditLogs: [], partInstalls: [mv], partNames: { 'sku-ram': 'RAM 8 ГБ' }, now: NOW })
      expect(result.parts.events[0]?.primary).toBe('RAM 8 ГБ ×2 → DT/00010')
    })

    it('falls back to note when skuId not in partNames', () => {
      const mv = makeMovement({ id: 'mv-p2', skuId: 'sku-new', qty: 1, note: 'Unknown chip', assetInvCode: null })
      const result = groupDomainEvents({ auditLogs: [], partInstalls: [mv], partNames: {}, now: NOW })
      expect(result.parts.events[0]?.primary).toBe('Unknown chip ×1')
    })

    it('falls back to skuId when neither partNames entry nor note', () => {
      const mv = makeMovement({ id: 'mv-p3', skuId: 'sku-x', qty: 3, note: null, assetInvCode: null })
      const result = groupDomainEvents({ auditLogs: [], partInstalls: [mv], partNames: {}, now: NOW })
      expect(result.parts.events[0]?.primary).toBe('sku-x ×3')
    })

    it('omits arrow suffix when assetInvCode is null', () => {
      const mv = makeMovement({ id: 'mv-p4', skuId: 'sku-ssd', qty: 1, assetInvCode: null })
      const result = groupDomainEvents({ auditLogs: [], partInstalls: [mv], partNames: { 'sku-ssd': 'SSD' }, now: NOW })
      expect(result.parts.events[0]?.primary).not.toContain('→')
    })
  })

  // ── Test 12: secondary field (actorName) ──────────────────────────────────
  describe('secondary field', () => {
    it('actorName present → trimmed value in secondary', () => {
      const log = makeLog({ id: 'sec1', entityType: 'asset', action: 'created', entityId: 'e-sec1', actorName: '  Alice Admin  ', after: {} })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.events[0]?.secondary).toBe('Alice Admin')
    })

    it('actorName undefined → secondary is null', () => {
      const { actorName: _omit, ...rest } = makeLog({ entityType: 'asset', action: 'created', entityId: 'e-sec2', after: {} })
      void _omit
      const log = rest as AuditLog
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.events[0]?.secondary).toBeNull()
    })

    it('actorName null → secondary is null', () => {
      const log = makeLog({ entityType: 'asset', action: 'created', entityId: 'e-sec3', actorName: null, after: {} })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.events[0]?.secondary).toBeNull()
    })

    it('actorName empty string → secondary is null', () => {
      const log = makeLog({ entityType: 'asset', action: 'created', entityId: 'e-sec4', actorName: '', after: {} })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.events[0]?.secondary).toBeNull()
    })

    it('parts movements always have secondary === null', () => {
      const mv = makeMovement({ id: 'mv-sec', skuId: 'sku-a', qty: 1, assetInvCode: null })
      const result = groupDomainEvents({ auditLogs: [], partInstalls: [mv], partNames: {}, now: NOW })
      expect(result.parts.events[0]?.secondary).toBeNull()
    })
  })

  // ── Test 13: linkTo routing ────────────────────────────────────────────────
  describe('linkTo routing', () => {
    it('assets event linkTo is /assets/{entityId}', () => {
      const log = makeLog({ id: 'lt1', entityType: 'asset', action: 'created', entityId: 'asset-abc', after: {} })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.events[0]?.linkTo).toBe('/assets/asset-abc')
    })

    it('employees event linkTo is /employees', () => {
      const log = makeLog({ id: 'lt2', entityType: 'employee', action: 'created', entityId: 'emp-1', after: {} })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.employees.events[0]?.linkTo).toBe('/employees')
    })

    it('parts event linkTo is /parts', () => {
      const mv = makeMovement({ id: 'lt3' })
      const result = groupDomainEvents({ auditLogs: [], partInstalls: [mv], partNames: {}, now: NOW })
      expect(result.parts.events[0]?.linkTo).toBe('/parts')
    })

    it('subscriptions event linkTo is /licenses', () => {
      const log = makeLog({ id: 'lt4', entityType: 'license', action: 'created', entityId: 'lic-1', after: { type: 'Subscription' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.subscriptions.events[0]?.linkTo).toBe('/licenses')
    })

    it('branches event linkTo is /branches', () => {
      const log = makeLog({ id: 'lt5', entityType: 'branch', action: 'created', entityId: 'br-1', after: { name: 'Main' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.branches.events[0]?.linkTo).toBe('/branches')
    })

    it('departments event linkTo is /departments', () => {
      const log = makeLog({ id: 'lt6', entityType: 'department', action: 'created', entityId: 'dept-1', after: { name: 'HR' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.departments.events[0]?.linkTo).toBe('/departments')
    })
  })

  // ── Test 14: non-'created' actions do not land in any box ─────────────────
  describe('non-created actions are excluded', () => {
    it('asset updated event does NOT land in assets box', () => {
      const log = makeLog({ id: 'nc1', entityType: 'asset', action: 'updated', entityId: 'asset-u1', after: { brand: 'Dell' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.delta7d).toBe(0)
      expect(result.assets.events).toHaveLength(0)
    })

    it('employee status_changed event does NOT land in employees box', () => {
      const log = makeLog({ id: 'nc2', entityType: 'employee', action: 'status_changed', entityId: 'emp-u1', after: {} })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.employees.delta7d).toBe(0)
    })

    it('branch updated event does NOT land in branches box', () => {
      const log = makeLog({ id: 'nc3', entityType: 'branch', action: 'updated', entityId: 'br-u1', after: { name: 'Updated' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.branches.delta7d).toBe(0)
    })

    it('assignment assigned event does NOT increment assets delta7d (growth = created only) but appears in the feed', () => {
      // assignment/assigned now classifies as 'issued' and shows in the assets feed,
      // but delta7d counts only 'created' events — so the growth metric stays 0.
      const log = makeLog({ id: 'nc4', entityType: 'assignment', action: 'assigned', entityId: 'asgn-1', after: { assetId: 'asset-9' } })
      const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
      expect(result.assets.delta7d).toBe(0)                 // growth semantic: created only
      expect(result.assets.events).toHaveLength(1)          // but it IS in the feed
      expect(result.assets.events[0]?.kind).toBe('issued')
      // no OTHER box receives it
      const nonAssetTotal = (['employees', 'parts', 'subscriptions', 'branches', 'departments'] as const)
        .reduce((sum, k) => sum + result[k].delta7d, 0)
      expect(nonAssetTotal).toBe(0)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// reducePeopleStats
// ═══════════════════════════════════════════════════════════════════════════════

describe('reducePeopleStats', () => {
  it('counts only active employees and collects their ids', () => {
    const rows: EmployeeForStats[] = [
      { id: 'e1', status: 'active' },
      { id: 'e2', status: 'terminated' },
    ]
    const result = reducePeopleStats(rows)
    expect(result.employeeCount).toBe(1)
    expect(result.activeEmployeeIds).toEqual(['e1'])
  })

  it('empty array → { employeeCount: 0, activeEmployeeIds: [] }', () => {
    expect(reducePeopleStats([])).toEqual({ employeeCount: 0, activeEmployeeIds: [] })
  })

  it('all active → all ids in activeEmployeeIds', () => {
    const rows: EmployeeForStats[] = [
      { id: 'a', status: 'active' },
      { id: 'b', status: 'active' },
    ]
    const result = reducePeopleStats(rows)
    expect(result.employeeCount).toBe(2)
    expect(result.activeEmployeeIds).toEqual(['a', 'b'])
  })

  it('all terminated → employeeCount 0, empty activeEmployeeIds', () => {
    const rows: EmployeeForStats[] = [
      { id: 'x', status: 'terminated' },
    ]
    const result = reducePeopleStats(rows)
    expect(result.employeeCount).toBe(0)
    expect(result.activeEmployeeIds).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// groupDomainEvents — activeEmployeeIds whitelist
// ═══════════════════════════════════════════════════════════════════════════════

describe('groupDomainEvents — activeEmployeeIds whitelist', () => {
  // Two employee 'created' events in the 7-day window:
  //   e1 → active (in whitelist), e2 → terminated (not in whitelist)
  const empLogActive = makeLog({
    id: 'emp-a', entityType: 'employee', action: 'created', entityId: 'e1',
    at: localIso(2026, 7, 31), after: { lastName: 'Active', firstName: 'Alice' },
  })
  const empLogTerminated = makeLog({
    id: 'emp-t', entityType: 'employee', action: 'created', entityId: 'e2',
    at: localIso(2026, 7, 30), after: { lastName: 'Terminated', firstName: 'Bob' },
  })
  const auditLogs = [empLogActive, empLogTerminated]

  it('with activeEmployeeIds provided → only active employee in delta7d/events/days', () => {
    const result = groupDomainEvents({
      auditLogs,
      partInstalls: [],
      partNames: {},
      now: NOW,
      activeEmployeeIds: ['e1'],
    })
    expect(result.employees.delta7d).toBe(1)
    expect(result.employees.events).toHaveLength(1)
    expect(result.employees.events[0]!.id).toBe('emp-a')
    // days buckets must sum to 1 (only the active employee event counts)
    const daySum = result.employees.days.reduce((s, n) => s + n, 0)
    expect(daySum).toBe(1)
  })

  it('without activeEmployeeIds → no filtering, both employees in delta7d', () => {
    const result = groupDomainEvents({
      auditLogs,
      partInstalls: [],
      partNames: {},
      now: NOW,
      // activeEmployeeIds intentionally omitted (undefined)
    })
    expect(result.employees.delta7d).toBe(2)
    const daySum = result.employees.days.reduce((s, n) => s + n, 0)
    expect(daySum).toBe(2)
  })

  it('activeEmployeeIds=[] → employees box is empty (no ids in whitelist)', () => {
    const result = groupDomainEvents({
      auditLogs,
      partInstalls: [],
      partNames: {},
      now: NOW,
      activeEmployeeIds: [],
    })
    expect(result.employees.delta7d).toBe(0)
    expect(result.employees.events).toHaveLength(0)
  })

  it('whitelist does not affect other boxes (assets unaffected)', () => {
    const assetLog = makeLog({
      id: 'asset-1', entityType: 'asset', action: 'created', entityId: 'a1',
      at: localIso(2026, 7, 31), after: { brand: 'Dell', model: 'XPS' },
    })
    const result = groupDomainEvents({
      auditLogs: [...auditLogs, assetLog],
      partInstalls: [],
      partNames: {},
      now: NOW,
      activeEmployeeIds: ['e1'],
    })
    expect(result.assets.delta7d).toBe(1)
    expect(result.employees.delta7d).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// classifyAssetEvent — typed asset events for the «АКТИВЫ» feed
// ═══════════════════════════════════════════════════════════════════════════════

describe('classifyAssetEvent', () => {
  it('asset + created → "created"', () => {
    const log = makeLog({ entityType: 'asset', action: 'created', after: { invCode: 'LAP/00001' } })
    expect(classifyAssetEvent(log)).toBe('created')
  })

  it('asset + status_changed → st_assigned → "issued"', () => {
    const log = makeLog({ entityType: 'asset', action: 'status_changed', after: { statusId: ASSET_STATUS.assigned } })
    expect(classifyAssetEvent(log)).toBe('issued')
  })

  it('asset + status_changed → st_pending → "issued"', () => {
    const log = makeLog({ entityType: 'asset', action: 'status_changed', after: { statusId: ASSET_STATUS.pending } })
    expect(classifyAssetEvent(log)).toBe('issued')
  })

  it('asset + status_changed → st_warehouse → "returned"', () => {
    const log = makeLog({ entityType: 'asset', action: 'status_changed', after: { statusId: ASSET_STATUS.warehouse } })
    expect(classifyAssetEvent(log)).toBe('returned')
  })

  it('asset + status_changed → st_disposed → "disposed"', () => {
    const log = makeLog({ entityType: 'asset', action: 'status_changed', after: { statusId: ASSET_STATUS.disposed } })
    expect(classifyAssetEvent(log)).toBe('disposed')
  })

  it('asset + status_changed → st_repair → "repair"', () => {
    const log = makeLog({ entityType: 'asset', action: 'status_changed', after: { statusId: ASSET_STATUS.repair } })
    expect(classifyAssetEvent(log)).toBe('repair')
  })

  it('assignment + assigned → "issued"', () => {
    const log = makeLog({ entityType: 'assignment', action: 'assigned', after: { assetId: 'asset-1' } })
    expect(classifyAssetEvent(log)).toBe('issued')
  })

  it('assignment + returned → "returned"', () => {
    const log = makeLog({ entityType: 'assignment', action: 'returned', after: { assetId: 'asset-1' } })
    expect(classifyAssetEvent(log)).toBe('returned')
  })

  it('asset + updated → null (not in feed)', () => {
    const log = makeLog({ entityType: 'asset', action: 'updated', after: { brand: 'Dell' } })
    expect(classifyAssetEvent(log)).toBeNull()
  })

  it('asset + receipt_confirmed (server-written, not in AuditAction union) → null', () => {
    // receipt_confirmed arrives via adapter cast; the classifier must guard unknown actions.
    const log = makeLog({ entityType: 'asset', action: 'receipt_confirmed' as unknown as AuditLog['action'], after: {} })
    expect(classifyAssetEvent(log)).toBeNull()
  })

  it('asset + status_changed with unknown after.statusId → null', () => {
    const log = makeLog({ entityType: 'asset', action: 'status_changed', after: { statusId: 'st_future_unknown' } })
    expect(classifyAssetEvent(log)).toBeNull()
  })

  it('asset + status_changed with missing after → null', () => {
    const log = makeLog({ entityType: 'asset', action: 'status_changed', after: null })
    expect(classifyAssetEvent(log)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// groupDomainEvents — assets box typed feed
// ═══════════════════════════════════════════════════════════════════════════════

describe('groupDomainEvents — assets typed feed', () => {
  it('no issuance duplicate: pending transfer + receipt_confirmed for same asset → exactly one "issued"', () => {
    // Physical event = one hand-off. status_changed→st_pending writes the «выдан».
    // The subsequent magic-link click writes receipt_confirmed (excluded) — no second issued.
    const transfer = makeLog({
      id: 'tr1', entityType: 'asset', action: 'status_changed', entityId: 'asset-42',
      at: localIso(2026, 7, 31, 10), after: { statusId: ASSET_STATUS.pending },
    })
    const confirm = makeLog({
      id: 'cf1', entityType: 'asset', action: 'receipt_confirmed' as unknown as AuditLog['action'],
      entityId: 'asset-42', at: localIso(2026, 7, 31, 11), after: {},
    })
    const result = groupDomainEvents({ auditLogs: [transfer, confirm], partInstalls: [], partNames: {}, now: NOW })
    const issued = result.assets.events.filter(e => e.kind === 'issued')
    expect(issued).toHaveLength(1)
    expect(result.assets.events).toHaveLength(1)
  })

  it('assignment assigned: kind "issued", joins by after.assetId, primary from assetLabels, linkTo /assets/<assetId>', () => {
    const log = makeLog({
      id: 'as1', entityType: 'assignment', action: 'assigned', entityId: 'asgn-1',
      at: localIso(2026, 7, 31), after: { assetId: 'asset-xyz', mode: 'employee' },
    })
    const result = groupDomainEvents({
      auditLogs: [log], partInstalls: [], partNames: {}, now: NOW,
      assetLabels: { 'asset-xyz': 'LAP/00007 · Dell XPS 13' },
    })
    const ev = result.assets.events[0]
    expect(ev?.kind).toBe('issued')
    expect(ev?.primary).toBe('LAP/00007 · Dell XPS 13')
    expect(ev?.linkTo).toBe('/assets/asset-xyz')
  })

  it('assignment returned: kind "returned", joins by after.assetId', () => {
    const log = makeLog({
      id: 'ret1', entityType: 'assignment', action: 'returned', entityId: 'asgn-2',
      at: localIso(2026, 7, 31), after: { assetId: 'asset-ret', endedAt: localIso(2026, 7, 31) },
    })
    const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
    const ev = result.assets.events[0]
    expect(ev?.kind).toBe('returned')
    expect(ev?.linkTo).toBe('/assets/asset-ret')
  })

  it('delta7d/days count only created; feed carries all typed events with correct kinds', () => {
    const created = makeLog({
      id: 'c1', entityType: 'asset', action: 'created', entityId: 'a-created',
      at: localIso(2026, 7, 31, 9), after: { invCode: 'LAP/00001' },
    })
    const issued = makeLog({
      id: 'i1', entityType: 'asset', action: 'status_changed', entityId: 'a-issued',
      at: localIso(2026, 7, 31, 8), after: { statusId: ASSET_STATUS.assigned },
    })
    const disposed = makeLog({
      id: 'd1', entityType: 'asset', action: 'status_changed', entityId: 'a-disposed',
      at: localIso(2026, 7, 31, 7), after: { statusId: ASSET_STATUS.disposed },
    })
    const repair = makeLog({
      id: 'r1', entityType: 'asset', action: 'status_changed', entityId: 'a-repair',
      at: localIso(2026, 7, 31, 6), after: { statusId: ASSET_STATUS.repair },
    })
    const result = groupDomainEvents({
      auditLogs: [created, issued, disposed, repair], partInstalls: [], partNames: {}, now: NOW,
    })
    // Growth metric: only the created event.
    expect(result.assets.delta7d).toBe(1)
    expect(result.assets.days.reduce((s, n) => s + n, 0)).toBe(1)
    // Feed: all four, sorted desc by at.
    expect(result.assets.events).toHaveLength(4)
    const kindsInOrder = result.assets.events.map(e => e.kind)
    expect(kindsInOrder).toEqual(['created', 'issued', 'disposed', 'repair'])
  })

  it('assetLabels miss on created event → falls back to invCode from after (assetEventLabel)', () => {
    const log = makeLog({
      id: 'm1', entityType: 'asset', action: 'created', entityId: 'a-nolabel',
      at: localIso(2026, 7, 31), after: { invCode: 'LAP/00099' },
    })
    const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
    expect(result.assets.events[0]?.primary).toBe('LAP/00099')
    expect(result.assets.events[0]?.linkTo).toBe('/assets/a-nolabel')
  })

  it('assetLabels miss on assignment event → falls back to the after.assetId string', () => {
    const log = makeLog({
      id: 'm2', entityType: 'assignment', action: 'assigned', entityId: 'asgn-9',
      at: localIso(2026, 7, 31), after: { assetId: 'asset-fallback' },
    })
    const result = groupDomainEvents({ auditLogs: [log], partInstalls: [], partNames: {}, now: NOW })
    // No label, assignment event → assetEventLabel not used → falls back to joinId (assetId).
    expect(result.assets.events[0]?.primary).toBe('asset-fallback')
    expect(result.assets.events[0]?.linkTo).toBe('/assets/asset-fallback')
  })

  it('assetLabels hit takes precedence over assetEventLabel for a created event', () => {
    const log = makeLog({
      id: 'h1', entityType: 'asset', action: 'created', entityId: 'LAP/00001',
      at: localIso(2026, 7, 31), after: { invCode: 'LAP/00001', brand: 'Dell', model: 'XPS' },
    })
    const result = groupDomainEvents({
      auditLogs: [log], partInstalls: [], partNames: {}, now: NOW,
      assetLabels: { 'LAP/00001': 'LAP/00001 · Dell XPS 13' },
    })
    expect(result.assets.events[0]?.primary).toBe('LAP/00001 · Dell XPS 13')
  })

  it('regression: employees/branches/departments/subscriptions events carry NO kind property', () => {
    const emp = makeLog({ id: 'reg-e', entityType: 'employee', action: 'created', entityId: 'e1', after: { lastName: 'A', firstName: 'B' } })
    const br = makeLog({ id: 'reg-b', entityType: 'branch', action: 'created', entityId: 'b1', after: { name: 'HQ' } })
    const dep = makeLog({ id: 'reg-d', entityType: 'department', action: 'created', entityId: 'd1', after: { name: 'IT' } })
    const sub = makeLog({ id: 'reg-s', entityType: 'license', action: 'created', entityId: 's1', after: { type: 'Subscription', name: 'M365' } })
    const result = groupDomainEvents({ auditLogs: [emp, br, dep, sub], partInstalls: [], partNames: {}, now: NOW })
    for (const box of ['employees', 'branches', 'departments', 'subscriptions'] as const) {
      for (const ev of result[box].events) {
        expect('kind' in ev).toBe(false)
      }
    }
  })

  it('regression: subscriptions/parts boxes still function (delta7d unaffected by asset typing)', () => {
    const mv = makeMovement({ id: 'reg-mv', skuId: 'sku-a', qty: 1, assetInvCode: null })
    const result = groupDomainEvents({ auditLogs: [], partInstalls: [mv], partNames: {}, now: NOW })
    expect(result.parts.delta7d).toBe(1)
    expect('kind' in (result.parts.events[0] ?? {})).toBe(false)
  })
})
