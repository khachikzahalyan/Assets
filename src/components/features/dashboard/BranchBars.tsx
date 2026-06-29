import { useTranslation } from 'react-i18next'
import type { BranchCount } from '@/domain/dashboard'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/components/ui/icon'

export interface BranchBarsProps {
  branches: BranchCount[]
}

export function BranchBars({ branches }: BranchBarsProps) {
  const { t } = useTranslation('dashboard')
  const maxCount = Math.max(...branches.map(b => b.count), 1)

  return (
    <section className="bg-surface border border-border rounded-xl overflow-hidden">
      <header className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <span className="w-6 h-6 lg:w-7 lg:h-7 rounded-md bg-success/15 text-success inline-flex items-center justify-center flex-shrink-0">
          <Icon name="building" size={14} />
        </span>
        <h2 className="text-[12px] lg:text-[13px] font-semibold text-text-primary">
          {t('branches.title')}
        </h2>
      </header>

      <div className="p-4 lg:p-5">
        {branches.length === 0 ? (
          <EmptyState icon="building" title={t('branches.empty')} />
        ) : (
          <div className="flex flex-col gap-3.5">
            {branches.map(b => {
              const pct = (b.count / maxCount) * 100
              return (
                <div key={b.branchId} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-[12.5px] text-text-secondary truncate">
                      {b.name}
                    </span>
                    <span className="text-[12.5px] font-mono tabular-nums text-text-primary">
                      {b.count}
                    </span>
                  </div>
                  {/* 5px accent gradient bar on mobile, 8px on desktop */}
                  <div
                    className="w-full h-[5px] lg:h-2 rounded-full bg-white/5 overflow-hidden"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent/25 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
