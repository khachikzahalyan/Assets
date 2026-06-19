import { describe, it, expect } from 'vitest'
import { assetTitle, relativeBucket, assigneeKind } from './assetFormat'
import type { Asset } from '@/domain/asset'

const base: Asset = {
  id: 'a',
  categoryId: 'cat_laptop',
  brand: 'Dell',
  model: 'Latitude',
  invCode: 'LAP/1',
  serial: 's',
  statusId: 'st_assigned',
  assignment: null,
  branchId: 'br',
  deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('assetTitle', () => {
  it('joins brand + model', () => expect(assetTitle(base)).toBe('Dell Latitude'))
  it('falls back to invCode for furniture', () =>
    expect(assetTitle({ ...base, brand: null, model: null })).toBe('LAP/1'))
})

describe('relativeBucket', () => {
  it('same moment → now bucket', () =>
    expect(
      relativeBucket('2026-01-01T00:00:00.000Z', new Date('2026-01-01T00:00:00.000Z')),
    ).toEqual({ unit: 'now' }))

  it('<1 min → now bucket', () =>
    expect(
      relativeBucket('2026-01-01T00:00:00.000Z', new Date('2026-01-01T00:00:30.000Z')),
    ).toEqual({ unit: 'now' }))

  it('5 min → min bucket with n=5', () =>
    expect(
      relativeBucket('2026-01-01T00:00:00.000Z', new Date('2026-01-01T00:05:00.000Z')),
    ).toEqual({ unit: 'min', n: 5 }))

  it('1 hour → hour bucket with n=1', () =>
    expect(
      relativeBucket('2026-01-01T00:00:00.000Z', new Date('2026-01-01T01:00:00.000Z')),
    ).toEqual({ unit: 'hour', n: 1 }))

  it('2 hours → hour bucket with n=2', () =>
    expect(
      relativeBucket('2026-01-01T00:00:00.000Z', new Date('2026-01-01T02:00:00.000Z')),
    ).toEqual({ unit: 'hour', n: 2 }))

  it('2 days → day bucket with n=2', () =>
    expect(
      relativeBucket('2026-01-01T00:00:00.000Z', new Date('2026-01-03T00:00:00.000Z')),
    ).toEqual({ unit: 'day', n: 2 }))
})

describe('assigneeKind', () => {
  it('warehouse when unassigned + st_warehouse', () =>
    expect(assigneeKind({ ...base, assignment: null, statusId: 'st_warehouse' })).toBe('warehouse'))

  it('none when unassigned + st_assigned', () =>
    expect(assigneeKind({ ...base, assignment: null, statusId: 'st_assigned' })).toBe('none'))

  it('mode when assigned', () =>
    expect(
      assigneeKind({ ...base, assignment: { mode: 'employee', employeeId: 'e1' } }),
    ).toBe('employee'))

  it('department mode', () =>
    expect(
      assigneeKind({ ...base, assignment: { mode: 'department', departmentId: 'd1' } }),
    ).toBe('department'))
})
