import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import type { Part, PartStock } from '@/domain/part/types'
import type { PartCatMeta, Tint } from './partsTokens'
import { categoryTint, categoryIcon } from './partsTokens'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isSizedCategory, isModelsCategory } from '@/domain/part/partCategory-types'
import { WarehouseSkuRowMobile } from './WarehouseSkuRowMobile'

/** Geometry-preserving placeholder slots used when stock is empty. */
const SKU_PLACEHOLDER_COUNT = 3

/**
 * Desktop empty-stock placeholder: dashed slots matching real SKU row height.
 * Empty card only — no hint text (empty state stays quiet).
 */
function SkuPlaceholderDesktop() {
  return (
    <div className="flex flex-col flex-shrink-0">
      {Array.from({ length: SKU_PLACEHOLDER_COUNT }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="relative flex items-center gap-3 px-5 h-[3.375rem] border-b border-border last:border-b-0"
        >
          <div className="absolute left-5 right-5 top-1/2 -translate-y-1/2 border-t border-dashed border-border/40" />
        </div>
      ))}
    </div>
  )
}

/**
 * Mobile empty-stock placeholder: dashed slots matching WarehouseSkuRowMobile height.
 * Mobile rows rendered by MobileListRow have ~py-[0.4375rem] + two text lines ≈ 48px.
 * Empty card only — no hint text (empty state stays quiet).
 */
function SkuPlaceholderMobile() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: SKU_PLACEHOLDER_COUNT }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="relative px-3.5 border-b border-border last:border-b-0"
          style={{ minHeight: 48 }}
        >
          {/* invisible height-anchor matching MobileListRow two-line layout */}
          <div className="opacity-0 py-[0.4375rem]">
            <div className="text-13 font-bold leading-snug mb-0.5">&nbsp;</div>
            <div className="text-11 leading-snug">&nbsp;</div>
          </div>
          <div className="absolute left-3.5 right-3.5 top-1/2 -translate-y-1/2 border-t border-dashed border-border/40" />
        </div>
      ))}
    </div>
  )
}

/** @deprecated Use isSizedCategory(def) with a live PartCategoryDef. Legacy fallback. */
export const AGG_CATS = new Set(['ssd', 'hdd', 'nvme', 'ram'])

export interface WarehouseSkuListProps {
  selectedCatId: string
  selectedSkus: Part[]
  stockOf: (skuId: string) => PartStock
  isMobile: boolean
  onAddGpu: () => void
  catMeta: PartCatMeta | undefined
  /** Resolved PartCategoryDef for selectedCatId — enables behavior-dispatch */
  catDef?: PartCategoryDef
  /** Tint for the selected category */
  tint?: Tint
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
  selectedCatId, selectedSkus, stockOf, isMobile, onAddGpu, catMeta, catDef, tint,
}: WarehouseSkuListProps) {
  const { t } = useTranslation('parts')

  // Behavior dispatch — use def when available, fall back to legacy AGG_CATS
  const isAggCat = catDef ? isSizedCategory(catDef) : AGG_CATS.has(selectedCatId)
  const isModelsCat = catDef ? isModelsCategory(catDef) : selectedCatId === 'gpu'

  // Per-SKU (non-agg) cats: hide rows with no stock at all.
  // Broken parts stay visible — red chip shows them and they are physically on the shelf.
  const visibleSkus = isAggCat
    ? selectedSkus
    : selectedSkus.filter((s) => {
        const st = stockOf(s.id)
        return st.onHand > 0 || st.broken > 0
      })

  if (visibleSkus.length === 0) {
    if (isModelsCat) {
      /* Models (GPU) zero: preserve slot geometry, keep the Add button as compact action */
      return (
        <div className="flex flex-col flex-shrink-0">
          {isMobile
            ? <SkuPlaceholderMobile />
            : <SkuPlaceholderDesktop />}
          <div className="px-5 pb-3 max-md:px-3.5">
            <button
              type="button"
              onClick={onAddGpu}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-13.5 font-semibold text-accent border border-[#F97316]/30 bg-[#F97316]/10 hover:bg-[#F97316]/15 transition-colors light:border-[#F97316]/40"
            >
              <Icon name="plus" size={12} />
              {t('gpu.addBtn')}
            </button>
          </div>
        </div>
      )
    }
    if (isMobile) {
      return <SkuPlaceholderMobile />
    }
    return <SkuPlaceholderDesktop />
  }

  /* Aggregated categories: one summary row with dual chips */
  if (isAggCat) {
    const resolvedTint = tint ?? categoryTint(selectedCatId)
    const icon = categoryIcon(selectedCatId)
    let totalWorking = 0
    let totalBroken = 0
    for (const sku of visibleSkus) {
      const s = stockOf(sku.id)
      totalWorking += s.onHand
      totalBroken += s.broken
    }
    if (totalWorking === 0 && totalBroken === 0) {
      if (isMobile) return <SkuPlaceholderMobile />
      return <SkuPlaceholderDesktop />
    }
    if (isMobile) {
      return (
        <div>
          <WarehouseSkuRowMobile
            name={catMeta?.label ?? selectedCatId}
            icon={icon}
            tint={resolvedTint}
            onHand={totalWorking}
            broken={totalBroken}
          />
        </div>
      )
    }
    return (
      <ul className="divide-y divide-border flex-shrink-0">
        <li className="flex items-center gap-3 px-5 py-3 hover:bg-[#22272E]/60 transition-colors">
          <span className={`w-8 h-8 rounded-lg ${resolvedTint.iconBg} ${resolvedTint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
            <Icon name={icon} size={14} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-15 font-semibold text-text-primary truncate leading-tight">
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
        const skuTint = categoryTint(sku.category)
        const icon = categoryIcon(sku.category)
        const s = stockOf(sku.id)
        return (
          <li
            key={sku.id}
            className="flex items-center gap-3 px-5 py-3 hover:bg-[#22272E]/60 light:hover:bg-black/[0.03] transition-colors"
          >
            <span className={`w-8 h-8 rounded-lg ${skuTint.iconBg} ${skuTint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
              <Icon name={icon} size={14} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-15 font-semibold text-text-primary truncate leading-tight">
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
