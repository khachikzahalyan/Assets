/**
 * Normalise an Armenian phone input to exactly 9 digits (leading 0 + 8 digits).
 * Accepts: raw digits, E.164 (+374…), partially formatted, null/undefined.
 * Returns '' when there is no meaningful input or fewer than 9 digits can be recovered.
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  let d = String(input).replace(/\D/g, '') // digits only
  if (d.startsWith('374')) d = d.slice(3)   // strip +374 country code
  if (!d) return ''
  if (!d.startsWith('0')) d = '0' + d        // ensure leading 0
  return d.slice(0, 9)                       // cap at 9 digits
}

/**
 * Formats an Armenian local phone for display as `0XX XX XX XX`.
 * Returns raw (normalised) digits for incomplete numbers, '' for missing.
 */
export function formatLocalPhone(input: string | null | undefined): string {
  const d = normalizePhone(input)
  if (d.length === 9) {
    return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`
  }
  return d
}

const RU_MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const

/**
 * Formats a Date as "DD mmm YYYY" in Russian, using local date fields.
 * Example: new Date(2026, 4, 12) → "12 май 2026"
 */
export function formatDateRu(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${RU_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}
