import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, Chip } from '@/components/ui'
import { AuditDiff } from './AuditDiff'
import { formatAuditTs, resolveActorName, entityLink } from './auditFormat'
import type { AuditLog, AuditLogReferenceData } from '@/domain/audit'

export interface AuditTableProps {
  rows: AuditLog[]
  ref: AuditLogReferenceData
}

export function AuditTable({ rows, ref: refData }: AuditTableProps) {
  const { t, i18n } = useTranslation('audit')
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[#64748B] border-b border-[#2A2F36]">
            <th className="font-semibold py-2 pr-3 w-8"></th>
            <th className="font-semibold py-2 pr-3 whitespace-nowrap">{t('col.time')}</th>
            <th className="font-semibold py-2 pr-3">{t('col.actor')}</th>
            <th className="font-semibold py-2 pr-3">{t('col.role')}</th>
            <th className="font-semibold py-2 pr-3">{t('col.entity')}</th>
            <th className="font-semibold py-2 pr-3">{t('col.action')}</th>
            <th className="font-semibold py-2">{t('col.entityId')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(log => {
            const isOpen = expanded === log.id
            const link = entityLink(log)
            return (
              <Fragment key={log.id}>
                <tr
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="text-[12.5px] border-b border-[#2A2F36] hover:bg-[#1A1D21] cursor-pointer transition-colors duration-100"
                >
                  <td className="py-2 pr-3 text-[#64748B]">
                    <Icon
                      name="chevron-right"
                      size={13}
                      className={isOpen ? 'rotate-90 transition-transform' : 'transition-transform'}
                    />
                  </td>
                  <td className="py-2 pr-3 text-[#94A3B8] whitespace-nowrap font-mono text-[12px]">
                    {formatAuditTs(log.at, i18n.language)}
                  </td>
                  <td className="py-2 pr-3 text-[#F8FAFC]">
                    {resolveActorName(log.actorUid, refData.actors)}
                  </td>
                  <td className="py-2 pr-3 text-[#94A3B8]">
                    {t(`role.${log.actorRole}`, { defaultValue: log.actorRole })}
                  </td>
                  <td className="py-2 pr-3">
                    <Chip>
                      {t(`entity.${log.entityType}`, { defaultValue: log.entityType })}
                    </Chip>
                  </td>
                  <td className="py-2 pr-3 text-[#94A3B8]">
                    {t(`action.${log.action}`, { defaultValue: log.action })}
                  </td>
                  <td className="py-2 font-mono text-[12px]">
                    {link != null ? (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); navigate(link) }}
                        className="text-[#FB923C] hover:underline"
                      >
                        {log.entityId}
                      </button>
                    ) : (
                      <span className="text-[#64748B]">{log.entityId}</span>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-[#2A2F36] bg-[#15181C]">
                    <td colSpan={7} className="py-2 px-3">
                      <AuditDiff log={log} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
