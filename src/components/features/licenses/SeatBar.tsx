import { useTranslation } from 'react-i18next'

export interface SeatBarProps {
  used: number
  total: number
}

export function SeatBar({ used, total }: SeatBarProps) {
  const { t } = useTranslation('licenses')
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const tone =
    pct >= 100 ? 'bg-rose-500' :
    pct >= 80  ? 'bg-amber-500' :
                 'bg-emerald-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11.5px] uppercase tracking-[0.06em] font-semibold text-text-tertiary">
          {t('subs.seats')}
        </span>
        <span className="text-[13px] font-semibold text-text-primary">
          {used} <span className="text-text-subtle">/ {total}</span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${tone} transition-all`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={t('subs.seatsProgress', { used, total })}
        />
      </div>
    </div>
  )
}
