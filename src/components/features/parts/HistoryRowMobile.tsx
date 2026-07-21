/**
 * HistoryRowMobile — mobile event row for the parts warehouse history list.
 * Wraps ui/MobileListRow with movement-specific slot content.
 *
 * Slot mapping:
 *   accentClass  → movement kind: emerald (receive/uninstall/move), amber (install), rose (broken)
 *   iconTile     → 28×28 kind-tinted tile using category icon
 *   title        → SKU label (13px bold truncate)
 *   subline      → install+assetCode: «invCode · assetName · Осталось N шт»
 *                  other with assetCode: «invCode · assetName»
 *                  no assetCode: package icon + «Со склада»
 *   right        → kind pill (top) + date (bottom, mono 10px)
 *
 * Rows are inert (no onClick) — warehouse history is read-only on mobile.
 */
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { CHIP_PALETTE } from '@/components/ui/chip'
import { Icon, MobileListRow } from '@/components/ui'
import type { PartMovement } from '@/domain/part/types'
import { fmtPartsDate } from './partsTokens'

/** Simplified visual kind for mobile — collapses uninstall/move into 'receive'. */
type MobileKind = 'receive' | 'install' | 'broken'

function resolveKind(mv: PartMovement): MobileKind {
  if (mv.broken) return 'broken'
  if (mv.type === 'install') return 'install'
  return 'receive'
}

/**
 * assetName is a denormalised display field that is present at runtime on some
 * movement documents but has not yet been promoted into the domain PartMovement
 * type. We intersect it here rather than casting to `any`.
 * Exported for HistoryPanel's desktop branch (same runtime field).
 */
export type MovementRuntime = PartMovement & { assetName?: string | null }

export interface HistoryRowMobileProps {
  mv: PartMovement
  /** Full SKU label — name + variantLabel, resolved from the parts lookup. */
  skuLabel: string
  /** Lucide icon name for the SKU category (e.g. 'plug', 'fan'). */
  catIconName: string
  /** Warehouse stock remaining after this movement (used in install subline). */
  remainingAfter: number
  /**
   * Asset category display name (e.g. "Ноутбук", "Компьютер") — shown instead
   * of skuLabel on install / uninstall rows so the user sees WHAT device was
   * affected rather than the SKU name (which is obvious from the panel context).
   */
  assetCategoryName?: string | null
  /**
   * When true this install was a service replacement — stock was NOT debited.
   * A compact "Сервис" chip is rendered to distinguish it from a regular install.
   */
  isServiceReplace?: boolean
}

export const HistoryRowMobile = memo(function HistoryRowMobile({
  mv,
  skuLabel,
  catIconName,
  remainingAfter,
  assetCategoryName,
  isServiceReplace = false,
}: HistoryRowMobileProps) {
  const { t } = useTranslation('parts')
  const rt = mv as MovementRuntime
  const kind = resolveKind(mv)

  /* For install / uninstall rows: show asset category name instead of SKU name.
     Falls back to skuLabel when assetCategoryName is not available. */
  const isMovementWithAsset = kind === 'install' || kind === 'broken' || mv.type === 'uninstall'
  const displayTitle = (isMovementWithAsset && assetCategoryName)
    ? assetCategoryName
    : skuLabel

  /* Left accent bar — kind-keyed */
  const accentClass =
    kind === 'broken'  ? 'border-l-rose-400'  :
    kind === 'install' ? 'border-l-amber-400'  :
    'border-l-emerald-400'

  /* Icon tile tint — kind-keyed (NOT category-keyed) */
  const tileCls =
    kind === 'broken'  ? 'bg-rose-500/15 text-rose-300'   :
    kind === 'install' ? 'bg-amber-500/15 text-amber-300'  :
    'bg-emerald-500/15 text-emerald-300'

  /* Status pill */
  const pillCls =
    kind === 'broken'  ? CHIP_PALETTE.red   :
    kind === 'install' ? CHIP_PALETTE.amber  :
    CHIP_PALETTE.green
  const pillLabel =
    kind === 'broken'  ? t('warehouse.actionScrapped')  :
    kind === 'install' ? t('warehouse.actionInstalled')  :
    `+${mv.qty ?? 1}`

  /* Subline — install: «Осталось N шт» moves here (kills the pill-overlap bug) */
  const assetCode = mv.assetInvCode ?? mv.assetId ?? null
  const assetName = rt.assetName ?? null

  /* Slots */
  const iconTile = (
    <span
      className={`w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 ${tileCls}`}
      aria-hidden="true"
    >
      <Icon name={catIconName} size={13} />
    </span>
  )

  const titleNode = (
    <div className="text-[13px] font-bold text-text-primary truncate leading-snug mb-[2px] flex items-center gap-1.5">
      <span className="truncate">{displayTitle}</span>
      {isServiceReplace && (
        <span
          className="inline-flex items-center border rounded-[4px] px-[5px] py-[1px] text-[9px] font-bold whitespace-nowrap leading-none flex-shrink-0 bg-teal-500/15 text-teal-300 border-teal-500/30"
          aria-label={t('warehouse.serviceChip')}
        >
          {t('warehouse.serviceChip')}
        </span>
      )}
    </div>
  )

  const sublineNode = (
    <div className="text-[11px] text-text-tertiary truncate leading-snug">
      {!assetCode ? (
        <span className="inline-flex items-center gap-1">
          <Icon name="package" size={9} aria-hidden="true" />
          {t('warehouse.fromWarehouse')}
        </span>
      ) : kind === 'install' ? (
        [assetCode, assetName, `${t('warehouse.actionRemaining')} ${remainingAfter} шт`]
          .filter(Boolean)
          .join(' · ')
      ) : (
        [assetCode, assetName].filter(Boolean).join(' · ')
      )}
    </div>
  )

  const right = (
    <div className="flex flex-col items-end gap-[3px] flex-shrink-0">
      <span
        className={[
          'inline-flex items-center border rounded-[5px] px-[7px] py-[2px]',
          'text-[10px] font-bold whitespace-nowrap leading-none',
          pillCls,
        ].join(' ')}
      >
        {'● '}{pillLabel}
      </span>
      <span className="font-['JetBrains_Mono',ui-monospace,monospace] text-[10px] text-text-subtle whitespace-nowrap tabular-nums">
        {fmtPartsDate(mv.at)}
      </span>
    </div>
  )

  /* No onClick — history rows are inert on mobile */
  return (
    <MobileListRow
      accentClass={accentClass}
      iconTile={iconTile}
      title={titleNode}
      subline={sublineNode}
      right={right}
    />
  )
})
