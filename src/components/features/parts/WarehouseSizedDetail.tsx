import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip, MobileSheet } from '@/components/ui'
import { WarehouseHistorySection } from './WarehouseHistorySection'
import { variantRank } from './partsTokens'
import { workingStock } from '@/domain/part/partStock'
import type { Part, PartMovement, PartsAsset, PartStock } from '@/domain/part/types'

export interface WarehouseSizedDetailProps {
  categoryId: string
  /** All SKUs in this category (all variants/sizes). */
  skus: Part[]
  /** Per-SKU stock map (authoritative, derived from movements). */
  stockMap: Record<string, PartStock>
  onInstall: (sku: Part) => void
  /** Movement log — feeds the shared «История» section. */
  movements: PartMovement[]
  /** SKU id set for this category (history filter). */
  skuIds: Set<string>
  /** All parts (SKU-label resolution in history). */
  parts: Part[]
  /** Running-stock snapshot per movement id (for «Осталось N шт»). */
  remainingAfterMap: Record<string, number>
  /** Upgradeable-asset projections — resolves asset names in history rows. */
  partsAssets?: PartsAsset[]
}

/**
 * Mobile-only layout for sized categories (SSD / HDD / M.2 / ОЗУ).
 *
 * IDENTICAL design to single-position categories (PSU / Cooler): the shared
 * WarehouseHistorySection (metric chips + «Установить» + HistoryPanel). No
 * category header and no inline per-size list — the selected category is already
 * shown in the chip strip, and history reads the same on every category.
 *
 * The difference is behind «Установить»: because these categories have multiple
 * sizes (256 ГБ, 2 ТБ …), tapping it opens a size-picker sheet listing the
 * in-stock variants; picking one hands off to the shared InstallModal. With a
 * single in-stock size we skip the picker and install it directly.
 */
export function WarehouseSizedDetail({
  categoryId,
  skus,
  stockMap,
  onInstall,
  movements,
  skuIds,
  parts,
  remainingAfterMap,
  partsAssets = [],
}: WarehouseSizedDetailProps) {
  const { t } = useTranslation('parts')
  const [pickerOpen, setPickerOpen] = useState(false)

  // In-stock variants (workingStock > 0), ordered by variant rank (small → large).
  const inStock = skus
    .filter((s) => workingStock(stockMap[s.id] ?? { onHand: 0, broken: 0 }) > 0)
    .slice()
    .sort((a, b) => variantRank(categoryId, a.variantId) - variantRank(categoryId, b.variantId))

  const handleInstallClick = () => {
    if (inStock.length === 0) return
    if (inStock.length === 1) {
      onInstall(inStock[0]!)
      return
    }
    setPickerOpen(true)
  }

  const pickSize = (sku: Part) => {
    setPickerOpen(false)
    onInstall(sku)
  }

  // «Установить» — surfaced as the history section's header action (same as Cooler/PSU).
  const installBtn = inStock.length > 0 ? (
    <button
      type="button"
      onClick={handleInstallClick}
      aria-label={t('actions.install', 'Установить')}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-md"
    >
      <Chip color="orange" size="sm">
        <Icon name="wrench" size={10} />
        {t('actions.install', 'Установить')}
      </Chip>
    </button>
  ) : null

  return (
    <>
      <WarehouseHistorySection
        catId={categoryId}
        movements={movements}
        skuIds={skuIds}
        parts={parts}
        remainingAfterMap={remainingAfterMap}
        partsAssets={partsAssets}
        {...(installBtn ? { headerAction: installBtn } : {})}
      />

      {/* Size picker — which in-stock size to install. Picking one opens InstallModal. */}
      <MobileSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('warehouse.pickSizeTitle', 'Выберите размер')}
        height="60vh"
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {inStock.map((sku, idx) => {
            const onHand = workingStock(stockMap[sku.id] ?? { onHand: 0, broken: 0 })
            const label = sku.variantLabel || sku.name
            const isLast = idx === inStock.length - 1
            return (
              <button
                key={sku.id}
                type="button"
                onClick={() => pickSize(sku)}
                className={`flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2${!isLast ? ' border-b border-border/60' : ''}`}
              >
                <span className="text-14.5 font-medium text-text-primary min-w-0 truncate">
                  {label}
                  {sku.ddr && <span className="text-text-tertiary font-normal"> · {sku.ddr}</span>}
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <Chip color="green" size="sm" dot>{onHand} шт</Chip>
                  <Icon name="chevron-right" size={15} className="text-text-subtle" />
                </span>
              </button>
            )
          })}
        </div>
      </MobileSheet>
    </>
  )
}
