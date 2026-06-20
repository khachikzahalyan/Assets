import { describe, it, expect } from 'vitest'
import { InMemoryDashboardRepository } from './inMemoryDashboardRepository'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'

function asset(id: string, statusId: string, categoryId: string, branchId: string): Asset {
  return {
    id, categoryId, brand: 'B', model: 'M', invCode: `INV/${id}`, serial: null,
    statusId, assignment: null, branchId, deptId: null, updatedAt: '2026-06-01T00:00:00.000Z',
    currentSpecs: null,
  }
}

const ref: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'Warehouse', color: 'gray' },
    { id: 'st_assigned', name: 'Assigned', color: 'green' },
    { id: 'st_repair', name: 'In Repair', color: 'orange' },
    { id: 'st_disposed', name: 'Disposed', color: 'red' },
  ],
  branches: [{ id: 'br_1', name: 'HQ' }, { id: 'br_2', name: 'West' }],
  departments: [],
  categories: [
    { id: 'cat_laptop', name: 'Laptop', group: 'devices', lucideIcon: 'laptop' },
    { id: 'cat_router', name: 'Router', group: 'network', lucideIcon: 'router' },
    { id: 'cat_desk', name: 'Desk', group: 'furniture', lucideIcon: 'table-2' },
  ],
  employees: [],
}

function lic(id: string, lifecycleStatus: 'active' | 'retired', assignmentType: 'employee' | 'device' | 'unassigned'): WorkstationLicense {
  return {
    id, name: id, vendor: null, type: 'Default', isReusable: true,
    assignmentType, assignedToEmployeeId: null, assignedToAssetId: null,
    assignedAt: null, assignedBy: null, lifecycleStatus,
    retiredAt: null, retiredWithAssetId: null, expiresAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'u', updatedBy: 'u',
  }
}

const auditRows: AuditLog[] = [
  { id: 'au_3', entityType: 'assignment', entityId: 'as_3', action: 'returned',
    actorUid: 'u_1', actorRole: 'asset_admin', before: null, after: { assetId: 'a_2' },
    comment: null, at: '2026-06-10T00:00:00.000Z' },
  { id: 'au_2', entityType: 'assignment', entityId: 'as_2', action: 'assigned',
    actorUid: 'u_1', actorRole: 'asset_admin', before: null, after: { assetId: 'a_1' },
    comment: null, at: '2026-06-09T00:00:00.000Z' },
  { id: 'au_1', entityType: 'asset', entityId: 'a_1', action: 'created',
    actorUid: 'u_1', actorRole: 'asset_admin', before: null, after: null,
    comment: null, at: '2026-06-08T00:00:00.000Z' },
]

function makeRepo() {
  return new InMemoryDashboardRepository({
    assets: [
      asset('a_1', 'st_assigned', 'cat_laptop', 'br_1'),
      asset('a_2', 'st_warehouse', 'cat_laptop', 'br_1'),
      asset('a_3', 'st_repair', 'cat_router', 'br_2'),
      asset('a_4', 'st_disposed', 'cat_desk', 'br_2'),
    ],
    ref,
    workstationLicenses: [
      lic('l_1', 'active', 'unassigned'),
      lic('l_2', 'active', 'device'),
      lic('l_3', 'retired', 'unassigned'),
    ],
    serverLicenseCount: 7,
    employeeCount: 42,
    pendingUsersCount: 3,
    auditLogs: auditRows,
  })
}

describe('InMemoryDashboardRepository', () => {
  it('loadAssetStats totals, byStatus, byGroup, topBranches', async () => {
    const s = await makeRepo().loadAssetStats(5)
    expect(s.total).toBe(4)
    expect(s.byStatus).toEqual({ st_warehouse: 1, st_assigned: 1, st_repair: 1, st_disposed: 1 })
    expect(s.byGroup).toEqual([
      { group: 'devices', count: 2 },
      { group: 'network', count: 1 },
      { group: 'furniture', count: 1 },
    ])
    expect(s.topBranches).toEqual([
      { branchId: 'br_1', name: 'HQ', count: 2 },
      { branchId: 'br_2', name: 'West', count: 2 },
    ])
  })

  it('loadAssignmentActivity returns assign/return rows newest-first with assetId from after', async () => {
    const rows = await makeRepo().loadAssignmentActivity(8)
    expect(rows).toEqual([
      { auditId: 'au_3', assetId: 'a_2', action: 'returned', actorUid: 'u_1', at: '2026-06-10T00:00:00.000Z' },
      { auditId: 'au_2', assetId: 'a_1', action: 'assigned', actorUid: 'u_1', at: '2026-06-09T00:00:00.000Z' },
    ])
  })

  it('loadAssignmentActivity respects limit', async () => {
    const rows = await makeRepo().loadAssignmentActivity(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.auditId).toBe('au_3')
  })

  it('loadWorkstationLicenseStats splits free/inUse/retired', async () => {
    const s = await makeRepo().loadWorkstationLicenseStats()
    expect(s).toEqual({ total: 3, free: 1, inUse: 1, retired: 1 })
  })

  it('loadServerLicenseCount', async () => {
    expect(await makeRepo().loadServerLicenseCount()).toBe(7)
  })

  it('loadPeopleStats omits pending when not requested', async () => {
    expect(await makeRepo().loadPeopleStats(false)).toEqual({ employeeCount: 42, pendingUsersCount: null })
    expect(await makeRepo().loadPeopleStats(true)).toEqual({ employeeCount: 42, pendingUsersCount: 3 })
  })

  it('loadRecentAudit returns newest-first, limited', async () => {
    const rows = await makeRepo().loadRecentAudit(2)
    expect(rows.map(r => r.id)).toEqual(['au_3', 'au_2'])
  })
})
