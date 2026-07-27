/**
 * KeyRowMobile — mobile list row for a Windows workstation license key.
 * Wraps ui/MobileListRow with license-specific slot content.
 *
 * Layout (via MobileListRow):
 *   FREE  (showAction=true):  [28×28 icon tile] [masked-key title / subline, flex-1] [Активировать button, right]
 *   IN-USE (showAction=false): [28×28 icon tile] [masked-key title / subline, flex-1] [● Используется pill + invCode, right]
 *
 * The full-width footer button has been removed — the activate action lives
 * in the right slot so the row stays a single compact line.
 */
import type { CSSProperties, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CHIP_PALETTE } from '@/components/ui/chip'
import { Icon, MobileListRow } from '@/components/ui'
import type { WorkstationLicense } from '@/domain/license'
import { fmtDate } from './licenseHelpers'

export interface KeyRowMobileProps {
  lic: WorkstationLicense
  masked: string
  isFree: boolean
  /** Display name of the assigned asset (in_use rows); null for free rows. */
  assetName: string | null
  /** Inventory code shown in the right column (in_use rows only). */
  assetInvCode: string | null
  /**
   * Whether to render the activate button — true when the parent filter
   * is "free". Kept separate from isFree so the parent controls the condition.
   */
  showAction: boolean
  onRowClick: () => void
  onActivate: (e: MouseEvent) => void
  /** Inline styles on the outer div — the parent injects flexGrow/flexShrink so
   *  rows distribute the card height evenly (same fill contract as AssetRowMobile). */
  outerStyle?: CSSProperties
}

export function KeyRowMobile({
  lic,
  masked,
  isFree,
  assetName,
  assetInvCode,
  showAction,
  onRowClick,
  onActivate,
  outerStyle,
}: KeyRowMobileProps) {
  const { t } = useTranslation('licenses')

  // Left accent bar — mirrors STATUS_BORDER_L in AssetRowMobile
  const borderL = isFree ? 'border-l-emerald-400' : 'border-l-sky-400'
  // Status pill — CHIP_PALETTE.green for free, CHIP_PALETTE.blue for in_use
  const pillPalette = isFree ? CHIP_PALETTE.green : CHIP_PALETTE.blue
  const statusLabel = isFree ? t('keys.statusFree') : t('keys.statusInUse')

  // lic.name is usually «{Brand Model} — Ключ продукта» — on mobile we keep only
  // the kind after the dash so the subline doesn't duplicate the asset name:
  // in_use → «Ключ продукта Asus H510», free → «Ключ продукта · Освобождён …».
  const kind = lic.name.includes(' — ')
    ? (lic.name.split(' — ').pop() ?? lic.name)
    : lic.name
  const freedDate = lic.retiredAt ?? lic.assignedAt ?? null
  const subline = isFree
    ? [kind, freedDate ? t('keys.freedOn', { date: fmtDate(freedDate, 'ru') }) : null]
        .filter(Boolean)
        .join(' · ')
    : [kind, assetName].filter(Boolean).join(' ')

  const iconTile = (
    <span
      className="w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-amber-500/15 text-amber-300"
      aria-hidden="true"
    >
      <Icon name="key-round" size={13} />
    </span>
  )

  const titleNode = (
    <div className="font-mono text-[13px] font-bold text-text-primary truncate leading-snug mb-[2px]">
      {masked}
    </div>
  )

  const sublineNode = (
    <div className="text-[11px] text-text-tertiary truncate leading-snug">
      {subline}
    </div>
  )

  // For free rows: right slot shows a compact "Activate" button (no redundant pill).
  // For in-use rows: right slot shows the "● Используется" pill + inventory code.
  const right = showAction ? (
    <button
      type="button"
      onClick={onActivate}
      data-testid={`activate-btn-${lic.id}`}
      className={[
        'flex-shrink-0 inline-flex items-center gap-1',
        'h-7 px-2.5 rounded-md',
        'text-[12px] font-semibold whitespace-nowrap',
        'text-accent-light border border-accent/30 bg-accent/10',
        'hover:bg-accent/20 transition-colors',
      ].join(' ')}
    >
      <Icon name="circle-check" size={12} />
      {t('keys.activate')}
    </button>
  ) : (
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      <span
        className={[
          'inline-flex items-center border rounded-[5px] px-[7px] py-[2px]',
          'text-[10px] font-bold whitespace-nowrap leading-none',
          pillPalette,
        ].join(' ')}
      >
        {'● '}{statusLabel}
      </span>
      {assetInvCode && (
        <span className="font-['JetBrains_Mono',ui-monospace,monospace] text-[10px] text-text-subtle whitespace-nowrap">
          {assetInvCode}
        </span>
      )}
    </div>
  )

  return (
    <MobileListRow
      dataTestId={`key-row-${lic.id}`}
      {...(outerStyle !== undefined ? { outerStyle } : {})}
      accentClass={borderL}
      iconTile={iconTile}
      title={titleNode}
      subline={sublineNode}
      right={right}
      onClick={onRowClick}
    />
  )
}
