import { type ReactNode, useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Icon, DataTable } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import type { WorkstationLicense } from '@/domain/license'
import { formatLicenseDate } from './formatLicenseDate'

export interface WorkstationLicenseTableProps {
  rows: WorkstationLicense[]
  /** Optional render-prop for per-row actions column. When omitted, no actions column is rendered. */
  renderActions?: (license: WorkstationLicense) => ReactNode
}

export function WorkstationLicenseTable({ rows, renderActions }: WorkstationLicenseTableProps) {
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
  const columns = useMemo<DataTableColumn<WorkstationLicense>[]>(() => {
    const cols: DataTableColumn<WorkstationLicense>[] = [
      {
        key: 'name',
        header: t('col.name'),
        width: 'minmax(140px,1.6fr)',
        cell: (row) => (
          <span className="text-[13px] text-text-primary font-medium">{row.name}</span>
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
        key: 'assignment',
        header: t('col.assignment'),
        width: 'minmax(120px,1.2fr)',
        cell: (row) => <AssignmentCell license={row} />,
      },
      {
        key: 'status',
        header: t('col.status'),
        width: 'minmax(90px,0.9fr)',
        cell: (row) => (
          <Chip color={row.lifecycleStatus === 'active' ? 'green' : 'gray'} dot>
            {t(`status.${row.lifecycleStatus}`)}
          </Chip>
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
          <div key={row.id} className="py-3 px-1 space-y-1.5">
            {/* Name + status */}
            <div className="flex items-start justify-between gap-2">
              <span className="text-[14px] font-medium text-text-primary leading-snug">{row.name}</span>
              <Chip color={row.lifecycleStatus === 'active' ? 'green' : 'gray'} dot>
                {t(`status.${row.lifecycleStatus}`)}
              </Chip>
            </div>
            {/* Vendor + type */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-text-tertiary">
              {row.vendor && <span>{row.vendor}</span>}
              <span>{row.type}</span>
              {row.expiresAt && (
                <span className="text-text-subtle">
                  {t('col.expiry')}: {formatLicenseDate(row.expiresAt, i18n.language)}
                </span>
              )}
            </div>
            {/* Assignment */}
            <div>
              <AssignmentCell license={row} />
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
    <DataTable<WorkstationLicense>
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
    />
  )
}

function AssignmentCell({ license }: { license: WorkstationLicense }) {
  const { t } = useTranslation('licenses')

  if (license.assignmentType === 'unassigned') {
    return (
      <Chip color="gray">{t('assignment.unassigned')}</Chip>
    )
  }

  if (license.assignmentType === 'employee') {
    return (
      <div className="flex items-center gap-1.5">
        <Icon name="user" size={12} className="text-text-subtle" />
        <span className="text-[13px] text-text-tertiary">
          {t('assignment.employee')}
          {license.assignedToEmployeeId ? (
            <span className="text-text-subtle ml-1 text-[12px]">
              #{license.assignedToEmployeeId}
            </span>
          ) : null}
        </span>
      </div>
    )
  }

  // device
  return (
    <div className="flex items-center gap-1.5">
      <Icon name="monitor" size={12} className="text-text-subtle" />
      <span className="text-[13px] text-text-tertiary">
        {t('assignment.device')}
        {license.assignedToAssetId ? (
          <span className="text-text-subtle ml-1 text-[12px]">
            #{license.assignedToAssetId}
          </span>
        ) : null}
      </span>
    </div>
  )
}
