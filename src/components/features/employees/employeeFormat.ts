const AVATAR_PALETTE = [
  'bg-[#F97316]',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-600',
  'bg-orange-500',
  'bg-teal-500',
  'bg-fuchsia-500',
  'bg-blue-500',
  'bg-lime-600',
] as const

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

/**
 * Returns 1–2 uppercase initials from firstName + lastName.
 * Falls back to '?' when both are empty.
 */
export function employeeInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const parts = [firstName, lastName]
    .map(s => (s ?? '').trim())
    .filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('')
}

/**
 * Deterministically picks a Tailwind bg-* class from AVATAR_PALETTE
 * based on the employee's id (stable across renders).
 */
export function employeeAvatarColor(id: string | null | undefined): string {
  if (!id) return AVATAR_PALETTE[0]
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]!
}

const RU_MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const

/**
 * Formats a Date as "DD mmm YYYY" in Russian, using local date fields.
 * Example: new Date(2026, 4, 12) → "12 май 2026"
 */
export function formatDateRu(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')} ${RU_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Returns a human-readable relative time string in Russian.
 * @param iso - ISO 8601 date string of the past event
 * @param now - reference point (defaults to current time; injectable for tests)
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} ч назад`
  const dy = Math.floor(hr / 24)
  if (dy < 7) return `${dy} ${dy === 1 ? 'день' : dy < 5 ? 'дня' : 'дней'} назад`
  const wk = Math.floor(dy / 7)
  if (wk < 4) return `${wk} нед назад`
  const mo = Math.floor(dy / 30)
  if (mo < 12) return `${mo} мес назад`
  return `${Math.floor(dy / 365)} г назад`
}
