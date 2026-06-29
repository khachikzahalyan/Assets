/**
 * Tests for FirestoreAssetRepository.loadReferenceData() resilience.
 *
 * The former_employees read is fail-soft: a permission-denied (or any other)
 * rejection must NOT propagate — the method must resolve with an empty
 * formerEmps list while returning valid data for all other collections.
 *
 * The in-memory cache must NOT be poisoned by a rejection: a second call after
 * a failure must retry Firebase instead of replaying the same rejected promise.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase/firestore'

const { mockGetDocs, mockCollection, mockDoc, mockGetDoc } = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => ({})),
  mockDoc: vi.fn(() => ({})),
  mockGetDoc: vi.fn(),
}))

vi.mock('firebase/firestore', async (importActual) => {
  const actual = await importActual<typeof import('firebase/firestore')>()
  return {
    ...actual,
    collection: mockCollection,
    doc: mockDoc,
    getDocs: mockGetDocs,
    getDoc: mockGetDoc,
    query: vi.fn((...args: unknown[]) => args),
    where: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
    runTransaction: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn()),
  }
})

vi.mock('@/lib/firebase', () => ({
  db: {} as Firestore,
  auth: {},
  storage: {},
  functions: {},
  app: {},
}))

vi.mock('@/lib/audit', () => ({
  firestoreAuditContext: vi.fn(() => ({})),
  withAudit: vi.fn(),
}))

import { FirestoreAssetRepository } from './firestoreAssetRepository'

function makeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map(d => ({
      id: d.id,
      data: () => d.data,
      exists: () => true,
    })),
  }
}

/** Set up mockGetDocs for the 6 legs of fetchReferenceData in order:
 *  asset_statuses, branches, departments, categories, employees, former_employees
 */
function mockRefDataLegs({
  formerRejects = false,
  formerDocs = [] as Array<{ id: string; data: Record<string, unknown> }>,
} = {}) {
  const statusSnap   = makeSnap([{ id: 'st_1', data: { name: 'Active', color: 'green' } }])
  const branchSnap   = makeSnap([{ id: 'br_1', data: { name: 'HQ' } }])
  const deptSnap     = makeSnap([{ id: 'dep_1', data: { name: 'IT' } }])
  const catSnap      = makeSnap([{ id: 'cat_1', data: { name: 'PC', group: 'devices', lucideIcon: 'monitor' } }])
  const empSnap      = makeSnap([{ id: 'emp_1', data: { firstName: 'Alice', lastName: 'Smith', email: 'a@x.com', departmentId: null, position: null } }])

  mockGetDocs
    .mockResolvedValueOnce(statusSnap)   // asset_statuses
    .mockResolvedValueOnce(branchSnap)   // branches
    .mockResolvedValueOnce(deptSnap)     // departments
    .mockResolvedValueOnce(catSnap)      // categories
    .mockResolvedValueOnce(empSnap)      // employees

  if (formerRejects) {
    mockGetDocs.mockRejectedValueOnce(
      Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }),
    )
  } else {
    mockGetDocs.mockResolvedValueOnce(makeSnap(formerDocs))
  }
}

describe('FirestoreAssetRepository — loadReferenceData resilience', () => {
  let repo: FirestoreAssetRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new FirestoreAssetRepository({} as Firestore)
  })

  it('resolves with active employees when former_employees read rejects (permission-denied)', async () => {
    mockRefDataLegs({ formerRejects: true })

    const ref = await repo.loadReferenceData()

    // Core ref data must be intact
    expect(ref.statuses).toHaveLength(1)
    expect(ref.branches).toHaveLength(1)
    expect(ref.departments).toHaveLength(1)
    expect(ref.categories).toHaveLength(1)

    // Active employees are present, no crash
    expect(ref.employees).toHaveLength(1)
    expect(ref.employees[0]!.id).toBe('emp_1')
  })

  it('merges active + former employees when former_employees read succeeds', async () => {
    mockRefDataLegs({
      formerDocs: [
        { id: 'ex_1', data: { firstName: 'Bob', lastName: 'Jones', email: 'b@x.com', departmentId: null, position: null } },
      ],
    })

    const ref = await repo.loadReferenceData()
    expect(ref.employees).toHaveLength(2)
    const ids = ref.employees.map(e => e.id)
    expect(ids).toContain('emp_1')
    expect(ids).toContain('ex_1')
  })

  it('cache is cleared when a CORE read fails, allowing retry on next call', async () => {
    // Simulate a core collection (employees) failing — this causes fetchReferenceData
    // to reject. The refCache must be cleared so a retry is possible.
    const statusSnap = makeSnap([{ id: 'st_1', data: { name: 'Active', color: 'green' } }])
    const branchSnap = makeSnap([{ id: 'br_1', data: { name: 'HQ' } }])
    const deptSnap   = makeSnap([{ id: 'dep_1', data: { name: 'IT' } }])
    const catSnap    = makeSnap([{ id: 'cat_1', data: { name: 'PC', group: 'devices', lucideIcon: 'monitor' } }])
    const empSnap    = makeSnap([{ id: 'emp_1', data: { firstName: 'Alice', lastName: 'Smith', email: 'a@x.com', departmentId: null, position: null } }])

    // First call: 'employees' (5th leg) rejects — core failure, should propagate.
    mockGetDocs
      .mockResolvedValueOnce(statusSnap)
      .mockResolvedValueOnce(branchSnap)
      .mockResolvedValueOnce(deptSnap)
      .mockResolvedValueOnce(catSnap)
      .mockRejectedValueOnce(new Error('Network error'))  // employees fails

    await expect(repo.loadReferenceData()).rejects.toThrow('Network error')

    // The cache must be cleared after rejection. A second call must retry Firebase.
    mockGetDocs
      .mockResolvedValueOnce(statusSnap)
      .mockResolvedValueOnce(branchSnap)
      .mockResolvedValueOnce(deptSnap)
      .mockResolvedValueOnce(catSnap)
      .mockResolvedValueOnce(empSnap)   // employees succeeds this time
      .mockResolvedValueOnce(makeSnap([])) // former_employees: empty

    const result = await repo.loadReferenceData()
    expect(result.employees).toHaveLength(1)
    expect(result.employees[0]!.id).toBe('emp_1')
  })

  it('deduplicates: an employee present in both collections appears only once', async () => {
    // emp_1 exists in both collections (e.g. an un-cleaned archive doc)
    const statusSnap = makeSnap([{ id: 'st_1', data: { name: 'Active', color: 'green' } }])
    const branchSnap = makeSnap([{ id: 'br_1', data: { name: 'HQ' } }])
    const deptSnap   = makeSnap([{ id: 'dep_1', data: { name: 'IT' } }])
    const catSnap    = makeSnap([{ id: 'cat_1', data: { name: 'PC', group: 'devices', lucideIcon: 'monitor' } }])
    const empSnap    = makeSnap([{ id: 'emp_1', data: { firstName: 'Alice', lastName: 'Smith', email: 'a@x.com', departmentId: null, position: null } }])
    const formerSnap = makeSnap([
      { id: 'emp_1', data: { firstName: 'Alice', lastName: 'Smith', email: 'a@x.com', departmentId: null, position: null } },
      { id: 'ex_2',  data: { firstName: 'Carol', lastName: 'Li',    email: 'c@x.com', departmentId: null, position: null } },
    ])

    mockGetDocs
      .mockResolvedValueOnce(statusSnap)
      .mockResolvedValueOnce(branchSnap)
      .mockResolvedValueOnce(deptSnap)
      .mockResolvedValueOnce(catSnap)
      .mockResolvedValueOnce(empSnap)
      .mockResolvedValueOnce(formerSnap)

    const ref = await repo.loadReferenceData()
    const ids = ref.employees.map(e => e.id)
    // emp_1 from active takes precedence; ex_2 is appended
    expect(ids.filter(id => id === 'emp_1')).toHaveLength(1)
    expect(ids).toContain('ex_2')
    expect(ref.employees).toHaveLength(2)
  })
})
