import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ServerLicense } from '@/domain/license'
import { formatLicenseDate } from './formatLicenseDate'

export interface ServerLicenseTableProps {
  rows: ServerLicense[]
  /** Optional render-prop for per-row actions column. When omitted, no actions column is rendered. */
  renderActions?: (license: ServerLicense) => ReactNode
}

export function ServerLicenseTable({ rows, renderActions }: ServerLicenseTableProps) {
  const { t, i18n } = useTranslation('licenses')

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-[#64748B] border-b border-[#2A2F36]">
            <th className="py-2 pr-4 font-medium">{t('col.name')}</th>
            <th className="py-2 pr-4 font-medium">{t('col.vendor')}</th>
            <th className="py-2 pr-4 font-medium">{t('col.type')}</th>
            <th className="py-2 pr-4 font-medium">{t('col.environment')}</th>
            <th className="py-2 pr-4 font-medium">{t('col.host')}</th>
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
                <span className="text-[#94A3B8]">{row.environment ?? '—'}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-[#94A3B8] font-mono text-[12px]">{row.host ?? '—'}</span>
              </td>
              <td className="py-2.5 pr-4">
                {row.expiresAt ? (
                  <span className="text-[#94A3B8]">
                    {formatLicenseDate(row.expiresAt, i18n.language)}
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

