import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/ui/section-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/components/ui/icon'

export interface ActivityRowVM {
  id: string
  icon: string
  label: string
  /** ISO 8601 timestamp string */
  at: string
  to?: string
}

export interface RecentActivityListProps {
  title: string
  icon: string
  rows: ActivityRowVM[]
  emptyLabel: string
  moreTo?: string
}

/**
 * Formats an ISO timestamp to DD/Mon/YYYY (date-only).
 * Reuses the same pattern as auditFormat.ts#formatAuditTs but date-only.
 * Returns the raw input on parse failure.
 */
function formatDdMonYyyy(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = new Intl.DateTimeFormat('en', { month: 'short' }).format(d)
  const yyyy = d.getFullYear()
  return `${dd}/${mon}/${yyyy}`
}

export function RecentActivityList({
  title,
  icon,
  rows,
  emptyLabel,
  moreTo,
}: RecentActivityListProps) {
  const { t } = useTranslation('dashboard')

  return (
    <SectionCard title={title} icon={icon}>
      {rows.length === 0 ? (
        <EmptyState icon="history" title={emptyLabel} />
      ) : (
        <div className="flex flex-col">
          {rows.map(row => {
            const content = (
              <div className="flex items-start gap-3 py-2.5 group">
                <span
                  className="w-7 h-7 rounded-md bg-[#22272E] text-[#94A3B8] inline-flex items-center justify-center flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  <Icon name={row.icon} size={13} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-[#F8FAFC] leading-snug truncate">
                    {row.label}
                  </div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    {formatDdMonYyyy(row.at)}
                  </div>
                </div>
              </div>
            )

            if (row.to) {
              return (
                <Link
                  key={row.id}
                  to={row.to}
                  className="block border-b border-[#2A2F36] last:border-b-0 hover:bg-[#22272E] rounded-md -mx-1 px-1 transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#F97316]"
                >
                  {content}
                </Link>
              )
            }

            return (
              <div
                key={row.id}
                className="border-b border-[#2A2F36] last:border-b-0"
              >
                {content}
              </div>
            )
          })}

          {moreTo && (
            <div className="pt-3 text-right">
              <Link
                to={moreTo}
                className="text-[11.5px] text-[#F97316] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#F97316]"
              >
                {t('viewAll')}
              </Link>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
