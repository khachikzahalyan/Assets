import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { HistoryPanel } from './HistoryPanel'
import type { Part, PartMovement, PartStock } from '@/domain/part/types'
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
}

export function WarehouseMobileDetail({
  catId, skus, stockOf, catMeta, onInstall,
  movements, skuIds, parts, remainingAfterMap,
}: WarehouseMobileDetailProps) {
  const { t } = useTranslation('parts')
  const tint = categoryTint(catId)
  const icon = categoryIcon(catId)

  let totalOnHand = 0
  for (const sku of skus) totalOnHand += workingStock(stockOf(sku.id))
  const installSku: Part | null = skus.find(s => workingStock(stockOf(s.id)) > 0) ?? skus.at(0) ?? null
  const title = skus.length === 1 ? (skus[0]?.name ?? catMeta?.label) : catMeta?.label

  return (
    <div className="px-3.5 pt-3.5">
      {/* Category header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <span className={`w-9 h-9 rounded-[10px] ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
            <Icon name={icon} size={16} />
          </span>
          <span className="text-[16px] font-bold text-text-primary">{title}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold rounded-full px-2.5 py-1">
            ● {totalOnHand}шт
          </span>
          {installSku && (
            <button
              type="button"
              onClick={() => onInstall(installSku)}
              className="inline-flex items-center gap-1 bg-accent/10 border border-accent/30 rounded-full px-2.5 py-1"
            >
              <Icon name="wrench" size={10} className="text-accent" />
              <span className="text-[11px] font-semibold text-accent">{t('actions.install', 'Установить')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ИСТОРИЯ overline */}
      <div className="text-[9px] font-bold tracking-[1.3px] uppercase text-text-subtle mb-3">
        {t('warehouse.history', 'ИСТОРИЯ')}
      </div>

      {/* History card */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <HistoryPanel
          movements={movements}
          skuIds={skuIds}
          parts={parts}
          isMobile={true}
          categoryId={catId}
          remainingAfterMap={remainingAfterMap}
        />
      </div>
    </div>
  )
}
