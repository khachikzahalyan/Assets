/**
 * Unit tests for FirestoreCategoryGroupRepository using vi.mock to stub firebase/firestore.
 * Mirrors the mocking approach from firestoreAssetRepository.categoryCaps.test.ts.
 *
 * withAudit is mocked to call the mutate function so that create/delete
 * paths execute fully (including readback) without a real Firestore connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase/firestore'
import { EntityInUseError } from '@/domain/shared'

// ---------------------------------------------------------------------------
// vi.hoisted — declare mocks before the vi.mock() factory runs
// ---------------------------------------------------------------------------
const { mockGetDocs, mockCollection, mockDoc, mockGetDoc, mockWhere, mockLimit, mockFsQuery } =
  vi.hoisted(() => ({
    mockGetDocs: vi.fn(),
    mockCollection: vi.fn((_db: unknown, name: string) => ({ __col: name })),
    mockDoc: vi.fn(() => ({ id: 'grp_new' })),
    mockGetDoc: vi.fn(),
    mockWhere: vi.fn((...args: unknown[]) => ({ __where: args })),
    mockLimit: vi.fn((n: number) => ({ __limit: n })),
    mockFsQuery: vi.fn((_col: unknown, ...constraints: unknown[]) => ({ __query: constraints })),
  }))

// ---------------------------------------------------------------------------
// firebase/firestore mock
// ---------------------------------------------------------------------------
vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDocs: mockGetDocs,
  getDoc: mockGetDoc,
  query: mockFsQuery,
  where: mockWhere,
  limit: mockLimit,
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}))

// ---------------------------------------------------------------------------
// @/lib/audit mock — withAudit calls mutate so create/delete paths work fully
// ---------------------------------------------------------------------------
vi.mock('@/lib/audit', () => ({
  firestoreAuditContext: vi.fn(() => ({})),
  withAudit: vi.fn(async (
    _ctx: unknown,
    _spec: unknown,
    mutate: (txn: { set: () => void; delete: () => void }) => Promise<{ value: unknown }>,
  ) => {
    const result = await mutate({ set: vi.fn(), delete: vi.fn() })
    return { ...result, auditId: 'fake-audit-id' }
  }),
}))

// ---------------------------------------------------------------------------
// Import AFTER mocking
// ---------------------------------------------------------------------------
import { FirestoreCategoryGroupRepository } from './firestoreCategoryGroupRepository'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    empty: docs.length === 0,
    docs: docs.map(d => ({
      id: d.id,
      data: () => d.data,
      exists: () => true,
    })),
  }
}

function makeDocSnap(id: string, data: Record<string, unknown>) {
  return { exists: () => true, id, data: () => data }
}

const fakeDb = {} as Firestore
const actor = { uid: 'u1', role: 'super_admin' as const }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('FirestoreCategoryGroupRepository', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('listCategoryGroups returns groups sorted by order then name', async () => {
    mockGetDocs.mockResolvedValueOnce(makeSnap([
      { id: 'g1', data: { name: 'Devices', behavior: 'devices', lucideIcon: 'monitor', color: 'blue', order: 2 } },
      { id: 'g2', data: { name: 'Furniture', behavior: 'furniture', lucideIcon: 'armchair', color: 'green', order: 1 } },
    ]))
    const repo = new FirestoreCategoryGroupRepository(fakeDb)
    const groups = await repo.listCategoryGroups()
    expect(groups[0]!.id).toBe('g2') // order 1 first
    expect(groups[1]!.id).toBe('g1')
    expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'categoryGroups')
  })

  it('createCategoryGroup: isNameTaken query → empty → write → readback', async () => {
    // isNameTaken getDocs → empty
    mockGetDocs.mockResolvedValueOnce(makeSnap([]))
    // readback getDoc after withAudit
    mockGetDoc.mockResolvedValueOnce(makeDocSnap('grp_new', {
      name: 'Network', behavior: 'network', lucideIcon: 'package', color: 'gray', order: 0,
      createdAt: 't', updatedAt: 't',
    }))

    const repo = new FirestoreCategoryGroupRepository(fakeDb)
    const { value, auditId } = await repo.createCategoryGroup({ name: 'Network', behavior: 'network' }, actor)

    expect(value.name).toBe('Network')
    expect(value.behavior).toBe('network')
    expect(auditId).toBe('fake-audit-id')
    expect(mockWhere).toHaveBeenCalledWith('name', '==', 'Network')
    expect(mockLimit).toHaveBeenCalledWith(2) // isNameTaken uses limit(2)
  })

  it('countReferences queries categories collection where categoryGroupId == id', async () => {
    mockGetDocs.mockResolvedValueOnce(makeSnap([{ id: 'c1', data: { categoryGroupId: 'g1' } }]))
    const repo = new FirestoreCategoryGroupRepository(fakeDb)
    const count = await repo.countReferences('g1')
    expect(count).toBe(1)
    expect(mockWhere).toHaveBeenCalledWith('categoryGroupId', '==', 'g1')
    expect(mockCollection).toHaveBeenCalledWith(fakeDb, 'categories')
    expect(mockLimit).toHaveBeenCalledWith(1)
  })

  it('countReferences returns 0 when no categories reference the group', async () => {
    mockGetDocs.mockResolvedValueOnce(makeSnap([]))
    const repo = new FirestoreCategoryGroupRepository(fakeDb)
    const count = await repo.countReferences('g2')
    expect(count).toBe(0)
  })

  it('deleteCategoryGroup throws EntityInUseError when categories reference the group', async () => {
    // getCategoryGroup getDoc
    mockGetDoc.mockResolvedValueOnce(makeDocSnap('g1', {
      name: 'Devices', behavior: 'devices', lucideIcon: 'monitor', color: 'blue', order: 0,
      createdAt: 't', updatedAt: 't',
    }))
    // countReferences getDocs → 1 category references the group
    mockGetDocs.mockResolvedValueOnce(makeSnap([{ id: 'c1', data: { categoryGroupId: 'g1' } }]))

    const repo = new FirestoreCategoryGroupRepository(fakeDb)
    await expect(repo.deleteCategoryGroup('g1', actor)).rejects.toThrow(EntityInUseError)
  })
})
