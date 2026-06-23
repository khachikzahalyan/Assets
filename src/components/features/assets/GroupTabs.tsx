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
 * Horizontal filter-chip tabs for asset group selection.
 * Each tab shows an icon, label (full on desktop / short on mobile), and count.
 */
export function GroupTabs({ tabs, selected, onSelect, counts }: GroupTabsProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap max-md:flex-nowrap max-md:overflow-x-auto max-md:gap-1.5 no-scrollbar max-md:w-full max-md:scroll-fade-x">
      {tabs.map(tab => {
        const active = selected === tab.id
        const count = counts[tab.id] ?? 0
        const hasShort = tab.shortLabel != null && tab.shortLabel !== tab.label
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={active}
            aria-label={tab.label}
            onClick={() => onSelect(tab.id)}
            className={[
              'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-semibold tracking-tight transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong',
              'max-md:shrink-0 max-md:h-[32px] max-md:px-[12px] max-md:text-[12px] max-md:gap-1.5',
              active
                ? 'bg-accent text-white'
                : 'bg-surface text-text-primary border border-border hover:border-border-strong',
            ].join(' ')}
          >
            <Icon
              name={tab.icon}
              size={13}
              aria-hidden="true"
              className={[
                active ? 'text-white' : 'text-text-primary',
                'max-md:hidden',
              ].join(' ')}
            />
            {/* Desktop: full label. Mobile: short label if provided, else full label.
                Both spans are aria-hidden because the button carries aria-label={tab.label}. */}
            {hasShort ? (
              <>
                <span aria-hidden="true" className="max-md:hidden">{tab.label}</span>
                <span aria-hidden="true" className="hidden max-md:inline">{tab.shortLabel}</span>
              </>
            ) : (
              <span aria-hidden="true">{tab.label}</span>
            )}
            <span
              aria-hidden="true"
              className={[
                'tabular-nums text-[12px] max-md:text-[11px] max-md:text-white max-md:font-semibold max-md:opacity-[0.95]',
                active ? 'text-white/70' : 'text-text-subtle',
              ].join(' ')}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
