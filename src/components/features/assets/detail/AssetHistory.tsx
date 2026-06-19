import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/ui'
import type { AuditLog, AuditAction } from '@/domain/audit'
import type { AssetReferenceData } from '@/domain/asset'

export interface AssetHistoryProps {
  logs: AuditLog[]
  ref?: AssetReferenceData | undefined
}

const ACTION_LABELS: Record<AuditAction, string> = {
  created: 'Создан',
  updated: 'Обновлён',
  status_changed: 'Статус изменён',
  assigned: 'Назначен',
  returned: 'Возвращён',
  transferred: 'Перемещён',
  upgrade_added: 'Апгрейд добавлен',
  disposed: 'Списан',
  sent_to_repair: 'Отправлен в ремонт',
  repair_completed: 'Ремонт завершён',
}

/** Short relative / absolute timestamp */
function shortTs(iso: string): string {
  try {
    const d = new Date(iso)
    const now = Date.now()
    const diffMs = now - d.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    if (diffMin < 2) return 'только что'
    if (diffMin < 60) return `${diffMin} мин назад`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH} ч назад`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `${diffD} дн назад`
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

export function AssetHistory({ logs }: AssetHistoryProps) {
  const { t } = useTranslation('assets')

  // Newest-first
  const sorted = [...logs].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <SectionCard title={t('form.history')} icon="clock">
      {sorted.length === 0 ? (
        <p className="text-[12.5px] text-[#64748B]">—</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map(log => (
            <li
              key={log.id}
              className="flex items-start gap-3 py-2 border-b border-[#2A2F36] last:border-0"
            >
              <div className="flex-1 min-w-0">
                <span className="text-[12.5px] font-medium text-[#F8FAFC]">
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="ml-2 text-[11.5px] text-[#64748B]">
                  {log.actorUid} · {log.actorRole}
                </span>
              </div>
              <span className="text-[11px] text-[#64748B] flex-shrink-0 mt-0.5">
                {shortTs(log.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
