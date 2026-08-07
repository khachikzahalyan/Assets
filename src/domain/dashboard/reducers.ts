import type { Asset, AssetReferenceData } from '@/domain/asset'
import { isAssetStatusId, ASSET_STATUS } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { PartMovement } from '@/domain/part/types'
import type { AssetStats, WorkstationLicenseStats, PeopleStats, AssetGroup, DomainBoxKey, DomainBoxData, DomainEventKind } from './types'
import { ASSET_GROUPS, EMPTY_STATUS_COUNTS } from './types'

/** Minimal asset projection needed by reduceAssetStats. Full Asset also satisfies this.
 *  invCode/brand/model are optional (Partial) so lean projections stay valid; the
 *  Firestore adapter carries all three through its existing getDocs map (ноль новых чтений). */
type AssetForStats = Pick<Asset, 'id' | 'categoryId' | 'statusId' | 'branchId' | 'updatedAt'>
  & Partial<Pick<Asset, 'invCode' | 'brand' | 'model'>>

export function reduceAssetStats(assets: AssetForStats[], ref: AssetReferenceData, topBranches: number): AssetStats {
  const byStatus = { ...EMPTY_STATUS_COUNTS }
  const catGroup = new Map(ref.categories.map(c => [c.id, c.group as AssetGroup]))
  const catName = new Map(ref.categories.map(c => [c.id, c.name]))
  const branchName = new Map(ref.branches.map(b => [b.id, b.name]))
  const groupCounts = new Map<AssetGroup, number>(ASSET_GROUPS.map(g => [g, 0]))
  const branchCounts = new Map<string, number>()
  const labelById: Record<string, string> = {}
  const metaById: Record<string, string> = {}

  for (const a of assets) {
    if (isAssetStatusId(a.statusId)) byStatus[a.statusId] += 1
    const g = catGroup.get(a.categoryId)
    if (g) groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1)
    branchCounts.set(a.branchId, (branchCounts.get(a.branchId) ?? 0) + 1)

    // Labels are keyed by asset DOC ID — the assets-box feed joins on the asset
    // document id (audit entityId / assignment after.assetId are both ref.id),
    // so id-keyed is mandatory (invCode-keyed would never match).
    //
    // EVERY loaded asset gets a first-line label — this is the fix for the
    // raw-id leak (issued/returned events for invCode-less assets used to fall
    // through to the raw doc id like «N80oZkW9YHhRm4Et3Ury»). Preference:
    // invCode → brand/model → category name (never the id).
    const invCode = str(a.invCode)
    const brandModel = [str(a.brand), str(a.model)].filter(Boolean).join(' ')
    const category = str(catName.get(a.categoryId))
    const line1 = invCode || brandModel || category
    if (line1) labelById[a.id] = line1

    // Second line: «{категория} · {brand model}» (e.g. «Компьютер · Asus H310»).
    const meta = [category, brandModel].filter(Boolean).join(' · ')
    if (meta) metaById[a.id] = meta
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
    labelById,
    metaById,
  }
}

/** Minimal license projection needed by reduceWorkstationLicenseStats. Full WorkstationLicense also satisfies this. */
type LicenseForStats = Pick<WorkstationLicense, 'lifecycleStatus' | 'assignmentType'>

export function reduceWorkstationLicenseStats(rows: LicenseForStats[]): WorkstationLicenseStats {
  let free = 0, inUse = 0, retired = 0
  for (const l of rows) {
    if (l.lifecycleStatus === 'retired') retired += 1
    else if (l.assignmentType === 'unassigned') free += 1
    else inUse += 1
  }
  return { total: rows.length, free, inUse, retired }
}

export type EmployeeForStats = { id: string; status: 'active' | 'terminated' }

export function reducePeopleStats(rows: readonly EmployeeForStats[]): PeopleStats {
  const activeEmployeeIds: string[] = []
  for (const row of rows) {
    if (row.status === 'active') activeEmployeeIds.push(row.id)
  }
  return { employeeCount: activeEmployeeIds.length, activeEmployeeIds }
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

/**
 * Классифицирует audit-запись в тип события ленты бокса «АКТИВЫ» (или null — не в фиде).
 *
 * Дизъюнктность путей `asset/status_changed` и `assignment/*` гарантирована на уровне
 * репозиториев: assign()/returnAsset() пишут ОДИН audit-док и флипают статус в той же
 * транзакции БЕЗ отдельного status_changed. Магик-линк подтверждения пишет
 * `receipt_confirmed` (не status_changed) → исключён здесь → второго «выдан» не возникает.
 *
 * NB: `receipt_confirmed` не входит в AuditAction-юнион (пишется сервером и приезжает через
 * cast адаптера). Свитч по строке безопасно возвращает null для любых неизвестных action.
 */
export function classifyAssetEvent(l: AuditLog): DomainEventKind | null {
  const action: string = l.action
  if (l.entityType === 'asset') {
    if (action === 'created') return 'created'
    if (action === 'status_changed') {
      switch (str(l.after?.statusId)) {
        case ASSET_STATUS.assigned:
        case ASSET_STATUS.pending:
          return 'issued'
        case ASSET_STATUS.warehouse:
          return 'returned'
        case ASSET_STATUS.disposed:
          return 'disposed'
        case ASSET_STATUS.repair:
          return 'repair'
        default:
          return null
      }
    }
    return null
  }
  if (l.entityType === 'assignment') {
    if (action === 'assigned') return 'issued'
    if (action === 'returned') return 'returned'
    return null
  }
  return null
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
  /** Whitelist of active employee entity ids. When provided, employee box events
   *  are filtered to this set. When absent (loadPeopleStats failed), no filtering
   *  is applied — graceful degradation. */
  activeEmployeeIds?: readonly string[]
  /** assetId → first-line label (from AssetStats.labelById). Enriches the
   *  assets-box event first line. Absent → fallback chain in groupDomainEvents.
   *  Keyed by the join id (asset entityId / assignment after.assetId). */
  assetLabels?: Record<string, string>
  /** assetId → second-line meta «{категория} · {brand model}» (AssetStats.metaById).
   *  Shown under the invCode in the assets feed (replaces the actor there). */
  assetMeta?: Record<string, string>
}

const LIST_ROUTE: Record<Exclude<DomainBoxKey, 'assets'>, string> = {
  employees: '/employees', parts: '/parts', subscriptions: '/licenses',
  branches: '/branches', departments: '/departments',
}

/**
 * Раскладка 7-дневного окна по 6 боксам:
 *   assets: typed events (classifyAssetEvent !== null) — created/issued/returned/disposed/repair
 *   employees: 'employee'+'created' · branches: 'branch'+'created'
 *   departments: 'department'+'created' · subscriptions: isSubscriptionEvent
 *   parts: partInstalls (уже отфильтрованы адаптером до type==='install')
 * Дельта = все события окна; лента = первые 6 desc; days = bucketByDay(все).
 *
 * ИСКЛЮЧЕНИЕ для assets: delta7d и days считаются ТОЛЬКО по «created», чтобы чип
 * «+N за 7 дней» сохранял смысл прироста (иначе «+» суммировал бы списания/возвраты).
 * Лента же показывает все 5 типов событий.
 */
export function groupDomainEvents(input: GroupDomainEventsInput): Record<DomainBoxKey, DomainBoxData> {
  const now = input.now ?? new Date()

  // Build the active-employee Set once. undefined = no filtering (graceful degradation).
  const activeSet = input.activeEmployeeIds !== undefined
    ? new Set(input.activeEmployeeIds)
    : null

  /** Assets box: typed feed (all 5 kinds), but growth metrics count only 'created'. */
  function buildAssetsBox(): DomainBoxData {
    const matched = input.auditLogs
      .filter(l => classifyAssetEvent(l) !== null)
      .sort((a, b) => b.at.localeCompare(a.at))

    const events = matched.slice(0, DASHBOARD_EVENTS_PER_BOX).map(l => {
      const kind = classifyAssetEvent(l)! // non-null: matched was filtered on this
      // Join id: assignment events carry the assetId in after/before; else it's the entityId.
      const joinId = l.entityType === 'assignment'
        ? (str(l.after?.assetId) || str(l.before?.assetId))
        : l.entityId
      // First line: assetLabels[joinId] → assetEventLabel (asset events only) →
      // joinId. assetLabels now covers EVERY loaded asset, so a resolvable asset
      // never shows the raw id; the joinId fallback only survives for an asset
      // absent from the collection (rare — assets are soft-deleted, not removed).
      const labelHit = joinId ? input.assetLabels?.[joinId] : undefined
      const primary = labelHit
        || (l.entityType === 'asset' ? assetEventLabel(l) : '')
        || joinId
        || l.entityId
      // Second line for the assets feed is the asset meta «{категория} · {brand
      // model}» (owner request), NOT the actor — the coloured dot already conveys
      // the kind and DomainBox prepends the kind label.
      const meta = joinId ? input.assetMeta?.[joinId] : undefined
      return {
        id: l.id,
        primary,
        secondary: meta?.trim() || null,
        at: l.at,
        linkTo: joinId ? `/assets/${joinId}` : '/assets',
        kind, // present on every assets-box event
      }
    })

    // Growth semantics: delta7d / days derived from 'created' events only.
    const created = matched.filter(l => l.entityType === 'asset' && l.action === 'created')
    return {
      key: 'assets',
      delta7d: created.length,
      days: bucketByDay(created.map(l => l.at), now),
      events,
    }
  }

  // assets is built by buildAssetsBox() (typed feed); fromAudit serves the other 4 audit boxes.
  function fromAudit(
    key: Exclude<DomainBoxKey, 'parts' | 'assets'>,
    match: (l: AuditLog) => boolean,
    label: (l: AuditLog) => string,
  ): DomainBoxData {
    const matched = input.auditLogs.filter(match).sort((a, b) => b.at.localeCompare(a.at))
    const events = matched.slice(0, DASHBOARD_EVENTS_PER_BOX).map(l => ({
      id: l.id,
      primary: label(l),
      secondary: l.actorName?.trim() || null,
      at: l.at,
      linkTo: LIST_ROUTE[key],
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
    assets: buildAssetsBox(),
    employees: fromAudit(
      'employees',
      l => l.entityType === 'employee' && l.action === 'created'
        && (activeSet === null || activeSet.has(l.entityId)),
      employeeEventLabel,
    ),
    parts,
    subscriptions: fromAudit('subscriptions', isSubscriptionEvent, namedEntityEventLabel),
    branches: fromAudit('branches', l => l.entityType === 'branch' && l.action === 'created', namedEntityEventLabel),
    departments: fromAudit('departments', l => l.entityType === 'department' && l.action === 'created', namedEntityEventLabel),
  }
}
