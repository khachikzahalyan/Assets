import { type ReactNode, useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import type { ServerLicense } from '@/domain/license'
import { formatLicenseDate } from './formatLicenseDate'

export interface ServerLicenseTableProps {
  rows: ServerLicense[]
  /** Optional render-prop for per-row actions column. When omitted, no actions column is rendered. */
  renderActions?: (license: ServerLicense) => ReactNode
}

export function ServerLicenseTable({ rows, renderActions }: ServerLicenseTableProps) {
  const { t, i18n } = useTranslation('licenses')

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
  const columns = useMemo<DataTableColumn<ServerLicense>[]>(() => {
    const cols: DataTableColumn<ServerLicense>[] = [
      {
        key: 'name',
        header: t('col.name'),
        width: 'minmax(160px,1.8fr)',
        cell: (row) => (
          <span className="text-text-primary font-medium text-[13px]">{row.name}</span>
        ),
      },
      {
        key: 'vendor',
        header: t('col.vendor'),
        width: 'minmax(100px,1fr)',
        cell: (row) => (
          <span className="text-[13px] text-text-tertiary">{row.vendor ?? '—'}</span>
        ),
      },
      {
        key: 'type',
        header: t('col.type'),
        width: 'minmax(100px,1fr)',
        cell: (row) => (
          <span className="text-[13px] text-text-tertiary">{row.type}</span>
        ),
      },
      {
        key: 'environment',
        header: t('col.environment'),
        width: 'minmax(100px,1fr)',
        cell: (row) => (
          <span className="text-[13px] text-text-tertiary">{row.environment ?? '—'}</span>
        ),
      },
      {
        key: 'host',
        header: t('col.host'),
        width: 'minmax(120px,1.2fr)',
        cell: (row) => (
          <span className="font-mono text-[12px] text-text-tertiary">{row.host ?? '—'}</span>
        ),
      },
      {
        key: 'expiry',
        header: t('col.expiry'),
        width: 'minmax(100px,1fr)',
        cell: (row) => row.expiresAt ? (
          <span className="text-[13px] text-text-tertiary">
            {formatLicenseDate(row.expiresAt, i18n.language)}
          </span>
        ) : (
          <span className="text-[13px] text-text-subtle">—</span>
        ),
      },
    ]
    if (renderActions) {
      cols.push({
        key: '__actions',
        header: '',
        width: '80px',
        cell: (row) => (
          <div className="flex items-center gap-1 flex-wrap">
            {renderActions(row)}
          </div>
        ),
      })
    }
    return cols
  }, [t, i18n.language, renderActions])

  if (isMobile) {
    // ── Mobile card list ────────────────────────────────────────────────────────
    return (
      <div className="flex flex-col divide-y divide-[#1F242B]">
        {rows.map((row) => (
          <div key={row.id} className="py-3 px-1 space-y-1">
            {/* Name */}
            <div className="text-[14px] font-medium text-text-primary">{row.name}</div>
            {/* Meta row */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-text-tertiary">
              {row.vendor && <span>{row.vendor}</span>}
              <span>{row.type}</span>
              {row.environment && <span className="text-text-subtle">{row.environment}</span>}
            </div>
            {/* Host + expiry */}
            <div className="flex items-center justify-between gap-2 text-[12px]">
              {row.host ? (
                <span className="font-mono text-[11px] text-text-tertiary truncate">{row.host}</span>
              ) : (
                <span />
              )}
              {row.expiresAt ? (
                <span className="text-text-tertiary flex-shrink-0">
                  {t('col.expiry')}: {formatLicenseDate(row.expiresAt, i18n.language)}
                </span>
              ) : null}
            </div>
            {/* Actions */}
            {renderActions && (
              <div className="flex items-center gap-1 flex-wrap pt-1">
                {renderActions(row)}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // ── Desktop DataTable ───────────────────────────────────────────────────────
  return (
    <DataTable<ServerLicense>
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  )
}
