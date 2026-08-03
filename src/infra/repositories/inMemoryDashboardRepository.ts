import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { PartMovement } from '@/domain/part/types'
import type { Part } from '@/domain/part/types'
import type { DashboardRepository } from '@/domain/dashboard'
import type {
  AssetStats, WorkstationLicenseStats, PeopleStats, DomainCountsResult,
} from '@/domain/dashboard'
import {
  reduceAssetStats, reduceWorkstationLicenseStats,
  DASHBOARD_AUDIT_CAP, DASHBOARD_MOVEMENTS_CAP,
} from '@/domain/dashboard'

export interface InMemoryDashboardSeed {
  assets: Asset[]
  ref: AssetReferenceData
  workstationLicenses: WorkstationLicense[]
  employeeCount: number
  auditLogs: AuditLog[]
  parts?: Part[]
  partMovements?: PartMovement[]
  subscriptionCount?: number
}

/** In-memory aggregation adapter for tests/dev. Reduces the same docs the Firestore
 *  adapter reads, so the two produce identical numbers. */
export class InMemoryDashboardRepository implements DashboardRepository {
  constructor(private readonly seed: InMemoryDashboardSeed) {}

  async loadAssetStats(topBranches = 5): Promise<AssetStats> {
    return reduceAssetStats(this.seed.assets, this.seed.ref, topBranches)
  }

  async loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats> {
    return reduceWorkstationLicenseStats(this.seed.workstationLicenses)
  }

  async loadPeopleStats(): Promise<PeopleStats> {
    return { employeeCount: this.seed.employeeCount }
  }

  async loadRecentEvents(sinceIso: string, cap = DASHBOARD_AUDIT_CAP): Promise<AuditLog[]> {
    return [...this.seed.auditLogs]
      .filter(l => l.at >= sinceIso)
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .slice(0, cap)
  }

  async loadRecentPartInstalls(sinceIso: string, cap = DASHBOARD_MOVEMENTS_CAP): Promise<PartMovement[]> {
    return (this.seed.partMovements ?? [])
      .filter(m => m.at >= sinceIso && m.type === 'install')
      .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
      .slice(0, cap)
  }

  async loadDomainCounts(): Promise<DomainCountsResult> {
    const parts = this.seed.parts ?? []
    let partsUnits = 0
    const partNames: Record<string, string> = {}
    for (const p of parts) {
      partsUnits += p.onHand
      partNames[p.id] = p.name.trim() || p.id
    }

    // branches: no status filter (mirrors the production FirestoreBranchRepository which
    // counts all docs without filtering by status)
    const branches = this.seed.ref.branches.length
    const departments = this.seed.ref.departments.length

    const subscriptionCount = this.seed.subscriptionCount ?? 0
    const subLicCount = this.seed.workstationLicenses.filter(l => l.type === 'Subscription').length
    const subscriptions = subscriptionCount + subLicCount

    return {
      counts: {
        partsUnits,
        branches,
        departments,
        subscriptions,
      },
      partNames,
    }
  }
}
