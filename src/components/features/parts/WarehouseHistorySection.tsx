import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import { HistoryPanel, type MetricFilter } from './HistoryPanel'
import type { Part, PartMovement, PartsAsset } from '@/domain/part/types'

/**
 * Shared mobile «История» block for the Warehouse «Склад» tab — one design for
 * EVERY category (PSU / Cooler / GPU / SSD / HDD / M.2 / ОЗУ).
 *
 * Layout: a row of clickable metric chips (added / used / service) that filter
 * the history below, then HistoryPanel (its own metric chips hidden — surfaced
 * here instead). An optional `headerAction` renders at the right of the chip row
 * (used by single-position categories for their inline «Установить» button).
 */
export interface WarehouseHistorySectionProps {
  catId: string
  movements: PartMovement[]
  skuIds: Set<string>
  parts: Part[]
  remainingAfterMap: Record<string, number>
  partsAssets?: PartsAsset[]
  /** Optional action rendered at the right of the metric-chips row (e.g. install button). */
  headerAction?: ReactNode
}

export function WarehouseHistorySection({
  catId,
  movements,
  skuIds,
  parts,
  remainingAfterMap,
  partsAssets = [],
  headerAction,
}: WarehouseHistorySectionProps) {
  const { t } = useTranslation('parts')

  // Clicking a metric chip filters the history list below (toggle off on re-click).
  const [metricFilter, setMetricFilter] = useState<MetricFilter | null>(null)

  // Header metrics for this category — mirrors HistoryPanel's definitions:
  //   added   = Σ qty of 'receive'
  //   used    = Σ qty of 'install' that are NOT service replacements
  //   service = Σ qty of 'install' flagged serviceReplace (stock-neutral swaps)
  let added = 0, used = 0, service = 0
  for (const m of movements) {
    if (!skuIds.has(m.skuId)) continue
    if (m.type === 'receive') added += m.qty
    else if (m.type === 'install') (m.serviceReplace ? (service += m.qty) : (used += m.qty))
  }

  const METRICS = [
    { key: 'added',   color: 'green',  ring: 'ring-emerald-400/70', label: `+${added} шт` },
    { key: 'used',    color: 'violet', ring: 'ring-violet-400/70',  label: `-${used} шт` },
    { key: 'service', color: 'teal',   ring: 'ring-teal-400/70',    label: `${t('warehouse.serviceChip')} ${service}` },
  ] as const

  return (
    <div>
      {/* Metric-chips row — clickable history filters; active chip gets a coloured
          ring, the rest dim while a filter is on. Optional install action at right. */}
      <div className="px-3.5 pt-3.5 flex items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {METRICS.map((m) => {
            const on = metricFilter === m.key
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={on}
                onClick={() => setMetricFilter(on ? null : m.key)}
                className={
                  'rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong ' +
                  (on ? `ring-2 ${m.ring}` : metricFilter ? 'opacity-55 hover:opacity-100' : 'hover:opacity-80')
                }
              >
                <Chip color={m.color} size="sm" dot>{m.label}</Chip>
              </button>
            )
          })}
          {/* Reset — only while a filter is active. Round «✕» on mobile. */}
          {metricFilter && (
            <button
              type="button"
              onClick={() => setMetricFilter(null)}
              aria-label={t('warehouse.filterReset')}
              className="ml-0.5 inline-flex items-center gap-1 flex-shrink-0 rounded-full border transition-colors
                bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40 light:text-rose-600
                focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40
                max-md:w-[1.375rem] max-md:h-[1.375rem] max-md:justify-center
                md:px-2 md:py-0.5 md:text-11 md:font-semibold"
            >
              <Icon name="x" size={11} className="md:hidden" />
              <span className="max-md:hidden">{t('warehouse.filterReset')}</span>
            </button>
          )}
        </div>
        {headerAction && (
          <div className="flex items-center gap-1.5 flex-shrink-0">{headerAction}</div>
        )}
      </div>

      {/* HistoryPanel full-bleed — its own «ИСТОРИЯ» strip reads as a section divider.
          hideMetricChips: the +N/-N chips are surfaced in the row above instead. */}
      <HistoryPanel
        movements={movements}
        skuIds={skuIds}
        parts={parts}
        isMobile={true}
        categoryId={catId}
        remainingAfterMap={remainingAfterMap}
        partsAssets={partsAssets}
        hideMetricChips={true}
        metricFilter={metricFilter}
      />
    </div>
  )
}
