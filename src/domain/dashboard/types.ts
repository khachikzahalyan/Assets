import type { AssetStatusId } from '@/domain/asset'
import { ASSET_STATUS_IDS } from '@/domain/asset'

export type AssetGroup = 'devices' | 'network' | 'furniture'
export const ASSET_GROUPS: readonly AssetGroup[] = ['devices', 'network', 'furniture']

export interface BranchCount { branchId: string; name: string; count: number }
export interface GroupCount { group: AssetGroup; count: number }

export interface AssetStats {
  total: number
  byStatus: Record<AssetStatusId, number>
  byGroup: GroupCount[]
  topBranches: BranchCount[]
}

export interface WorkstationLicenseStats {
  total: number
  free: number
  inUse: number
  retired: number
}

export interface PeopleStats {
  employeeCount: number
}

export interface DashboardData {
  assets: AssetStats | null
  workstationLicenses: WorkstationLicenseStats | null
  people: PeopleStats | null
  counts: DomainCounts | null
  boxes: Record<DomainBoxKey, DomainBoxData> | null
}

/** Template of zeroed per-status counts. Spread (`{ ...EMPTY_STATUS_COUNTS }`) before mutating. */
export const EMPTY_STATUS_COUNTS: Record<AssetStatusId, number> = ASSET_STATUS_IDS.reduce(
  (acc, id) => { acc[id] = 0; return acc },
  {} as Record<AssetStatusId, number>,
)

export function emptyAssetStats(): AssetStats {
  return {
    total: 0,
    byStatus: { ...EMPTY_STATUS_COUNTS },
    byGroup: ASSET_GROUPS.map(group => ({ group, count: 0 })),
    topBranches: [],
  }
}

// ── Domain boxes (dashboard redesign 2026-07-31) ──────────────────────────────

export type DomainBoxKey = 'assets' | 'employees' | 'parts' | 'subscriptions' | 'branches' | 'departments'

export const DOMAIN_BOX_KEYS: readonly DomainBoxKey[] = [
  'assets', 'employees', 'parts', 'subscriptions', 'branches', 'departments',
]

/** Одна строка ленты бокса. */
export interface DomainEventVM {
  id: string                  // auditId | movementId
  primary: string             // label сущности / запчасти (fallback-цепочка, никогда не пустой)
  secondary: string | null    // actorName (у part_movements всегда null)
  at: string                  // ISO
  linkTo?: string             // маршрут; страница убирает при отсутствии canAccess
}

export interface DomainBoxData {
  key: DomainBoxKey
  delta7d: number
  days: number[]              // ровно 7, [0]=6 дней назад … [6]=сегодня
  events: DomainEventVM[]     // ≤ 6, desc
}

/**
 * Поля nullable per-count: /subscriptions read закрыт для asset_admin
 * (firestore.rules PII-обоснование) — счётчик деградирует в null («—» в UI),
 * остальные боксы живут.
 */
export interface DomainCounts {
  partsUnits: number | null
  branches: number | null
  departments: number | null
  subscriptions: number | null   // subscriptions count + licenses(type=='Subscription') count
}

/** Результат loadDomainCounts: счётчики + карта имён SKU (каталог parts уже прочитан для Σ onHand). */
export interface DomainCountsResult {
  counts: DomainCounts
  partNames: Record<string, string>
}
