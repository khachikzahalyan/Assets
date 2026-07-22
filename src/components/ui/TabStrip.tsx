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
        'flex items-center gap-1 overflow-x-auto no-scrollbar flex-nowrap min-w-0',
        className,
      )}
      {...(ariaLabel !== undefined ? { 'aria-label': ariaLabel } : {})}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id
        const sizeClasses =
          size === 'sm'
            ? 'px-3 py-3 max-md:py-2.5 text-[13px]'
            : 'px-4 py-3 text-[13.5px]'
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 shrink-0 whitespace-nowrap font-medium transition-colors',
              sizeClasses,
              isActive
                ? 'text-accent-light'
                : 'text-text-subtle hover:text-text-tertiary',
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
                  'text-[12px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums',
                  isActive
                    ? 'bg-accent/15 text-accent-light'
                    : 'bg-surface-2 text-text-subtle',
                )}
              >
                {tab.count}
              </span>
            )}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-light rounded-full"
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
