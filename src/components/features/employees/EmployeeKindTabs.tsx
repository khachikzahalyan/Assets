import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface EmployeeKindTabsProps {
  selected: string
  onSelect: (id: string) => void
  counts: { all: number; staff: number }
}

interface TabDef {
  id: 'all' | 'staff'
  icon: string
  labelKey: string
}

const TABS: TabDef[] = [
  { id: 'all',   icon: 'users', labelKey: 'kind.all' },
  { id: 'staff', icon: 'user',  labelKey: 'kind.staff' },
]

/**
 * Horizontal tab strip for employee kind filter.
 *
 * Desktop (≥768px): filled chip buttons (accent/surface).
 * Mobile (<768px): underline-tab style — transparent bg, accent 2px underline bar on
 *   active tab, count badge pill (active=accent, inactive=surface).
 *   The bg-surface-2 / border-b strip is applied by the wrapping div in EmployeesPage.
 */
export function EmployeeKindTabs({ selected, onSelect, counts }: EmployeeKindTabsProps) {
  const { t } = useTranslation('employees')

  return (
    <div className="flex items-center gap-1.5 flex-wrap max-md:flex-nowrap max-md:overflow-x-auto max-md:gap-0 no-scrollbar max-md:w-full">
      {TABS.map(({ id, icon, labelKey }) => {
        const isActive = selected === id
        const count    = counts[id] ?? 0

        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={isActive}
            className={cn(
              // Shared
              'inline-flex items-center font-semibold tracking-tight transition-colors duration-100 shrink-0',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong',
              // Desktop sizing / shape (md+)
              'md:gap-2 md:h-9 md:px-3 md:rounded-lg md:text-[15px]',
              isActive
                ? 'md:bg-accent md:text-white'
                : 'md:bg-surface md:text-text-primary md:border md:border-border md:hover:border-border-strong',
              // Mobile: underline-tab style (max-md)
              'max-md:relative max-md:h-auto max-md:gap-[5px]',
              'max-md:pl-0 max-md:pr-[10px] max-md:py-[8px] max-md:mr-[6px]',
              'max-md:text-[12.5px]',
              'max-md:bg-transparent max-md:border-0 max-md:rounded-none',
              isActive ? 'max-md:text-accent' : 'max-md:text-text-tertiary',
            )}
          >
            {/* Icon: visible on desktop only */}
            <Icon
              name={icon}
              size={14}
              aria-hidden="true"
              className={cn(isActive ? 'text-white' : 'text-text-primary', 'max-md:hidden')}
            />

            <span>{t(labelKey)}</span>

            {/* Count badge */}
            <span
              aria-hidden="true"
              className={cn(
                // Desktop count
                'tabular-nums text-[14px]',
                isActive ? 'text-white/70' : 'text-text-subtle',
                // Mobile count pill
                'max-md:text-[10px] max-md:font-bold max-md:rounded-[10px]',
                isActive
                  ? 'max-md:bg-accent max-md:text-white max-md:px-[6px] max-md:py-[1px]'
                  : count === 0
                    ? 'max-md:text-text-subtle max-md:opacity-60 max-md:px-[5px] max-md:py-[1px]'
                    : 'max-md:bg-surface max-md:text-text-subtle max-md:px-[6px] max-md:py-[1px]',
              )}
            >
              {count}
            </span>

            {/* Mobile active underline — absolute 2px bar at bottom of the strip */}
            {isActive && (
              <span
                aria-hidden="true"
                className="hidden max-md:block absolute bottom-[-1px] left-0 right-[10px] h-[2px] bg-accent rounded-[1px]"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
