import type { AuditLog, ActorRef } from '@/domain/audit'

/** DD/Mon/YYYY HH:MM — the AMS-standard timestamp format. Returns the raw input on parse failure. */
export function formatAuditTs(iso: string, locale: string = 'en'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d)
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mon}/${yyyy} ${hh}:${mm}`
}

/** Best-effort actor name; falls back to the uid when no display name is known. */
export function resolveActorName(uid: string, actors: ActorRef[]): string {
  const found = actors.find(a => a.uid === uid)
  return found?.displayName ?? uid
}

export type DiffKind = 'added' | 'removed' | 'changed'
export interface DiffRow {
  key: string
  before: string | undefined
  after: string | undefined
  kind: DiffKind
}

function stringify(v: unknown): string | undefined {
  if (v === undefined) return undefined
  if (v === null) return 'null'
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

/**
 * Key-by-key diff of two snapshot maps. Values are stringified for display.
 * Display-as-is: any masked secret stays masked (masking happens at write time).
 */
export function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): DiffRow[] {
  const keys = Array.from(new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])).sort()

  const rows: DiffRow[] = []
  for (const key of keys) {
    const hasB = before != null && key in before
    const hasA = after != null && key in after
    const b = hasB ? stringify(before![key]) : undefined
    const a = hasA ? stringify(after![key]) : undefined
    if (hasB && hasA) {
      if (b !== a) rows.push({ key, before: b, after: a, kind: 'changed' })
    } else if (hasA) {
      rows.push({ key, before: undefined, after: a, kind: 'added' })
    } else {
      rows.push({ key, before: b, after: undefined, kind: 'removed' })
    }
  }
  return rows
}

/** Detail-page link for an entity, or null when no detail page exists. */
export function entityLink(log: Pick<AuditLog, 'entityType' | 'entityId'>): string | null {
  switch (log.entityType) {
    case 'asset': return `/assets/${log.entityId}`
    case 'employee': return `/employees/${log.entityId}`
    case 'user': return `/employees/${log.entityId}` // users share the employee uid space
    // assignment / upgrade / license entities have no standalone detail route;
    // branch / department / category / asset_status are catalog rows without :id routes.
    default: return null
  }
}
