import { Chip, Icon } from '@/components/ui'
import type { HistoryEventVM } from './detailFormat'
import { historyTint, fmtRuDate, relativeTime } from './detailFormat'

interface HistoryEventProps {
  ev: HistoryEventVM
}

export function HistoryEvent({ ev }: HistoryEventProps) {
  const tint      = historyTint(ev.icon)
  const hasDelta  = Boolean(ev.before ?? ev.after)
  const headLabel = hasDelta ? (ev.slotLabel ?? ev.action) : ev.action

  return (
    <li className="flex gap-3">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-inset ${tint.bg} ${tint.text}`}
      >
        <Icon name={ev.icon} size={16} />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        {headLabel && (
          <p className="font-semibold text-text-primary text-[14.5px] mb-1">{headLabel}</p>
        )}
        {hasDelta && (
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {ev.before && (
              <>
                <Chip color="red"><span className="line-through">{ev.before}</span></Chip>
                <Icon name="arrow-right" size={12} className="text-text-subtle shrink-0" />
              </>
            )}
            {ev.after && <Chip color="green">{ev.after}</Chip>}
          </div>
        )}
        <span className="text-[12px] text-text-tertiary tabular-nums">
          {ev.actor} · {fmtRuDate(ev.date)} · {relativeTime(ev.date)}
        </span>
      </div>
    </li>
  )
}
