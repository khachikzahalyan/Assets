import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { DashboardAuditRow } from '@/domain/dashboard'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

// ── Badge colours ─────────────────────────────────────────────────────────────

type BadgeTone = 'green' | 'blue' | 'violet' | 'red' | 'neutral'

const BADGE_CLS: Record<BadgeTone, string> = {
  green:   'bg-success/15 text-success border border-success/20',
  blue:    'bg-info/15 text-info border border-info/20',
  violet:  'bg-violet-500/15 text-violet-300 border border-violet-500/20',
  red:     'bg-error/15 text-error border border-error/20',
  neutral: 'bg-surface-2 text-text-subtle border border-border',
}

function actionTone(action: string): BadgeTone {
  if (['created', 'reactivated', 'upgrade_added'].includes(action)) return 'green'
  if (['assigned', 'returned', 'transferred'].includes(action)) return 'blue'
  if (
    ['key_revealed', 'key_rotated', 'license_decoupled', 'license_retired_with_asset'].includes(
      action,
    )
  )
    return 'violet'
  if (['disposed', 'deleted', 'terminated', 'sent_to_repair'].includes(action)) return 'red'
  return 'neutral'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function actorInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0] ?? ''
  const second = parts[1] ?? ''
  if (first && second) return (first.charAt(0) + second.charAt(0)).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatShortTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins}м`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}ч`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}д`
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = new Intl.DateTimeFormat('ru', { month: 'short' }).format(d)
  return `${dd} ${mon}`
}

// ── Component ─────────────────────────────────────────────────────────────────

const COL_KEYS = [
  'audit.col.action',
  'audit.col.description',
  'audit.col.user',
  'audit.col.time',
] as const

export interface AuditTableProps {
  rows: DashboardAuditRow[]
}

export function AuditTable({ rows }: AuditTableProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section
      className="bg-surface border border-border rounded-xl overflow-hidden"
      data-testid="section-recent-audit"
    >
      {/* Panel header */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 lg:w-7 lg:h-7 rounded-md bg-surface-2 text-text-tertiary inline-flex items-center justify-center flex-shrink-0">
            <Icon name="history" size={14} />
          </span>
          <h2 className="text-[12px] lg:text-[13px] font-semibold text-text-primary">
            {t('recentAudit')}
          </h2>
        </div>
        <Link
          to="/audit"
          className="text-[11.5px] text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          {t('viewAll')}
        </Link>
      </header>

      {/* Desktop column headers — hidden below lg */}
      <div className="hidden lg:grid grid-cols-[160px_1fr_180px_72px] gap-4 px-5 py-2 border-b border-border/50">
        {COL_KEYS.map(key => (
          <span
            key={key}
            className="text-[10.5px] font-semibold uppercase tracking-wider text-text-subtle"
          >
            {t(key)}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/50">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12px] text-text-subtle">{t('noAudit')}</div>
        ) : (
          rows.map(row => {
            const tone = actionTone(row.action)
            const badgeCls = BADGE_CLS[tone]
            const initials = actorInitials(row.actorName)

            return (
              <div key={row.id} className="px-5 py-3">
                {/* Desktop: 4-col grid (≥lg) */}
                <div className="hidden lg:grid grid-cols-[160px_1fr_180px_72px] gap-4 items-center">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium w-fit max-w-full truncate',
                      badgeCls,
                    )}
                  >
                    {t(`auditAction.${row.action}`, { defaultValue: row.action })}
                  </span>
                  <span className="text-[12.5px] text-text-secondary truncate">
                    {row.targetLabel}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-6 h-6 rounded-full bg-surface-2 flex-shrink-0 inline-flex items-center justify-center text-[9px] font-bold text-text-tertiary"
                      aria-hidden="true"
                    >
                      {initials}
                    </span>
                    <span className="text-[12px] text-text-secondary truncate">
                      {row.actorName}
                    </span>
                  </div>
                  <span className="text-[11.5px] font-mono text-text-subtle text-right">
                    {formatShortTime(row.at)}
                  </span>
                </div>

                {/* Mobile: compact row — action badge + targetLabel + short date (<lg) */}
                <div className="lg:hidden flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-medium truncate',
                        badgeCls,
                      )}
                    >
                      {t(`auditAction.${row.action}`, { defaultValue: row.action })}
                    </span>
                    <span className="text-[10.5px] font-mono text-text-subtle flex-shrink-0">
                      {formatShortTime(row.at)}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-text-secondary truncate">
                    {row.targetLabel}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
