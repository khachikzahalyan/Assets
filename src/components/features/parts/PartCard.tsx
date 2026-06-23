import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import type { Part, PartStock } from '@/domain/part/types'
import { categoryTint, categoryIcon, PART_CAT_BY_ID } from './partsTokens'

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
  psu: null,
  cooler: null,
  ssd: STORAGE_VARIANTS,
  hdd: STORAGE_VARIANTS,
  nvme: STORAGE_VARIANTS,
  ram: RAM_VARIANTS,
  gpu: null,
}

export interface PartCardProps {
  categoryId: string
  skus: Part[]
  selected: boolean
  onSelect: (id: string) => void
  onInstall: (sku: Part) => void
  onAddGpu?: () => void
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
export function PartCard({
  categoryId,
  skus,
  selected,
  onSelect,
  onInstall,
  onAddGpu,
  stockMap = {},
}: PartCardProps) {
  const { t } = useTranslation('parts')
  const isRam = categoryId === 'ram'
  const isGpu = categoryId === 'gpu'
  const [ramDdr, setRamDdr] = useState<'DDR3' | 'DDR4' | 'DDR5'>('DDR4')

  const catMeta = PART_CAT_BY_ID[categoryId]
  const tint = categoryTint(categoryId)
  const icon = categoryIcon(categoryId)
  const allVariants = CATEGORY_VARIANTS[categoryId] ?? null

  /* For RAM: filter by selected DDR gen */
  const activeSkus = isRam ? skus.filter((s) => s.ddr === ramDdr) : skus

  /* For RAM: only show variant ids that have a matching SKU */
  const variants: Variant[] | null = (() => {
    if (!allVariants) return null
    if (isRam) {
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

  /* Single SKU (psu/cooler) */
  const singleSku = !allVariants && !isGpu ? (activeSkus[0] ?? null) : null

  /* Lookup SKU by variant id */
  const skuByVariant: Record<string, Part> = allVariants
    ? Object.fromEntries(
        activeSkus
          .filter((s) => s.variantId)
          .map((s) => [s.variantId as string, s]),
      )
    : {}

  /* Subtitle text */
  const subtitle = (() => {
    if (allVariants) {
      const count = variants?.length ?? 0
      if (categoryId === 'ram') {
        // e.g. "3 размера"
        return count === 0
          ? 'Нет размеров'
          : count === 1
          ? '1 размер'
          : count <= 4
          ? `${count} размера`
          : `${count} размеров`
      }
      return count === 0
        ? 'Нет размеров'
        : count === 1
        ? '1 размер'
        : count <= 4
        ? `${count} размера`
        : `${count} размеров`
    }
    if (isGpu) {
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

        {/* RAM DDR pills — click doesn't propagate to card select */}
        {isRam && (
          <div
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {(['DDR3', 'DDR4', 'DDR5'] as const).map((ddr) => (
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

          {/* GPU: orange Добавить */}
          {isGpu && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAddGpu?.()
              }}
              title={t('gpu.addBtn')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[13.5px] font-medium text-accent hover:text-accent hover:bg-[#F97316]/10 transition-colors"
            >
              <Icon name="plus" size={11} />
              {t('gpu.addBtn')}
            </button>
          )}

          {/* Single-SKU (psu/cooler): inline Install button */}
          {!isGpu && !allVariants && singleSku && (() => {
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
          {allVariants && (
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
}
