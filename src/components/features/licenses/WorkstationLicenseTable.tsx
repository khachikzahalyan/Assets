import { type ReactNode, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Icon } from '@/components/ui'
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

  // ── Desktop table ───────────────────────────────────────────────────────────
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-text-subtle border-b border-border">
            <th className="py-2 pr-4 font-medium">{t('col.name')}</th>
            <th className="py-2 pr-4 font-medium">{t('col.vendor')}</th>
            <th className="py-2 pr-4 font-medium">{t('col.type')}</th>
            <th className="py-2 pr-4 font-medium">{t('col.assignment')}</th>
            <th className="py-2 pr-4 font-medium">{t('col.status')}</th>
            <th className="py-2 pr-4 font-medium">{t('col.expiry')}</th>
            {renderActions && <th className="py-2 pr-4 font-medium" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[#1F242B] hover:bg-[#161A20]">
              <td className="py-2.5 pr-4">
                <span className="text-text-primary font-medium">{row.name}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-text-tertiary">{row.vendor ?? '—'}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-text-tertiary">{row.type}</span>
              </td>
              <td className="py-2.5 pr-4">
                <AssignmentCell license={row} />
              </td>
              <td className="py-2.5 pr-4">
                <Chip color={row.lifecycleStatus === 'active' ? 'green' : 'gray'} dot>
                  {t(`status.${row.lifecycleStatus}`)}
                </Chip>
              </td>
              <td className="py-2.5 pr-4">
                {row.expiresAt ? (
                  <span className="text-text-tertiary">
                    {formatLicenseDate(row.expiresAt, i18n.language)}
                  </span>
                ) : (
                  <span className="text-text-subtle">—</span>
                )}
              </td>
              {renderActions && (
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-1 flex-wrap">
                    {renderActions(row)}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
        <span className="text-text-tertiary">
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
      <span className="text-text-tertiary">
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

