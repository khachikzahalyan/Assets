import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Icon } from '@/components/ui'
import type { WorkstationLicense } from '@/domain/license'

export interface WorkstationLicenseTableProps {
  rows: WorkstationLicense[]
  /** Optional render-prop for per-row actions column. When omitted, no actions column is rendered. */
  renderActions?: (license: WorkstationLicense) => ReactNode
}

export function WorkstationLicenseTable({ rows, renderActions }: WorkstationLicenseTableProps) {
  const { t } = useTranslation('licenses')

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-[#64748B] border-b border-[#2A2F36]">
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
                <span className="text-[#F8FAFC] font-medium">{row.name}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-[#94A3B8]">{row.vendor ?? '—'}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-[#94A3B8]">{row.type}</span>
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
                  <span className="text-[#94A3B8]">
                    {formatDate(row.expiresAt)}
                  </span>
                ) : (
                  <span className="text-[#64748B]">—</span>
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
        <Icon name="user" size={12} className="text-[#64748B]" />
        <span className="text-[#94A3B8]">
          {t('assignment.employee')}
          {license.assignedToEmployeeId ? (
            <span className="text-[#64748B] ml-1 text-[12px]">
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
      <Icon name="monitor" size={12} className="text-[#64748B]" />
      <span className="text-[#94A3B8]">
        {t('assignment.device')}
        {license.assignedToAssetId ? (
          <span className="text-[#64748B] ml-1 text-[12px]">
            #{license.assignedToAssetId}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
