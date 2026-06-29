import type { AssetStatusId } from '@/domain/asset'
import { ASSET_STATUS_IDS } from '@/domain/asset'
import type { AuditAction } from '@/domain/audit'

export type AssetGroup = 'devices' | 'network' | 'furniture'
export const ASSET_GROUPS: readonly AssetGroup[] = ['devices', 'network', 'furniture']

export interface BranchCount { branchId: string; name: string; count: number }
export interface GroupCount { group: AssetGroup; count: number }

export interface AssetStats {
  total: number
  byStatus: Record<AssetStatusId, number>
  byGroup: GroupCount[]
  topBranches: BranchCount[]
}

export interface AssignmentActivityRow {
  auditId: string
  assetId: string
  action: 'assigned' | 'returned'
  actorUid: string
  at: string
  /** Human-readable label: «{brand} {model}», else invCode, else assetId. */
  assetLabel: string
  /** Display name of assignee (assigned) or prior holder (returned); null if unresolvable. */
  recipientName: string | null
}

export interface AssignmentActivity {
  currentlyOut: number
  recent: AssignmentActivityRow[]
}

export interface WorkstationLicenseStats {
  total: number
  free: number
  inUse: number
  retired: number
}

export interface PeopleStats {
  employeeCount: number
  pendingUsersCount: number | null
}

/** Enriched audit row for the dashboard audit table. Does NOT mutate the shared AuditLog type. */
export interface DashboardAuditRow {
  id: string
  action: AuditAction
  /** Best-effort display name of the actor; falls back to actorRole if unresolvable. */
  actorName: string
  /** Concise label for the affected entity (brand+model, employee name, etc.); falls back to entityType. */
  targetLabel: string
  at: string
}

export interface DashboardData {
  assets: AssetStats | null
  assignments: AssignmentActivity | null
  workstationLicenses: WorkstationLicenseStats | null
  serverLicenseCount: number | null
  people: PeopleStats | null
  recentAudit: DashboardAuditRow[] | null
}

/** Template of zeroed per-status counts. Spread (`{ ...EMPTY_STATUS_COUNTS }`) before mutating. */
export const EMPTY_STATUS_COUNTS: Record<AssetStatusId, number> = ASSET_STATUS_IDS.reduce(
  (acc, id) => { acc[id] = 0; return acc },
  {} as Record<AssetStatusId, number>,
)

export function emptyAssetStats(): AssetStats {
  return {
    total: 0,
    byStatus: { ...EMPTY_STATUS_COUNTS },
    byGroup: ASSET_GROUPS.map(group => ({ group, count: 0 })),
    topBranches: [],
  }
}
