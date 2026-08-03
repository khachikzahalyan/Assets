import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import { WarehouseHistorySection } from './WarehouseHistorySection'
import type { Part, PartMovement, PartStock, PartsAsset } from '@/domain/part/types'
import { workingStock } from '@/domain/part/partStock'

/**
 * Mobile-only layout for single-position warehouse categories (PSU / Cooler).
 * Renders the shared WarehouseHistorySection (metric chips + HistoryPanel) with
 * the single-SKU «Установить» button surfaced as the section's header action.
 * Only mounted on mobile — WarehouseTab renders this via the isMobile branch.
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
}

export function WarehouseMobileDetail({
  catId, skus, stockOf, onInstall,
  movements, skuIds, parts, remainingAfterMap,
  partsAssets = [],
}: WarehouseMobileDetailProps) {
  const { t } = useTranslation('parts')

  const installSku: Part | null = skus.find(s => workingStock(stockOf(s.id)) > 0) ?? null

  // Single-position install action → surfaced as the history section's header action.
  const installBtn = installSku ? (
    <button
      type="button"
      onClick={() => onInstall(installSku)}
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
    <WarehouseHistorySection
      catId={catId}
      movements={movements}
      skuIds={skuIds}
      parts={parts}
      remainingAfterMap={remainingAfterMap}
      partsAssets={partsAssets}
      {...(installBtn ? { headerAction: installBtn } : {})}
    />
  )
}
