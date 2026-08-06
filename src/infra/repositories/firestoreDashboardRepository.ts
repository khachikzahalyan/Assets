import {
  collection, getDocs, query as fsQuery, where, orderBy, limit as fsLimit,
  Timestamp, getCountFromServer,
  type Firestore,
  type AggregateQuerySnapshot,
  type AggregateField,
} from 'firebase/firestore'
import type { CategoryRow, RefRow, StatusRow, EmployeeRow } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { PartMovement } from '@/domain/part/types'
import type { DashboardRepository } from '@/domain/dashboard'
import type {
  AssetStats, WorkstationLicenseStats, PeopleStats, DomainCountsResult,
} from '@/domain/dashboard'
import {
  reduceAssetStats, reduceWorkstationLicenseStats, reducePeopleStats,
  DASHBOARD_AUDIT_CAP, DASHBOARD_MOVEMENTS_CAP,
} from '@/domain/dashboard'
import type { EmployeeForStats } from '@/domain/dashboard'
import { toMovement } from './firestorePartRepository.mappers'
import { toIso } from './firestoreUtils'

export class FirestoreDashboardRepository implements DashboardRepository {
  constructor(private readonly db: Firestore) {}

  async loadAssetStats(topBranches = 5): Promise<AssetStats> {
    const [assetsSnap, ref] = await Promise.all([
      getDocs(collection(this.db, 'assets')),
      this.loadAssetRef(),
    ])
    const assets = assetsSnap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return {
        id: d.id,
        categoryId: String(x.categoryId ?? ''),
        statusId: String(x.statusId ?? ''),
        branchId: String(x.branchId ?? ''),
        updatedAt: toIso(x.updatedAt),
        invCode: String(x.invCode ?? ''),
        brand: (x.brand as string | null) ?? null,
        model: (x.model as string | null) ?? null,
      }
    })
    return reduceAssetStats(assets, ref, topBranches)
  }

  private async loadAssetRef(): Promise<AssetReferenceData> {
    const [branches, categories] = await Promise.all([
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<CategoryRow>('categories', d => ({
        name: String(d.name ?? ''),
        categoryGroupId: String(d.categoryGroupId ?? d.group ?? 'devices'),
        group: (d.group as CategoryRow['group']) ?? 'devices',
        lucideIcon: String(d.lucideIcon ?? 'package'),
      })),
    ])
    return {
      statuses:       [] as StatusRow[],
      branches,
      departments:    [],
      categories,
      employees:      [] as EmployeeRow[],
      categoryGroups: [],
    }
  }

  async loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats> {
    const snap = await getDocs(collection(this.db, 'licenses'))
    const rows = snap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return {
        lifecycleStatus: ((x.lifecycleStatus as WorkstationLicense['lifecycleStatus']) ?? 'active'),
        assignmentType: ((x.assignmentType as WorkstationLicense['assignmentType']) ?? 'unassigned'),
      }
    })
    return reduceWorkstationLicenseStats(rows)
  }

  async loadPeopleStats(): Promise<PeopleStats> {
    const employeesSnap = await getDocs(collection(this.db, 'employees'))
    const rows: EmployeeForStats[] = employeesSnap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return {
        id: d.id,
        status: ((x.status as 'active' | 'terminated') ?? 'active'),
      }
    })
    return reducePeopleStats(rows)
  }

  async loadRecentEvents(sinceIso: string, cap = DASHBOARD_AUDIT_CAP): Promise<AuditLog[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'audit_logs'),
      where('at', '>=', Timestamp.fromDate(new Date(sinceIso))),
      orderBy('at', 'desc'),
      fsLimit(cap),
    ))
    return snap.docs.map(d => this.toAuditLog(d.id, d.data() as Record<string, unknown>))
  }

  async loadRecentPartInstalls(sinceIso: string, cap = DASHBOARD_MOVEMENTS_CAP): Promise<PartMovement[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'part_movements'),
      where('at', '>=', Timestamp.fromDate(new Date(sinceIso))),
      orderBy('at', 'desc'),
      fsLimit(cap),
    ))
    return snap.docs
      .map(d => toMovement(d.id, d.data() as Record<string, unknown>))
      .filter(m => m.type === 'install')
  }

  async loadDomainCounts(): Promise<DomainCountsResult> {
    // branches: listBranches has no status filter in the production adapter — count all.
    const [branches, departments, subs, subLics, partsSnap] = await Promise.allSettled([
      getCountFromServer(collection(this.db, 'branches')),
      getCountFromServer(collection(this.db, 'departments')),
      getCountFromServer(collection(this.db, 'subscriptions')),
      getCountFromServer(fsQuery(collection(this.db, 'licenses'), where('type', '==', 'Subscription'))),
      getDocs(collection(this.db, 'parts')),
    ])

    let partsUnits: number | null = null
    const partNames: Record<string, string> = {}
    if (partsSnap.status === 'fulfilled') {
      partsUnits = 0
      for (const d of partsSnap.value.docs) {
        const x = d.data() as Record<string, unknown>
        partsUnits += Number(x.onHand ?? 0)
        partNames[d.id] = String(x.name ?? '').trim() || d.id
      }
    }

    const count = (r: PromiseSettledResult<AggregateQuerySnapshot<{ count: AggregateField<number> }>>) =>
      r.status === 'fulfilled' ? r.value.data().count : null

    const subsCount = count(subs)
    const subLicCount = count(subLics)

    return {
      counts: {
        partsUnits,
        branches: count(branches),
        departments: count(departments),
        // subscriptions = SaaS subscriptions + licenses of type 'Subscription'
        subscriptions: subsCount !== null && subLicCount !== null ? subsCount + subLicCount : null,
      },
      partNames,
    }
  }

  private toAuditLog(id: string, x: Record<string, unknown>): AuditLog {
    return {
      id,
      entityType: x.entityType as AuditLog['entityType'],
      entityId: String(x.entityId ?? ''),
      action: x.action as AuditLog['action'],
      actorUid: String(x.actorUid ?? ''),
      actorRole: x.actorRole as AuditLog['actorRole'],
      before: (x.before as AuditLog['before']) ?? null,
      after: (x.after as AuditLog['after']) ?? null,
      comment: (x.comment as string | null) ?? null,
      ...(x.actorName !== undefined ? { actorName: x.actorName as string | null } : {}),
      at: toIso(x.at),
    }
  }

  private async readCol<T extends { id: string }>(
    name: string,
    map: (d: Record<string, unknown>) => Omit<T, 'id'>,
  ): Promise<T[]> {
    const snap = await getDocs(collection(this.db, name))
    return snap.docs.map(d => ({ ...map(d.data() as Record<string, unknown>), id: d.id } as T))
  }

}
