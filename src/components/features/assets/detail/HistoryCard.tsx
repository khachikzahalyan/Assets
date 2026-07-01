import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/ui'
import type { HistoryEventVM } from './detailFormat'
import { isCreationEvent, pluralRecords, fmtRuDate } from './detailFormat'
import { HistoryEvent } from './HistoryEvent'

interface HistoryCardProps {
  events: HistoryEventVM[]
  /**
   * Mobile: hide the SectionCard header (icon + «ИСТОРИЯ») and put the
   * «Создан…» line together with the record count on a single row.
   */
  mobileBare?: boolean
}

export function HistoryCard({ events, mobileBare = false }: HistoryCardProps) {
  const { t } = useTranslation('assets')

  const sorted    = [...events].sort((a, b) => b.date.localeCompare(a.date))
  const createdEv = sorted.find(ev => isCreationEvent(ev))
  const others    = sorted.filter(ev => !isCreationEvent(ev))
  const n         = others.length
  const countLabel = `${n} ${pluralRecords(n)}`
  const createdLine = createdEv
    ? `${t('detail.history.created')} · ${fmtRuDate(createdEv.date)} · ${t('detail.history.added')} ${createdEv.actor}`
    : ''

  return (
    <SectionCard
      title={t('detail.history.title')}
      icon="history"
      iconTone="cyan"
      noHeader={mobileBare}
      // Desktop: the card fills the tab body and ONLY the event list scrolls —
      // the header («ИСТОРИЯ»/count) and the «Создан…» line stay fixed.
      className="lg:h-full lg:flex lg:flex-col lg:min-h-0"
      bodyClassName="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col"
      action={
        <span className="text-[13px] font-medium text-text-tertiary tabular-nums">
          {countLabel}
        </span>
      }
    >
      {mobileBare ? (
        /* Single line: «Создан … · добавил Вы» (left) + record count (right) */
        <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border text-[12.5px] text-text-secondary">
          <span className="min-w-0 truncate">{createdLine}</span>
          <span className="shrink-0 text-text-tertiary tabular-nums">{countLabel}</span>
        </div>
      ) : (
        createdEv && (
          <div className="mb-3 pb-2.5 border-b border-border text-[12.5px] text-text-secondary lg:shrink-0">
            {createdLine}
          </div>
        )
      )}
      {others.length > 0 ? (
        // Only this list scrolls on desktop; the card header above stays put.
        <ol className="space-y-3 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {others.map((ev, i) => (
            <HistoryEvent key={ev.id ?? `${ev.date}-${i}`} ev={ev} />
          ))}
        </ol>
      ) : (
        <p className="text-[13px] text-text-subtle italic">
          {createdEv ? t('detail.history.noOther') : t('detail.history.noRecords')}
        </p>
      )}
    </SectionCard>
  )
}
