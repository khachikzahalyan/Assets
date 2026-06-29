import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { PartsAsset } from '@/domain/part/types'
import { assetFamilyOf, isServiceOnly } from '@/domain/part/partStock'
import { CATEGORY_COLOR } from '@/components/features/assets/categoryColors'

/** Fallback lucide icon by hardware family (when the category has no lucideIcon). */
function familyIconFallback(family: string): string {
  if (family === 'laptop') return 'laptop'
  if (family === 'server') return 'server'
  return 'monitor'
}

export interface DeviceGridCardProps {
  asset: PartsAsset
  selected: boolean
  /** hasBroken: true when any installed SKU on this asset has broken stock > 0 */
  hasBroken?: boolean
  onSelect: () => void
}

/**
 * Compact 2-col grid card for the Devices tab left panel.
 * Layout from prototype parts.html lines 2876-2945.
 * No action buttons — actions live in the right detail panel.
 */
export function DeviceGridCard({ asset, selected, hasBroken = false, onSelect }: DeviceGridCardProps) {
  const { t } = useTranslation('parts')

  const family = assetFamilyOf(asset.categoryId) ?? 'desktop'
  const isService = isServiceOnly(asset.categoryId)

  /* Category icon + colour — SAME system as the Assets page (categoryColors.ts
     + the category's lucideIcon) so laptops/desktops/servers look identical there. */
  const catColor = CATEGORY_COLOR[asset.categoryId] ?? null
  const iconName = asset.categoryIcon || familyIconFallback(family)
  const accent = catColor?.icon ?? '#F97316'

  /* Category human label — the category NAME (e.g. «Ноутбук»), not the raw id. */
  const catLabel = asset.categoryName || asset.kind || asset.categoryId || ''

  /* Total components = number of upgradeCurrent entries (all slots, including empty factory ones) */
  const totalComponents = asset.upgradeCurrent.length

  /* Status dot */
  const dotColor = hasBroken ? 'bg-amber-400' : 'bg-emerald-400'

  /* selected → inset accent left border */
  const cardStyle: React.CSSProperties = selected
    ? { boxShadow: `inset 2px 0 0 ${accent}` }
    : {}

  const cardBg = selected ? 'bg-white/10' : 'bg-surface hover:bg-white/[0.05]'

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={cardStyle}
      className={`${cardBg} border border-border rounded-xl p-2.5 cursor-pointer transition-colors flex flex-col h-full w-full text-left`}
    >
      {/* top row: family icon + status dot + component count */}
      <div className="flex items-start justify-between gap-1">
        {/* category icon square — colours from the Assets category palette */}
        <span
          className="w-9 h-9 rounded-lg inline-flex items-center justify-center flex-shrink-0 max-md:w-7 max-md:h-7"
          style={catColor ? { backgroundColor: catColor.bg, color: catColor.icon } : undefined}
        >
          {/* icon svg: 16px desktop → 13px mobile */}
          <Icon name={iconName} size={16} className="max-md:!w-[13px] max-md:!h-[13px]" />
        </span>
        {/* status dot + component counter */}
        <div className="flex items-center gap-1 pt-0.5 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          {/* component count: 13px desktop, 11.5px mobile */}
          <span className="text-[13px] text-text-subtle tabular-nums whitespace-nowrap max-md:text-[11.5px]">
            {totalComponents}&nbsp;{t('devices.compShort', 'комп.')}
          </span>
          {isService && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/30 rounded px-1 py-0.5 flex-shrink-0">
              <Icon name="wrench" size={8} />
              {t('device.service')}
            </span>
          )}
        </div>
      </div>
      {/* name + subtitle — name: 15px desktop, 12px mobile; inv-code: 13px desktop, 11.5px mobile */}
      <div className="mt-2 min-w-0 max-md:mt-1">
        <div
          className="text-[15px] font-medium text-text-primary leading-tight truncate max-md:text-[12px]"
          title={asset.name}
        >
          {asset.name}
        </div>
        <div className="text-[13px] text-text-subtle mt-0.5 truncate max-md:text-[11.5px]">
          {asset.id}&nbsp;·&nbsp;{catLabel}
        </div>
      </div>
    </button>
  )
}
