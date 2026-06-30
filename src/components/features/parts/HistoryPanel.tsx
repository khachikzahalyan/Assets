import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import type { PartMovement, Part } from '@/domain/part/types'
import { categoryIcon, categoryTint, fmtPartsDate } from './partsTokens'

/* ── Helpers ── */
function toTs(val: string | number | null | undefined): number {
  if (!val) return 0
  if (typeof val === 'number') return val
  return new Date(val).getTime()
}

/* Matches prototype displayType() exactly (parts.html 1958-1966):
   - 'in' / 'receive'   → 'receive'
   - 'out' / 'install'  → 'install'
   - 'uninstall'        → 'uninstall'
   - mv.displayType==='move' or action contains 'Перемещение' → 'move'
   broken flag is checked separately on the mv level (not a display type) */
type DisplayType = 'receive' | 'install' | 'uninstall' | 'move'

function resolveDisplayType(mv: PartMovement): DisplayType {
  const t = mv.type
  if (t === 'receive') return 'receive'
  if (t === 'install') return 'install'
  if (t === 'uninstall') return 'uninstall'
  if ((mv as any).displayType === 'move') return 'move'
  return 'receive'
}

const PAGE_SIZE = 10

/* Numbered page list with ellipsis — mirrors prototype buildPageNums */
function buildPageNums(cur: number, total: number): Array<number | '…'> {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: Array<number | '…'> = []
  pages.push(1)
  const lo = Math.max(2, cur - 1)
  const hi = Math.min(total - 1, cur + 1)
  if (lo > 2) pages.push('…')
  for (let p = lo; p <= hi; p++) pages.push(p)
  if (hi < total - 1) pages.push('…')
  pages.push(total)
  return pages
}

export interface HistoryPanelProps {
  movements: PartMovement[]
  /**
   * Filter to movements belonging to a specific SKU id set.
   * Kept for backward-compat — WarehouseTab now passes skuIds directly.
   */
  skuIdSet?: Set<string>
  /** The set of SKU ids for the selected category (replaces skuIdSet). */
  skuIds?: Set<string>
  /** All parts (for skuLabel resolution) */
  parts?: Part[]
  /** Is the viewport mobile? */
  isMobile?: boolean
  /** Selected category id (for event-filter reset on category change) */
  categoryId?: string
  /** Running-stock snapshot per movement id (keyed by movement id) */
  remainingAfterMap?: Record<string, number>
}

/**
 * Per-category history block — matches the prototype Склад «История» section:
 *  - Header strip «ИСТОРИЯ» + «Добавлено: N шт» (green) + «Использовано: N шт» (violet)
 *  - 2-line event rows: dot · icon plaque · SKU label / subline (asset invcode+name or Со склада) · action chip · date
 *  - Action chips: Списано (red), Установлено · Осталось N шт (amber), +qty (green)
 *  - Pagination: 10/page, numbered+ellipsis desktop, 3-button mobile
 *  - Event-type filter chips (receive/install/uninstall/move)
 */
export function HistoryPanel({
  movements,
  skuIdSet,
  skuIds,
  parts = [],
  isMobile = false,
  categoryId,
  remainingAfterMap = {},
}: HistoryPanelProps) {
  const { t } = useTranslation('parts')
  const [page, setPage] = useState(1)
  const [eventFilter, setEventFilter] = useState<DisplayType | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  /* Reset page + filter when category changes */
  useEffect(() => {
    setPage(1)
    setEventFilter(null)
  }, [categoryId])

  /* Reset page when filter changes */
  useEffect(() => {
    setPage(1)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [eventFilter])

  /* Resolve the effective SKU id set */
  const effectiveSkuIds = useMemo((): Set<string> | null => {
    if (skuIds) return skuIds
    if (skuIdSet) return skuIdSet
    return null
  }, [skuIds, skuIdSet])

  /* Build skuById lookup */
  const skuById = useMemo(
    () => Object.fromEntries(parts.map((p) => [p.id, p])),
    [parts],
  )

  /* Filter movements to this category */
  const categoryMovements = useMemo(() => {
    if (!effectiveSkuIds) return movements
    return movements.filter(
      (m) => m.type === 'service'
        ? false // service events excluded from warehouse history block
        : effectiveSkuIds.has(m.skuId),
    )
  }, [movements, effectiveSkuIds])

  /* Sort newest-first */
  const sorted = useMemo(
    () =>
      [...categoryMovements].sort(
        (a, b) => toTs(b.at) - toTs(a.at),
      ),
    [categoryMovements],
  )

  /* Aggregate metrics (uses full sorted, not filtered) */
  const addedQty = useMemo(
    () =>
      sorted
        .filter((m) => m.type === 'receive')
        .reduce((s, m) => s + m.qty, 0),
    [sorted],
  )
  const usedQty = useMemo(
    () =>
      sorted
        .filter((m) => m.type === 'install' && !m.serviceReplace)
        .reduce((s, m) => s + m.qty, 0),
    [sorted],
  )

  /* Event-type filter */
  const filtered = useMemo(() => {
    if (!eventFilter) return sorted
    return sorted.filter((m) => resolveDisplayType(m) === eventFilter)
  }, [sorted, eventFilter])

  /* Pagination */
  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const sliceStart = (safePage - 1) * PAGE_SIZE
  const visibleRows = filtered.slice(sliceStart, sliceStart + PAGE_SIZE)
  const pageNums = buildPageNums(safePage, totalPages)

  /* Count by type — mirrors prototype lines 2019-2022 */
  const receiveCnt   = sorted.filter((m) => resolveDisplayType(m) === 'receive').length
  const installCnt   = sorted.filter((m) => resolveDisplayType(m) === 'install').length
  const uninstallCnt = sorted.filter((m) => resolveDisplayType(m) === 'uninstall').length
  const moveCnt      = sorted.filter((m) => resolveDisplayType(m) === 'move').length

  const goToPage = (p: number) => {
    setPage(p)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }

  const toggleFilter = (type: DisplayType) =>
    setEventFilter((prev) => (prev === type ? null : type))

  /* ── Inner render ── */
  return (
    <div>
      {/* ── Metrics strip ── */}
      <div className="px-5 py-2.5 max-md:px-3 max-md:py-1.5 border-t border-border flex items-center gap-3 flex-shrink-0 bg-bg">
        <span className="text-[13px] uppercase tracking-wider text-text-subtle font-semibold">
          {t('warehouse.history')}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <Chip color="green" size="sm" dot>
            {t('warehouse.historyAdded')}: {addedQty} шт
          </Chip>
          <Chip color="violet" size="sm" dot>
            {t('warehouse.historyUsed')}: {usedQty} шт
          </Chip>
        </div>
      </div>

      {/* ── Event-type filter chips — mirrors prototype lines 2058-2122 (desktop only) ── */}
      {(receiveCnt > 0 || installCnt > 0 || uninstallCnt > 0 || moveCnt > 0) && (
        <div className="max-md:hidden px-5 py-2 border-t border-border flex flex-wrap items-center gap-1">
          {receiveCnt > 0 && (
            <button
              type="button"
              onClick={() => toggleFilter('receive')}
              aria-pressed={eventFilter === 'receive'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[12.5px] font-semibold transition-all cursor-pointer
                ${eventFilter === 'receive'
                  ? 'bg-emerald-500/25 text-emerald-200 ring-2 ring-emerald-400/60 shadow-inner'
                  : `bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 ${eventFilter ? 'opacity-60 hover:opacity-100' : ''}`}`}
            >
              <Icon name="inbox" size={11} />
              {receiveCnt} {t('warehouse.filterReceive')}
            </button>
          )}
          {installCnt > 0 && (
            <button
              type="button"
              onClick={() => toggleFilter('install')}
              aria-pressed={eventFilter === 'install'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[12.5px] font-semibold transition-all cursor-pointer
                ${eventFilter === 'install'
                  ? 'bg-violet-500/25 text-violet-200 ring-2 ring-violet-400/60 shadow-inner'
                  : `bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/30 hover:bg-violet-500/20 ${eventFilter ? 'opacity-60 hover:opacity-100' : ''}`}`}
            >
              <Icon name="wrench" size={11} />
              {installCnt} {t('warehouse.filterInstall')}
            </button>
          )}
          {uninstallCnt > 0 && (
            <button
              type="button"
              onClick={() => toggleFilter('uninstall')}
              aria-pressed={eventFilter === 'uninstall'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[12.5px] font-semibold transition-all cursor-pointer
                ${eventFilter === 'uninstall'
                  ? 'bg-blue-500/25 text-blue-200 ring-2 ring-blue-400/60 shadow-inner'
                  : `bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/30 hover:bg-blue-500/20 ${eventFilter ? 'opacity-60 hover:opacity-100' : ''}`}`}
            >
              <Icon name="rotate-ccw" size={11} />
              {uninstallCnt} {t('warehouse.filterUninstall')}
            </button>
          )}
          {moveCnt > 0 && (
            <button
              type="button"
              onClick={() => toggleFilter('move')}
              aria-pressed={eventFilter === 'move'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[12.5px] font-semibold transition-all cursor-pointer
                ${eventFilter === 'move'
                  ? 'bg-amber-500/25 text-amber-200 ring-2 ring-amber-400/60 shadow-inner'
                  : `bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/20 ${eventFilter ? 'opacity-60 hover:opacity-100' : ''}`}`}
            >
              <Icon name="arrow-left-right" size={11} />
              {moveCnt} {t('warehouse.filterMove')}
            </button>
          )}
          {eventFilter && (
            <button
              type="button"
              onClick={() => setEventFilter(null)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[12.5px] font-semibold transition-all cursor-pointer bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30 hover:bg-slate-500/25"
            >
              <Icon name="x" size={11} />
              {t('warehouse.filterReset')}
            </button>
          )}
        </div>
      )}

      {/* ── Empty state — mirrors prototype lines 2268-2291 ── */}
      {filtered.length === 0 ? (
        <div className="h-full flex items-center justify-center p-8 border-t border-border">
          <div className="text-center max-w-xs">
            <span className="w-12 h-12 rounded-full bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
              <Icon name={eventFilter ? 'list-filter' : 'history'} size={20} />
            </span>
            <div className="text-[15px] font-semibold text-text-secondary">
              {eventFilter ? t('warehouse.historyFilterTitle') : t('warehouse.historyEmpty')}
            </div>
            <div className="text-[14px] text-text-tertiary mt-1">
              {eventFilter
                ? t('warehouse.historyFilterHint')
                : t('warehouse.historyEmptyHint')}
            </div>
            {eventFilter && (
              <button
                type="button"
                onClick={() => setEventFilter(null)}
                className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[13px] font-semibold transition-all cursor-pointer bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30 hover:bg-slate-500/25"
              >
                <Icon name="x" size={11} />
                {t('warehouse.historyFilterReset')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Event rows — mirrors prototype lines 3944-3997 ── */}
          <div ref={scrollRef}>
            <ul
              className="ams-stock-history-list divide-y divide-border border-t border-border flex-shrink-0"
              style={isMobile ? undefined : { minHeight: 'min(700px, 62vh)' }}
            >
              {visibleRows.map((mv, i) => {
                const dt = resolveDisplayType(mv)
                const isBroken = !!(mv as any).broken
                const isInstall = dt === 'install' && !isBroken
                const qty = mv.qty ?? 1

                const rowSku = skuById[mv.skuId] ?? null
                const skuCat = rowSku?.category ?? ''
                const skuLabel = rowSku
                  ? rowSku.name + (rowSku.variantLabel ? ' ' + rowSku.variantLabel : '')
                  : mv.skuId || '—'

                const catIconName = skuCat ? categoryIcon(skuCat) : null
                const catTint = skuCat ? categoryTint(skuCat) : null

                /* Dot colour — matches prototype lines 3953-3954 */
                const dotColor = isBroken
                  ? 'bg-rose-500'
                  : isInstall
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'

                /* Action chip — mirrors prototype lines 3955-3959 */
                const actionChip = (() => {
                  if (isBroken) {
                    return (
                      <Chip color="red" size="md">
                        <Icon name="x-circle" size={11} />
                        {t('warehouse.actionScrapped')}
                      </Chip>
                    )
                  }
                  if (isInstall) {
                    const remaining = remainingAfterMap[mv.id] ?? 0
                    return (
                      <Chip color="amber" size="md">
                        <Icon name="wrench" size={11} />
                        <span className="whitespace-nowrap">
                          {t('warehouse.actionInstalled')} · {t('warehouse.actionRemaining')} {remaining} шт
                        </span>
                      </Chip>
                    )
                  }
                  /* receive */
                  return (
                    <Chip color="green" size="md">
                      <Icon name="inbox" size={11} />
                      +{qty}
                    </Chip>
                  )
                })()

                /* Subline: asset invcode + name OR «Со склада» — prototype lines 3961-3974 */
                const assetCode = mv.assetInvCode ?? (mv as any).assetId ?? null
                const assetName = (mv as any).assetName ?? null
                const subline = assetCode ? (
                  <>
                    <span className="font-mono text-[13px] uppercase tracking-wider bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-zinc-300 flex-shrink-0">
                      {assetCode}
                    </span>
                    {assetName && (
                      <span className="ams-stock-history-asset-name truncate text-text-subtle">{assetName}</span>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 text-text-subtle">
                    <Icon name="package" size={10} />
                    <span>{t('warehouse.fromWarehouse')}</span>
                  </span>
                )

                return (
                  <li
                    key={mv.id ?? i}
                    className="flex items-center gap-3 px-5 h-[56px] flex-shrink-0 hover:bg-[#111315]/60 transition-colors max-md:h-auto max-md:py-2 max-md:gap-2 max-md:px-3 max-md:flex-wrap"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {catIconName && catTint && (
                        <span className={`w-6 h-6 rounded bg-surface-2 text-text-tertiary inline-flex items-center justify-center flex-shrink-0`}>
                          <Icon name={catIconName} size={11} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[15.5px] max-md:text-[14px] text-text-secondary truncate">
                          {skuLabel}
                        </div>
                        <div className="text-[14px] max-md:text-[12.5px] text-text-subtle mt-0.5 leading-tight flex items-center gap-1.5 min-w-0">
                          {subline}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">{actionChip}</div>
                    <div className="text-[14px] font-medium text-text-tertiary tabular-nums whitespace-nowrap flex-shrink-0 w-[88px] text-right">
                      {fmtPartsDate(mv.at)}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            isMobile ? (
              /* Mobile: 3-button */
              <div className="flex items-center justify-between gap-2 py-2 px-4 border-t border-border">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => goToPage(Math.max(1, safePage - 1))}
                  className="h-7 px-3 rounded-md bg-surface border border-border text-[14px] text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={t('warehouse.pagePrev')}
                >
                  ← {t('warehouse.pagePrev')}
                </button>
                <span className="text-[14px] text-text-tertiary tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                  className="h-7 px-3 rounded-md bg-surface border border-border text-[14px] text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={t('warehouse.pageNext')}
                >
                  {t('warehouse.pageNext')} →
                </button>
              </div>
            ) : (
              /* Desktop: numbered + ellipsis */
              <div className="border-t border-border flex-shrink-0">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="text-[13px] text-text-subtle tabular-nums">
                    {t('warehouse.pageOf', { page: safePage, total: totalPages })}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={safePage === 1}
                      onClick={() => goToPage(Math.max(1, safePage - 1))}
                      className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-surface text-text-secondary disabled:opacity-30 hover:border-border-strong transition-colors"
                      aria-label={t('warehouse.pagePrev')}
                    >
                      <Icon name="chevron-left" size={13} />
                    </button>
                    {pageNums.map((item, idx) =>
                      item === '…' ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="w-7 h-7 flex items-center justify-center text-[13px] text-text-subtle"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => goToPage(item as number)}
                          aria-current={item === safePage ? 'page' : undefined}
                          className={`flex items-center justify-center w-7 h-7 rounded-md text-[13.5px] font-semibold transition-colors
                            ${item === safePage
                              ? 'bg-accent text-white'
                              : 'bg-surface border border-border text-text-secondary hover:border-border-strong'}`}
                        >
                          {item}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      disabled={safePage === totalPages}
                      onClick={() => goToPage(Math.min(totalPages, safePage + 1))}
                      className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-surface text-text-secondary disabled:opacity-30 hover:border-border-strong transition-colors"
                      aria-label={t('warehouse.pageNext')}
                    >
                      <Icon name="chevron-right" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
