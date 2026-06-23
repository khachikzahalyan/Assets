import { useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { Part } from '@/domain/part/types'
import { PART_CATEGORY_META } from './partsTokens'

export interface CategoryChipStripProps {
  skusByCategory: Record<string, Part[]>
  selectedId: string
  onSelect: (id: string) => void
  /** Pre-computed stockOf map from WarehouseTab. key = skuId */
  stockMap?: Record<string, { onHand: number; broken: number }>
}

/**
 * Horizontally scrollable category chip strip for mobile (≤767px).
 * Icon + label + count badge on each chip.
 * Auto-scrolls selected chip to center using getBoundingClientRect
 * (NOT scrollIntoView — that bubbles to ancestors).
 *
 * Active style: bg-[#F97316]/15 border-[#F97316]/40.
 * Rounded-full chips per prototype.
 */
export function CategoryChipStrip({
  skusByCategory,
  selectedId,
  onSelect,
  stockMap = {},
}: CategoryChipStripProps) {
  const { t } = useTranslation('parts')
  const stripRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  /* ── Scroll selected chip to horizontal centre of strip ── */
  const scrollChipToCenter = useCallback((catId: string) => {
    const strip = stripRef.current
    const chip = chipRefs.current[catId]
    if (!strip || !chip) return
    const stripRect = strip.getBoundingClientRect()
    const chipRect = chip.getBoundingClientRect()
    const targetLeft =
      strip.scrollLeft +
      (chipRect.left - stripRect.left) -
      stripRect.width / 2 +
      chipRect.width / 2
    requestAnimationFrame(() => {
      strip.scrollTo({ left: targetLeft, behavior: 'smooth' })
    })
  }, [])

  /* Scroll on explicit click */
  const handleClick = useCallback(
    (catId: string) => {
      onSelect(catId)
      scrollChipToCenter(catId)
    },
    [onSelect, scrollChipToCenter],
  )

  /* Scroll when selectedId changes programmatically */
  useEffect(() => {
    scrollChipToCenter(selectedId)
  }, [selectedId, scrollChipToCenter])

  return (
    <div
      ref={stripRef}
      className="flex gap-2 overflow-x-auto py-1 px-1"
      style={{ scrollbarWidth: 'none' }}
      role="tablist"
      aria-label={t('tabs.warehouse')}
    >
      {PART_CATEGORY_META.map((cat) => {
        const catSkus = skusByCategory[cat.id] ?? []
        /* Sum onHand from stockMap if available, else fall back to Part.onHand */
        const total = catSkus.reduce((sum, s) => {
          const entry = stockMap[s.id]
          return sum + (entry ? entry.onHand : s.onHand)
        }, 0)
        const isSelected = selectedId === cat.id

        return (
          <button
            key={cat.id}
            ref={(el) => { chipRefs.current[cat.id] = el }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => handleClick(cat.id)}
            className={`
              inline-flex items-center gap-1 px-2.5 h-7 rounded-full whitespace-nowrap
              flex-shrink-0 text-[14px] font-semibold transition-all duration-150 border
              ${isSelected
                ? 'bg-[#F97316]/15 border-[#F97316]/40 text-text-primary'
                : 'bg-surface border-border text-text-secondary'}
            `}
          >
            <Icon name={cat.icon} size={13} />
            <span>{cat.label}</span>
            <span className="text-[12px] tabular-nums px-1 rounded-full bg-surface-2 text-text-tertiary">
              {total}
            </span>
          </button>
        )
      })}
    </div>
  )
}
