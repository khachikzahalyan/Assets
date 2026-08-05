import { describe, it, expect } from 'vitest'
import { InMemoryDashboardRepository } from './inMemoryDashboardRepository'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { EmployeeForStats } from '@/domain/dashboard'

function asset(
  id: string,
  statusId: string,
  categoryId: string,
  branchId: string,
  employeeId?: string,
): Asset {
  return {
    id, categoryId, brand: 'B', model: 'M', invCode: `INV/${id}`, serial: null,
    statusId,
    assignment: employeeId ? { mode: 'employee', employeeId } : null,
    branchId, deptId: null, updatedAt: '2026-06-01T00:00:00.000Z',
    currentSpecs: null,
  }
}

const ref: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'Warehouse', color: 'gray' },
    { id: 'st_assigned', name: 'Assigned', color: 'green' },
    { id: 'st_repair', name: 'In Repair', color: 'orange' },
    { id: 'st_pending', name: 'Pending', color: 'violet' },
    { id: 'st_disposed', name: 'Disposed', color: 'red' },
  ],
  branches: [{ id: 'br_1', name: 'HQ' }, { id: 'br_2', name: 'West' }],
  departments: [],
  categories: [
    { id: 'cat_laptop', name: 'Laptop', group: 'devices',   categoryGroupId: 'grp_devices',   lucideIcon: 'laptop' },
    { id: 'cat_router', name: 'Router', group: 'network',   categoryGroupId: 'grp_network',   lucideIcon: 'router' },
    { id: 'cat_desk',   name: 'Desk',   group: 'furniture', categoryGroupId: 'grp_furniture', lucideIcon: 'table-2' },
  ],
  employees: [
    { id: 'emp_1', firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' },
  ],
  categoryGroups: [],
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

// 42 active employees (matches the previous employeeCount: 42 behaviour)
const employees42: EmployeeForStats[] = Array.from({ length: 42 }, (_, i) => ({
  id: `emp_seed_${i + 1}`,
  status: 'active' as const,
}))

function makeRepo() {
  return new InMemoryDashboardRepository({
    assets: [
      // a_1 is assigned to emp_1 so recipientName resolves
      asset('a_1', 'st_assigned', 'cat_laptop', 'br_1', 'emp_1'),
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
    employees: employees42,
    auditLogs: auditRows,
  })
}

describe('InMemoryDashboardRepository', () => {
  it('loadAssetStats totals, byStatus, byGroup, topBranches', async () => {
    const s = await makeRepo().loadAssetStats(5)
    expect(s.total).toBe(4)
    expect(s.byStatus).toEqual({ st_warehouse: 1, st_pending: 0, st_assigned: 1, st_repair: 1, st_disposed: 1 })
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

  it('loadWorkstationLicenseStats splits free/inUse/retired', async () => {
    const s = await makeRepo().loadWorkstationLicenseStats()
    expect(s).toEqual({ total: 3, free: 1, inUse: 1, retired: 1 })
  })

  it('loadPeopleStats returns the active employee count and their ids', async () => {
    const result = await makeRepo().loadPeopleStats()
    expect(result.employeeCount).toBe(42)
    expect(result.activeEmployeeIds).toHaveLength(42)
  })

  it('loadRecentEvents filters by sinceIso and sorts desc', async () => {
    const since = '2026-06-09T00:00:00.000Z'
    const rows = await makeRepo().loadRecentEvents(since)
    // au_3 (2026-06-10) and au_2 (2026-06-09) are >= since; au_1 (2026-06-08) is not
    expect(rows).toHaveLength(2)
    expect(rows[0]!.id).toBe('au_3')
    expect(rows[1]!.id).toBe('au_2')
  })

  it('loadRecentEvents respects cap', async () => {
    const since = '2026-06-01T00:00:00.000Z'
    const rows = await makeRepo().loadRecentEvents(since, 1)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('au_3')
  })

  it('loadRecentPartInstalls returns only install movements after sinceIso', async () => {
    const repo = new InMemoryDashboardRepository({
      assets: [], ref,
      workstationLicenses: [],
      employees: [],
      auditLogs: [],
      partMovements: [
        { id: 'mv_1', type: 'install', skuId: 'sku_1', qty: 1, broken: false,
          assetId: 'a_1', assetInvCode: 'INV/a_1', serviceReplace: false,
          note: null, reason: null, actorUid: 'u', actorRole: 'tech_admin',
          at: '2026-06-10T00:00:00.000Z' },
        { id: 'mv_2', type: 'receive', skuId: 'sku_1', qty: 5, broken: false,
          assetId: null, assetInvCode: null, serviceReplace: false,
          note: null, reason: null, actorUid: 'u', actorRole: 'tech_admin',
          at: '2026-06-10T00:00:00.000Z' },
        { id: 'mv_3', type: 'install', skuId: 'sku_2', qty: 1, broken: false,
          assetId: 'a_2', assetInvCode: 'INV/a_2', serviceReplace: false,
          note: null, reason: null, actorUid: 'u', actorRole: 'tech_admin',
          at: '2026-06-08T00:00:00.000Z' },
      ],
    })
    const since = '2026-06-09T00:00:00.000Z'
    const rows = await repo.loadRecentPartInstalls(since)
    // mv_1 is install after since; mv_2 is receive (filtered); mv_3 is before since
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('mv_1')
    expect(rows[0]!.type).toBe('install')
  })

  it('loadDomainCounts sums partsUnits and partNames from seed', async () => {
    const repo = new InMemoryDashboardRepository({
      assets: [], ref,
      workstationLicenses: [],
      employees: [],
      auditLogs: [],
      parts: [
        { id: 'p1', name: 'RAM 8GB', category: 'ram', variantId: null, variantLabel: null,
          ddr: null, unit: 'шт', onHand: 10, broken: 0, lowStockThreshold: 5,
          createdAt: '', updatedAt: '', createdBy: '', updatedBy: '' },
        { id: 'p2', name: 'SSD 512', category: 'ssd', variantId: null, variantLabel: null,
          ddr: null, unit: 'шт', onHand: 5, broken: 0, lowStockThreshold: 3,
          createdAt: '', updatedAt: '', createdBy: '', updatedBy: '' },
      ],
      subscriptionCount: 3,
    })
    const res = await repo.loadDomainCounts()
    expect(res.counts.partsUnits).toBe(15)
    expect(res.partNames).toEqual({ p1: 'RAM 8GB', p2: 'SSD 512' })
    expect(res.counts.branches).toBe(2)   // ref.branches.length
    expect(res.counts.departments).toBe(0) // ref.departments.length
    expect(res.counts.subscriptions).toBe(3) // subscriptionCount=3, no sub-type licenses
  })

  it('loadPeopleStats: 1 active + 1 terminated → employeeCount 1, only active id in activeEmployeeIds', async () => {
    const repo = new InMemoryDashboardRepository({
      assets: [], ref,
      workstationLicenses: [],
      employees: [
        { id: 'emp_active', status: 'active' },
        { id: 'emp_terminated', status: 'terminated' },
      ],
      auditLogs: [],
    })
    const result = await repo.loadPeopleStats()
    expect(result.employeeCount).toBe(1)
    expect(result.activeEmployeeIds).toEqual(['emp_active'])
  })
})
