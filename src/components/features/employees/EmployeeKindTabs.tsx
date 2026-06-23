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

export function EmployeeKindTabs({ selected, onSelect, counts }: EmployeeKindTabsProps) {
  const { t } = useTranslation('employees')

  return (
    <div className="flex items-center gap-1.5 flex-wrap max-md:flex-nowrap max-md:overflow-x-auto no-scrollbar">
      {TABS.map(({ id, icon, labelKey }) => {
        const isActive = selected === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-[15px] font-semibold tracking-tight transition-colors duration-100 max-md:h-8 max-md:text-[13px] max-md:shrink-0',
              isActive
                ? 'bg-accent text-white'
                : 'bg-surface text-text-primary border border-border hover:border-border-strong',
            )}
          >
            <Icon
              name={icon}
              size={14}
              className={cn(isActive ? 'text-white' : 'text-text-primary', 'max-md:hidden')}
            />
            <span>{t(labelKey)}</span>
            <span
              className={cn(
                'tabular-nums text-[14px]',
                isActive ? 'text-white/70' : 'text-text-subtle',
              )}
            >
              {counts[id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
