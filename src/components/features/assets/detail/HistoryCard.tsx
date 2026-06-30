import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/ui'
import type { HistoryEventVM } from './detailFormat'
import { isCreationEvent, pluralRecords, fmtRuDate } from './detailFormat'
import { HistoryEvent } from './HistoryEvent'

interface HistoryCardProps {
  events: HistoryEventVM[]
}

export function HistoryCard({ events }: HistoryCardProps) {
  const { t } = useTranslation('assets')

  const sorted    = [...events].sort((a, b) => b.date.localeCompare(a.date))
  const createdEv = sorted.find(ev => isCreationEvent(ev))
  const others    = sorted.filter(ev => !isCreationEvent(ev))
  const n         = others.length

  return (
    <SectionCard
      title={t('detail.history.title')}
      icon="history"
      iconTone="cyan"
      action={
        <span className="text-[13px] font-medium text-text-tertiary tabular-nums">
          {n} {pluralRecords(n)}
        </span>
      }
    >
      {createdEv && (
        <div className="mb-3 pb-2.5 border-b border-border text-[12.5px] text-text-secondary">
          {t('detail.history.created')} · {fmtRuDate(createdEv.date)} · {t('detail.history.added')} {createdEv.actor}
        </div>
      )}
      {others.length > 0 ? (
        // Desktop: cap the list height and scroll INSIDE it so the page itself
        // stays put. Mobile keeps the natural page scroll.
        <ol className="space-y-3 lg:max-h-[calc(100dvh-360px)] lg:overflow-y-auto lg:pr-1">
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
