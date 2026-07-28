import { useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { Part } from '@/domain/part/types'
import { workingStock } from '@/domain/part/partStock'
import { PART_CATEGORY_META, type PartCatMeta } from './partsTokens'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isModelsCategory } from '@/domain/part/partCategory-types'

export interface CategoryChipStripProps {
  skusByCategory: Record<string, Part[]>
  selectedId: string
  onSelect: (id: string) => void
  /** Pre-computed stockOf map from WarehouseTab. key = skuId */
  stockMap?: Record<string, { onHand: number; broken: number }>
  /**
   * When true, strips own padding/border (py-3 px-3.5 border-b border-border)
   * and uses flex-1 min-w-0 instead — the parent row provides its own padding.
   * Default false (unchanged rendering for all existing callers).
   */
  bare?: boolean
  /** Live category defs — when provided, derives chip list from defs instead of PART_CATEGORY_META. */
  partCategories?: PartCategoryDef[]
  /** Pre-built meta — when provided, uses this for labels/icons instead of re-iterating PART_CATEGORY_META. */
  partCatMeta?: PartCatMeta[]
}

/**
 * Horizontally scrollable category chip strip for mobile (≤767px).
 * Icon + label + count badge on each chip.
 * Auto-scrolls selected chip to center using getBoundingClientRect
 * (NOT scrollIntoView — that bubbles to ancestors).
 *
 * Chip style mirrors the assets GroupTabs desktop filled chips exactly:
 * active = solid bg-accent text-white, idle = bg-surface border border-border.
 */
export function CategoryChipStrip({
  skusByCategory,
  selectedId,
  onSelect,
  stockMap = {},
  bare = false,
  partCategories,
  partCatMeta,
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
      className={
        bare
          ? 'flex gap-[7px] overflow-x-auto flex-1 min-w-0'
          : 'flex gap-[7px] overflow-x-auto py-3 px-3.5 border-b border-border'
      }
      style={{ scrollbarWidth: 'none' }}
      role="tablist"
      aria-label={t('tabs.warehouse')}
    >
      {/* If live defs provided, filter out models categories (GPU equivalent); else use legacy filter */}
      {(partCatMeta ?? PART_CATEGORY_META).filter(cat => {
        if (partCategories) {
          const def = partCategories.find(d => d.id === cat.id)
          return def ? !isModelsCategory(def) : cat.id !== 'gpu'
        }
        return cat.id !== 'gpu'
      }).map((cat) => {
        const catSkus = skusByCategory[cat.id] ?? []
        /* Sum working stock (onHand − broken) from stockMap if available, else fall back to Part.onHand */
        const total = catSkus.reduce((sum, s) => {
          const entry = stockMap[s.id]
          return sum + (entry ? workingStock(entry) : s.onHand)
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
              inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg whitespace-nowrap
              flex-shrink-0 text-[13px] font-semibold tracking-tight transition-colors duration-100
              focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong
              ${isSelected
                ? 'bg-accent text-white'
                : 'bg-surface text-text-primary border border-border hover:border-border-strong'}
            `}
          >
            <Icon
              name={cat.icon}
              size={13}
              className={isSelected ? 'text-white' : 'text-text-primary'}
            />
            <span>{cat.label}</span>
            <span className={`tabular-nums text-[12px] ${isSelected ? 'text-white/70' : 'text-text-subtle'}`}>
              {total}
            </span>
          </button>
        )
      })}
    </div>
  )
}
