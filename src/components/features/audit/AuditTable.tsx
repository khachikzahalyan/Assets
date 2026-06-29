import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, Chip, DataTable } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
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

  // ── Desktop DataTable columns ────────────────────────────────────────────────
  const columns = useMemo<DataTableColumn<AuditLog>[]>(() => [
    {
      key: 'chevron',
      header: '',
      width: '36px',
      cell: (log) => (
        <Icon
          name="chevron-right"
          size={13}
          className={`text-text-subtle transition-transform ${expanded === log.id ? 'rotate-90' : ''}`}
        />
      ),
    },
    {
      key: 'time',
      header: t('col.time'),
      width: 'minmax(130px,1fr)',
      cell: (log) => (
        <span className="font-mono text-[12px] text-text-tertiary whitespace-nowrap">
          {formatAuditTs(log.at, i18n.language)}
        </span>
      ),
    },
    {
      key: 'actor',
      header: t('col.actor'),
      width: 'minmax(120px,1.5fr)',
      cell: (log) => (
        <span className="text-[12.5px] text-text-primary">
          {resolveActorName(log.actorUid, refData.actors)}
        </span>
      ),
    },
    {
      key: 'role',
      header: t('col.role'),
      width: 'minmax(100px,1fr)',
      cell: (log) => (
        <span className="text-[12.5px] text-text-tertiary">
          {t(`role.${log.actorRole}`, { defaultValue: log.actorRole })}
        </span>
      ),
    },
    {
      key: 'entity',
      header: t('col.entity'),
      width: 'minmax(90px,1fr)',
      cell: (log) => (
        <Chip>
          {t(`entity.${log.entityType}`, { defaultValue: log.entityType })}
        </Chip>
      ),
    },
    {
      key: 'action',
      header: t('col.action'),
      width: 'minmax(90px,1fr)',
      cell: (log) => (
        <span className="text-[12.5px] text-text-tertiary">
          {t(`action.${log.action}`, { defaultValue: log.action })}
        </span>
      ),
    },
    {
      key: 'entityId',
      header: t('col.entityId'),
      width: 'minmax(120px,1.2fr)',
      cell: (log) => {
        const link = entityLink(log)
        if (link != null) {
          return (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); navigate(link) }}
              className="font-mono text-[12px] text-accent-light hover:underline"
            >
              {log.entityId}
            </button>
          )
        }
        return (
          <span className="font-mono text-[12px] text-text-subtle">{log.entityId}</span>
        )
      },
    },
  ], [t, i18n.language, expanded, navigate, refData.actors])

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

  // ── Desktop DataTable ───────────────────────────────────────────────────────
  return (
    <DataTable<AuditLog>
      columns={columns}
      rows={rows}
      getRowKey={(log) => log.id}
      onRowClick={(log) => setExpanded(expanded === log.id ? null : log.id)}
      renderRowExpanded={(log) =>
        expanded === log.id ? (
          <div className="py-2 px-3">
            <AuditDiff log={log} />
          </div>
        ) : null
      }
      aria-label={t('pageTitle', { defaultValue: 'Аудит' })}
    />
  )
}
