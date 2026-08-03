import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/ui/section-card'
import type { SectionCardProps } from '@/components/ui/section-card'
import { EmptyState } from '@/components/ui/empty-state'
import type { DomainEventVM } from '@/domain/dashboard'
import { MiniBarChart } from './MiniBarChart'
import { relativeTime } from './relativeTime'

export interface DomainBoxProps {
  icon: string
  iconTone?: SectionCardProps['iconTone']
  title: string
  total: number | null
  delta7d: number
  days: number[]
  events: DomainEventVM[]
  barClass: string
  viewAllTo?: string
  viewAllLabel: string
  emptyLabel: string
  totalCaption?: string
  testId?: string
}

export function DomainBox({
  icon,
  iconTone,
  title,
  total,
  delta7d,
  days,
  events,
  barClass,
  viewAllTo,
  viewAllLabel,
  emptyLabel,
  totalCaption,
  testId,
}: DomainBoxProps) {
  const { t } = useTranslation('dashboard')

  // Compute date-range titles for bar chart: [0]=6 days ago … [6]=today
  const now = new Date()
  const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
  const barTitles = days.map((v, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    return `${fmt.format(d)} · ${v}`
  })

  const deltaChipClass =
    delta7d === 0
      ? 'text-text-subtle bg-surface-2'
      : 'text-success bg-success/10'

  return (
    <div {...(testId ? { 'data-testid': testId } : {})}>
      <SectionCard
        icon={icon}
        {...(iconTone ? { iconTone } : {})}
        title={title}
        action={
          <MiniBarChart
            days={days}
            barClass={barClass}
            titles={barTitles}
          />
        }
      >
        {/* Total row */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-display-sm font-bold leading-none tracking-tight tabular-nums text-text-primary">
            {total === null ? '—' : total}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-11 font-medium tabular-nums ${deltaChipClass}`}
          >
            {t('boxes.delta7d', { n: delta7d })}
          </span>
        </div>
        {totalCaption !== undefined && totalCaption !== '' && (
          <p className="text-11 text-text-subtle mt-0.5 leading-tight">{totalCaption}</p>
        )}

        {/* Divider */}
        <hr className="border-border my-3" />

        {/* Event feed */}
        {events.length === 0 ? (
          <EmptyState icon="history" title={emptyLabel} />
        ) : (
          <div className="flex flex-col gap-0.5">
            {events.map((ev) => {
              const rowContent = (
                <div className="flex items-center gap-3 px-2 py-2.5 min-h-11">
                  <div className="flex-1 min-w-0">
                    <div className="text-12.5 text-text-primary truncate leading-snug">
                      {ev.primary}
                    </div>
                    {ev.secondary !== null && (
                      <div className="text-11 text-text-subtle truncate mt-0.5">
                        {ev.secondary}
                      </div>
                    )}
                  </div>
                  <span className="text-10.5 text-text-subtle tabular-nums flex-shrink-0">
                    {relativeTime(ev.at, t)}
                  </span>
                </div>
              )

              if (ev.linkTo !== undefined) {
                return (
                  <Link
                    key={ev.id}
                    to={ev.linkTo}
                    className="block hover:bg-surface-2 rounded-lg transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                  >
                    {rowContent}
                  </Link>
                )
              }

              return <div key={ev.id}>{rowContent}</div>
            })}
          </div>
        )}

        {/* Footer — only when viewAllTo is provided */}
        {viewAllTo !== undefined && (
          <>
            {/* Mobile: full-width outlined button */}
            <Link
              to={viewAllTo}
              className="lg:hidden mt-3 block text-center py-2 rounded-lg border border-border/60 text-12 text-text-secondary hover:border-border hover:text-text-primary transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              {viewAllLabel}
            </Link>

            {/* Desktop: right-aligned text link */}
            <div className="hidden lg:block pt-3 text-right">
              <Link
                to={viewAllTo}
                className="text-11.5 text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                {viewAllLabel}
              </Link>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}
