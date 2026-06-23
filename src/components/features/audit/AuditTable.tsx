import { Fragment, useState, useEffect } from 'react'
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

  // ── Responsive: matchMedia so the layout is correct on first paint ───────────
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (isMobile) {
    // ── Mobile card list ────────────────────────────────────────────────────────
    return (
      <div className="flex flex-col divide-y divide-border">
        {rows.map(log => {
          const isOpen = expanded === log.id
          const link = entityLink(log)
          return (
            <div key={log.id}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : log.id)}
                className="w-full text-left px-1 py-3 hover:bg-[#1A1D21] active:bg-[#1A1D21] transition-colors duration-100"
              >
                {/* Row 1: time + entity chip */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-[11px] text-text-tertiary whitespace-nowrap">
                    {formatAuditTs(log.at, i18n.language)}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Chip>
                      {t(`entity.${log.entityType}`, { defaultValue: log.entityType })}
                    </Chip>
                    <Icon
                      name="chevron-right"
                      size={13}
                      className={`text-text-subtle ${isOpen ? 'rotate-90 transition-transform' : 'transition-transform'}`}
                    />
                  </div>
                </div>
                {/* Row 2: actor + action */}
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="text-text-primary font-medium truncate flex-1 min-w-0">
                    {resolveActorName(log.actorUid, refData.actors)}
                  </span>
                  <span className="text-text-tertiary flex-shrink-0">
                    {t(`action.${log.action}`, { defaultValue: log.action })}
                  </span>
                </div>
                {/* Row 3: entity id */}
                <div className="mt-0.5">
                  {link != null ? (
                    <span
                      role="link"
                      onClick={e => { e.stopPropagation(); navigate(link) }}
                      className="font-mono text-[11px] text-accent-light underline"
                    >
                      {log.entityId}
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-text-subtle">{log.entityId}</span>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="bg-[#15181C] px-2 py-2 border-t border-border">
                  <AuditDiff log={log} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Desktop table ───────────────────────────────────────────────────────────
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-text-subtle border-b border-border">
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
                  className="text-[12.5px] border-b border-border hover:bg-[#1A1D21] cursor-pointer transition-colors duration-100"
                >
                  <td className="py-2 pr-3 text-text-subtle">
                    <Icon
                      name="chevron-right"
                      size={13}
                      className={isOpen ? 'rotate-90 transition-transform' : 'transition-transform'}
                    />
                  </td>
                  <td className="py-2 pr-3 text-text-tertiary whitespace-nowrap font-mono text-[12px]">
                    {formatAuditTs(log.at, i18n.language)}
                  </td>
                  <td className="py-2 pr-3 text-text-primary">
                    {resolveActorName(log.actorUid, refData.actors)}
                  </td>
                  <td className="py-2 pr-3 text-text-tertiary">
                    {t(`role.${log.actorRole}`, { defaultValue: log.actorRole })}
                  </td>
                  <td className="py-2 pr-3">
                    <Chip>
                      {t(`entity.${log.entityType}`, { defaultValue: log.entityType })}
                    </Chip>
                  </td>
                  <td className="py-2 pr-3 text-text-tertiary">
                    {t(`action.${log.action}`, { defaultValue: log.action })}
                  </td>
                  <td className="py-2 font-mono text-[12px]">
                    {link != null ? (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); navigate(link) }}
                        className="text-accent-light hover:underline"
                      >
                        {log.entityId}
                      </button>
                    ) : (
                      <span className="text-text-subtle">{log.entityId}</span>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-border bg-[#15181C]">
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
