/**
 * WarehouseSkuRowMobile — mobile SKU row for the Warehouse «Склад» tab.
 * Wraps ui/MobileListRow for both per-SKU and aggregated-category rows.
 *
 * Used by WarehouseTab.renderSkuList() when isMobile is true.
 * Rows are inert (no onClick) — selection is handled by CategoryChipStrip.
 */
import { memo } from 'react'
import { CHIP_PALETTE } from '@/components/ui/chip'
import { Icon, MobileListRow } from '@/components/ui'
import type { Tint } from './partsTokens'

export interface WarehouseSkuRowMobileProps {
  /** Category label (agg rows) or SKU name (per-SKU rows). */
  name: string
  /** Optional variant suffix rendered in muted weight inline with the name. */
  variantLabel?: string | null
  /** Lucide icon name for the category (e.g. 'plug', 'fan'). */
  icon: string
  /** Icon tile background + text colour from CATEGORY_TINT. */
  tint: Tint
  /** Working (on-hand) stock count. */
  onHand: number
  /** Broken/scrapped stock count — omitted when 0. */
  broken: number
}

export const WarehouseSkuRowMobile = memo(function WarehouseSkuRowMobile({
  name,
  variantLabel,
  icon,
  tint,
  onHand,
  broken,
}: WarehouseSkuRowMobileProps) {
  const iconTile = (
    <span
      className={`w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 ${tint.iconBg} ${tint.iconText}`}
      aria-hidden="true"
    >
      <Icon name={icon} size={13} />
    </span>
  )

  const titleNode = (
    <div className="text-[13px] font-bold text-text-primary truncate leading-snug">
      {name}
      {variantLabel && (
        <span className="text-text-tertiary font-normal"> · {variantLabel}</span>
      )}
    </div>
  )

  const right = (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <span
        className={[
          'inline-flex items-center border rounded-[5px] px-[7px] py-[2px]',
          'text-[10px] font-bold whitespace-nowrap leading-none',
          CHIP_PALETTE.green,
        ].join(' ')}
      >
        {'● '}{onHand} шт
      </span>
      {broken > 0 && (
        <span
          className={[
            'inline-flex items-center border rounded-[5px] px-[7px] py-[2px]',
            'text-[10px] font-bold whitespace-nowrap leading-none',
            CHIP_PALETTE.red,
          ].join(' ')}
        >
          {'● '}{broken} шт
        </span>
      )}
    </div>
  )

  /* No accentClass — SKU rows are informational, not selected/active items. */
  return (
    <MobileListRow
      iconTile={iconTile}
      title={titleNode}
      right={right}
    />
  )
})
