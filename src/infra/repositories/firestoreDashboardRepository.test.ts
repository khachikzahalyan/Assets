/**
 * FirestoreDashboardRepository — unit tests using vi.mock to stub firebase/firestore.
 *
 * Strategy: use vi.hoisted() to declare mock functions before the vi.mock() factory
 * runs (vi.mock is hoisted to the top of the file by Vitest's transformer).
 * Each test configures mockGetDocs to return a canned snapshot, then asserts
 * the reduced output and, where relevant, verifies the query constraints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// Declare mocks via vi.hoisted so they are available inside the vi.mock factory
// ---------------------------------------------------------------------------
const {
  mockCollection,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockFsQuery,
  mockGetDocs,
} = vi.hoisted(() => ({
  mockCollection: vi.fn((_db: unknown, name: string) => ({ __col: name })),
  mockWhere:      vi.fn((...args: unknown[]) => ({ __where: args })),
  mockOrderBy:    vi.fn((...args: unknown[]) => ({ __orderBy: args })),
  mockLimit:      vi.fn((n: number) => ({ __limit: n })),
  mockFsQuery:    vi.fn((_col: unknown, ...constraints: unknown[]) => ({ __query: constraints })),
  mockGetDocs:    vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  getDocs:    mockGetDocs,
  query:      mockFsQuery,
  where:      mockWhere,
  orderBy:    mockOrderBy,
  limit:      mockLimit,
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
// Fixtures (mirror inMemoryDashboardRepository.test.ts)
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

const serverLicenseDocs = Array.from({ length: 7 }, (_, i) => ({
  id: `sl_${i + 1}`, data: {},
}))

const employeeDocs = Array.from({ length: 42 }, (_, i) => ({
  id: `emp_${i + 1}`, data: { email: `e${i}@test.com` },
}))

const pendingUserDocs = [
  { id: 'u_1', data: { status: 'no-role', email: 'a@test.com' } },
  { id: 'u_2', data: { status: 'no-role', email: 'b@test.com' } },
  { id: 'u_3', data: { status: 'no-role', email: 'c@test.com' } },
]

const auditReturned = {
  id: 'au_3', data: {
    entityType: 'assignment', entityId: 'as_3', action: 'returned',
    actorUid: 'u_1', actorRole: 'asset_admin',
    before: null, after: { assetId: 'a_2' }, comment: null,
    at: '2026-06-10T00:00:00.000Z',
  },
}
const auditAssigned = {
  id: 'au_2', data: {
    entityType: 'assignment', entityId: 'as_2', action: 'assigned',
    actorUid: 'u_1', actorRole: 'asset_admin',
    before: null, after: { assetId: 'a_1' }, comment: null,
    at: '2026-06-09T00:00:00.000Z',
  },
}
const auditOther = {
  id: 'au_1', data: {
    entityType: 'asset', entityId: 'a_1', action: 'created',
    actorUid: 'u_1', actorRole: 'asset_admin',
    before: null, after: null, comment: null,
    at: '2026-06-08T00:00:00.000Z',
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FirestoreDashboardRepository', () => {

  describe('loadAssetStats', () => {
    it('reduces 4 asset docs + ref to AssetStats matching expected numbers', async () => {
      // getDocs is called for: assets, branches, categories (via Promise.all)
      // Promise.all([assets, Promise.all([branches, categories])]) — three sequential getDocs calls
      mockGetDocs
        .mockResolvedValueOnce(makeSnap(assetDocs))    // assets
        .mockResolvedValueOnce(makeSnap(branchDocs))   // branches
        .mockResolvedValueOnce(makeSnap(categoryDocs)) // categories

      const repo = new FirestoreDashboardRepository(fakeDb)
      const s = await repo.loadAssetStats(5)

      expect(s.total).toBe(4)
      expect(s.byStatus).toEqual({
        st_warehouse: 1, st_assigned: 1, st_repair: 1, st_disposed: 1,
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

  describe('loadServerLicenseCount', () => {
    it('returns snap.size for server_licenses collection', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap(serverLicenseDocs))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const count = await repo.loadServerLicenseCount()

      expect(count).toBe(7)
      expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'server_licenses')
    })
  })

  describe('loadPeopleStats', () => {
    it('includePending=false: counts employees and returns pendingUsersCount=null without querying users', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap(employeeDocs))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const stats = await repo.loadPeopleStats(false)

      expect(stats).toEqual({ employeeCount: 42, pendingUsersCount: null })
      expect(mockGetDocs).toHaveBeenCalledTimes(1)
      expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'employees')
      const collectionNames = (mockCollection.mock.calls as unknown[][]).map(c => c[1] as string)
      expect(collectionNames).not.toContain('users')
    })

    it('includePending=true: counts employees AND pending users via where(status==no-role)', async () => {
      mockGetDocs
        .mockResolvedValueOnce(makeSnap(employeeDocs))    // employees
        .mockResolvedValueOnce(makeSnap(pendingUserDocs)) // users where status==no-role

      const repo = new FirestoreDashboardRepository(fakeDb)
      const stats = await repo.loadPeopleStats(true)

      expect(stats).toEqual({ employeeCount: 42, pendingUsersCount: 3 })
      // Verify exact query: collection('users') + where('status','==','no-role')
      expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'users')
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'no-role')
    })
  })

  describe('loadAssignmentActivity', () => {
    it('queries audit_logs with entityType==assignment + orderBy at desc + limit(limitN*2), maps assetId from after', async () => {
      // Feed newest-first (Firestore orderBy at desc guarantees this in production)
      mockGetDocs.mockResolvedValueOnce(makeSnap([auditReturned, auditAssigned, auditOther]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const rows = await repo.loadAssignmentActivity(8)

      // auditOther (entityType='asset') is filtered out by mapAssignmentActivity
      expect(rows).toHaveLength(2)
      expect(rows[0]).toMatchObject({ auditId: 'au_3', assetId: 'a_2', action: 'returned', actorUid: 'u_1' })
      expect(rows[1]).toMatchObject({ auditId: 'au_2', assetId: 'a_1', action: 'assigned', actorUid: 'u_1' })

      // Verify query constraints
      expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'audit_logs')
      expect(mockWhere).toHaveBeenCalledWith('entityType', '==', 'assignment')
      expect(mockOrderBy).toHaveBeenCalledWith('at', 'desc')
      expect(mockLimit).toHaveBeenCalledWith(16) // limitN * 2 = 8 * 2
    })
  })

  describe('loadRecentAudit', () => {
    it('queries audit_logs orderBy at desc + limit and maps to AuditLog[]', async () => {
      mockGetDocs.mockResolvedValueOnce(makeSnap([auditReturned, auditAssigned, auditOther]))

      const repo = new FirestoreDashboardRepository(fakeDb)
      const rows = await repo.loadRecentAudit(8)

      expect(rows).toHaveLength(3)
      expect(rows[0]!.id).toBe('au_3')
      expect(rows[0]!.at).toBe('2026-06-10T00:00:00.000Z')
      expect(rows[1]!.id).toBe('au_2')
      expect(rows[2]!.id).toBe('au_1')
      expect(rows[2]!.entityType).toBe('asset')

      expect(mockOrderBy).toHaveBeenCalledWith('at', 'desc')
      expect(mockLimit).toHaveBeenCalledWith(8)
      expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'audit_logs')
    })
  })
})
