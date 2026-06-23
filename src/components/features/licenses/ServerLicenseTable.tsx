import { type ReactNode, useState, useEffect } from 'react'
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

  // ── Desktop table ───────────────────────────────────────────────────────────
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-text-subtle border-b border-border">
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
                <span className="text-text-primary font-medium">{row.name}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-text-tertiary">{row.vendor ?? '—'}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-text-tertiary">{row.type}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-text-tertiary">{row.environment ?? '—'}</span>
              </td>
              <td className="py-2.5 pr-4">
                <span className="text-text-tertiary font-mono text-[12px]">{row.host ?? '—'}</span>
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

