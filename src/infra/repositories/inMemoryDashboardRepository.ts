import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { DashboardRepository } from '@/domain/dashboard'
import type {
  AssetStats, AssignmentActivityRow, WorkstationLicenseStats, PeopleStats, DashboardAuditRow,
} from '@/domain/dashboard'
import {
  reduceAssetStats, reduceWorkstationLicenseStats, mapAssignmentActivity, resolveTargetLabel,
} from '@/domain/dashboard'

export interface InMemoryDashboardSeed {
  assets: Asset[]
  ref: AssetReferenceData
  workstationLicenses: WorkstationLicense[]
  serverLicenseCount: number
  employeeCount: number
  pendingUsersCount: number
  auditLogs: AuditLog[]
  /** Optional: uid → name map for actor name resolution in audit rows. */
  users?: Array<{ id: string; firstName: string | null; lastName: string | null }>
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

    const assetMap = new Map(this.seed.assets.map(a => [a.id, {
      brand: a.brand,
      model: a.model,
      invCode: a.invCode,
      assignedEmployeeId: a.assignment?.mode === 'employee' ? (a.assignment.employeeId ?? null) : null,
    }]))

    const employeeMap = new Map(this.seed.ref.employees.map(e => [e.id, {
      firstName: e.firstName,
      lastName: e.lastName,
    }]))

    return mapAssignmentActivity(sorted, assetMap, employeeMap).slice(0, limitN)
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

  async loadRecentAuditRows(limitN = 8): Promise<DashboardAuditRow[]> {
    const logs = [...this.seed.auditLogs]
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .slice(0, limitN)

    const userMap = new Map((this.seed.users ?? []).map(u => [u.id, u]))

    return logs.map(log => {
      const user = userMap.get(log.actorUid)
      const actorName = user
        ? ([user.firstName, user.lastName].filter(Boolean).join(' ').trim() || log.actorRole)
        : log.actorRole

      return {
        id: log.id,
        action: log.action,
        actorName,
        targetLabel: resolveTargetLabel(log),
        at: log.at,
      }
    })
  }
}
