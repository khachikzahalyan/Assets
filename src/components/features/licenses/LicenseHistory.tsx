import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Icon } from '@/components/ui'
import type { AuditLog } from '@/domain/audit'

export interface LicenseHistoryProps {
  /** The audit entries for this license — already fetched by the parent. Keys
   *  in audit payloads are ALREADY masked server-side; never unmask here. */
  entries: AuditLog[]
}

export function LicenseHistory({ entries }: LicenseHistoryProps) {
  const { t } = useTranslation('licenses')
  const [open, setOpen] = useState(false)

  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div>
      <Btn
        variant="ghost"
        size="sm"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        data-testid="license-history-toggle"
      >
        <Icon name="clock" size={13} />
        {t('historyHeading')}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={12} />
      </Btn>

      {open && (
        <div className="mt-2 border border-[#2A2F36] rounded-lg bg-[#111315] p-3">
          {sorted.length === 0 ? (
            <p className="text-[12px] text-[#64748B]">{t('historyEmpty')}</p>
          ) : (
            <ul className="space-y-1.5">
              {sorted.map(entry => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 py-1.5 border-b border-[#1F242B] last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-medium text-[#F8FAFC]">
                      {entry.action}
                    </span>
                    <span className="ml-2 text-[11px] text-[#64748B]">
                      {entry.actorUid} · {entry.actorRole}
                    </span>
                    {/* Display masked key from audit payload if present — already masked server-side */}
                    {entry.after && typeof (entry.after as Record<string, unknown>).key === 'string' && (
                      <span className="ml-2 font-mono text-[11px] text-[#64748B]">
                        {String((entry.after as Record<string, unknown>).key)}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#64748B] flex-shrink-0 mt-0.5">
                    {formatTs(entry.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}
