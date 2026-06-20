import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { DashboardRepository } from '@/domain/dashboard'
import type {
  AssetStats, AssignmentActivityRow, WorkstationLicenseStats, PeopleStats,
} from '@/domain/dashboard'
import { reduceAssetStats, reduceWorkstationLicenseStats, mapAssignmentActivity } from '@/domain/dashboard'

export interface InMemoryDashboardSeed {
  assets: Asset[]
  ref: AssetReferenceData
  workstationLicenses: WorkstationLicense[]
  serverLicenseCount: number
  employeeCount: number
  pendingUsersCount: number
  auditLogs: AuditLog[]
}

/** In-memory aggregation adapter for tests/dev. Reduces the same docs the Firestore
 *  adapter reads, so the two produce identical numbers. */
export class InMemoryDashboardRepository implements DashboardRepository {
  constructor(private readonly seed: InMemoryDashboardSeed) {}

  async loadAssetStats(topBranches = 5): Promise<AssetStats> {
    return reduceAssetStats(this.seed.assets, this.seed.ref, topBranches)
  }

  async loadAssignmentActivity(limitN = 8): Promise<AssignmentActivityRow[]> {
    const sorted = [...this.seed.auditLogs].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
    return mapAssignmentActivity(sorted).slice(0, limitN)
  }

  async loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats> {
    return reduceWorkstationLicenseStats(this.seed.workstationLicenses)
  }

  async loadServerLicenseCount(): Promise<number> {
    return this.seed.serverLicenseCount
  }

  async loadPeopleStats(includePending: boolean): Promise<PeopleStats> {
    return {
      employeeCount: this.seed.employeeCount,
      pendingUsersCount: includePending ? this.seed.pendingUsersCount : null,
    }
  }

  async loadRecentAudit(limitN = 8): Promise<AuditLog[]> {
    return [...this.seed.auditLogs]
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .slice(0, limitN)
  }
}
