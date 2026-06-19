import type { Asset } from '@/domain/asset'

/** Derives a display title: "Brand Model" or falls back to invCode. */
export function assetTitle(a: Asset): string {
  return [a.brand, a.model].filter(Boolean).join(' ') || a.invCode
}

/**
 * Structured time bucket — caller translates via i18n keys:
 *   now      → t('relTime.now')
 *   min/hour/day → t('relTime.minAgo' | 'hourAgo' | 'dayAgo', { n })
 */
export type RelTimeBucket =
  | { unit: 'now' }
  | { unit: 'min' | 'hour' | 'day'; n: number }

/**
 * Returns a coarse relative-time bucket for the given ISO timestamp.
 * Thresholds: <1 min → now; <60 min → min; <24 h → hour; else day.
 */
export function relativeBucket(iso: string, now: Date = new Date()): RelTimeBucket {
  const diffMs = Math.max(0, now.getTime() - new Date(iso).getTime())
  const min = Math.floor(diffMs / 60000)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)
  if (min < 1) return { unit: 'now' }
  if (hr < 1) return { unit: 'min', n: min }
  if (day < 1) return { unit: 'hour', n: hr }
  return { unit: 'day', n: day }
}

/** Classifies the assignment state for display routing. */
export function assigneeKind(
  a: Asset,
): 'employee' | 'department' | 'branch' | 'warehouse' | 'none' {
  if (!a.assignment) {
    return a.statusId === 'st_warehouse' ? 'warehouse' : 'none'
  }
  return a.assignment.mode
}
