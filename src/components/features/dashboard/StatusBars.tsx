import { useTranslation } from 'react-i18next'
import { ASSET_STATUS_IDS } from '@/domain/asset'
import type { AssetStatusId, StatusRow } from '@/domain/asset'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

/** Tailwind token-based color config per status id. */
const STATUS_CFG: Record<string, { dot: string; bar: string }> = {
  st_warehouse: { dot: 'bg-info',    bar: 'from-info to-info/25' },
  st_assigned:  { dot: 'bg-success', bar: 'from-success to-success/25' },
  st_repair:    { dot: 'bg-warning', bar: 'from-warning to-warning/25' },
  st_disposed:  { dot: 'bg-error',   bar: 'from-error to-error/25' },
}
const DEFAULT_STATUS_CFG = STATUS_CFG['st_warehouse'] as { dot: string; bar: string }

export interface StatusBarsProps {
  byStatus: Record<AssetStatusId, number>
  statuses: StatusRow[]
  total: number
}

export function StatusBars({ byStatus, statuses, total }: StatusBarsProps) {
  const { t } = useTranslation('dashboard')
  const statusMap = new Map(statuses.map(s => [s.id, s]))

  return (
    <section className="bg-surface border border-border rounded-xl overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 lg:w-7 lg:h-7 rounded-md bg-info/15 text-info inline-flex items-center justify-center flex-shrink-0">
            <Icon name="circle-dot" size={14} />
          </span>
          <h2 className="text-[12px] lg:text-[13px] font-semibold text-text-primary">
            {t('status.title')}
          </h2>
        </div>
        <span className="text-[11px] text-text-subtle tabular-nums">
          {t('status.totalCaption', { count: total })}
        </span>
      </header>

      <div className="p-4 lg:p-5 flex flex-col gap-3.5">
        {ASSET_STATUS_IDS.map(id => {
          const status = statusMap.get(id)
          const count = byStatus[id] ?? 0
          const pct = total > 0 ? (count / total) * 100 : 0
          const cfg = STATUS_CFG[id] ?? DEFAULT_STATUS_CFG

          return (
            <div key={id} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {/* Colored status dot */}
                <span
                  className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)}
                  aria-hidden="true"
                />
                <span className="flex-1 text-[12.5px] text-text-secondary truncate">
                  {status?.name ?? id}
                </span>
                <span className="text-[12.5px] font-mono tabular-nums text-text-primary ml-1">
                  {count}
                </span>
              </div>
              {/* 5px gradient track on mobile, 6px on desktop */}
              <div
                className="w-full h-[5px] lg:h-1.5 rounded-full bg-white/5 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className={cn(
                    'h-full rounded-full bg-gradient-to-r transition-all duration-300',
                    cfg.bar,
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
