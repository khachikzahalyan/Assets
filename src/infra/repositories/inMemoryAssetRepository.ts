import type {
  Asset, AssetListQuery, AssetSort, AssetGroupFilter,
} from '@/domain/asset'
import type { AssetRepository, AssetReferenceData } from '@/domain/asset'

const SORTERS: Record<AssetSort, (a: Asset, b: Asset) => number> = {
  updated_desc: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  updated_asc: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
  name_asc: (a, b) => nameOf(a).localeCompare(nameOf(b), 'ru'),
  name_desc: (a, b) => nameOf(b).localeCompare(nameOf(a), 'ru'),
  inv_asc: (a, b) => a.invCode.localeCompare(b.invCode),
}
function nameOf(a: Asset): string {
  return [a.brand, a.model].filter(Boolean).join(' ') || a.invCode
}

/** In-memory read adapter for tests/dev. Same query semantics as the Firestore adapter. */
export class InMemoryAssetRepository implements AssetRepository {
  constructor(
    private readonly assets: Asset[],
    private readonly ref: AssetReferenceData,
  ) {}

  async listAssets(query: AssetListQuery): Promise<Asset[]> {
    const group: AssetGroupFilter = query.group ?? 'all'
    const catGroup = new Map(this.ref.categories.map(c => [c.id, c.group]))
    const search = (query.search ?? '').trim().toLowerCase()
    const result = this.assets.filter(a => {
      if (group !== 'all' && catGroup.get(a.categoryId) !== group) return false
      if (query.statusId && query.statusId !== 'all' && a.statusId !== query.statusId) return false
      if (query.branchId && query.branchId !== 'all' && a.branchId !== query.branchId) return false
      if (search) {
        const hay = [a.invCode, a.brand, a.model, a.serial].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
    return [...result].sort(SORTERS[query.sort ?? 'updated_desc'])
  }

  async loadReferenceData(): Promise<AssetReferenceData> {
    return this.ref
  }
}
