import type { Asset, StatusRow } from '@/domain/asset'
import type { ChipColor } from '@/components/ui/chip'

// ---------------------------------------------------------------------------
// 1. deriveDisplayStatusId / deriveDisplayStatus
// ---------------------------------------------------------------------------

/**
 * Status to DISPLAY: lifecycle statuses (st_repair/st_disposed) win;
 * otherwise derived from assignment presence.
 */
export function deriveDisplayStatusId(
  asset: Asset,
): 'st_warehouse' | 'st_assigned' | 'st_repair' | 'st_disposed' {
  if (asset.statusId === 'st_repair' || asset.statusId === 'st_disposed') {
    return asset.statusId as 'st_repair' | 'st_disposed'
  }
  return asset.assignment ? 'st_assigned' : 'st_warehouse'
}

/** Resolves the StatusRow to render, given loaded statuses. Falls back to a synthetic row. */
export function deriveDisplayStatus(asset: Asset, statuses: StatusRow[]): StatusRow {
  const id = deriveDisplayStatusId(asset)
  return statuses.find((s) => s.id === id) ?? { id, name: id, color: 'gray' }
}

// ---------------------------------------------------------------------------
// 2. STATUS_CHIP_COLOR
// ---------------------------------------------------------------------------

/** Maps derived status id → Chip color for the status chip in asset tables/cards. */
export const STATUS_CHIP_COLOR: Record<string, ChipColor> = {
  st_warehouse: 'blue',
  st_assigned:  'green',
  st_repair:    'amber',
  st_disposed:  'red',
}

// ---------------------------------------------------------------------------
// 3. assetTitle — upgraded with optional categoryName + group overloads
// ---------------------------------------------------------------------------

/**
 * Derives a display title for an asset.
 *
 * Priority:
 *   1. brand + model (Tier-4 fields)
 *   2. categoryName when group === 'furniture'
 *   3. categoryName (any group)
 *   4. invCode fallback
 *
 * Single-arg call `assetTitle(a)` is still valid — falls through to invCode.
 */
export function assetTitle(
  a: Asset,
  categoryName?: string | null,
  group?: string | null,
): string {
  if (a.brand && a.model) return `${a.brand} ${a.model}`
  if (group === 'furniture' && categoryName) return categoryName
  if (categoryName) return categoryName
  return a.invCode
}

// ---------------------------------------------------------------------------
// 4. RelTimeBucket + relativeBucket — extended with week/month/year
// ---------------------------------------------------------------------------

/**
 * Structured time bucket — caller translates via i18n keys:
 *   now        → t('relTime.now')
 *   min        → t('relTime.minAgo',   { n })
 *   hour       → t('relTime.hourAgo',  { n })
 *   day        → t('relTime.dayAgo',   { n })
 *   week       → t('relTime.weekAgo',  { n })
 *   month      → t('relTime.monthAgo', { n })
 *   year       → t('relTime.yearAgo',  { n })
 */
export type RelTimeBucket =
  | { unit: 'now' }
  | { unit: 'min' | 'hour' | 'day' | 'week' | 'month' | 'year'; n: number }

/**
 * Returns a coarse relative-time bucket for the given ISO timestamp.
 *
 * Thresholds:
 *   < 1 min   → now
 *   < 60 min  → min
 *   < 24 h    → hour
 *   < 7 days  → day
 *   < 4 weeks → week
 *   < 12 mo   → month
 *   else      → year
 */
export function relativeBucket(iso: string, now: Date = new Date()): RelTimeBucket {
  const diffMs = Math.max(0, now.getTime() - new Date(iso).getTime())
  const min   = Math.floor(diffMs / 60_000)
  const hr    = Math.floor(min  / 60)
  const day   = Math.floor(hr   / 24)
  const week  = Math.floor(day  / 7)
  const month = Math.floor(day  / 30)
  const year  = Math.floor(day  / 365)

  if (min   <  1)  return { unit: 'now' }
  if (hr    <  1)  return { unit: 'min',   n: min }
  if (day   <  1)  return { unit: 'hour',  n: hr }
  if (week  <  1)  return { unit: 'day',   n: day }
  if (month <  1)  return { unit: 'week',  n: week }
  if (year  <  1)  return { unit: 'month', n: month }
  return                  { unit: 'year',  n: year }
}

// ---------------------------------------------------------------------------
// 5. fmtDate — absolute date "09/Dec/2026"
// ---------------------------------------------------------------------------

const MONTHS_EN_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** Absolute date formatted as "09/Dec/2026" (prototype Updated-column format). */
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${MONTHS_EN_ABBR[d.getMonth()]}/${d.getFullYear()}`
}

// ---------------------------------------------------------------------------
// 6. assigneeKind — unchanged; isTemporaryAssignment — NEW
// ---------------------------------------------------------------------------

/** Classifies the assignment state for display routing. */
export function assigneeKind(
  a: Asset,
): 'employee' | 'department' | 'branch' | 'warehouse' | 'temporary' | 'none' {
  if (!a.assignment) {
    return a.statusId === 'st_warehouse' ? 'warehouse' : 'none'
  }
  return a.assignment.mode
}

/**
 * Returns true when the asset's current assignment is marked as temporary
 * (AMS schema §5 assignments.isTemporary).
 */
export function isTemporaryAssignment(a: Asset): boolean {
  return a.assignment?.isTemporary === true
}
