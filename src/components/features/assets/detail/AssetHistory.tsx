import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { SectionCard, LIST_ROW_SEPARATOR_FULL } from '@/components/ui'
import type { AuditLog } from '@/domain/audit'
import type { AssetReferenceData } from '@/domain/asset'

export interface AssetHistoryProps {
  logs: AuditLog[]
  ref?: AssetReferenceData | undefined
}

export function AssetHistory({ logs }: AssetHistoryProps) {
  const { t } = useTranslation('assets')

  /** Short relative / absolute timestamp — uses outer `t` for i18n */
  const shortTs = (iso: string): string => {
    try {
      const d = new Date(iso)
      const now = Date.now()
      const diffMs = now - d.getTime()
      const diffMin = Math.floor(diffMs / 60_000)
      if (diffMin < 2) return t('relTime.now')
      if (diffMin < 60) return t('relTime.minAgo', { n: diffMin })
      const diffH = Math.floor(diffMin / 60)
      if (diffH < 24) return t('relTime.hourAgo', { n: diffH })
      const diffD = Math.floor(diffH / 24)
      if (diffD < 7) return t('relTime.dayAgo', { n: diffD })
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return iso
    }
  }

  // Newest-first
  const sorted = [...logs].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <SectionCard title={t('form.history')} icon="clock">
      {sorted.length === 0 ? (
        <p className="text-[12.5px] text-text-subtle">—</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map(log => (
            <li
              key={log.id}
              className={cn('flex items-start gap-3 py-2', LIST_ROW_SEPARATOR_FULL)}
            >
              <div className="flex-1 min-w-0">
                <span className="text-[12.5px] font-medium text-text-primary">
                  {t(`history.action.${log.action}`, { defaultValue: log.action })}
                </span>
                <span className="ml-2 text-[11.5px] text-text-subtle">
                  {log.actorUid} · {log.actorRole}
                </span>
              </div>
              <span className="text-[11px] text-text-subtle flex-shrink-0 mt-0.5">
                {shortTs(log.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
