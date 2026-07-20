import { useTranslation } from 'react-i18next'
import { Icon, Chip, EmptyState } from '@/components/ui'
import type { Part, PartStock } from '@/domain/part/types'
import type { PartCatMeta } from './partsTokens'
import { categoryTint, categoryIcon } from './partsTokens'
import { WarehouseSkuRowMobile } from './WarehouseSkuRowMobile'

/** Categories whose SKUs collapse to one aggregate summary row (not enumerated). */
export const AGG_CATS = new Set(['ssd', 'hdd', 'nvme', 'ram'])

export interface WarehouseSkuListProps {
  selectedCatId: string
  selectedSkus: Part[]
  stockOf: (skuId: string) => PartStock
  isMobile: boolean
  onAddGpu: () => void
  catMeta: PartCatMeta | undefined
}

/**
 * Right-panel SKU list for the Склад (Warehouse) tab.
 * Extracted from WarehouseTab.renderSkuList — mechanical extraction, behavior preserved.
 *
 * Per-SKU cats (psu / cooler / gpu): only rows with onHand > 0 || broken > 0 are shown.
 * AGG_CATS (ssd / hdd / nvme / ram): all SKUs are included in aggregate totals;
 *   shows EmptyState when totalWorking === 0 && totalBroken === 0.
 * GPU zero: keeps the special emptyGpu branch with the Add button.
 * Non-GPU zero: shared EmptyState (warehouse.noStock + warehouse.noneAvailableHint).
 */
export function WarehouseSkuList({
  selectedCatId, selectedSkus, stockOf, isMobile, onAddGpu, catMeta,
}: WarehouseSkuListProps) {
  const { t } = useTranslation('parts')
  const isGpuCat = selectedCatId === 'gpu'

  // Per-SKU (non-agg) cats: hide rows with no stock at all.
  // Broken parts stay visible — red chip shows them and they are physically on the shelf.
  const visibleSkus = AGG_CATS.has(selectedCatId)
    ? selectedSkus
    : selectedSkus.filter((s) => {
        const st = stockOf(s.id)
        return st.onHand > 0 || st.broken > 0
      })

  if (visibleSkus.length === 0) {
    if (isGpuCat) {
      return (
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <span className="w-12 h-12 rounded-full bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
              <Icon name="microchip" size={20} />
            </span>
            <div className="text-[15px] font-semibold text-text-secondary">{t('warehouse.emptyGpu')}</div>
            <div className="text-[14px] text-text-tertiary mt-1">{t('warehouse.emptyGpuHint')}</div>
            <button
              type="button"
              onClick={onAddGpu}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14.5px] font-semibold text-accent border border-[#F97316]/30 bg-[#F97316]/10 hover:bg-[#F97316]/15 transition-colors"
            >
              <Icon name="plus" size={12} />
              {t('gpu.addBtn')}
            </button>
          </div>
        </div>
      )
    }
    return (
      <EmptyState
        icon="package-open"
        title={t('warehouse.noStock')}
        description={t('warehouse.noneAvailableHint')}
      />
    )
  }

  /* Aggregated categories: one summary row with dual chips */
  if (AGG_CATS.has(selectedCatId)) {
    const tint = categoryTint(selectedCatId)
    const icon = categoryIcon(selectedCatId)
    let totalWorking = 0
    let totalBroken = 0
    for (const sku of visibleSkus) {
      const s = stockOf(sku.id)
      totalWorking += s.onHand
      totalBroken += s.broken
    }
    if (totalWorking === 0 && totalBroken === 0) {
      return (
        <EmptyState
          icon="package-open"
          title={t('warehouse.noStock')}
          description={t('warehouse.noneAvailableHint')}
        />
      )
    }
    if (isMobile) {
      return (
        <div>
          <WarehouseSkuRowMobile
            name={catMeta?.label ?? selectedCatId}
            icon={icon}
            tint={tint}
            onHand={totalWorking}
            broken={totalBroken}
          />
        </div>
      )
    }
    return (
      <ul className="divide-y divide-border flex-shrink-0">
        <li className="flex items-center gap-3 px-5 py-3 hover:bg-[#22272E]/60 transition-colors">
          <span className={`w-8 h-8 rounded-lg ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
            <Icon name={icon} size={14} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-text-primary truncate leading-tight">
              {catMeta?.label ?? selectedCatId}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Chip color="green" size="sm" dot>{totalWorking} шт</Chip>
            {totalBroken > 0 && <Chip color="red" size="sm" dot>{totalBroken} шт</Chip>}
          </div>
        </li>
      </ul>
    )
  }

  /* Per-SKU rows (psu / cooler / gpu) */
  if (isMobile) {
    return (
      <div>
        {visibleSkus.map((sku) => {
          const skuTint = categoryTint(sku.category)
          const skuIcon = categoryIcon(sku.category)
          const s = stockOf(sku.id)
          return (
            <WarehouseSkuRowMobile
              key={sku.id}
              name={sku.name}
              variantLabel={sku.variantLabel ?? null}
              icon={skuIcon}
              tint={skuTint}
              onHand={s.onHand}
              broken={s.broken}
            />
          )
        })}
      </div>
    )
  }
  return (
    <ul className="divide-y divide-border flex-shrink-0">
      {visibleSkus.map((sku) => {
        const tint = categoryTint(sku.category)
        const icon = categoryIcon(sku.category)
        const s = stockOf(sku.id)
        return (
          <li
            key={sku.id}
            className="flex items-center gap-3 px-5 py-3 hover:bg-[#22272E]/60 transition-colors"
          >
            <span className={`w-8 h-8 rounded-lg ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
              <Icon name={icon} size={14} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-text-primary truncate leading-tight">
                {sku.name}
                {sku.variantLabel && (
                  <span className="text-text-tertiary font-normal"> · {sku.variantLabel}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Chip color="green" size="sm" dot>{s.onHand} шт</Chip>
              {s.broken > 0 && <Chip color="red" size="sm" dot>{s.broken} шт</Chip>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
