import type { Asset } from './types'
import { temporaryHoldStatus, type TemporaryHoldStatus } from './temporaryHold'

export interface HoldNotification {
  assetId: string
  title: string
  invCode: string
  tempKind: 'audit' | 'intern' | 'staff' | null
  expiresAt: string
  hold: Exclude<TemporaryHoldStatus, 'active'>
}

function assetTitle(a: Asset): string {
  const name = [a.brand, a.model].filter(Boolean).join(' ').trim()
  if (name) return name
  if (a.type) return a.type
  return a.invCode
}

const ORDER: Record<Exclude<TemporaryHoldStatus, 'active'>, number> = { overdue: 0, dueSoon: 1 }

/**
 * Builds the sorted bell-notification list. PURE — no Firebase, no i18n.
 * Emits one entry per asset whose assignment is a temporary hold currently
 * 'dueSoon' or 'overdue'. Sort: overdue before dueSoon; then earliest
 * expiresAt; then invCode (stable tie-break).
 */
export function buildHoldNotifications(assets: Asset[], now: Date = new Date()): HoldNotification[] {
  const out: HoldNotification[] = []
  for (const a of assets) {
    const hold = temporaryHoldStatus(a.assignment, now)
    if (hold !== 'dueSoon' && hold !== 'overdue') continue
    const expiresAt = a.assignment?.expiresAt
    if (!expiresAt) continue
    out.push({
      assetId: a.id,
      title: assetTitle(a),
      invCode: a.invCode,
      tempKind: a.assignment?.tempKind ?? null,
      expiresAt,
      hold,
    })
  }
  out.sort((x, y) => {
    if (ORDER[x.hold] !== ORDER[y.hold]) return ORDER[x.hold] - ORDER[y.hold]
    if (x.expiresAt !== y.expiresAt) return x.expiresAt < y.expiresAt ? -1 : 1
    return x.invCode < y.invCode ? -1 : x.invCode > y.invCode ? 1 : 0
  })
  return out
}
