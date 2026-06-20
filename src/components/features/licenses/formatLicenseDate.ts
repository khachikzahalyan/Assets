/**
 * Shared date formatter for license tables and history.
 * Accepts an ISO date/timestamp string and the active i18n locale.
 * Returns the locale-formatted date, or the raw iso string if invalid.
 */
export function formatLicenseDate(iso: string, locale: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}
