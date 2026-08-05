/**
 * FirestoreDashboardRepository — unit tests using vi.mock to stub firebase/firestore.
 *
 * Strategy: use vi.hoisted() to declare mock functions before the vi.mock() factory
 * runs (vi.mock is hoisted to the top of the file by Vitest's transformer).
 * Each test configures mockGetDocs to return a canned snapshot, then asserts
 * the reduced output and, where relevant, verifies the query constraints.
 *
 * NOTE: loadAssignmentActivity, loadServerLicenseCount, loadRecentAuditRows are
 * deprecated (removed in T6). Their tests have been removed. Thorough tests for the
 * new methods (loadRecentEvents, loadRecentPartInstalls, loadDomainCounts) are
 * written by the test-engineer in a follow-up task.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Declare mocks via vi.hoisted so they are available inside the vi.mock factory
// ---------------------------------------------------------------------------
const {
  mockCollection,
  mockDoc,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockFsQuery,
  mockGetDocs,
  mockGetDoc,
  mockGetCountFromServer,
  MockTimestamp,
} = vi.hoisted(() => ({
  mockCollection: vi.fn((_db: unknown, name: string) => ({ __col: name })),
  mockDoc:        vi.fn((_db: unknown, col: string, id: string) => ({ __docRef: `${col}/${id}` })),
  mockWhere:      vi.fn((...args: unknown[]) => ({ __where: args })),
  mockOrderBy:    vi.fn((...args: unknown[]) => ({ __orderBy: args })),
  mockLimit:      vi.fn((n: number) => ({ __limit: n })),
  mockFsQuery:    vi.fn((_col: unknown, ...constraints: unknown[]) => ({ __query: constraints })),
  mockGetDocs:    vi.fn(),
  mockGetDoc:     vi.fn(),
  mockGetCountFromServer: vi.fn(),
  MockTimestamp:  { fromDate: vi.fn((d: Date) => ({ __ts: d.toISOString() })) },
}))

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc:        mockDoc,
  getDocs:    mockGetDocs,
  getDoc:     mockGetDoc,
  query:      mockFsQuery,
  where:      mockWhere,
  orderBy:    mockOrderBy,
  limit:      mockLimit,
  Timestamp:  MockTimestamp,
  getCountFromServer: mockGetCountFromServer,
}))

// Import AFTER mocking
import { FirestoreDashboardRepository } from './firestoreDashboardRepository'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fake QuerySnapshot */
function makeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    size: docs.length,
    docs: docs.map(d => ({
      id: d.id,
      data: () => d.data,
    })),
  }
}

const fakeDb = {} as Firestore

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const assetDocs = [
  { id: 'a_1', data: { categoryId: 'cat_laptop', statusId: 'st_assigned',  branchId: 'br_1' } },
  { id: 'a_2', data: { categoryId: 'cat_laptop', statusId: 'st_warehouse', branchId: 'br_1' } },
  { id: 'a_3', data: { categoryId: 'cat_router', statusId: 'st_repair',    branchId: 'br_2' } },
  { id: 'a_4', data: { categoryId: 'cat_desk',   statusId: 'st_disposed',  branchId: 'br_2' } },
]

const branchDocs = [
  { id: 'br_1', data: { name: 'HQ' } },
  { id: 'br_2', data: { name: 'West' } },
]

const categoryDocs = [
  { id: 'cat_laptop', data: { name: 'Laptop', group: 'devices',   lucideIcon: 'laptop'  } },
  { id: 'cat_router', data: { name: 'Router', group: 'network',   lucideIcon: 'router'  } },
  { id: 'cat_desk',   data: { name: 'Desk',   group: 'furniture', lucideIcon: 'table-2' } },
]

const licenseDocs = [
  { id: 'l_1', data: { lifecycleStatus: 'active',  assignmentType: 'unassigned' } },
  { id: 'l_2', data: { lifecycleStatus: 'active',  assignmentType: 'device'     } },
  { id: 'l_3', data: { lifecycleStatus: 'retired', assignmentType: 'unassigned' } },
]

const employeeDocs = Array.from({ length: 42 }, (_, i) => ({
  id: `emp_${i + 1}`, data: { email: `e${i}@test.com` },
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FirestoreDashboardRepository', () => {

  // ── loadRecentEvents ───────────────────────────────────────────────────────

  describe('loadRecentEvents', () => {
    const sinceIso = '2026-07-01T00:00:00.000Z'

    it('builds the query with Timestamp.fromDate(new Date(sinceIso)), orderBy desc, and default cap 250', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap([]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      await repo.loadRecentEvents(sinceIso)

      // Timestamp.fromDate must have been called with new Date(sinceIso)
      expect(MockTimestamp.fromDate).toHaveBeenCalledWith(new Date(sinceIso))
      const expectedTs = { __ts: new Date(sinceIso).toISOString() }

      expect(mockWhere).toHaveBeenCalledWith('at', '>=', expectedTs)
      expect(mockOrderBy).toHaveBeenCalledWith('at', 'desc')
      expect(mockLimit).toHaveBeenCalledWith(250)
    })

    it('respects an explicit cap argument', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap([]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      await repo.loadRecentEvents(sinceIso, 50)

      expect(mockLimit).toHaveBeenCalledWith(50)
    })

    it('queries the audit_logs collection', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap([]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      await repo.loadRecentEvents(sinceIso)

      expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'audit_logs')
    })

    it('maps docs to AuditLog shape, omitting actorName when absent (legacy docs)', async () => {
      const auditDocs = [
        {
          id: 'ev_1',
          data: {
            entityType: 'asset', entityId: 'a_1', action: 'created',
            actorUid: 'u_1', actorRole: 'asset_admin',
            before: null, after: { brand: 'Dell' }, comment: null,
            at: '2026-07-02T10:00:00.000Z',
            actorName: 'Alice Smith',
          },
        },
        {
          id: 'ev_2',
          data: {
            entityType: 'employee', entityId: 'emp_1', action: 'created',
            actorUid: 'u_2', actorRole: 'super_admin',
            before: null, after: { firstName: 'Bob' }, comment: null,
            at: '2026-07-01T08:00:00.000Z',
            // actorName intentionally absent — the key must be omitted (legacy
            // doc contract: undefined = absent, null = explicitly stored null)
          },
        },
      ]
      mockGetDocs.mockResolvedValueOnce(makeSnap(auditDocs))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const events = await repo.loadRecentEvents(sinceIso)

      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({
        id: 'ev_1',
        entityType: 'asset',
        entityId: 'a_1',
        action: 'created',
        actorUid: 'u_1',
        actorRole: 'asset_admin',
        actorName: 'Alice Smith',
      })
      // actorName absent in Firestore doc → key omitted (conditional-spread,
      // matches the canonical firestoreAuditLogRepository mapper)
      expect(events[1]).toMatchObject({ id: 'ev_2' })
      expect('actorName' in events[1]!).toBe(false)
    })
  })

  // ── loadRecentPartInstalls ─────────────────────────────────────────────────

  describe('loadRecentPartInstalls', () => {
    const sinceIso = '2026-07-01T00:00:00.000Z'

    it('builds the query with Timestamp.fromDate(new Date(sinceIso)), orderBy desc, and default cap 200', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap([]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      await repo.loadRecentPartInstalls(sinceIso)

      expect(MockTimestamp.fromDate).toHaveBeenCalledWith(new Date(sinceIso))
      const expectedTs = { __ts: new Date(sinceIso).toISOString() }

      expect(mockWhere).toHaveBeenCalledWith('at', '>=', expectedTs)
      expect(mockOrderBy).toHaveBeenCalledWith('at', 'desc')
      expect(mockLimit).toHaveBeenCalledWith(200)
    })

    it('respects an explicit cap argument', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap([]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      await repo.loadRecentPartInstalls(sinceIso, 30)

      expect(mockLimit).toHaveBeenCalledWith(30)
    })

    it('queries the part_movements collection', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap([]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      await repo.loadRecentPartInstalls(sinceIso)

      expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'part_movements')
    })

    it('client-side filters: install type kept, receive/uninstall/service dropped', async () => {
      const movementDocs = [
        { id: 'mv_1', data: { type: 'install',   skuId: 'sku_1', qty: 1, broken: false, assetId: 'a_1', assetInvCode: 'INV/001', serviceReplace: false, note: null, reason: null, actorUid: 'u', actorRole: 'tech_admin', at: '2026-07-02T10:00:00.000Z' } },
        { id: 'mv_2', data: { type: 'receive',   skuId: 'sku_1', qty: 5, broken: false, assetId: null,  assetInvCode: null,      serviceReplace: false, note: null, reason: null, actorUid: 'u', actorRole: 'tech_admin', at: '2026-07-02T09:00:00.000Z' } },
        { id: 'mv_3', data: { type: 'uninstall', skuId: 'sku_2', qty: 1, broken: false, assetId: 'a_1', assetInvCode: 'INV/001', serviceReplace: false, note: null, reason: null, actorUid: 'u', actorRole: 'tech_admin', at: '2026-07-02T08:00:00.000Z' } },
        { id: 'mv_4', data: { type: 'service',   skuId: 'sku_3', qty: 1, broken: false, assetId: 'a_2', assetInvCode: 'INV/002', serviceReplace: false, note: null, reason: null, actorUid: 'u', actorRole: 'tech_admin', at: '2026-07-02T07:00:00.000Z' } },
        { id: 'mv_5', data: { type: 'install',   skuId: 'sku_4', qty: 2, broken: false, assetId: 'a_3', assetInvCode: 'INV/003', serviceReplace: false, note: null, reason: null, actorUid: 'u', actorRole: 'tech_admin', at: '2026-07-01T06:00:00.000Z' } },
      ]
      mockGetDocs.mockResolvedValueOnce(makeSnap(movementDocs))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const installs = await repo.loadRecentPartInstalls(sinceIso)

      // Only type==='install' docs survive the client-side filter
      expect(installs).toHaveLength(2)
      expect(installs.map(m => m.id)).toEqual(['mv_1', 'mv_5'])
      expect(installs.every(m => m.type === 'install')).toBe(true)
    })
  })

  // ── loadDomainCounts ──────────────────────────────────────────────────────

  describe('loadDomainCounts', () => {
    function makeCountSnap(n: number) {
      return { data: () => ({ count: n }) }
    }

    it('returns counts from aggregates and sums partsUnits from parts docs', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce(makeCountSnap(4))  // branches
        .mockResolvedValueOnce(makeCountSnap(3))  // departments
        .mockResolvedValueOnce(makeCountSnap(2))  // subscriptions
        .mockResolvedValueOnce(makeCountSnap(1))  // licenses(type==Subscription)
      mockGetDocs.mockResolvedValueOnce(makeSnap([
        { id: 'p1', data: { name: 'RAM 8GB', onHand: 10 } },
        { id: 'p2', data: { name: 'SSD 512', onHand: 5  } },
      ]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const res = await repo.loadDomainCounts()

      expect(res.counts.branches).toBe(4)
      expect(res.counts.departments).toBe(3)
      // subscriptions = SaaS subscriptions (2) + Subscription-type licenses (1)
      expect(res.counts.subscriptions).toBe(3)
      expect(res.counts.partsUnits).toBe(15)
    })

    it('builds partNames map from parts docs with fallback to doc id when name is blank', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce(makeCountSnap(0))
        .mockResolvedValueOnce(makeCountSnap(0))
        .mockResolvedValueOnce(makeCountSnap(0))
        .mockResolvedValueOnce(makeCountSnap(0))
      mockGetDocs.mockResolvedValueOnce(makeSnap([
        { id: 'p1', data: { name: 'RAM 8GB', onHand: 2 } },
        { id: 'p2', data: { name: '',        onHand: 0 } },  // blank name → falls back to id
      ]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const res = await repo.loadDomainCounts()

      expect(res.partNames).toEqual({ p1: 'RAM 8GB', p2: 'p2' })
    })

    it('per-count degradation: subscriptions getCountFromServer rejects → counts.subscriptions === null, others are numbers', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce(makeCountSnap(4))          // branches ✓
        .mockResolvedValueOnce(makeCountSnap(3))          // departments ✓
        .mockRejectedValueOnce(new Error('permission-denied'))  // subscriptions ✗
        .mockResolvedValueOnce(makeCountSnap(1))          // subLics ✓
      mockGetDocs.mockResolvedValueOnce(makeSnap([]))     // parts ✓

      const repo = new FirestoreDashboardRepository(fakeDb)
      const res = await repo.loadDomainCounts()

      // subscriptions is null because subsCount is null (subs rejected) even though subLicCount resolved
      expect(res.counts.subscriptions).toBeNull()
      // Other counts are unaffected
      expect(res.counts.branches).toBe(4)
      expect(res.counts.departments).toBe(3)
      expect(res.counts.partsUnits).toBe(0)
    })

    it('per-count degradation: parts getDocs rejects → partsUnits === null and partNames === {}', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce(makeCountSnap(2))
        .mockResolvedValueOnce(makeCountSnap(1))
        .mockResolvedValueOnce(makeCountSnap(5))
        .mockResolvedValueOnce(makeCountSnap(0))
      mockGetDocs.mockRejectedValueOnce(new Error('firestore-offline'))  // parts read fails

      const repo = new FirestoreDashboardRepository(fakeDb)
      const res = await repo.loadDomainCounts()

      expect(res.counts.partsUnits).toBeNull()
      expect(res.partNames).toEqual({})
      // Count aggregates are unaffected
      expect(res.counts.branches).toBe(2)
      expect(res.counts.departments).toBe(1)
      expect(res.counts.subscriptions).toBe(5)
    })

    it('queries licenses collection with where(type==Subscription) for subscription license aggregate', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce(makeCountSnap(0))
        .mockResolvedValueOnce(makeCountSnap(0))
        .mockResolvedValueOnce(makeCountSnap(0))
        .mockResolvedValueOnce(makeCountSnap(0))
      mockGetDocs.mockResolvedValueOnce(makeSnap([]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      await repo.loadDomainCounts()

      expect(mockWhere).toHaveBeenCalledWith('type', '==', 'Subscription')
      expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'licenses')
    })
  })

  // ── loadAssetStats ─────────────────────────────────────────────────────────

  describe('loadAssetStats', () => {
    it('reduces 4 asset docs + ref to AssetStats matching expected numbers', async () => {
      // getDocs is called for: assets, branches, categories (via Promise.all)
      mockGetDocs
        .mockResolvedValueOnce(makeSnap(assetDocs))    // assets
        .mockResolvedValueOnce(makeSnap(branchDocs))   // branches
        .mockResolvedValueOnce(makeSnap(categoryDocs)) // categories

      const repo = new FirestoreDashboardRepository(fakeDb)
      const s = await repo.loadAssetStats(5)

      expect(s.total).toBe(4)
      expect(s.byStatus).toEqual({
        st_warehouse: 1, st_pending: 0, st_assigned: 1, st_repair: 1, st_disposed: 1,
      })
      expect(s.byGroup).toEqual([
        { group: 'devices',   count: 2 },
        { group: 'network',   count: 1 },
        { group: 'furniture', count: 1 },
      ])
      expect(s.topBranches).toEqual([
        { branchId: 'br_1', name: 'HQ',   count: 2 },
        { branchId: 'br_2', name: 'West', count: 2 },
      ])
    })
  })

  describe('loadWorkstationLicenseStats', () => {
    it('splits 3 license docs into free/inUse/retired correctly', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap(licenseDocs))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const s = await repo.loadWorkstationLicenseStats()

      expect(s).toEqual({ total: 3, free: 1, inUse: 1, retired: 1 })
    })
  })

  describe('loadPeopleStats', () => {
    it('counts employees and does NOT query users', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap(employeeDocs))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const stats = await repo.loadPeopleStats()

      expect(stats).toEqual({ employeeCount: 42 })
      expect(mockGetDocs).toHaveBeenCalledTimes(1)
      expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'employees')
      const collectionNames = (mockCollection.mock.calls as unknown[][]).map(c => c[1] as string)
      expect(collectionNames).not.toContain('users')
    })
  })
})
