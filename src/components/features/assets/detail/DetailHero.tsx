import { useTranslation } from 'react-i18next'
import type { Asset, CategoryRow, StatusRow } from '@/domain/asset'
import { assetTitle, statusLabel, STATUS_CHIP_COLOR } from '@/components/features/assets/assetFormat'
import { resolveCategoryColor } from '@/components/common/categoryColors'
import { Chip, Icon } from '@/components/ui'
import { CHIP_PALETTE, CHIP_DOT } from '@/components/ui/chip'

interface DetailHeroProps {
  asset: Asset
  category: CategoryRow | null | undefined
  statusRow: StatusRow
  canWriteOff: boolean
  isDisposed: boolean
  onWriteOff: () => void
  /** When provided (asset has a barcode), renders a «Печать наклейки» button in the action cluster. */
  onPrint?: () => void
  /** When true (no print bar follows), apply bottom rounding and full border. */
  roundedBottom?: boolean
  /** Extra classes on the root div — use `flex-1` when the parent is a flex column
   *  that needs this card to grow and fill the available height. */
  className?: string
}

export function DetailHero({
  asset,
  category,
  statusRow,
  canWriteOff,
  isDisposed,
  onWriteOff,
  onPrint,
  roundedBottom = false,
  className = '',
}: DetailHeroProps) {
  const { t } = useTranslation('assets')

  // Same per-category icon-box color as the list: pastel bg + colored icon/border.
  // Icon fallback covers dynamically created categories (id not in the seeded map).
  const catColor = resolveCategoryColor(asset.categoryId, category?.lucideIcon)

  return (
    <div className={`bg-surface overflow-hidden anim-fade-slide-in ${
      roundedBottom
        ? 'rounded-2xl border border-border'
        : 'rounded-t-2xl border border-b-0 border-border'
    } ${className}`}>
      <div className="h-1 w-full bg-gradient-to-r from-accent to-accent-light" />
      <div className="p-3.5 sm:p-6">
        <div className="flex items-start gap-4 max-md:gap-3 max-md:flex-wrap">
          <div
            className="w-12 h-12 max-md:w-10 max-md:h-10 rounded-xl bg-surface-2 border border-border text-text-tertiary flex items-center justify-center shrink-0"
            style={catColor ? { backgroundColor: catColor.bg, color: catColor.icon, borderColor: catColor.icon } : undefined}
          >
            <Icon name={category?.lucideIcon ?? 'package'} size={24} className="max-md:hidden" />
            <Icon name={category?.lucideIcon ?? 'package'} size={20} className="md:hidden" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-18 max-md:text-15 font-bold text-text-primary leading-snug mb-1.5 max-md:mb-1 truncate">
              {assetTitle(asset, category?.name, category?.group)}
            </h1>
            <div className="flex flex-wrap items-center gap-2 max-md:gap-1.5">
              {/* Neutral mono chip, white text (priority identifier), no # — owner request */}
              <span className="inline-flex items-center font-mono text-13 max-md:text-11 font-bold bg-surface-2 text-text-primary ring-1 ring-border px-2 py-0.5 rounded-md">
                {asset.invCode}
              </span>
              {category && <Chip color="blue">{category.name}</Chip>}
              {asset.serial && (
                <span className="inline-flex items-center gap-1.5 text-text-tertiary max-md:text-12">
                  <span className="uppercase tracking-wide text-12 max-md:text-10 text-text-subtle">SN</span>
                  <span className="font-mono text-[#E2E8F0] light:text-slate-700 break-all max-md:text-11">{asset.serial}</span>
                </span>
              )}
            </div>
          </div>
          {/* Status + actions — all three share one height (h-8 desktop / h-11 mobile),
              same padding/rounding/text so they read as a uniform control row.
              Flows after title on mobile (flex-wrap), stays inline on desktop. */}
          <div className="shrink-0 flex gap-2 items-center max-md:w-full max-md:mt-0.5">
            <span
              className={`inline-flex items-center gap-1.5 h-8 max-md:h-11 px-2.5 rounded-lg text-13 font-semibold border ${
                CHIP_PALETTE[STATUS_CHIP_COLOR[statusRow.id] ?? 'gray']
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${CHIP_DOT[STATUS_CHIP_COLOR[statusRow.id] ?? 'gray']}`} />
              {statusLabel(statusRow, t)}
            </span>
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex items-center gap-1.5 h-8 max-md:h-11 px-2.5 rounded-lg text-13 font-semibold text-accent light:text-accent bg-accent/10 border border-accent/30 hover:bg-accent/15 hover:border-accent/50 transition-colors"
              >
                <Icon name="barcode" size={14} />
                {t('label.print')}
              </button>
            )}
            {!isDisposed && canWriteOff && (
              <button
                type="button"
                onClick={onWriteOff}
                className="inline-flex items-center gap-1.5 h-8 max-md:h-11 px-2.5 rounded-lg text-13 font-semibold text-rose-300 light:text-rose-700 bg-rose-500/10 light:bg-rose-50 border border-rose-500/30 light:border-rose-200 hover:bg-rose-500/15 hover:border-rose-500/50 transition-colors max-md:ml-auto"
              >
                <Icon name="archive-x" size={13} />
                {t('detail.hero.writeOff')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
