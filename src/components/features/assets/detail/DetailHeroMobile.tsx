import { useTranslation } from 'react-i18next'
import type { Asset, CategoryRow, StatusRow } from '@/domain/asset'
import { assetTitle, STATUS_CHIP_COLOR } from '@/components/features/assets/assetFormat'
import { Chip, Icon } from '@/components/ui'
import { CHIP_PALETTE, CHIP_DOT } from '@/components/ui/chip'

/**
 * Mobile-only hero card for the Asset Detail page (≤767px).
 *
 * Structure (matches prototype §589–618):
 *   ┌─────────────────────────────────────────────┐
 *   │  [icon]  title                  ● status    │
 *   │          # invCode  [category]  SN serial   │
 *   ├─────────────────────────────────────────────┤
 *   │  [Печать наклейки]  [Списать]               │  ← only if either button exists
 *   └─────────────────────────────────────────────┘
 *
 * Desktop hero: DetailHero.tsx — left untouched.
 * This file is imported ONLY by AssetDetailMobileView.tsx.
 */

interface DetailHeroMobileProps {
  asset: Asset
  category: CategoryRow | null | undefined
  statusRow: StatusRow
  /** Already accounts for `!isDisposed` at the call site. */
  canWriteOff: boolean
  isDisposed: boolean
  onWriteOff: () => void
  /** Present only when asset.barcode is set. */
  onPrint?: () => void
}

export function DetailHeroMobile({
  asset,
  category,
  statusRow,
  canWriteOff,
  isDisposed,
  onWriteOff,
  onPrint,
}: DetailHeroMobileProps) {
  const { t } = useTranslation('assets')

  // Status pill colour.
  const chipColor = STATUS_CHIP_COLOR[statusRow.id] ?? 'gray'

  const showPrint    = Boolean(onPrint && asset.barcode)
  const showWriteOff = !isDisposed && canWriteOff
  const showActions  = showPrint || showWriteOff

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 anim-fade-slide-in">

      {/* ── TOP ROW: icon box + title/meta ── */}
      <div className="flex items-start gap-3">

        {/* Category icon box — ~50px, neutral surface (prototype uses a plain box, not category-tinted) */}
        <div className="w-[50px] h-[50px] rounded-xl bg-surface-2 border border-border text-text-secondary flex items-center justify-center shrink-0">
          <Icon name={category?.lucideIcon ?? 'package'} size={22} aria-hidden="true" />
        </div>

        {/* Title + meta block */}
        <div className="flex-1 min-w-0">

          {/* First line: asset title (left) + status pill (right) */}
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-[19px] font-bold text-text-primary leading-snug break-words min-w-0">
              {assetTitle(asset, category?.name, category?.group)}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 shrink-0 h-7 px-2.5 rounded-lg text-[12px] font-semibold border ${
                CHIP_PALETTE[chipColor]
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${CHIP_DOT[chipColor]}`} />
              {statusRow.name}
            </span>
          </div>

          {/* Second line: inv-code chip + category chip + serial */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {/* Inventory code — accent mono chip */}
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold bg-accent/10 text-accent-light ring-1 ring-accent/25 px-2 py-0.5 rounded-md">
              <Icon name="hash" size={10} aria-hidden="true" />
              {asset.invCode}
            </span>

            {/* Category label */}
            {category && (
              <Chip color="blue" size="sm">
                {category.name}
              </Chip>
            )}

            {/* Serial number — muted mono */}
            {asset.serial && (
              <span className="inline-flex items-center gap-1 text-text-tertiary">
                <span className="uppercase tracking-wide text-[10px] text-text-subtle">SN</span>
                <span className="font-mono text-[11px] text-[#E2E8F0]">{asset.serial}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: action buttons (flex-1 each, side-by-side) ── */}
      {showActions && (
        <div className="flex gap-2 mt-3.5">
          {showPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium text-text-secondary bg-surface-2 border border-border hover:text-text-primary hover:border-border-strong transition-colors"
            >
              <Icon name="printer" size={14} aria-hidden="true" />
              {t('label.print')}
            </button>
          )}
          {showWriteOff && (
            <button
              type="button"
              onClick={onWriteOff}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/15 hover:border-rose-500/50 transition-colors"
            >
              <Icon name="archive-x" size={13} aria-hidden="true" />
              {t('detail.hero.writeOff')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
