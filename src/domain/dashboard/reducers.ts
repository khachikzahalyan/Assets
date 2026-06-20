import type { Asset, AssetReferenceData } from '@/domain/asset'
import { isAssetStatusId } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { AssetStats, AssignmentActivityRow, WorkstationLicenseStats, AssetGroup } from './types'
import { ASSET_GROUPS, EMPTY_STATUS_COUNTS } from './types'

export function reduceAssetStats(assets: Asset[], ref: AssetReferenceData, topBranches: number): AssetStats {
  const byStatus = { ...EMPTY_STATUS_COUNTS }
  const catGroup = new Map(ref.categories.map(c => [c.id, c.group as AssetGroup]))
  const branchName = new Map(ref.branches.map(b => [b.id, b.name]))
  const groupCounts = new Map<AssetGroup, number>(ASSET_GROUPS.map(g => [g, 0]))
  const branchCounts = new Map<string, number>()

  for (const a of assets) {
    if (isAssetStatusId(a.statusId)) byStatus[a.statusId] += 1
    const g = catGroup.get(a.categoryId)
    if (g) groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1)
    branchCounts.set(a.branchId, (branchCounts.get(a.branchId) ?? 0) + 1)
  }

  const topB = [...branchCounts.entries()]
    .map(([branchId, count]) => ({ branchId, name: branchName.get(branchId) ?? branchId, count }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'ru'))
    .slice(0, topBranches)

  return {
    total: assets.length,
    byStatus,
    byGroup: ASSET_GROUPS.map(group => ({ group, count: groupCounts.get(group) ?? 0 })),
    topBranches: topB,
  }
}

export function reduceWorkstationLicenseStats(rows: WorkstationLicense[]): WorkstationLicenseStats {
  let free = 0, inUse = 0, retired = 0
  for (const l of rows) {
    if (l.lifecycleStatus === 'retired') retired += 1
    else if (l.assignmentType === 'unassigned') free += 1
    else inUse += 1
  }
  return { total: rows.length, free, inUse, retired }
}

/** Filters assignment assign/return rows and maps to activity rows. Caller sorts + slices. */
export function mapAssignmentActivity(rows: AuditLog[]): AssignmentActivityRow[] {
  return rows
    .filter(l => l.entityType === 'assignment' && (l.action === 'assigned' || l.action === 'returned'))
    .map(l => ({
      auditId: l.id,
      assetId: String((l.after as Record<string, unknown> | null)?.assetId ?? ''),
      action: l.action as 'assigned' | 'returned',
      actorUid: l.actorUid,
      at: l.at,
    }))
}
