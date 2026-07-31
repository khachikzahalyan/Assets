import { memo } from 'react'
import { Icon } from '@/components/ui/icon'

export interface GroupTab {
  id: string
  label: string
  /** Shorter label shown on mobile to keep the tab strip compact. Falls back to label if omitted. */
  shortLabel?: string
  icon: string
}

export interface GroupTabsProps {
  tabs: GroupTab[]
  selected: string
  onSelect: (id: string) => void
  counts: Record<string, number>
}

/**
 * Horizontal tab strip for asset group selection.
 *
 * Desktop (≥768px): filled chip buttons (accent/surface).
 * Mobile (<768px): underline-tab style — transparent bg, accent underline on active,
 *   count badge with tinted bg (active) or muted (inactive/zero).
 *   The bg-surface-2 / border-b strip is applied by AssetsToolbar's wrapper div, not here.
 */
export const GroupTabs = memo(function GroupTabs({ tabs, selected, onSelect, counts }: GroupTabsProps) {
  return (
    <div
      className={[
        // Desktop: wrapped flex with gap
        'flex items-center gap-1 flex-wrap',
        // Mobile: horizontal scroll, no gap (tabs use margin-right instead)
        'max-md:flex-nowrap max-md:overflow-x-auto max-md:gap-0 no-scrollbar max-md:w-full',
      ].join(' ')}
    >
      {tabs.map(tab => {
        const active   = selected === tab.id
        const count    = counts[tab.id] ?? 0
        const hasShort = tab.shortLabel != null && tab.shortLabel !== tab.label

        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            aria-label={tab.label}
            onClick={() => onSelect(tab.id)}
            className={[
              // ── Shared base ──
              'inline-flex items-center transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong shrink-0',
              // ── Desktop sizing / shape (md+) ──
              'md:gap-1.5 md:h-8 md:px-2.5 md:rounded-lg md:text-13 md:font-semibold md:tracking-tight',
              // Desktop active vs inactive chip
              active
                ? 'md:bg-accent md:text-white'
                : 'md:bg-surface md:text-text-primary md:border md:border-border md:hover:border-border-strong',
              // ── Mobile sizing / shape (max-md) ──
              // padding: 8px top/bottom, 10px right, 0 left; 6px right-margin for spacing
              'max-md:relative max-md:h-auto max-md:gap-[0.3125rem]',
              'max-md:pl-0 max-md:pr-2.5 max-md:py-2 max-md:mr-1.5',
              'max-md:text-12.5 max-md:font-semibold',
              // Mobile text colour (active = accent, inactive = muted)
              active ? 'max-md:text-accent' : 'max-md:text-text-tertiary',
            ].join(' ')}
          >
            {/* Icon: visible on desktop only */}
            <Icon
              name={tab.icon}
              size={13}
              aria-hidden="true"
              className={[
                active ? 'text-white' : 'text-text-primary',
                'max-md:hidden',
              ].join(' ')}
            />

            {/* Label: full on desktop, short on mobile if provided */}
            {hasShort ? (
              <>
                <span aria-hidden="true" className="max-md:hidden">{tab.label}</span>
                <span aria-hidden="true" className="hidden max-md:inline">{tab.shortLabel}</span>
              </>
            ) : (
              <span aria-hidden="true">{tab.label}</span>
            )}

            {/* Count badge */}
            <span
              aria-hidden="true"
              className={[
                // Desktop count — subtle text
                'tabular-nums text-12',
                active ? 'text-white/70' : 'text-text-subtle',
                // Mobile count — badge pill
                'max-md:text-10 max-md:font-bold max-md:rounded-[10px]',
                active
                  // Active: accent bg + white text
                  ? 'max-md:bg-accent max-md:text-white max-md:px-1.5 max-md:py-[1px]'
                  : count === 0
                    // Zero count: no bg, extra-muted text
                    ? 'max-md:text-text-subtle max-md:opacity-60 max-md:px-[0.3125rem] max-md:py-[1px]'
                    // Non-zero inactive: faint bg
                    : 'max-md:bg-surface max-md:text-text-subtle max-md:px-1.5 max-md:py-[1px]',
              ].join(' ')}
            >
              {count}
            </span>

            {/* Mobile active underline — absolute bar at bottom of the strip */}
            {active && (
              <span
                aria-hidden="true"
                className="hidden max-md:block absolute bottom-[-1px] left-0 right-0 h-[2px] bg-accent rounded-[1px]"
              />
            )}
          </button>
        )
      })}
    </div>
  )
})
