import {
  collection, getDocs, query as fsQuery, where, orderBy, limit as fsLimit, type Firestore,
} from 'firebase/firestore'
import type { Asset, CategoryRow, RefRow, StatusRow, EmployeeRow } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { DashboardRepository } from '@/domain/dashboard'
import type { AssetStats, AssignmentActivityRow, WorkstationLicenseStats, PeopleStats } from '@/domain/dashboard'
import { reduceAssetStats, reduceWorkstationLicenseStats, mapAssignmentActivity } from '@/domain/dashboard'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

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
        brand: null,
        model: null,
        invCode: '',
        serial: null,
        assignment: null,
        deptId: null,
        updatedAt: toIso(x.updatedAt),
        currentSpecs: null,
      } as unknown as Asset
    })
    return reduceAssetStats(assets, ref, topBranches)
  }

  private async loadAssetRef(): Promise<AssetReferenceData> {
    const [branches, categories] = await Promise.all([
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<CategoryRow>('categories', d => ({
        name: String(d.name ?? ''),
        group: (d.group as CategoryRow['group']) ?? 'devices',
        lucideIcon: String(d.lucideIcon ?? 'package'),
      })),
    ])
    return {
      statuses: [] as StatusRow[],
      branches,
      departments: [],
      categories,
      employees: [] as EmployeeRow[],
    }
  }

  async loadAssignmentActivity(limitN = 8): Promise<AssignmentActivityRow[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'audit_logs'),
      where('entityType', '==', 'assignment'),
      orderBy('at', 'desc'),
      fsLimit(limitN * 2),
    ))
    const rows = snap.docs.map(d => this.toAuditLog(d.id, d.data() as Record<string, unknown>))
    return mapAssignmentActivity(rows).slice(0, limitN)
  }

  async loadWorkstationLicenseStats(): Promise<WorkstationLicenseStats> {
    const snap = await getDocs(collection(this.db, 'licenses'))
    const rows = snap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return {
        id: d.id,
        lifecycleStatus: (x.lifecycleStatus as WorkstationLicense['lifecycleStatus']) ?? 'active',
        assignmentType: (x.assignmentType as WorkstationLicense['assignmentType']) ?? 'unassigned',
        name: '',
        vendor: null,
        type: 'Default' as WorkstationLicense['type'],
        isReusable: true,
        createdAt: toIso(x.createdAt),
        updatedAt: toIso(x.updatedAt),
        createdBy: String(x.createdBy ?? ''),
        updatedBy: String(x.updatedBy ?? ''),
      } as unknown as WorkstationLicense
    })
    return reduceWorkstationLicenseStats(rows)
  }

  async loadServerLicenseCount(): Promise<number> {
    const snap = await getDocs(collection(this.db, 'server_licenses'))
    return snap.size
  }

  async loadPeopleStats(includePending: boolean): Promise<PeopleStats> {
    const employeesSnap = await getDocs(collection(this.db, 'employees'))
    let pendingUsersCount: number | null = null
    if (includePending) {
      // Exact query from firestoreUserRepository.listPendingUsers():
      const pendingSnap = await getDocs(fsQuery(
        collection(this.db, 'users'), where('status', '==', 'no-role'),
      ))
      pendingUsersCount = pendingSnap.size
    }
    return { employeeCount: employeesSnap.size, pendingUsersCount }
  }

  async loadRecentAudit(limitN = 8): Promise<AuditLog[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'audit_logs'),
      orderBy('at', 'desc'),
      fsLimit(limitN),
    ))
    return snap.docs.map(d => this.toAuditLog(d.id, d.data() as Record<string, unknown>))
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
