import type {
  AssetStats, AssignmentActivityRow, WorkstationLicenseStats, PeopleStats, DashboardAuditRow,
} from './types'

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
  /**
   * super_admin only (caller-gated). Newest first.
   * Returns enriched rows with resolved actor names and entity labels.
   */
  loadRecentAuditRows(limitN?: number): Promise<DashboardAuditRow[]>
}
