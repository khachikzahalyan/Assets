const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/

/** Reduce arbitrary user text to a bare lowercase host. */
export function normalizeDomain(input: string): string {
  let s = (input ?? '').trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.replace(/^@/, '')
  s = s.replace(/^www\./, '')
  s = s.split(/[/?#]/)[0] ?? s
  return s
}

/** Conservative domain check on an ALREADY-normalized host. */
export function isValidDomain(input: string): boolean {
  const s = normalizeDomain(input)
  if (!s) return false
  return DOMAIN_RE.test(s)
}

/** Case-insensitive de-dupe (input assumed normalized), stable first-seen order. */
export function dedupeDomains(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const d of list) {
    const key = d.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}
