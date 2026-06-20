import type {
  AssetStats, AssignmentActivityRow, WorkstationLicenseStats, PeopleStats,
} from './types'
import type { AuditLog } from '@/domain/audit'

/**
 * READ-ONLY aggregation port for the role dashboards. No mutation methods.
 * Each method is independently role-gated AT THE CALL SITE (the useDashboard hook):
 * a method a role cannot use is never invoked, so its data is never fetched.
 */
export interface DashboardRepository {
  loadAssetStats(topBranches?: number): Promise<AssetStats>
  loadAssignmentActivity(limitN?: number): Promise<AssignmentActivityRow[]>
  loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats>
  /** super_admin only (caller-gated). */
  loadServerLicenseCount(): Promise<number>
  /** pendingUsersCount queried only when includePending (super_admin). */
  loadPeopleStats(includePending: boolean): Promise<PeopleStats>
  /** super_admin only (caller-gated). Newest first. Keys already masked upstream. */
  loadRecentAudit(limitN?: number): Promise<AuditLog[]>
}
