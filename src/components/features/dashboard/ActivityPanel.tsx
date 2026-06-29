import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { AssignmentActivityRow } from '@/domain/dashboard'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0] ?? ''
  const second = parts[1] ?? ''
  if (first && second) return (first.charAt(0) + second.charAt(0)).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_GRADIENTS = [
  'from-accent to-accent/50',
  'from-info to-info/50',
  'from-success to-success/50',
  'from-warning to-warning/50',
  'from-violet-500 to-violet-400/50',
] as const

function avatarGradient(name: string | null): string {
  if (!name) return AVATAR_GRADIENTS[0]
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length] ?? AVATAR_GRADIENTS[0]
}

function relativeTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins}м назад`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}ч назад`
  const days = Math.floor(hrs / 24)
  return `${days}д назад`
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface ActivityPanelProps {
  rows: AssignmentActivityRow[]
}

export function ActivityPanel({ rows }: ActivityPanelProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section className="bg-surface border border-border rounded-xl overflow-hidden">
      <header className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <span className="w-6 h-6 lg:w-7 lg:h-7 rounded-md bg-success/15 text-success inline-flex items-center justify-center flex-shrink-0">
          <Icon name="arrow-right-left" size={14} />
        </span>
        <h2 className="text-[12px] lg:text-[13px] font-semibold text-text-primary">
          {t('recentActivity')}
        </h2>
      </header>

      <div className="p-4 flex flex-col">
        {rows.length === 0 ? (
          <EmptyState icon="history" title={t('noActivity')} />
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              {rows.map((row, idx) => {
                const initials = getInitials(row.recipientName)
                const grad = avatarGradient(row.recipientName)
                const subtitle = [row.recipientName, row.assetLabel]
                  .filter(Boolean)
                  .join(' · ')

                const content = (
                  <div
                    className={cn(
                      'flex items-center gap-3 px-2 py-2.5 rounded-lg',
                      // Most recent row — faint green tint
                      idx === 0 && 'bg-success/[0.04]',
                    )}
                  >
                    {/* Gradient initials avatar — 30px */}
                    <span
                      className={cn(
                        'w-[30px] h-[30px] rounded-full flex-shrink-0 inline-flex items-center justify-center',
                        'bg-gradient-to-br text-[10px] font-bold text-white leading-none',
                        grad,
                      )}
                      aria-hidden="true"
                    >
                      {initials}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-text-primary leading-snug">
                        {t(`activity.${row.action}`)}
                      </div>
                      {subtitle && (
                        <div className="text-[11px] text-text-subtle mt-0.5 truncate">
                          {subtitle}
                        </div>
                      )}
                    </div>
                    <span className="text-[10.5px] text-text-subtle tabular-nums flex-shrink-0 ml-1">
                      {relativeTime(row.at)}
                    </span>
                  </div>
                )

                if (row.assetId) {
                  return (
                    <Link
                      key={row.auditId}
                      to={`/assets/${row.assetId}`}
                      className="block hover:bg-surface-2 rounded-lg transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                    >
                      {content}
                    </Link>
                  )
                }

                return <div key={row.auditId}>{content}</div>
              })}
            </div>

            {/* Mobile: full-width outlined button */}
            <Link
              to="/assets"
              className="lg:hidden mt-3 block text-center py-2 rounded-lg border border-border/60 text-[12px] text-text-secondary hover:border-border hover:text-text-primary transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              {t('viewAll')}
            </Link>

            {/* Desktop: right-aligned text link */}
            <div className="hidden lg:block pt-3 text-right">
              <Link
                to="/assets"
                className="text-[11.5px] text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                {t('viewAll')}
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
