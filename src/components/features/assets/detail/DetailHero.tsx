import { useTranslation } from 'react-i18next'
import type { Asset, CategoryRow, StatusRow } from '@/domain/asset'
import { assetTitle, STATUS_CHIP_COLOR } from '@/components/features/assets/assetFormat'
import { CATEGORY_COLOR } from '@/components/features/assets/categoryColors'
import { Btn, Chip, Icon } from '@/components/ui'

interface DetailHeroProps {
  asset: Asset
  category: CategoryRow | null | undefined
  statusRow: StatusRow
  canWriteOff: boolean
  isDisposed: boolean
  onWriteOff: () => void
  /** When true (no print bar follows), apply bottom rounding and full border. */
  roundedBottom?: boolean
}

export function DetailHero({
  asset,
  category,
  statusRow,
  canWriteOff,
  isDisposed,
  onWriteOff,
  roundedBottom = false,
}: DetailHeroProps) {
  const { t } = useTranslation('assets')

  // Same per-category icon-box color as the list (CATEGORY_COLOR): pastel bg + colored icon/border.
  const catColor = CATEGORY_COLOR[asset.categoryId] ?? null

  return (
    <div className={`bg-surface overflow-hidden anim-fade-slide-in ${
      roundedBottom
        ? 'rounded-2xl border border-border'
        : 'rounded-t-2xl border border-b-0 border-border'
    }`}>
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
            <h1 className="text-[18px] max-md:text-[15px] font-bold text-text-primary leading-snug mb-1.5 max-md:mb-1 truncate">
              {assetTitle(asset, category?.name, category?.group)}
            </h1>
            <div className="flex flex-wrap items-center gap-2 max-md:gap-1.5">
              <span className="inline-flex items-center gap-1 font-mono text-[13px] max-md:text-[11px] font-semibold bg-accent/10 text-accent-light ring-1 ring-accent/25 px-2 py-0.5 rounded-md">
                <Icon name="hash" size={11} />
                {asset.invCode}
              </span>
              {category && <Chip color="blue">{category.name}</Chip>}
              {asset.serial && (
                <span className="inline-flex items-center gap-1.5 text-text-tertiary max-md:text-[12px]">
                  <span className="uppercase tracking-wide text-[12px] max-md:text-[10px] text-text-subtle">SN</span>
                  <span className="font-mono text-[#E2E8F0] break-all max-md:text-[11px]">{asset.serial}</span>
                </span>
              )}
            </div>
          </div>
          {/* Status + write-off: flows after title on mobile (flex-wrap), stays inline on desktop */}
          <div className="shrink-0 flex gap-2 items-center max-md:w-full max-md:mt-0.5">
            <Chip color={STATUS_CHIP_COLOR[statusRow.id] ?? 'gray'} dot>
              {statusRow.name}
            </Chip>
            {!isDisposed && canWriteOff && (
              <Btn variant="danger" size="sm" onClick={onWriteOff} className="max-md:ml-auto max-md:min-h-[44px]">
                <Icon name="archive-x" size={12} />
                {t('detail.hero.writeOff')}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
