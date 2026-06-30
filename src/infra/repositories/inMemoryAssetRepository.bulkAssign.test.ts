import { describe, it, expect } from 'vitest'
import { InMemoryAssetRepository } from './inMemoryAssetRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { Asset, AssetReferenceData, AssetAssignment } from '@/domain/asset'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned', name: 'Выдано', color: 'green' },
  ],
  branches: [{ id: 'br_main', name: 'HQ' }],
  departments: [],
  categories: [{ id: 'cat_laptop', name: 'Laptop', group: 'devices', categoryGroupId: 'grp_devices', lucideIcon: 'laptop' }],
  employees: [{ id: 'emp_x', firstName: 'Ara', lastName: 'Petrosyan', email: 'ara@example.test' }],
  categoryGroups: [],
}

const INITIAL_ASSETS: Asset[] = [
  {
    id: 'asset_1', categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS', invCode: '450/001',
    serial: 'SN001', statusId: 'st_warehouse', assignment: null, branchId: 'br_main', deptId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'asset_2', categoryId: 'cat_laptop', brand: 'HP', model: 'EliteBook', invCode: '450/002',
    serial: 'SN002', statusId: 'st_warehouse', assignment: null, branchId: 'br_main', deptId: null,
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'asset_3', categoryId: 'cat_laptop', brand: 'Lenovo', model: 'ThinkPad', invCode: '450/003',
    serial: 'SN003', statusId: 'st_warehouse', assignment: null, branchId: 'br_main', deptId: null,
    updatedAt: '2026-01-03T00:00:00.000Z',
  },
]

const ACTOR = { uid: 'u_admin', role: 'asset_admin' as const }
const ASSIGNMENT: AssetAssignment = { mode: 'employee', employeeId: 'emp_x' }
const IDS = ['asset_1', 'asset_2', 'asset_3']

function makeRepo() {
  const store = createInMemoryAuditStore()
  // Deep-copy initial assets so each test starts from a clean state
  const assets: Asset[] = INITIAL_ASSETS.map(a => ({ ...a }))
  const repo = new InMemoryAssetRepository(assets, REF, inMemoryAuditContext(store))
  return { repo, store }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InMemoryAssetRepository.bulkChangeAssignment', () => {
  it('sets statusId to st_assigned on every targeted asset', async () => {
    // Arrange
    const { repo } = makeRepo()

    // Act
    await repo.bulkChangeAssignment(IDS, ASSIGNMENT, ACTOR)

    // Assert
    for (const id of IDS) {
      const asset = await repo.getAsset(id)
      expect(asset?.statusId, `statusId for ${id}`).toBe('st_assigned')
    }
  })

  it('updates the assignment field on every targeted asset to the passed object', async () => {
    // Arrange
    const { repo } = makeRepo()

    // Act
    await repo.bulkChangeAssignment(IDS, ASSIGNMENT, ACTOR)

    // Assert
    for (const id of IDS) {
      const asset = await repo.getAsset(id)
      expect(asset?.assignment, `assignment for ${id}`).toEqual(ASSIGNMENT)
    }
  })

  it('produces exactly one audit entry of action status_changed per asset', async () => {
    // Arrange
    const { repo } = makeRepo()

    // Act
    await repo.bulkChangeAssignment(IDS, ASSIGNMENT, ACTOR)

    // Assert — one entry per id, correct action, no extra entries
    for (const id of IDS) {
      const logs = await repo.listAudit(id)
      expect(logs, `audit entry count for ${id}`).toHaveLength(1)
      expect(logs[0]!.action, `audit action for ${id}`).toBe('status_changed')
    }
  })

  it('returns an array with length equal to ids.length and non-empty auditId per entry', async () => {
    // Arrange
    const { repo } = makeRepo()

    // Act
    const results = await repo.bulkChangeAssignment(IDS, ASSIGNMENT, ACTOR)

    // Assert — correct shape and completeness
    expect(results).toHaveLength(IDS.length)
    for (const entry of results) {
      expect(entry.auditId, 'auditId must be a non-empty string').toBeTruthy()
      expect(typeof entry.auditId).toBe('string')
    }
  })

  it('returns entries whose assetId matches the corresponding input id (same order)', async () => {
    // Arrange
    const { repo } = makeRepo()

    // Act
    const results = await repo.bulkChangeAssignment(IDS, ASSIGNMENT, ACTOR)

    // Assert — order is preserved
    expect(results.map(r => r.assetId)).toEqual(IDS)
  })

  it('accepts an optional comment without throwing', async () => {
    // Arrange
    const { repo } = makeRepo()

    // Act + Assert — should resolve without error
    await expect(
      repo.bulkChangeAssignment(IDS, ASSIGNMENT, ACTOR, 'Temporary handover — Q2 audit'),
    ).resolves.not.toThrow()
  })
})
