import { describe, it, expect } from 'vitest'
import { buildHoldNotifications, type HoldNotification } from './holdNotifications'
import type { Asset } from './types'

const base: Asset = {
  id: 'a0', categoryId: 'cat_laptop', brand: 'Dell', model: 'Latitude',
  invCode: '450/001', serial: null, statusId: 'st_assigned',
  assignment: null, branchId: 'br-1', deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const NOW = new Date(2026, 5, 23) // 2026-06-23 local midnight

function tempAsset(over: Partial<Asset>, expiresAt: string, tempKind: 'audit' | 'intern' = 'intern'): Asset {
  return { ...base, ...over, assignment: { mode: 'temporary', isTemporary: true, tempKind, expiresAt } }
}

describe('buildHoldNotifications', () => {
  it('excludes non-holds and active holds', () => {
    const assets: Asset[] = [
      { ...base, id: 'plain', assignment: { mode: 'employee', employeeId: 'e1' } },
      tempAsset({ id: 'active' }, '2026-12-31'),
    ]
    expect(buildHoldNotifications(assets, NOW)).toEqual([])
  })
  it('includes dueSoon and overdue holds', () => {
    const assets: Asset[] = [
      tempAsset({ id: 'soon', invCode: '450/002' }, '2026-06-24'),
      tempAsset({ id: 'late', invCode: '450/003' }, '2026-06-20'),
    ]
    const out = buildHoldNotifications(assets, NOW)
    expect(out.map(n => n.assetId)).toEqual(['late', 'soon'])
    expect(out[0]!.hold).toBe('overdue')
    expect(out[1]!.hold).toBe('dueSoon')
  })
  it('sorts overdue by earliest expiresAt first, then invCode', () => {
    const assets: Asset[] = [
      tempAsset({ id: 'b', invCode: '450/010' }, '2026-06-19'),
      tempAsset({ id: 'a', invCode: '450/009' }, '2026-06-18'),
      tempAsset({ id: 'c', invCode: '450/008' }, '2026-06-19'),
    ]
    const out = buildHoldNotifications(assets, NOW)
    expect(out.map(n => n.assetId)).toEqual(['a', 'c', 'b'])
  })
  it('carries title (brand+model), invCode, tempKind, expiresAt, hold', () => {
    const out = buildHoldNotifications([tempAsset({ id: 'x' }, '2026-06-20', 'audit')], NOW)
    const n = out[0] as HoldNotification
    expect(n).toMatchObject({
      assetId: 'x', title: 'Dell Latitude', invCode: '450/001',
      tempKind: 'audit', expiresAt: '2026-06-20', hold: 'overdue',
    })
  })
  it('falls back to type then invCode for title', () => {
    const furn = tempAsset({ id: 'f', brand: null, model: null, type: 'Стол', invCode: '460/001' }, '2026-06-20')
    const noName = tempAsset({ id: 'g', brand: null, model: null, type: null, invCode: '470/001' }, '2026-06-20')
    const out = buildHoldNotifications([furn, noName], NOW)
    expect(out.find(n => n.assetId === 'f')!.title).toBe('Стол')
    expect(out.find(n => n.assetId === 'g')!.title).toBe('470/001')
  })
})
