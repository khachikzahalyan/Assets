/**
 * Date helpers for the asset registration form (condition / warranty).
 *
 * GOLDEN RULE: warranty/year arithmetic uses Date.setMonth / Date.setFullYear —
 * NEVER n * 30 * 86400000 (which drifts by leap years and month lengths).
 */

/** Format a local Date as YYYY-MM-DD (no UTC roundtrip — uses local components). */
export function formatLocalISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a YYYY-MM-DD string into a local Date (midnight). Returns null on bad input. */
export function parseLocalISO(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** Today as YYYY-MM-DD (local). */
export function todayISO(): string {
  return formatLocalISO(new Date())
}

/** Add N whole years to an ISO date using setFullYear (leap-safe). */
export function addYearsISO(iso: string, n: number): string {
  const d = parseLocalISO(iso)
  if (!d) return ''
  d.setFullYear(d.getFullYear() + n)
  return formatLocalISO(d)
}

/** Add N whole months to an ISO date using setMonth (length-safe). */
export function addMonthsISO(iso: string, n: number): string {
  const d = parseLocalISO(iso)
  if (!d) return ''
  d.setMonth(d.getMonth() + n)
  return formatLocalISO(d)
}

/** Warranty default: one year after the purchase date. */
export function oneYearFrom(iso: string): string {
  return addYearsISO(iso, 1)
}

/** Human-readable RU date (DD.MM.YYYY) from an ISO date; '' for blank. */
export function formatDateRU(iso: string | null | undefined): string {
  const d = parseLocalISO(iso ?? '')
  return d ? d.toLocaleDateString('ru-RU') : ''
}

/** True when warranty end is strictly before purchase date (an invalid state). */
export function warrantyBeforePurchase(purchaseDate: string | null, warrantyEndsAt: string | null): boolean {
  return Boolean(purchaseDate && warrantyEndsAt && warrantyEndsAt < purchaseDate)
}
