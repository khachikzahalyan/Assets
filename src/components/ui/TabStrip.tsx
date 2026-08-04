import { Icon } from './icon'
import { cn } from '@/lib/utils'

export interface TabStripItem<T extends string = string> {
  id: T
  label: string
  icon?: string
  count?: number
  testId?: string
  ariaControls?: string
}

export interface TabStripProps<T extends string = string> {
  tabs: TabStripItem<T>[]
  active: T
  onChange: (id: T) => void
  size?: 'md' | 'sm'
  className?: string
  'aria-label'?: string
}

export function TabStrip<T extends string = string>({
  tabs,
  active,
  onChange,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: TabStripProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        // Mobile-first: gap-0 (tabs space via mr); md:gap-1 on desktop.
        'flex items-center gap-0 md:gap-1 overflow-x-auto no-scrollbar flex-nowrap min-w-0',
        className,
      )}
      {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id
        // Desktop-only sizing (md:) — keeps mobile free of any unprefixed base that
        // an override would have to fight. Mobile sizing lives in the base classes below.
        const sizeClasses =
          size === 'sm'
            ? 'md:px-3 md:py-3 md:text-13'
            : 'md:px-4 md:py-3 md:text-13.5'
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center shrink-0 whitespace-nowrap transition-colors',
              // Base = MOBILE compact underline-tab (identical to the Assets GroupTabs
              // strip: tight py-2, no left pad, 6px right margin, 12.5px semibold).
              // Mobile-first: desktop overrides are md:-prefixed, so mobile never
              // inherits the larger desktop size.
              'gap-[0.3125rem] pl-0 pr-2.5 py-2 mr-1.5 text-12.5 font-semibold md:gap-1.5 md:mr-0 md:font-medium',
              sizeClasses,
              isActive
                ? 'text-accent md:text-accent-light'
                : 'text-text-tertiary md:text-text-subtle md:hover:text-text-tertiary',
            )}
            {...(tab.ariaControls !== undefined
              ? { 'aria-controls': tab.ariaControls, id: `tab-${tab.id}` }
              : {})}
            {...(tab.testId !== undefined ? { 'data-testid': tab.testId } : {})}
          >
            {tab.icon !== undefined && (
              <Icon name={tab.icon} size={14} className="max-md:hidden" />
            )}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  // Base = MOBILE count pill (GroupTabs style — solid accent when active);
                  // desktop is md:-prefixed subtle text. Mobile-first, no fragile overrides.
                  'tabular-nums px-1.5 py-[1px] text-10 font-bold rounded-[10px] md:py-0.5 md:text-12 md:font-semibold md:rounded-md',
                  isActive
                    ? 'bg-accent text-white md:bg-accent/15 md:text-accent-light'
                    : 'bg-surface text-text-subtle md:bg-surface-2 md:text-text-subtle',
                )}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-accent md:bg-accent-light"
                style={{
                  animation:
                    'tabIndicatorIn 160ms cubic-bezier(0.16,1,0.3,1) both',
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
