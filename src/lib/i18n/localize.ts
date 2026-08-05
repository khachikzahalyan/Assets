/**
 * localize — resolves a Tier-2 multi-lang stored object to the active UI locale.
 *
 * Fallback order: requested locale → ru → en → hy → first non-empty value → ''.
 * If passed a plain string (Tier-3 / Tier-4 storage), returns it unchanged.
 */

const SUPPORTED = ['ru', 'en', 'hy'] as const
const FALLBACK_ORDER: readonly string[] = ['ru', 'en', 'hy']

type LocaleMap = { ru?: string; en?: string; hy?: string } & Record<string, string>

export function localize(
  value: LocaleMap | string | null | undefined,
  locale: string,
): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return ''

  const requested = (SUPPORTED as readonly string[]).includes(locale) ? locale : FALLBACK_ORDER[0]!
  const direct = value[requested]
  if (direct && direct.trim()) return direct

  for (const lng of FALLBACK_ORDER) {
    const v = value[lng]
    if (v && v.trim()) return v
  }

  // last-ditch: any non-empty value
  for (const k of Object.keys(value)) {
    const v = value[k]
    if (typeof v === 'string' && v.trim()) return v
  }

  return ''
}
