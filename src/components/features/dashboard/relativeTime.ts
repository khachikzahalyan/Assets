import type { TFunction } from 'i18next'

/** Localized relative time. `t` is the 'dashboard' namespace translator. */
export function relativeTime(iso: string, t: TFunction, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return t('relTime.justNow')
  if (mins < 60) return t('relTime.minAgo', { n: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('relTime.hourAgo', { n: hrs })
  const days = Math.floor(hrs / 24)
  return t('relTime.dayAgo', { n: days })
}
