import type { AuditLog } from '@/domain/audit'
import type { PartMovement } from '@/domain/part/types'
import type { AssetStats, WorkstationLicenseStats, PeopleStats, DomainCountsResult } from './types'

/**
 * READ-ONLY aggregation port for the role dashboards. No mutation methods.
 */
export interface DashboardRepository {
  loadAssetStats(topBranches?: number): Promise<AssetStats>
  loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats>
  loadPeopleStats(): Promise<PeopleStats>
  /** Окно audit_logs: at >= since (Timestamp!), desc, limit cap (умолч. DASHBOARD_AUDIT_CAP). */
  loadRecentEvents(sinceIso: string, cap?: number): Promise<AuditLog[]>
  /** Окно part_movements: at >= since, desc, limit cap; клиентский фильтр type==='install'. */
  loadRecentPartInstalls(sinceIso: string, cap?: number): Promise<PartMovement[]>
  /** Count-агрегаты + карта имён SKU. Per-count деградация в null (subscriptions у asset_admin). */
  loadDomainCounts(): Promise<DomainCountsResult>
}
