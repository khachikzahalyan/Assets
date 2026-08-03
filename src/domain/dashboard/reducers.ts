import type { Asset, AssetReferenceData } from '@/domain/asset'
import { isAssetStatusId } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { PartMovement } from '@/domain/part/types'
import type { AssetStats, WorkstationLicenseStats, AssetGroup, DomainBoxKey, DomainBoxData } from './types'
import { ASSET_GROUPS, EMPTY_STATUS_COUNTS } from './types'

export function reduceAssetStats(assets: Asset[], ref: AssetReferenceData, topBranches: number): AssetStats {
  const byStatus = { ...EMPTY_STATUS_COUNTS }
  const catGroup = new Map(ref.categories.map(c => [c.id, c.group as AssetGroup]))
  const branchName = new Map(ref.branches.map(b => [b.id, b.name]))
  const groupCounts = new Map<AssetGroup, number>(ASSET_GROUPS.map(g => [g, 0]))
  const branchCounts = new Map<string, number>()

  for (const a of assets) {
    if (isAssetStatusId(a.statusId)) byStatus[a.statusId] += 1
    const g = catGroup.get(a.categoryId)
    if (g) groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1)
    branchCounts.set(a.branchId, (branchCounts.get(a.branchId) ?? 0) + 1)
  }

  const topB = [...branchCounts.entries()]
    .map(([branchId, count]) => ({ branchId, name: branchName.get(branchId) ?? branchId, count }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'ru'))
    .slice(0, topBranches)

  return {
    total: assets.length,
    byStatus,
    byGroup: ASSET_GROUPS.map(group => ({ group, count: groupCounts.get(group) ?? 0 })),
    topBranches: topB,
  }
}

export function reduceWorkstationLicenseStats(rows: WorkstationLicense[]): WorkstationLicenseStats {
  let free = 0, inUse = 0, retired = 0
  for (const l of rows) {
    if (l.lifecycleStatus === 'retired') retired += 1
    else if (l.assignmentType === 'unassigned') free += 1
    else inUse += 1
  }
  return { total: rows.length, free, inUse, retired }
}

// ── Domain boxes (dashboard redesign 2026-07-31) ──────────────────────────────

export const DASHBOARD_WINDOW_DAYS = 7
export const DASHBOARD_EVENTS_PER_BOX = 6
export const DASHBOARD_AUDIT_CAP = 250
export const DASHBOARD_MOVEMENTS_CAP = 200

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Бакетирование по ЛОКАЛЬНОМУ календарному дню: 7 бакетов, [6]=сегодня.
 * Math.round поглощает сдвиг DST (±1ч). Невалидные и вне-оконные даты игнорируются.
 */
export function bucketByDay(ats: readonly string[], now: Date = new Date()): number[] {
  const buckets = [0, 0, 0, 0, 0, 0, 0]
  const today = startOfLocalDay(now)
  for (const iso of ats) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) continue
    const diff = Math.round((today - startOfLocalDay(d)) / 86_400_000)
    if (diff >= 0 && diff <= 6) buckets[6 - diff]! += 1
  }
  return buckets
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Активы: «{brand} {model}» → invCode → entityId. */
export function assetEventLabel(log: AuditLog): string {
  const a = log.after
  const bm = [str(a?.brand), str(a?.model)].filter(Boolean).join(' ')
  return bm || str(a?.invCode) || log.entityId
}

/** Сотрудники: «{lastName} {firstName}» → email → entityId. */
export function employeeEventLabel(log: AuditLog): string {
  const a = log.after
  const name = [str(a?.lastName), str(a?.firstName)].filter(Boolean).join(' ')
  return name || str(a?.email) || log.entityId
}

/** Подписки/Филиалы/Отделы: after.name → entityId (name — plain string в этой кодовой базе). */
export function namedEntityEventLabel(log: AuditLog): string {
  return str(log.after?.name) || log.entityId
}

/** Запчасти: «{skuName|note|skuId} ×{qty} → {assetInvCode}». */
export function partInstallLabel(m: PartMovement, partNames: Record<string, string>): string {
  const name = partNames[m.skuId] ?? (m.note?.trim() || m.skuId)
  const target = m.assetInvCode ? ` → ${m.assetInvCode}` : ''
  return `${name} ×${m.qty}${target}`
}

/** Подписочное событие: строго Subscription (Windows/OEM/Volume/Retail/Default отсекаются). */
export function isSubscriptionEvent(l: AuditLog): boolean {
  if (l.entityType === 'subscription' && l.action === 'subscription_created') return true
  return l.entityType === 'license' && l.action === 'created' && str(l.after?.type) === 'Subscription'
}

export interface GroupDomainEventsInput {
  auditLogs: readonly AuditLog[]        // 7-дневное окно
  partInstalls: readonly PartMovement[] // 7-дневное окно, type==='install'
  partNames: Record<string, string>     // skuId → имя SKU
  now?: Date
}

const LIST_ROUTE: Record<Exclude<DomainBoxKey, 'assets'>, string> = {
  employees: '/employees', parts: '/parts', subscriptions: '/licenses',
  branches: '/branches', departments: '/departments',
}

/**
 * Раскладка 7-дневного окна по 6 боксам:
 *   assets: entityType==='asset' && action==='created'
 *   employees: 'employee'+'created' · branches: 'branch'+'created'
 *   departments: 'department'+'created' · subscriptions: isSubscriptionEvent
 *   parts: partInstalls (уже отфильтрованы адаптером до type==='install')
 * Дельта = все события окна; лента = первые 6 desc; days = bucketByDay(все).
 */
export function groupDomainEvents(input: GroupDomainEventsInput): Record<DomainBoxKey, DomainBoxData> {
  const now = input.now ?? new Date()

  function fromAudit(
    key: Exclude<DomainBoxKey, 'parts'>,
    match: (l: AuditLog) => boolean,
    label: (l: AuditLog) => string,
  ): DomainBoxData {
    const matched = input.auditLogs.filter(match).sort((a, b) => b.at.localeCompare(a.at))
    const events = matched.slice(0, DASHBOARD_EVENTS_PER_BOX).map(l => ({
      id: l.id,
      primary: label(l),
      secondary: l.actorName?.trim() || null,
      at: l.at,
      linkTo: key === 'assets' ? `/assets/${l.entityId}` : LIST_ROUTE[key],
    }))
    return { key, delta7d: matched.length, days: bucketByDay(matched.map(l => l.at), now), events }
  }

  const installs = [...input.partInstalls].sort((a, b) => b.at.localeCompare(a.at))
  const parts: DomainBoxData = {
    key: 'parts',
    delta7d: installs.length,
    days: bucketByDay(installs.map(m => m.at), now),
    events: installs.slice(0, DASHBOARD_EVENTS_PER_BOX).map(m => ({
      id: m.id,
      primary: partInstallLabel(m, input.partNames),
      secondary: null,
      at: m.at,
      linkTo: LIST_ROUTE.parts,
    })),
  }

  return {
    assets: fromAudit('assets', l => l.entityType === 'asset' && l.action === 'created', assetEventLabel),
    employees: fromAudit('employees', l => l.entityType === 'employee' && l.action === 'created', employeeEventLabel),
    parts,
    subscriptions: fromAudit('subscriptions', isSubscriptionEvent, namedEntityEventLabel),
    branches: fromAudit('branches', l => l.entityType === 'branch' && l.action === 'created', namedEntityEventLabel),
    departments: fromAudit('departments', l => l.entityType === 'department' && l.action === 'created', namedEntityEventLabel),
  }
}
