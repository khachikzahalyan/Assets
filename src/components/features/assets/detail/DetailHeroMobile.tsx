import { useTranslation } from 'react-i18next'
import type { Asset, CategoryRow, StatusRow } from '@/domain/asset'
import { assetTitle, STATUS_CHIP_COLOR } from '@/components/features/assets/assetFormat'
import { resolveCategoryColor } from '@/components/common/categoryColors'
import { Chip, Icon } from '@/components/ui'
import { CHIP_PALETTE, CHIP_DOT } from '@/components/ui/chip'

/**
 * Mobile-only hero card for the Asset Detail page (≤767px).
 *
 * Structure (owner mock, 2026-07-28, compact revision):
 *   ┌───────────────────────────────────────────────┐
 *   │  [tinted icon]  title       ● status  Списать │
 *   │                 [category chip]               │
 *   ├───────────────────────────────────────────────┤  ← divider
 *   │  [459/9128389]  [SN] SN-sabdsb                │  ← one compact line, no labels
 *   └───────────────────────────────────────────────┘
 *
 * No print button on mobile — labels cannot be printed from a phone.
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
}

export function DetailHeroMobile({
  asset,
  category,
  statusRow,
  canWriteOff,
  isDisposed,
  onWriteOff,
}: DetailHeroMobileProps) {
  const { t } = useTranslation('assets')

  // Status pill colour.
  const chipColor = STATUS_CHIP_COLOR[statusRow.id] ?? 'gray'
  // Same per-type tint as the list rows (id first, icon fallback for dynamic categories).
  const catColor = resolveCategoryColor(asset.categoryId, category?.lucideIcon)

  const showWriteOff = !isDisposed && canWriteOff

  return (
    <div className="bg-surface rounded-2xl border border-border px-3.5 py-2.5 anim-fade-slide-in">

      {/* ── Row 1: tinted icon box + title/category + status & write-off ── */}
      <div className="flex items-start gap-3">
        <div
          className="w-[48px] h-[48px] rounded-xl bg-surface-2 border border-border text-text-secondary flex items-center justify-center shrink-0"
          style={catColor ? { backgroundColor: catColor.bg, color: catColor.icon, borderColor: catColor.icon } : undefined}
        >
          <Icon name={category?.lucideIcon ?? 'package'} size={22} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-bold text-text-primary leading-snug truncate">
            {assetTitle(asset, category?.name, category?.group)}
          </h1>
          {category && (
            <div className="mt-0.5">
              <Chip color="blue" size="sm">{category.name}</Chip>
            </div>
          )}
        </div>

        {/* Compact control cluster (owner: «делай компактнее») */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-semibold border ${
              CHIP_PALETTE[chipColor]
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${CHIP_DOT[chipColor]}`} />
            {statusRow.name}
          </span>
          {showWriteOff && (
            <button
              type="button"
              onClick={onWriteOff}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[12px] font-semibold text-rose-300 light:text-rose-700 bg-rose-500/10 light:bg-rose-50 border border-rose-500/30 light:border-rose-200 hover:bg-rose-500/15 hover:border-rose-500/50 transition-colors"
            >
              <Icon name="archive-x" size={12} aria-hidden="true" />
              {t('detail.hero.writeOff')}
            </button>
          )}
        </div>
      </div>

      {/* ── Divider + one compact identifier line: [inv chip] [SN] serial ── */}
      <div className="mt-2 pt-2 border-t border-border flex items-center gap-2 min-w-0">
        <span className="inline-flex items-center font-mono text-[12px] font-bold bg-surface-2 text-text-primary ring-1 ring-border px-2 py-0.5 rounded-md shrink-0">
          {asset.invCode}
        </span>
        {asset.serial && (
          <span className="font-mono text-[12px] text-[#E2E8F0] light:text-slate-700 truncate">
            {asset.serial}
          </span>
        )}
      </div>
    </div>
  )
}
