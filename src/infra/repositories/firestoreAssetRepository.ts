import {
  collection, getDocs, query as fsQuery, where, orderBy,
  type Firestore, type QueryConstraint,
} from 'firebase/firestore'
import type {
  Asset, AssetListQuery, AssetSort, CategoryRow, StatusRow, RefRow, EmployeeRow,
} from '@/domain/asset'
import type { AssetRepository, AssetReferenceData } from '@/domain/asset'

const SERVER_SORT: Record<AssetSort, [string, 'asc' | 'desc']> = {
  updated_desc: ['updatedAt', 'desc'],
  updated_asc: ['updatedAt', 'asc'],
  name_asc: ['brand', 'asc'],
  name_desc: ['brand', 'desc'],
  inv_asc: ['invCode', 'asc'],
}

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toAsset(id: string, d: Record<string, unknown>): Asset {
  return {
    id,
    categoryId: String(d.categoryId ?? ''),
    brand: (d.brand as string | null) ?? null,
    model: (d.model as string | null) ?? null,
    invCode: String(d.invCode ?? ''),
    serial: (d.serial as string | null) ?? null,
    statusId: String(d.statusId ?? ''),
    assignment: (d.assignment as Asset['assignment']) ?? null,
    branchId: String(d.branchId ?? ''),
    deptId: (d.deptId as string | null) ?? null,
    updatedAt: toIso(d.updatedAt),
    currentSpecs: (d.currentSpecs as Asset['currentSpecs']) ?? null,
  }
}

/**
 * Production read adapter. Status + branch equality filters and the sort field run
 * server-side (composite indexes — see firestore.indexes.json). Group (needs a
 * category lookup) and free-text search run client-side over the returned set,
 * matching the org-scale dataset (hundreds of assets).
 */
export class FirestoreAssetRepository implements AssetRepository {
  constructor(private readonly db: Firestore) {}

  // FIX 4: instance-level cache so loadReferenceData() is fetched at most once
  // per repository instance, regardless of how many callers (listAssets group filter
  // + useAssets hook) call it concurrently.
  private refCache: Promise<AssetReferenceData> | null = null

  async listAssets(query: AssetListQuery): Promise<Asset[]> {
    const cons: QueryConstraint[] = []
    if (query.statusId && query.statusId !== 'all') cons.push(where('statusId', '==', query.statusId))
    if (query.branchId && query.branchId !== 'all') cons.push(where('branchId', '==', query.branchId))
    const [field, dir] = SERVER_SORT[query.sort ?? 'updated_desc']
    cons.push(orderBy(field, dir))
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), ...cons))
    let rows = snap.docs.map(d => toAsset(d.id, d.data() as Record<string, unknown>))

    if (query.group && query.group !== 'all') {
      const ref = await this.loadReferenceData()
      const catGroup = new Map(ref.categories.map(c => [c.id, c.group]))
      rows = rows.filter(a => catGroup.get(a.categoryId) === query.group)
    }
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(a =>
        [a.invCode, a.brand, a.model, a.serial].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
    }
    return rows
  }

  async loadReferenceData(): Promise<AssetReferenceData> {
    if (!this.refCache) this.refCache = this.fetchReferenceData()
    return this.refCache
  }

  private async fetchReferenceData(): Promise<AssetReferenceData> {
    const [statuses, branches, departments, categories, employees] = await Promise.all([
      this.readCol<StatusRow>('asset_statuses', d => ({ name: String(d.name ?? ''), color: String(d.color ?? 'gray') })),
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<RefRow>('departments', d => ({ name: String(d.name ?? '') })),
      this.readCol<CategoryRow>('categories', d => ({
        name: String(d.name ?? ''),
        group: (d.group as CategoryRow['group']) ?? 'devices',
        lucideIcon: String(d.lucideIcon ?? 'package'),
      })),
      this.readCol<EmployeeRow>('employees', d => ({
        firstName: (d.firstName as string | null) ?? null,
        lastName: (d.lastName as string | null) ?? null,
      })),
    ])
    return { statuses, branches, departments, categories, employees }
  }

  // FIX 7: mapper returns Omit<T,'id'> — no id:'' placeholder needed.
  // The id is always spread in from d.id after mapping.
  private async readCol<T extends { id: string }>(
    name: string, map: (d: Record<string, unknown>) => Omit<T, 'id'>,
  ): Promise<T[]> {
    const snap = await getDocs(collection(this.db, name))
    return snap.docs.map(d => ({ ...map(d.data() as Record<string, unknown>), id: d.id } as T))
  }
}
