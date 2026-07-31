import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { HistoryPanel } from './HistoryPanel'
import type { Part, PartMovement, PartStock, PartsAsset } from '@/domain/part/types'
import { categoryTint, categoryIcon } from './partsTokens'
import { workingStock } from '@/domain/part/partStock'

/**
 * Mobile-only layout for single-position warehouse categories (PSU / Cooler).
 * Shows: header row (icon, title, stock count, install button) +
 *        "ИСТОРИЯ" overline + HistoryPanel wrapped in a card.
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
  catId, skus, stockOf, catMeta, onInstall,
  movements, skuIds, parts, remainingAfterMap,
  partsAssets = [],
}: WarehouseMobileDetailProps) {
  const { t } = useTranslation('parts')
  const tint = categoryTint(catId)
  const icon = categoryIcon(catId)

  let totalOnHand = 0
  for (const sku of skus) totalOnHand += workingStock(stockOf(sku.id))
  const installSku: Part | null = skus.find(s => workingStock(stockOf(s.id)) > 0) ?? null
  const title = skus.length === 1 ? (skus[0]?.name ?? catMeta?.label) : catMeta?.label

  return (
    <div>
      {/* Category header — own gutter (14px = card gutter) */}
      <div className="px-3.5 pt-3.5 flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <span className={`w-9 h-9 rounded-[10px] ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
            <Icon name={icon} size={16} />
          </span>
          <span className="text-16 font-bold text-text-primary">{title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-11 font-bold rounded-full px-2.5 py-1 flex-shrink-0
            ${totalOnHand > 0
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 light:text-emerald-700'
              : 'bg-surface-2 border border-border text-text-subtle'}`}>
            ● {totalOnHand}шт
          </span>
          {installSku && (
            <button
              type="button"
              onClick={() => onInstall(installSku)}
              className="inline-flex items-center gap-1 bg-accent/10 border border-accent/30 rounded-full px-2.5 py-1"
            >
              <Icon name="wrench" size={10} className="text-accent" />
              <span className="text-11 font-semibold text-accent">{t('actions.install', 'Установить')}</span>
            </button>
          )}
        </div>
      </div>

      {/* HistoryPanel full-bleed — its own metrics strip (bg-bg border-t border-border)
          reads as an in-card section divider; the duplicate «ИСТОРИЯ» overline and
          the nested card wrapper have been removed. HistoryPanel is NOT modified. */}
      <HistoryPanel
        movements={movements}
        skuIds={skuIds}
        parts={parts}
        isMobile={true}
        categoryId={catId}
        remainingAfterMap={remainingAfterMap}
        partsAssets={partsAssets}
      />
    </div>
  )
}
