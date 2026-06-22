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
    <div className="flex items-center gap-1.5 flex-wrap">
      {TABS.map(({ id, icon, labelKey }) => {
        const isActive = selected === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center gap-2 h-9 px-3 rounded-lg text-[15px] font-semibold tracking-tight transition-colors duration-100',
              isActive
                ? 'bg-[#F97316] text-white'
                : 'bg-[#1B1F24] text-[#F8FAFC] border border-[#2A2F36] hover:border-[#3A4048]',
            )}
          >
            <Icon
              name={icon}
              size={14}
              className={isActive ? 'text-white' : 'text-[#F8FAFC]'}
            />
            <span>{t(labelKey)}</span>
            <span
              className={cn(
                'tabular-nums text-[14px]',
                isActive ? 'text-white/70' : 'text-[#64748B]',
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
