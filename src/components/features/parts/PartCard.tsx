import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import type { Part, PartStock } from '@/domain/part/types'
import { categoryTint, categoryIcon, PART_CAT_BY_ID } from './partsTokens'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isSizedCategory, isModelsCategory } from '@/domain/part/partCategory-types'

/* ── Variant shapes (mirrors prototype CATEGORY_VARIANTS) ── */
interface Variant {
  id: string
  label: string
}
const STORAGE_VARIANTS: Variant[] = [
  { id: '64gb', label: '64 ГБ' },
  { id: '128gb', label: '128 ГБ' },
  { id: '256gb', label: '256 ГБ' },
  { id: '512gb', label: '512 ГБ' },
  { id: '1tb', label: '1 ТБ' },
  { id: '2tb', label: '2 ТБ' },
  { id: '3tb', label: '3 ТБ' },
  { id: '4tb', label: '4 ТБ' },
  { id: '5tb', label: '5 ТБ' },
]
const RAM_VARIANTS: Variant[] = [
  { id: '4gb', label: '4 ГБ' },
  { id: '8gb', label: '8 ГБ' },
  { id: '16gb', label: '16 ГБ' },
  { id: '20gb', label: '20 ГБ' },
  { id: '32gb', label: '32 ГБ' },
  { id: '40gb', label: '40 ГБ' },
  { id: '64gb', label: '64 ГБ' },
  { id: '128gb', label: '128 ГБ' },
]
const CATEGORY_VARIANTS: Record<string, Variant[] | null> = {
  psu: null, cooler: null, gpu: null,
  ssd: STORAGE_VARIANTS, hdd: STORAGE_VARIANTS, nvme: STORAGE_VARIANTS,
  ram: RAM_VARIANTS,
}

export interface PartCardProps {
  categoryId: string
  skus: Part[]
  selected: boolean
  onSelect: (id: string) => void
  onInstall: (sku: Part) => void
  /** @deprecated Use onAddSku for models-category. Kept for legacy GPU call sites. */
  onAddGpu?: () => void
  /** Generic models-sku add handler (replaces gpu-specific onAddGpu). */
  onAddSku?: () => void
  /** Resolved PartCategoryDef — enables behavior dispatch for custom categories. */
  catDef?: PartCategoryDef
  /** Live stock map from WarehouseTab (keyed by skuId) */
  stockMap?: Record<string, PartStock>
}

/**
 * Per-category card for the Склад (Warehouse) tab left column.
 * Matches the prototype PartCard exactly:
 *  - Horizontal layout: 10×10 icon plaque | label + subtitle | green chip + CTA
 *  - Selected: orange border + ring + shadow
 *  - RAM: DDR3/DDR4/DDR5 pills to filter variants
 *  - Multi-variant (ram/ssd/hdd/nvme): click header to expand variant list with per-row Install
 *  - GPU: orange "+ Добавить" button instead of Install
 *  - Single-SKU (psu/cooler): inline "Установить" text button
 */
export const PartCard = memo(function PartCard({
  categoryId,
  skus,
  selected,
  onSelect,
  onInstall,
  onAddGpu,
  onAddSku,
  catDef,
  stockMap = {},
}: PartCardProps) {
  const { t } = useTranslation('parts')

  // Legacy id-based checks (used as fallback when catDef is absent)
  const isRamLegacy = categoryId === 'ram'
  const isGpuLegacy = categoryId === 'gpu'

  // Behavior dispatch: prefer def, fall back to id-based legacy checks
  const isModels = catDef ? isModelsCategory(catDef) : isGpuLegacy
  const isSized = catDef ? isSizedCategory(catDef) : (CATEGORY_VARIANTS[categoryId] !== null && CATEGORY_VARIANTS[categoryId] !== undefined)
  const isRamDef = catDef ? (catDef.generations !== null && catDef.generations !== undefined && catDef.generations.length > 0) : isRamLegacy

  const [ramDdr, setRamDdr] = useState('DDR4')

  const catMeta = PART_CAT_BY_ID[categoryId]
  const tint = categoryTint(categoryId)
  const icon = categoryIcon(categoryId)

  // Derive variants from def when available, else use legacy CATEGORY_VARIANTS
  const allVariants: Variant[] | null = (() => {
    if (catDef) {
      if (!catDef.variants) return null
      return catDef.variants.map(v => ({ id: v.id, label: v.label }))
    }
    return CATEGORY_VARIANTS[categoryId] ?? null
  })()

  // DDR generation labels from def.generations when present
  const ddrGens: string[] = (() => {
    if (catDef?.generations && catDef.generations.length > 0) {
      return [...catDef.generations].sort((a, b) => a.order - b.order).map(g => g.label)
    }
    return ['DDR3', 'DDR4', 'DDR5']
  })()

  /* For RAM-like: filter by selected DDR gen */
  const activeSkus = isRamDef ? skus.filter((s) => s.ddr === ramDdr) : skus

  /* For sized: only show variant ids that have a matching SKU */
  const variants: Variant[] | null = (() => {
    if (!allVariants) return null
    if (isRamDef) {
      const activeVariantIds = new Set(
        activeSkus.filter((s) => s.variantId).map((s) => s.variantId as string),
      )
      return allVariants.filter((v) => activeVariantIds.has(v.id))
    }
    return allVariants
  })()

  /* Helper: resolve PartStock for a SKU */
  const stockOf = (skuId: string): PartStock => stockMap[skuId] ?? { onHand: 0, broken: 0 }

  /* Total on-hand for header chip */
  const total = activeSkus.reduce((acc, s) => acc + stockOf(s.id).onHand, 0)

  /* Single SKU (psu/cooler) — not sized and not models */
  const singleSku = !allVariants && !isModels ? (activeSkus[0] ?? null) : null

  /* Lookup SKU by variant id */
  const skuByVariant: Record<string, Part> = allVariants
    ? Object.fromEntries(
        activeSkus
          .filter((s) => s.variantId)
          .map((s) => [s.variantId as string, s]),
      )
    : {}

  /* Subtitle: count only in-stock variants (onHand > 0, consistent with the expanded list). */
  const inStockVariantCount = (variants ?? []).filter((v) => {
    const sku = skuByVariant[v.id]
    return sku !== undefined && stockOf(sku.id).onHand > 0
  }).length
  const subtitle = (() => {
    if (allVariants) {
      const n = inStockVariantCount
      return n === 0 ? 'Нет размеров' : n === 1 ? '1 размер' : n <= 4 ? `${n} размера` : `${n} размеров`
    }
    if (isModels) {
      const n = skus.length
      if (n === 0) return 'Нет записей'
      return n === 1 ? '1 модель' : n <= 4 ? `${n} модели` : `${n} моделей`
    }
    return singleSku ? singleSku.name : '—'
  })()

  return (
    <div
      onClick={() => onSelect(categoryId)}
      className={`
        relative bg-surface border rounded-xl overflow-hidden transition-all cursor-pointer
        ${selected
          ? 'border-[#F97316] shadow-md shadow-[#FB923C]/40 ring-2 ring-[#F97316]/15'
          : 'border-border shadow-sm shadow-black/30 hover:shadow-md hover:border-border-strong'}
      `}
    >
      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Icon plaque */}
        <span
          className={`w-10 h-10 rounded-lg ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}
        >
          <Icon name={icon} size={18} />
        </span>

        {/* Label + subtitle */}
        <div className="flex-1 min-w-0">
          <div className="text-[15.5px] font-semibold text-text-primary truncate">
            {catMeta?.label ?? categoryId}
          </div>
          <div className="text-[13.5px] text-text-subtle mt-0.5">{subtitle}</div>
        </div>

        {/* RAM-like DDR pills — click doesn't propagate to card select */}
        {isRamDef && (
          <div
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {ddrGens.map((ddr) => (
              <button
                key={ddr}
                type="button"
                onClick={() => setRamDdr(ddr)}
                className={`px-2.5 h-6 rounded-full text-[13px] font-semibold transition-all border
                  ${ramDdr === ddr
                    ? 'bg-accent border-accent text-white shadow-sm shadow-[#FB923C]/40'
                    : 'bg-surface border-border text-text-tertiary hover:border-border-strong hover:text-text-secondary'}`}
              >
                {ddr}
              </button>
            ))}
          </div>
        )}

        {/* Right side: count chip + CTA */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Chip color="green" size="sm" dot>
            {total} шт
          </Chip>

          {/* Models (GPU): orange Добавить */}
          {isModels && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                const handler = onAddSku ?? onAddGpu
                handler?.()
              }}
              title={t('gpu.addBtn')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[13.5px] font-medium text-accent hover:text-accent hover:bg-[#F97316]/10 transition-colors"
            >
              <Icon name="plus" size={11} />
              {t('gpu.addBtn')}
            </button>
          )}

          {/* Single-SKU (psu/cooler): inline Install button */}
          {!isModels && !allVariants && singleSku && (() => {
            const singleWorking = stockOf(singleSku.id).onHand
            return (
              <button
                type="button"
                disabled={singleWorking === 0}
                onClick={(e) => {
                  e.stopPropagation()
                  if (singleWorking > 0) onInstall(singleSku)
                }}
                title={singleWorking === 0 ? t('warehouse.noStock') : t('actions.install')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[13.5px] font-medium transition-colors
                  ${singleWorking === 0
                    ? 'text-text-subtle cursor-not-allowed'
                    : 'text-accent hover:text-accent hover:bg-[#F97316]/10'}`}
              >
                <Icon name="wrench" size={11} />
                {t('actions.install')}
              </button>
            )
          })()}

          {/* Multi-variant: chevron */}
          {isSized && allVariants && (
            <span className={`text-text-subtle transition-transform ${selected ? 'rotate-180' : ''}`}>
              <Icon name="chevron-down" size={14} />
            </span>
          )}
        </div>
      </div>

      {/* ── EXPANDED VARIANTS LIST ── */}
      {selected && allVariants && (() => {
        const visibleVariants = (variants ?? []).filter((v) => {
          const sku = skuByVariant[v.id]
          return sku && stockOf(sku.id).onHand > 0
        })

        if (visibleVariants.length === 0) {
          return (
            <div
              className="border-t border-[#2A2F36]/60 bg-[#1B1F24]/70 px-4 py-3 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-[14px] text-text-tertiary">{t('warehouse.noneAvailable')}</div>
              <div className="text-[13px] text-text-subtle mt-0.5">{t('warehouse.noneAvailableHint')}</div>
            </div>
          )
        }

        return (
          <div
            className="border-t border-[#2A2F36]/60 bg-[#1B1F24]/70 max-h-[220px] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ul className="divide-y divide-border">
              {visibleVariants.map((v) => {
                const sku = skuByVariant[v.id]
                if (!sku) return null
                const onH = stockOf(sku.id).onHand
                return (
                  <li
                    key={v.id}
                    className="flex items-center gap-3 pl-[1.05rem] pr-3 py-1.5 hover:bg-bg"
                  >
                    <span className="font-mono text-[14px] font-semibold text-text-secondary w-16 flex-shrink-0">
                      {v.label}
                    </span>
                    <div className="flex-1" />
                    <Chip color="gray" size="sm">
                      {onH} шт
                    </Chip>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onInstall(sku)
                      }}
                      title={t('actions.install')}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[13.5px] font-medium text-accent hover:text-accent hover:bg-surface transition-colors"
                    >
                      <Icon name="wrench" size={11} />
                      {t('actions.install')}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })()}
    </div>
  )
})
