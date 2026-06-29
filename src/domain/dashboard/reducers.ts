import type { Asset, AssetReferenceData } from '@/domain/asset'
import { isAssetStatusId } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { AssetStats, AssignmentActivityRow, WorkstationLicenseStats, AssetGroup } from './types'
import { ASSET_GROUPS, EMPTY_STATUS_COUNTS } from './types'

/** Asset fields needed to enrich an assignment activity row. */
export interface AssetActivityInfo {
  brand: string | null
  model: string | null
  invCode: string
  assignedEmployeeId: string | null
}

/** Employee fields needed to resolve a recipient display name. */
export interface EmployeeActivityInfo {
  firstName: string | null
  lastName: string | null
}

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

/**
 * Filters assignment assign/return rows and maps to enriched activity rows.
 * Caller sorts + slices. assetMap / employeeMap default to empty Maps so the
 * function remains usable without lookup data (labels fall back to raw IDs).
 */
export function mapAssignmentActivity(
  rows: AuditLog[],
  assetMap: Map<string, AssetActivityInfo> = new Map(),
  employeeMap: Map<string, EmployeeActivityInfo> = new Map(),
): AssignmentActivityRow[] {
  return rows
    .filter(l => l.entityType === 'assignment' && (l.action === 'assigned' || l.action === 'returned'))
    .map(l => {
      const afterData = l.after as Record<string, unknown> | null
      const beforeData = l.before as Record<string, unknown> | null
      const assetId = String(afterData?.assetId ?? '')

      // assetLabel: prefer «brand model», else invCode, else assetId
      const info = assetMap.get(assetId)
      let assetLabel: string
      if (info) {
        const brandModel = [info.brand, info.model].filter(Boolean).join(' ').trim()
        assetLabel = brandModel || info.invCode || assetId
      } else {
        assetLabel = assetId
      }

      // recipientName: for assigned→after state or current asset assignment;
      //                for returned→before state (prior holder), else null
      let employeeId: string | null = null
      if (l.action === 'assigned') {
        const fromAfter = String(afterData?.assignedToEmployeeId ?? afterData?.employeeId ?? '').trim()
        employeeId = fromAfter || info?.assignedEmployeeId || null
      } else {
        const fromBefore = String(beforeData?.assignedToEmployeeId ?? beforeData?.employeeId ?? '').trim()
        employeeId = fromBefore || null
      }

      const emp = employeeId ? employeeMap.get(employeeId) : undefined
      const recipientName = emp
        ? ([emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || null)
        : null

      return {
        auditId: l.id,
        assetId,
        action: l.action as 'assigned' | 'returned',
        actorUid: l.actorUid,
        at: l.at,
        assetLabel,
        recipientName,
      }
    })
}

/**
 * Derives a concise human-readable label for an audit log entry from the
 * entity type and the available before/after data. Best-effort: falls back
 * to entityId or entityType when the relevant fields are absent.
 */
export function resolveTargetLabel(log: AuditLog): string {
  const after = log.after
  switch (log.entityType) {
    case 'asset': {
      const b = String(after?.brand ?? '').trim()
      const m = String(after?.model ?? '').trim()
      const label = [b, m].filter(Boolean).join(' ')
      return label || String(after?.invCode ?? '').trim() || log.entityId
    }
    case 'employee': {
      const f = String(after?.firstName ?? '').trim()
      const la = String(after?.lastName ?? '').trim()
      return [f, la].filter(Boolean).join(' ') || log.entityId
    }
    case 'assignment': {
      return String(after?.assetId ?? log.entityId)
    }
    case 'branch':
    case 'department':
    case 'category': {
      return String(after?.name ?? '').trim() || log.entityId
    }
    default:
      return log.entityType
  }
}
