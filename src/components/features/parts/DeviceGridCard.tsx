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
  /** isMobile: true on ≤767px — renders a full-width horizontal list card with chevron */
  isMobile?: boolean
  onSelect: () => void
}

/**
 * Compact 2-col grid card for the Devices tab left panel.
 * Layout from prototype parts.html lines 2876-2945.
 * No action buttons — actions live in the right detail panel.
 */
export function DeviceGridCard({ asset, selected, hasBroken = false, isMobile = false, onSelect }: DeviceGridCardProps) {
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

  /* ── Mobile: full-width horizontal list card ─────────────────────────────
   * Layout (per owner screenshot):
   *   Row 1: [N комп. chip (emerald/amber)] [Сервисное badge if applicable]
   *   Row 2: [category icon 32px] [device name + invCode·type subtitle] [chevron-right]
   * ─────────────────────────────────────────────────────────────────────── */
  if (isMobile) {
    const chipTone = hasBroken
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'

    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`${cardBg} border rounded-xl px-4 py-3 cursor-pointer transition-colors w-full text-left flex flex-col gap-2 ${selected ? 'border-accent' : 'border-border'}`}
      >
        {/* Row 1: component count chip + service badge */}
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-medium border ${chipTone}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
            {totalComponents}&nbsp;{t('devices.compShort', 'комп.')}
          </span>
          {isService && (
            <span className="inline-flex items-center gap-0.5 text-[10.5px] font-medium bg-violet-500/10 text-violet-300 border border-violet-500/30 rounded-full px-2 py-0.5 flex-shrink-0">
              <Icon name="wrench" size={9} />
              {t('device.service')}
            </span>
          )}
        </div>
        {/* Row 2: category icon + name/subtitle + chevron */}
        <div className="flex items-center gap-3">
          <span
            className="w-8 h-8 rounded-lg inline-flex items-center justify-center flex-shrink-0"
            style={catColor ? { backgroundColor: catColor.bg, color: catColor.icon } : undefined}
          >
            <Icon name={iconName} size={15} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[13.5px] font-semibold text-text-primary leading-tight truncate"
              title={asset.name}
            >
              {asset.name}
            </div>
            <div className="text-[11.5px] text-text-subtle mt-0.5 truncate">
              <span className="font-mono">{asset.id}</span>&nbsp;·&nbsp;{catLabel}
            </div>
          </div>
          <Icon name="chevron-right" size={16} className="text-text-subtle flex-shrink-0" />
        </div>
      </button>
    )
  }

  /* ── Desktop: compact 2-col grid card (unchanged) ───────────────────── */
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
          className="w-9 h-9 rounded-lg inline-flex items-center justify-center flex-shrink-0"
          style={catColor ? { backgroundColor: catColor.bg, color: catColor.icon } : undefined}
        >
          <Icon name={iconName} size={16} />
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
