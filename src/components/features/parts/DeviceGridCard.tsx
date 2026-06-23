import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { PartsAsset } from '@/domain/part/types'
import { assetFamilyOf, isServiceOnly } from '@/domain/part/partStock'
import { familyChip, PART_CAT_BY_ID } from './partsTokens'

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
  const cfg = familyChip(family)
  const isService = isServiceOnly(asset.categoryId)

  /* Category human label */
  const catMeta = PART_CAT_BY_ID[asset.categoryId]
  const catLabel = catMeta ? catMeta.label : (asset.categoryId || asset.kind || '')

  /* Total components = number of upgradeCurrent entries (all slots, including empty factory ones) */
  const totalComponents = asset.upgradeCurrent.length

  /* Status dot */
  const dotColor = hasBroken ? 'bg-amber-400' : 'bg-emerald-400'

  /* selected → inset accent left border */
  const cardStyle: React.CSSProperties = selected
    ? { boxShadow: `inset 2px 0 0 ${cfg.accent}` }
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
        {/* family icon square */}
        <span
          className={`w-9 h-9 rounded-lg ${cfg.iconBg} ${cfg.iconText} inline-flex items-center justify-center flex-shrink-0`}
        >
          <Icon name={cfg.iconName} size={16} />
        </span>
        {/* status dot + component counter */}
        <div className="flex items-center gap-1 pt-0.5 flex-shrink-0">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className="text-[13px] text-text-subtle tabular-nums whitespace-nowrap">
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
      {/* name + subtitle */}
      <div className="mt-2 min-w-0">
        <div
          className="text-[15px] font-medium text-text-primary leading-tight truncate"
          title={asset.name}
        >
          {asset.name}
        </div>
        <div className="text-[13px] text-text-subtle mt-0.5 truncate">
          {asset.id}&nbsp;·&nbsp;{catLabel}
        </div>
      </div>
    </button>
  )
}
