import { useTranslation } from 'react-i18next'
import type { GroupCount } from '@/domain/dashboard'
import { ASSET_GROUPS } from '@/domain/dashboard'
import { SectionCard } from '@/components/ui/section-card'

const GROUP_ICON: Record<string, string> = {
  devices:   'laptop',
  network:   'network',
  furniture: 'building',
}

export interface GroupBreakdownProps {
  byGroup: GroupCount[]
}

export function GroupBreakdown({ byGroup }: GroupBreakdownProps) {
  const { t } = useTranslation('dashboard')

  const groupMap = new Map(byGroup.map(g => [g.group, g.count]))
  const maxCount = Math.max(...byGroup.map(g => g.count), 1)

  return (
    <SectionCard title="По группам" icon="tags">
      <div className="flex flex-col gap-3">
        {ASSET_GROUPS.map(group => {
          const count = groupMap.get(group) ?? 0
          const pct = (count / maxCount) * 100

          return (
            <div key={group} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[#94A3B8]">
                  {t(`groups.${group}`, { defaultValue: group })}
                </span>
                <span className="text-[12.5px] font-semibold text-[#F8FAFC] tabular-nums">
                  {count}
                </span>
              </div>
              <div
                className="w-full h-1 rounded-full bg-[#22272E] overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-[#F97316] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

// satisfy unused-import check for GROUP_ICON (used in future icon badge)
void GROUP_ICON
