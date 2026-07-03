import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, Chip, DataTable } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { AuditDiff } from './AuditDiff'
import { formatAuditTs, resolveActorName, entityLink } from './auditFormat'
import type { AuditLog, AuditLogReferenceData } from '@/domain/audit'
import { AuditRowMobile } from './AuditRowMobile'

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
    // ── Mobile card list via AuditRowMobile (wraps ui/MobileListRow) ────────
    return (
      <div className="flex flex-col">
        {rows.map(log => (
          <AuditRowMobile
            key={log.id}
            log={log}
            refData={refData}
            isOpen={expanded === log.id}
            onToggle={() => setExpanded(expanded === log.id ? null : log.id)}
          />
        ))}
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
