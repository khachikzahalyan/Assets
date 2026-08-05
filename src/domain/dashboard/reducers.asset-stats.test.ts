/**
 * Unit tests for reduceAssetStats (reducers.ts).
 *
 * Focuses on byStatus counting — including the st_disposed bucket that backs
 * the «Списанные активы» KPI tile added to the dashboard.
 *
 * No Firebase, no React.  Pure domain function.
 */

import { describe, it, expect } from 'vitest'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset'
import { ASSET_STATUS } from '@/domain/asset'
import { reduceAssetStats } from './reducers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AssetForStats = Pick<Asset, 'id' | 'categoryId' | 'statusId' | 'branchId' | 'updatedAt'>

function makeAsset(id: string, statusId: string, opts: { categoryId?: string; branchId?: string } = {}): AssetForStats {
  return {
    id,
    categoryId: opts.categoryId ?? 'cat_laptop',
    statusId,
    branchId: opts.branchId ?? 'br_1',
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}

/** Minimal ref that satisfies reduceAssetStats without any lookup lookups. */
const EMPTY_REF: AssetReferenceData = {
  statuses:       [],
  branches:       [],
  departments:    [],
  categories:     [],
  employees:      [],
  categoryGroups: [],
}

// ═══════════════════════════════════════════════════════════════════════════════
// byStatus counting
// ═══════════════════════════════════════════════════════════════════════════════

describe('reduceAssetStats — byStatus counting', () => {

  // ── (a) mixed statuses ─────────────────────────────────────────────────────

  it('counts each status bucket correctly across a mixed set', () => {
    // Arrange — 5 assets: 2 disposed, 1 assigned, 1 warehouse, 1 repair
    const assets: AssetForStats[] = [
      makeAsset('a1', ASSET_STATUS.disposed),
      makeAsset('a2', ASSET_STATUS.disposed),
      makeAsset('a3', ASSET_STATUS.assigned),
      makeAsset('a4', ASSET_STATUS.warehouse),
      makeAsset('a5', ASSET_STATUS.repair),
    ]

    // Act
    const stats = reduceAssetStats(assets, EMPTY_REF, 5)

    // Assert
    expect(stats.byStatus[ASSET_STATUS.disposed]).toBe(2)
    expect(stats.byStatus[ASSET_STATUS.assigned]).toBe(1)
    expect(stats.byStatus[ASSET_STATUS.warehouse]).toBe(1)
    expect(stats.byStatus[ASSET_STATUS.repair]).toBe(1)
    expect(stats.byStatus[ASSET_STATUS.pending]).toBe(0)
  })

  it('total includes disposed assets (disposed ARE part of the total count)', () => {
    // Arrange — 5 assets of which 2 are disposed
    const assets: AssetForStats[] = [
      makeAsset('a1', ASSET_STATUS.disposed),
      makeAsset('a2', ASSET_STATUS.disposed),
      makeAsset('a3', ASSET_STATUS.assigned),
      makeAsset('a4', ASSET_STATUS.warehouse),
      makeAsset('a5', ASSET_STATUS.repair),
    ]

    // Act
    const stats = reduceAssetStats(assets, EMPTY_REF, 5)

    // Assert
    expect(stats.total).toBe(5)
  })

  // ── (b) flipping one asset to disposed increments the counter ──────────────

  it('flipping a non-disposed asset to disposed increments byStatus[disposed] by 1 and keeps total the same', () => {
    // Arrange — base set: 1 disposed, 2 assigned
    const base: AssetForStats[] = [
      makeAsset('a1', ASSET_STATUS.disposed),
      makeAsset('a2', ASSET_STATUS.assigned),
      makeAsset('a3', ASSET_STATUS.assigned),
    ]

    const statsBefore = reduceAssetStats(base, EMPTY_REF, 5)

    // Flip a2 from assigned → disposed
    const after: AssetForStats[] = [
      makeAsset('a1', ASSET_STATUS.disposed),
      makeAsset('a2', ASSET_STATUS.disposed),   // <-- flipped
      makeAsset('a3', ASSET_STATUS.assigned),
    ]

    // Act
    const statsAfter = reduceAssetStats(after, EMPTY_REF, 5)

    // Assert — disposed count grew by 1
    expect(statsAfter.byStatus[ASSET_STATUS.disposed]).toBe(statsBefore.byStatus[ASSET_STATUS.disposed] + 1)
    // Total stays the same (same number of assets)
    expect(statsAfter.total).toBe(statsBefore.total)
  })

  // ── (c) unknown statusId ───────────────────────────────────────────────────

  it('unknown statusId is NOT counted in any byStatus bucket but IS counted in total', () => {
    // Arrange — one well-known status + one completely unknown status id
    const assets: AssetForStats[] = [
      makeAsset('a1', ASSET_STATUS.warehouse),
      makeAsset('a2', 'st_unknown_future_status'),   // not in ASSET_STATUS_IDS
    ]

    // Act
    const stats = reduceAssetStats(assets, EMPTY_REF, 5)

    // Assert — total counts both
    expect(stats.total).toBe(2)
    // The unknown id does not appear as an own-key with a non-zero value in byStatus
    const unknownCount = (stats.byStatus as Record<string, number>)['st_unknown_future_status']
    expect(unknownCount).toBeUndefined()
    // Known statuses are unaffected
    expect(stats.byStatus[ASSET_STATUS.warehouse]).toBe(1)
  })

  // ── edge cases ─────────────────────────────────────────────────────────────

  it('returns zero totals and zeroed byStatus for an empty assets array', () => {
    // Arrange / Act
    const stats = reduceAssetStats([], EMPTY_REF, 5)

    // Assert
    expect(stats.total).toBe(0)
    expect(stats.byStatus[ASSET_STATUS.disposed]).toBe(0)
    expect(stats.byStatus[ASSET_STATUS.assigned]).toBe(0)
    expect(stats.byStatus[ASSET_STATUS.warehouse]).toBe(0)
    expect(stats.byStatus[ASSET_STATUS.repair]).toBe(0)
    expect(stats.byStatus[ASSET_STATUS.pending]).toBe(0)
  })

  it('single disposed asset gives total 1 and byStatus[disposed] === 1', () => {
    // Arrange
    const assets: AssetForStats[] = [makeAsset('a1', ASSET_STATUS.disposed)]

    // Act
    const stats = reduceAssetStats(assets, EMPTY_REF, 5)

    // Assert
    expect(stats.total).toBe(1)
    expect(stats.byStatus[ASSET_STATUS.disposed]).toBe(1)
    // All other status buckets are zeroed
    expect(stats.byStatus[ASSET_STATUS.assigned]).toBe(0)
    expect(stats.byStatus[ASSET_STATUS.warehouse]).toBe(0)
    expect(stats.byStatus[ASSET_STATUS.repair]).toBe(0)
    expect(stats.byStatus[ASSET_STATUS.pending]).toBe(0)
  })

  it('all assets disposed — byStatus[disposed] equals total', () => {
    // Arrange
    const assets: AssetForStats[] = [
      makeAsset('a1', ASSET_STATUS.disposed),
      makeAsset('a2', ASSET_STATUS.disposed),
      makeAsset('a3', ASSET_STATUS.disposed),
    ]

    // Act
    const stats = reduceAssetStats(assets, EMPTY_REF, 5)

    // Assert
    expect(stats.byStatus[ASSET_STATUS.disposed]).toBe(3)
    expect(stats.total).toBe(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// topBranches — basic sanity (ref with branches)
// ═══════════════════════════════════════════════════════════════════════════════

describe('reduceAssetStats — topBranches', () => {
  const ref: AssetReferenceData = {
    statuses:       [],
    branches:       [{ id: 'br_1', name: 'HQ' }, { id: 'br_2', name: 'West' }],
    departments:    [],
    categories:     [],
    employees:      [],
    categoryGroups: [],
  }

  it('returns top N branches sorted descending by count', () => {
    // Arrange — 3 in br_1, 1 in br_2
    const assets: AssetForStats[] = [
      makeAsset('a1', ASSET_STATUS.assigned,  { branchId: 'br_1' }),
      makeAsset('a2', ASSET_STATUS.warehouse, { branchId: 'br_1' }),
      makeAsset('a3', ASSET_STATUS.disposed,  { branchId: 'br_1' }),
      makeAsset('a4', ASSET_STATUS.assigned,  { branchId: 'br_2' }),
    ]

    // Act
    const stats = reduceAssetStats(assets, ref, 2)

    // Assert
    expect(stats.topBranches).toHaveLength(2)
    expect(stats.topBranches[0]?.branchId).toBe('br_1')
    expect(stats.topBranches[0]?.count).toBe(3)
    expect(stats.topBranches[1]?.branchId).toBe('br_2')
    expect(stats.topBranches[1]?.count).toBe(1)
  })

  it('respects the topBranches limit', () => {
    // Arrange — 2 branches but limit = 1
    const assets: AssetForStats[] = [
      makeAsset('a1', ASSET_STATUS.assigned,  { branchId: 'br_1' }),
      makeAsset('a2', ASSET_STATUS.assigned,  { branchId: 'br_2' }),
    ]

    // Act
    const stats = reduceAssetStats(assets, ref, 1)

    // Assert
    expect(stats.topBranches).toHaveLength(1)
  })
})
