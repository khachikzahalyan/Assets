import { useTranslation } from 'react-i18next'
import { ASSET_STATUS_IDS } from '@/domain/asset'
import type { AssetStatusId, StatusRow } from '@/domain/asset'
import { SectionCard } from '@/components/ui/section-card'

/** Maps the `color` field from a StatusRow to a hex fill for proportion bars. */
const STATUS_BAR_COLOR: Record<string, string> = {
  gray:   '#64748B',
  green:  '#10B981',
  orange: '#F97316',
  red:    '#EF4444',
  // Extra Chip palette values that may appear on statuses
  amber:  '#F59E0B',
  blue:   '#38BDF8',
  teal:   '#14B8A6',
  cyan:   '#06B6D4',
  violet: '#8B5CF6',
  indigo: '#F97316', // AMS indigo = orange brand
}

export interface StatusBreakdownProps {
  byStatus: Record<AssetStatusId, number>
  statuses: StatusRow[]
  total: number
}

export function StatusBreakdown({ byStatus, statuses, total }: StatusBreakdownProps) {
  const { t } = useTranslation('dashboard')
  const statusMap = new Map(statuses.map(s => [s.id, s]))

  return (
    <SectionCard title={t('status.title')} icon="circle-dot">
      <div className="flex flex-col gap-3">
        {ASSET_STATUS_IDS.map(id => {
          const status = statusMap.get(id)
          const count = byStatus[id] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          const barColor = STATUS_BAR_COLOR[status?.color ?? 'gray'] ?? '#64748B'

          return (
            <div key={id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-[#94A3B8]">
                  {status?.name ?? id}
                </span>
                <span className="text-[12.5px] font-semibold text-[#F8FAFC] tabular-nums">
                  {count}
                </span>
              </div>
              {/* Proportion bar — decorative; numeric count is the accessible value */}
              <div
                className="w-full h-1 rounded-full bg-[#22272E] overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
