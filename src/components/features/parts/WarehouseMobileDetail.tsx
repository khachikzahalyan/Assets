import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import { WarehouseHistorySection } from './WarehouseHistorySection'
import { WarehouseInstallSkuSheet, buildSkuPickerItems } from './WarehouseInstallSkuSheet'
import type { Part, PartMovement, PartStock, PartsAsset } from '@/domain/part/types'
import { workingStock } from '@/domain/part/partStock'
import type { ReactNode } from 'react'

/**
 * Mobile-only layout for single-position warehouse categories (PSU / Cooler)
 * and for models categories (GPU) when routed through this component.
 *
 * Install flow (fixed):
 *   0 in-stock → no «Установить» button
 *   1 in-stock → tap installs directly (no picker)
 *   2+ in-stock → tap opens MobileSheet picker; picking a row calls onInstall
 *
 * extraHeaderAction — optional ReactNode rendered BEFORE the install chip in the
 * header action fragment. Used by the GPU (isModelsCat) branch in WarehouseTab
 * to add the green «Добавить видеокарту» chip.
 */

export interface WarehouseMobileDetailProps {
  catId: string
  skus: Part[]
  stockOf: (skuId: string) => PartStock
  catMeta: { id: string; label: string; icon: string } | undefined
  onInstall: (sku: Part) => void
  movements: PartMovement[]
  skuIds: Set<string>
  parts: Part[]
  remainingAfterMap: Record<string, number>
  /** Forwarded to HistoryPanel for asset category name resolution. */
  partsAssets?: PartsAsset[]
  /**
   * Optional extra action rendered BEFORE the install chip in the section header.
   * Always rendered (even when 0 in-stock) — caller controls its visibility.
   */
  extraHeaderAction?: ReactNode
}

export function WarehouseMobileDetail({
  catId,
  skus,
  stockOf,
  onInstall,
  movements,
  skuIds,
  parts,
  remainingAfterMap,
  partsAssets = [],
  extraHeaderAction,
}: WarehouseMobileDetailProps) {
  const { t } = useTranslation('parts')
  const [pickerOpen, setPickerOpen] = useState(false)

  // In-stock SKUs (workingStock > 0).
  const inStock = skus.filter((s) => workingStock(stockOf(s.id)) > 0)

  const handleInstallClick = () => {
    if (inStock.length === 0) return
    if (inStock.length === 1) {
      onInstall(inStock[0]!)
      return
    }
    setPickerOpen(true)
  }

  const pickSku = (sku: Part) => {
    setPickerOpen(false)
    onInstall(sku)
  }

  // «Установить» chip — shown only when ≥1 in stock.
  const installBtn =
    inStock.length > 0 ? (
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

  // Build the composed headerAction: extraHeaderAction (always) + install btn (conditional).
  const hasHeaderAction = extraHeaderAction !== undefined || installBtn !== null
  const headerAction = hasHeaderAction ? (
    <>
      {extraHeaderAction}
      {installBtn}
    </>
  ) : null

  // Build picker items for the sheet (only in-stock).
  const pickerItems = buildSkuPickerItems(skus, stockOf)

  return (
    <>
      <WarehouseHistorySection
        catId={catId}
        movements={movements}
        skuIds={skuIds}
        parts={parts}
        remainingAfterMap={remainingAfterMap}
        partsAssets={partsAssets}
        {...(headerAction ? { headerAction } : {})}
      />

      {/* SKU picker — shown when 2+ in-stock and user tapped «Установить». */}
      <WarehouseInstallSkuSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('warehouse.pickSkuTitle', 'Выберите запчасть')}
        items={pickerItems}
        onPick={pickSku}
      />
    </>
  )
}
