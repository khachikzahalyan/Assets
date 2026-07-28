import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { Part } from '@/domain/part/types'
import { workingStock } from '@/domain/part/partStock'
import type { PartStock } from '@/domain/part/types'
import { categoryTint, categoryIcon, PART_CAT_BY_ID, variantRank } from './partsTokens'

/** Placeholder slots for sized-category empty state (mobile-only component).
 *  Slots match the per-size row height (py-3.5 ≈ 56px).
 *  Empty card only — no hint text (empty state stays quiet). */
function SizedPlaceholder() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="relative border-b border-border/50 last:border-b-0"
        >
          {/* invisible height-anchor matching real per-size row */}
          <div className="opacity-0 flex items-center justify-between px-3.5 py-3.5">
            <span className="text-[13.5px] font-medium">&nbsp;</span>
          </div>
          <div className="absolute left-3.5 right-3.5 top-1/2 -translate-y-1/2 border-t border-dashed border-border/40" />
        </div>
      ))}
    </div>
  )
}

export interface WarehouseSizedDetailProps {
  categoryId: string
  /** All SKUs in this category (all variants/sizes). */
  skus: Part[]
  /** Per-SKU stock map (authoritative, derived from movements). */
  stockMap: Record<string, PartStock>
  onInstall: (sku: Part) => void
}

/**
 * Mobile-only per-size row layout for sized categories (SSD / HDD / M.2 / ОЗУ).
 * Replaces the desktop AGG_CATS collapsed single-row on mobile.
 *
 * Shows only in-stock sizes (workingStock > 0). If the whole category has no
 * stock, renders an EmptyState instead of the size list.
 *
 * Layout per prototype:
 *   – Category header: [36px colored icon][title + "N размеров"][● Nшт chip][chevron]
 *   – ОЗУ only: DDR3/DDR4/DDR5 toggle (active = uniform accent)
 *   – Per-size rows (in-stock only): label left, [qty + "Установить" button] right
 */
export function WarehouseSizedDetail({ categoryId, skus, stockMap, onInstall }: WarehouseSizedDetailProps) {
  const { t } = useTranslation('parts')
  const [ramDdr, setRamDdr] = useState('DDR4')

  const tint = categoryTint(categoryId)
  const icon = categoryIcon(categoryId)
  const catMeta = PART_CAT_BY_ID[categoryId]
  const isRam = categoryId === 'ram'

  const totalOnHand = skus.reduce((sum, s) => {
    const stock = stockMap[s.id] ?? { onHand: 0, broken: 0 }
    return sum + workingStock(stock)
  }, 0)

  const ddrFiltered = isRam ? skus.filter(s => s.ddr === ramDdr) : skus
  const visibleSkus = ddrFiltered
    .filter(s => workingStock(stockMap[s.id] ?? { onHand: 0, broken: 0 }) > 0)
    .slice()
    .sort((a, b) => variantRank(categoryId, a.variantId) - variantRank(categoryId, b.variantId))

  const sizeCount = visibleSkus.length
  const sizeLabel = totalOnHand === 0
    ? t('warehouse.noStock')
    : `${sizeCount} ${sizeCount === 1 ? 'размер' : sizeCount >= 2 && sizeCount <= 4 ? 'размера' : 'размеров'}`

  return (
    <div>
      {/* Category header */}
      <div className="flex items-center gap-3 px-3.5 py-3.5 border-b border-border">
        <span className={`w-9 h-9 rounded-[10px] ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
          <Icon name={icon} size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-text-primary leading-tight">{catMeta?.label ?? categoryId}</div>
          <div className="text-[11.5px] text-text-secondary">{sizeLabel}</div>
        </div>
        <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 flex-shrink-0
          ${totalOnHand > 0
            ? 'bg-emerald-500/10 border border-emerald-500/28 text-emerald-400'
            : 'bg-surface-2 border border-border text-text-subtle'}`}>
          ● {totalOnHand}шт
        </span>
        <Icon name="chevron-up" size={14} className="text-text-subtle flex-shrink-0" />
      </div>

      {/* Whole category empty → geometry-preserving placeholder, no icon/heading */}
      {totalOnHand === 0 ? (
        <SizedPlaceholder />
      ) : (
        <>
          {/* DDR toggle for ОЗУ */}
          {isRam && (
            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border/50">
              {['DDR3', 'DDR4', 'DDR5'].map(ddr => (
                <button
                  key={ddr}
                  type="button"
                  onClick={() => setRamDdr(ddr)}
                  className={`px-2.5 h-5 rounded text-[10px] font-semibold transition-all
                    ${ramDdr === ddr
                      ? 'bg-accent text-white'
                      : 'bg-surface text-text-tertiary border border-border hover:border-border-strong'}`}
                >
                  {ddr}
                </button>
              ))}
            </div>
          )}

          {/* Per-size rows — all in stock (filtered above, no 0шт branch needed) */}
          {visibleSkus.length === 0 ? (
            <div className="px-3.5 py-6 text-[13px] text-text-subtle text-center">
              {t('warehouse.noStock')}
            </div>
          ) : (
            <div>
              {visibleSkus.map((sku, idx) => {
                const stock = stockMap[sku.id] ?? { onHand: 0, broken: 0 }
                const onHand = workingStock(stock)
                const sizeCellLabel = sku.variantLabel || sku.name
                const isLast = idx === visibleSkus.length - 1
                return (
                  <div
                    key={sku.id}
                    className={`flex items-center justify-between px-3.5 py-3.5${!isLast ? ' border-b border-border/50' : ''}`}
                  >
                    <span className="text-[13.5px] font-medium text-text-primary">
                      {sizeCellLabel}
                    </span>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[13px] font-semibold text-text-primary">{onHand} шт</span>
                      <button
                        type="button"
                        onClick={() => onInstall(sku)}
                        className="inline-flex items-center gap-1 text-accent text-[12px] font-semibold"
                      >
                        <Icon name="wrench" size={11} />
                        {t('actions.install', 'Установить')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
