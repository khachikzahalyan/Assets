import { useTranslation } from 'react-i18next'
import type { BranchCount } from '@/domain/dashboard'
import { SectionCard } from '@/components/ui/section-card'
import { EmptyState } from '@/components/ui/empty-state'

export interface BranchBreakdownProps {
  branches: BranchCount[]
}

export function BranchBreakdown({ branches }: BranchBreakdownProps) {
  const { t } = useTranslation('dashboard')
  const maxCount = Math.max(...branches.map(b => b.count), 1)

  return (
    <SectionCard title={t('branches.title')} icon="building">
      {branches.length === 0 ? (
        <EmptyState icon="building" title={t('branches.empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {branches.map(b => {
            const pct = (b.count / maxCount) * 100
            return (
              <div key={b.branchId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-text-tertiary truncate max-w-[70%]">
                    {b.name}
                  </span>
                  <span className="text-[12.5px] font-semibold text-text-primary tabular-nums">
                    {b.count}
                  </span>
                </div>
                <div
                  className="w-full h-1 rounded-full bg-surface-2 overflow-hidden"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
