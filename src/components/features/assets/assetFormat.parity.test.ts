/**
 * Parity tests for new/upgraded exports in assetFormat.ts
 * Covers: deriveDisplayStatusId, deriveDisplayStatus, STATUS_CHIP_COLOR,
 *         assetTitle (extended), relativeBucket (week/month/year + regression),
 *         fmtDate, isTemporaryAssignment
 */
import { describe, it, expect } from 'vitest'
import {
  deriveDisplayStatusId,
  deriveDisplayStatus,
  STATUS_CHIP_COLOR,
  assetTitle,
  relativeBucket,
  fmtDate,
  isTemporaryAssignment,
} from './assetFormat'
import type { Asset, StatusRow } from '@/domain/asset'

// ---------------------------------------------------------------------------
// Shared minimal-valid fixture
// ---------------------------------------------------------------------------

const base: Asset = {
  id: 'asset-1',
  categoryId: 'cat_laptop',
  brand: 'Dell',
  model: 'Latitude',
  invCode: '450/302042',
  serial: 'SN-001',
  statusId: 'st_warehouse',
  assignment: null,
  branchId: 'br-1',
  deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

// ---------------------------------------------------------------------------
// 1. deriveDisplayStatusId
// ---------------------------------------------------------------------------

describe('deriveDisplayStatusId', () => {
  it('st_repair wins even when assignment is present', () => {
    // Arrange
    const asset: Asset = {
      ...base,
      statusId: 'st_repair',
      assignment: { mode: 'employee', employeeId: 'e1' },
    }
    // Act + Assert
    expect(deriveDisplayStatusId(asset)).toBe('st_repair')
  })

  it('st_disposed wins even when assignment is present', () => {
    // Arrange
    const asset: Asset = {
      ...base,
      statusId: 'st_disposed',
      assignment: { mode: 'employee', employeeId: 'e1' },
    }
    // Act + Assert
    expect(deriveDisplayStatusId(asset)).toBe('st_disposed')
  })

  it('st_warehouse + no assignment → st_warehouse', () => {
    // Arrange
    const asset: Asset = { ...base, statusId: 'st_warehouse', assignment: null }
    // Act + Assert
    expect(deriveDisplayStatusId(asset)).toBe('st_warehouse')
  })

  it('st_warehouse + assignment present → st_assigned (derived)', () => {
    // Arrange
    const asset: Asset = {
      ...base,
      statusId: 'st_warehouse',
      assignment: { mode: 'employee', employeeId: 'e1' },
    }
    // Act + Assert
    expect(deriveDisplayStatusId(asset)).toBe('st_assigned')
  })

  it('st_assigned + no assignment → st_warehouse (derived, not raw statusId)', () => {
    // Arrange — raw statusId says assigned but there is no assignment object
    const asset: Asset = { ...base, statusId: 'st_assigned', assignment: null }
    // Act + Assert
    expect(deriveDisplayStatusId(asset)).toBe('st_warehouse')
  })
})

// ---------------------------------------------------------------------------
// 2. deriveDisplayStatus
// ---------------------------------------------------------------------------

describe('deriveDisplayStatus', () => {
  const statuses: StatusRow[] = [
    { id: 'st_warehouse', name: 'In Warehouse', color: 'blue' },
    { id: 'st_assigned',  name: 'Assigned',     color: 'green' },
    { id: 'st_repair',    name: 'In Repair',    color: 'amber' },
    { id: 'st_disposed',  name: 'Disposed',     color: 'red' },
  ]

  it('returns matching StatusRow when found in list', () => {
    // Arrange
    const asset: Asset = { ...base, statusId: 'st_warehouse', assignment: null }
    // Act
    const result = deriveDisplayStatus(asset, statuses)
    // Assert
    expect(result).toEqual({ id: 'st_warehouse', name: 'In Warehouse', color: 'blue' })
  })

  it('returns matching StatusRow for derived st_assigned', () => {
    // Arrange
    const asset: Asset = {
      ...base,
      statusId: 'st_warehouse',
      assignment: { mode: 'employee', employeeId: 'e1' },
    }
    // Act
    const result = deriveDisplayStatus(asset, statuses)
    // Assert
    expect(result).toEqual({ id: 'st_assigned', name: 'Assigned', color: 'green' })
  })

  it('returns synthetic row with color gray when statuses list is empty', () => {
    // Arrange
    const asset: Asset = { ...base, statusId: 'st_warehouse', assignment: null }
    // Act
    const result = deriveDisplayStatus(asset, [])
    // Assert
    expect(result).toEqual({ id: 'st_warehouse', name: 'st_warehouse', color: 'gray' })
  })

  it('synthetic row id matches the derived id, not the raw statusId', () => {
    // Arrange — raw statusId=st_assigned but no assignment → derived=st_warehouse
    const asset: Asset = { ...base, statusId: 'st_assigned', assignment: null }
    // Act
    const result = deriveDisplayStatus(asset, [])
    // Assert: synthetic id should be 'st_warehouse', not 'st_assigned'
    expect(result.id).toBe('st_warehouse')
    expect(result.name).toBe('st_warehouse')
    expect(result.color).toBe('gray')
  })
})

// ---------------------------------------------------------------------------
// 3. STATUS_CHIP_COLOR
// ---------------------------------------------------------------------------

describe('STATUS_CHIP_COLOR', () => {
  it('st_warehouse → blue', () => {
    expect(STATUS_CHIP_COLOR['st_warehouse']).toBe('blue')
  })

  it('st_assigned → green', () => {
    expect(STATUS_CHIP_COLOR['st_assigned']).toBe('green')
  })

  it('st_repair → amber', () => {
    expect(STATUS_CHIP_COLOR['st_repair']).toBe('amber')
  })

  it('st_disposed → red', () => {
    expect(STATUS_CHIP_COLOR['st_disposed']).toBe('red')
  })
})

// ---------------------------------------------------------------------------
// 4. assetTitle — extended overloads
// ---------------------------------------------------------------------------

describe('assetTitle (extended)', () => {
  it('brand + model → "Brand Model"', () => {
    // Arrange
    const asset: Asset = { ...base, brand: 'Samsung', model: 'S23' }
    // Act + Assert
    expect(assetTitle(asset)).toBe('Samsung S23')
  })

  it('furniture group + categoryName + no brand/model → categoryName', () => {
    // Arrange
    const asset: Asset = { ...base, brand: null, model: null }
    // Act + Assert
    expect(assetTitle(asset, 'Офисный стул', 'furniture')).toBe('Офисный стул')
  })

  it('categoryName without group → categoryName (not invCode)', () => {
    // Arrange
    const asset: Asset = { ...base, brand: null, model: null }
    // Act + Assert
    expect(assetTitle(asset, 'Laptop', null)).toBe('Laptop')
  })

  it('nothing (no brand, no model, no categoryName) → invCode', () => {
    // Arrange
    const asset: Asset = { ...base, brand: null, model: null }
    // Act + Assert
    expect(assetTitle(asset)).toBe('450/302042')
  })

  it('brand + model takes priority over categoryName', () => {
    // Arrange — both brand/model and categoryName provided
    const asset: Asset = { ...base, brand: 'HP', model: 'EliteBook' }
    // Act + Assert
    expect(assetTitle(asset, 'Laptop', 'devices')).toBe('HP EliteBook')
  })
})

// ---------------------------------------------------------------------------
// 5. relativeBucket — week / month / year extensions + regression for now/min/hour/day
// ---------------------------------------------------------------------------

describe('relativeBucket — extended buckets', () => {
  // Fixed reference point to keep tests deterministic
  const NOW = new Date('2026-06-21T12:00:00.000Z')

  function isoAgo(days: number, hours = 0, minutes = 0): string {
    const ms = (days * 86_400 + hours * 3_600 + minutes * 60) * 1_000
    return new Date(NOW.getTime() - ms).toISOString()
  }

  // --- regression: existing buckets still work ---

  it('same moment → now', () => {
    expect(relativeBucket(NOW.toISOString(), NOW)).toEqual({ unit: 'now' })
  })

  it('30 seconds ago → now', () => {
    const iso = new Date(NOW.getTime() - 30_000).toISOString()
    expect(relativeBucket(iso, NOW)).toEqual({ unit: 'now' })
  })

  it('5 minutes ago → { unit: min, n: 5 }', () => {
    expect(relativeBucket(isoAgo(0, 0, 5), NOW)).toEqual({ unit: 'min', n: 5 })
  })

  it('2 hours ago → { unit: hour, n: 2 }', () => {
    expect(relativeBucket(isoAgo(0, 2), NOW)).toEqual({ unit: 'hour', n: 2 })
  })

  it('3 days ago → { unit: day, n: 3 }', () => {
    expect(relativeBucket(isoAgo(3), NOW)).toEqual({ unit: 'day', n: 3 })
  })

  // --- new buckets ---

  it('10 days ago → { unit: week, n: 1 }', () => {
    // 10 days = 1 full week (floor(10/7)=1), less than 4 weeks (floor(10/30)=0→month<1)
    expect(relativeBucket(isoAgo(10), NOW)).toEqual({ unit: 'week', n: 1 })
  })

  it('21 days ago → { unit: week, n: 3 }', () => {
    // 21 days = 3 full weeks (floor(21/7)=3), month=floor(21/30)=0 → still week bucket
    expect(relativeBucket(isoAgo(21), NOW)).toEqual({ unit: 'week', n: 3 })
  })

  it('40 days ago → { unit: month, n: 1 }', () => {
    // 40 days: week=floor(40/7)=5 ≥1, month=floor(40/30)=1 ≥1, year=floor(40/365)=0 → month
    expect(relativeBucket(isoAgo(40), NOW)).toEqual({ unit: 'month', n: 1 })
  })

  it('200 days ago → { unit: month, n: 6 }', () => {
    // 200 days: month=floor(200/30)=6, year=floor(200/365)=0 → month
    expect(relativeBucket(isoAgo(200), NOW)).toEqual({ unit: 'month', n: 6 })
  })

  it('400 days ago → { unit: year, n: 1 }', () => {
    // 400 days: year=floor(400/365)=1 → year
    expect(relativeBucket(isoAgo(400), NOW)).toEqual({ unit: 'year', n: 1 })
  })

  it('800 days ago → { unit: year, n: 2 }', () => {
    // 800 days: year=floor(800/365)=2 → year
    expect(relativeBucket(isoAgo(800), NOW)).toEqual({ unit: 'year', n: 2 })
  })
})

// ---------------------------------------------------------------------------
// 6. fmtDate
// ---------------------------------------------------------------------------

describe('fmtDate', () => {
  it('formats a valid ISO string to DD/Mon/YYYY pattern', () => {
    // Use a UTC noon timestamp to avoid any day boundary ambiguity from timezone offsets
    // 2026-12-09T12:00:00.000Z — local getDate() will be 9 in UTC+14..UTC-12 range
    const result = fmtDate('2026-12-09T12:00:00.000Z')
    // Assert the structural pattern first
    expect(result).toMatch(/^\d{2}\/[A-Z][a-z]{2}\/\d{4}$/)
    // Assert month is Dec
    expect(result).toContain('/Dec/')
    // Assert year
    expect(result).toContain('/2026')
  })

  it('returns em-dash for invalid date string', () => {
    expect(fmtDate('not-a-date')).toBe('—')
  })

  it('returns em-dash for empty string', () => {
    expect(fmtDate('')).toBe('—')
  })
})

// ---------------------------------------------------------------------------
// 7. isTemporaryAssignment
// ---------------------------------------------------------------------------

describe('isTemporaryAssignment', () => {
  it('returns true when assignment.isTemporary === true', () => {
    // Arrange
    const asset: Asset = {
      ...base,
      assignment: { mode: 'employee', employeeId: 'e1', isTemporary: true },
    }
    // Act + Assert
    expect(isTemporaryAssignment(asset)).toBe(true)
  })

  it('returns false when assignment.isTemporary === false', () => {
    // Arrange
    const asset: Asset = {
      ...base,
      assignment: { mode: 'employee', employeeId: 'e1', isTemporary: false },
    }
    // Act + Assert
    expect(isTemporaryAssignment(asset)).toBe(false)
  })

  it('returns false when assignment.isTemporary is undefined', () => {
    // Arrange — isTemporary field absent
    const asset: Asset = {
      ...base,
      assignment: { mode: 'employee', employeeId: 'e1' },
    }
    // Act + Assert
    expect(isTemporaryAssignment(asset)).toBe(false)
  })

  it('returns false when assignment is null', () => {
    // Arrange
    const asset: Asset = { ...base, assignment: null }
    // Act + Assert
    expect(isTemporaryAssignment(asset)).toBe(false)
  })
})
