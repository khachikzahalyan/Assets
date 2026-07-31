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
  /**
   * Revealed full key for a FREE row (mobile only): a free key exists to be
   * re-activated elsewhere, so the admin needs to read it. When present it
   * replaces `masked` on free rows; in-use rows always stay masked.
   */
  revealedKey?: string | null
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
  revealedKey,
  isFree,
  assetName,
  assetInvCode,
  showAction,
  onRowClick,
  onActivate,
  outerStyle,
}: KeyRowMobileProps) {
  const { t } = useTranslation('licenses')

  // Free rows show the real key when revealed (see revealedKey doc); otherwise
  // masked. In-use rows always stay masked (attached to a live device).
  const keyDisplay = isFree && revealedKey ? revealedKey : masked

  // Status pill — CHIP_PALETTE.green for free, CHIP_PALETTE.blue for in_use
  const pillPalette = isFree ? CHIP_PALETTE.green : CHIP_PALETTE.blue
  const statusLabel = isFree ? t('keys.statusFree') : t('keys.statusInUse')

  // lic.name is «{Brand Model} — Ключ продукта» — show only the DEVICE (the part
  // before the dash), not the "Ключ продукта" prefix (owner request):
  //   in_use → the assigned asset name (e.g. «DELL XPS»);
  //   free   → the origin device + «Освобождён …».
  const deviceName = lic.name.includes(' — ') ? (lic.name.split(' — ')[0] ?? lic.name) : lic.name
  const freedDate = lic.retiredAt ?? lic.assignedAt ?? null
  const subline = isFree
    ? [deviceName, freedDate ? t('keys.freedOn', { date: fmtDate(freedDate, 'ru') }) : null]
        .filter(Boolean)
        .join(' · ')
    : (assetName ?? deviceName)

  const iconTile = (
    <span
      className="w-[1.75rem] h-[1.75rem] rounded-[8px] inline-flex items-center justify-center flex-shrink-0 bg-amber-500/15 text-amber-300 light:text-amber-700"
      aria-hidden="true"
    >
      <Icon name="key-round" size={13} />
    </span>
  )

  const titleNode = (
    // No truncation for free keys — the whole key must be readable; the mono
    // string wraps at char boundaries if the viewport is very narrow.
    <div
      className={[
        'font-mono text-12.5 font-bold text-text-primary leading-snug mb-0.5',
        isFree ? 'break-all' : 'truncate',
      ].join(' ')}
    >
      {keyDisplay}
    </div>
  )

  const sublineNode = (
    <div className="text-11 text-text-tertiary truncate leading-snug">
      {subline}
    </div>
  )

  // For free rows: right slot shows a compact "Activate" button (no redundant pill).
  // For in-use rows: right slot shows the "● Используется" pill + inventory code.
  const right = showAction ? (
    // Icon-only on mobile — text removed to give the full key room (owner request).
    <button
      type="button"
      onClick={onActivate}
      data-testid={`activate-btn-${lic.id}`}
      aria-label={t('keys.activate')}
      title={t('keys.activate')}
      className={[
        'flex-shrink-0 inline-flex items-center justify-center',
        'w-8 h-8 rounded-md',
        'text-accent-light border border-accent/30 bg-accent/10',
        'hover:bg-accent/20 transition-colors',
      ].join(' ')}
    >
      <Icon name="circle-check" size={15} />
    </button>
  ) : (
    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
      <span
        className={[
          'inline-flex items-center border rounded-[5px] px-[0.4375rem] py-0.5',
          'text-10 font-bold whitespace-nowrap leading-none',
          pillPalette,
        ].join(' ')}
      >
        {'● '}{statusLabel}
      </span>
      {assetInvCode && (
        // Inventory code is a top-priority identifier — white, larger, bold so
        // it reads clearly against the row (owner request).
        <span className="font-['JetBrains_Mono',ui-monospace,monospace] text-12.5 font-bold text-text-primary whitespace-nowrap">
          {assetInvCode}
        </span>
      )}
    </div>
  )

  return (
    <MobileListRow
      dataTestId={`key-row-${lic.id}`}
      {...(outerStyle !== undefined ? { outerStyle } : {})}
      iconTile={iconTile}
      title={titleNode}
      subline={sublineNode}
      right={right}
      onClick={onRowClick}
    />
  )
}
