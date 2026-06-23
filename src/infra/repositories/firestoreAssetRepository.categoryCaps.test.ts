/**
 * Unit tests for the Firestore category mapper in FirestoreAssetRepository.
 *
 * The mapper must:
 *  1. Preserve capability flags (hasSpecs / hasOemLicense / requiresSerial /
 *     hasTypeField) when the Firestore doc carries an explicit boolean.
 *  2. Omit the flag entirely (not set to undefined) when the doc lacks the field,
 *     so that `resolveCategoryCapabilities()` can fall through to the static
 *     taxonomy / heuristic. exactOptionalPropertyTypes is ON in tsconfig.app.json.
 *
 * We mock firebase/firestore at the module level so no real Firestore connection
 * is needed. The repository is instantiated with a mock Firestore instance; the
 * mocked getDocs returns whatever fake QuerySnapshot we set up per test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase/firestore'

// vi.hoisted() ensures these are initialized before vi.mock() factory runs,
// since vi.mock() calls are hoisted to the top of the file by Vitest.
const { mockGetDocs, mockCollection, mockDoc, mockGetDoc } = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => ({})),
  mockDoc: vi.fn(() => ({})),
  mockGetDoc: vi.fn(),
}))

// ---- firebase/firestore mock ------------------------------------------------
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

// ---- lib/firebase mock (returns a bare object as db) -----------------------
vi.mock('@/lib/firebase', () => ({
  db: {} as Firestore,
  auth: {},
  storage: {},
  functions: {},
  app: {},
}))

// ---- lib/audit mock (no-op withAudit) --------------------------------------
vi.mock('@/lib/audit', () => ({
  firestoreAuditContext: vi.fn(() => ({})),
  withAudit: vi.fn(),
}))

import { FirestoreAssetRepository } from './firestoreAssetRepository'

// ---- helpers ----------------------------------------------------------------

/** Build a minimal QuerySnapshot-like object from an array of { id, data } pairs. */
function makeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map(d => ({
      id: d.id,
      data: () => d.data,
      exists: () => true,
    })),
  }
}

// ---- tests ------------------------------------------------------------------

describe('FirestoreAssetRepository — category mapper', () => {
  let repo: FirestoreAssetRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new FirestoreAssetRepository({} as Firestore)
  })

  it('preserves all four capability flags when the doc carries explicit booleans', async () => {
    // Simulate a cat_computer doc with all four flags present.
    const catSnap = makeSnap([{
      id: 'cat_computer',
      data: {
        name: 'Компьютер', group: 'devices', lucideIcon: 'monitor',
        hasSpecs: true, hasOemLicense: true, requiresSerial: true, hasTypeField: false,
      },
    }])
    // loadSelfServiceRefData fetches 4 collections: statuses, categories, branches, departments
    mockGetDocs
      .mockResolvedValueOnce(makeSnap([]))   // asset_statuses
      .mockResolvedValueOnce(catSnap)         // categories
      .mockResolvedValueOnce(makeSnap([]))   // branches
      .mockResolvedValueOnce(makeSnap([]))   // departments

    const ref = await repo.loadSelfServiceRefData()
    const cat = ref.categories[0]
    expect(cat).toBeDefined()
    expect(cat!.id).toBe('cat_computer')
    expect(cat!.hasSpecs).toBe(true)
    expect(cat!.hasOemLicense).toBe(true)
    expect(cat!.requiresSerial).toBe(true)
    expect(cat!.hasTypeField).toBe(false)
  })

  it('omits capability flag keys when the doc lacks them (domain fallback can run)', async () => {
    // Doc without any capability flags — old Firestore doc before backfill.
    const catSnap = makeSnap([{
      id: 'cat_monitor',
      data: { name: 'Монитор', group: 'devices', lucideIcon: 'monitor' },
    }])
    mockGetDocs
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(catSnap)
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(makeSnap([]))

    const ref = await repo.loadSelfServiceRefData()
    const cat = ref.categories[0]
    expect(cat).toBeDefined()
    expect(cat!.id).toBe('cat_monitor')
    // Flags must be ABSENT (not present as undefined) so exactOptionalPropertyTypes is satisfied
    // and resolveCategoryCapabilities() falls through to its taxonomy / heuristic.
    expect(Object.prototype.hasOwnProperty.call(cat, 'hasSpecs')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(cat, 'hasOemLicense')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(cat, 'requiresSerial')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(cat, 'hasTypeField')).toBe(false)
  })

  it('handles false values correctly (hasTypeField:true for furniture)', async () => {
    const catSnap = makeSnap([{
      id: 'cat_desk',
      data: {
        name: 'Стол офисный', group: 'furniture', lucideIcon: 'table-2',
        hasSpecs: false, hasOemLicense: false, requiresSerial: false, hasTypeField: true,
      },
    }])
    mockGetDocs
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(catSnap)
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(makeSnap([]))

    const ref = await repo.loadSelfServiceRefData()
    const cat = ref.categories[0]
    expect(cat!.hasSpecs).toBe(false)
    expect(cat!.hasOemLicense).toBe(false)
    expect(cat!.requiresSerial).toBe(false)
    expect(cat!.hasTypeField).toBe(true)
  })

  it('partial flags: preserves only the flags that exist, omits the rest', async () => {
    // Only hasSpecs present — the other three should be absent so domain fallback applies.
    const catSnap = makeSnap([{
      id: 'cat_server',
      data: { name: 'Сервер', group: 'network', lucideIcon: 'server', hasSpecs: true },
    }])
    mockGetDocs
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(catSnap)
      .mockResolvedValueOnce(makeSnap([]))
      .mockResolvedValueOnce(makeSnap([]))

    const ref = await repo.loadSelfServiceRefData()
    const cat = ref.categories[0]
    expect(cat!.hasSpecs).toBe(true)
    // hasOemLicense, requiresSerial, hasTypeField are absent → domain fallback runs
    expect(Object.prototype.hasOwnProperty.call(cat, 'hasOemLicense')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(cat, 'requiresSerial')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(cat, 'hasTypeField')).toBe(false)
  })
})
