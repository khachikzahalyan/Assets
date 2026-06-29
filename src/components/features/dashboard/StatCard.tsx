import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

export type StatCardAccent = 'orange' | 'green' | 'blue' | 'violet' | 'amber'

export interface StatCardHeroStat {
  value: number | null
  label: string
  tone: 'success' | 'info'
}

export interface StatCardProps {
  icon: string
  label: string
  value: number | null
  to: string
  accent: StatCardAccent
  /** Orange gradient hero card — bigger glow, special label colour. */
  featured?: boolean
  /**
   * Only rendered on mobile (<lg) when featured=true.
   * Two mini-stats on the right side of the horizontal hero layout.
   */
  heroStats?: [StatCardHeroStat, StatCardHeroStat]
  testId?: string
}

const ACCENT: Record<
  StatCardAccent,
  {
    iconBox: string
    number: string
    label: string
    hoverBorder: string
    /** Mobile compact card tinted background (non-featured). */
    mobileBg: string
    /** Mobile compact card border color (non-featured). */
    mobileBorder: string
  }
> = {
  orange: {
    iconBox:      'bg-accent/15 text-accent',
    number:       'text-text-primary',
    label:        'text-accent',
    hoverBorder:  'hover:border-accent/50',
    mobileBg:     'bg-accent/[0.06]',
    mobileBorder: 'border-accent/20',
  },
  green: {
    iconBox:      'bg-success/15 text-success',
    number:       'text-success',
    label:        'text-text-subtle',
    hoverBorder:  'hover:border-success/40',
    mobileBg:     'bg-success/[0.06]',
    mobileBorder: 'border-success/20',
  },
  blue: {
    iconBox:      'bg-info/15 text-info',
    number:       'text-info',
    label:        'text-text-subtle',
    hoverBorder:  'hover:border-info/40',
    mobileBg:     'bg-info/[0.06]',
    mobileBorder: 'border-info/20',
  },
  violet: {
    iconBox:      'bg-violet-500/15 text-violet-300',
    number:       'text-violet-300',
    label:        'text-text-subtle',
    hoverBorder:  'hover:border-violet-500/40',
    mobileBg:     'bg-violet-500/[0.06]',
    mobileBorder: 'border-violet-500/20',
  },
  amber: {
    iconBox:      'bg-warning/15 text-warning',
    number:       'text-warning',
    label:        'text-text-subtle',
    hoverBorder:  'hover:border-warning/40',
    mobileBg:     'bg-warning/[0.06]',
    mobileBorder: 'border-warning/20',
  },
}

export function StatCard({
  icon,
  label,
  value,
  to,
  accent,
  featured = false,
  heroStats,
  testId,
}: StatCardProps) {
  const cls = ACCENT[accent]

  return (
    <Link
      to={to}
      data-testid={testId}
      className={cn(
        'block rounded-xl border relative overflow-hidden',
        'transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        // Featured spans full 2-col width on mobile, reverts to 1 col on desktop
        featured && 'col-span-2 lg:col-span-1',
        // Background + border
        featured
          ? 'bg-gradient-to-br from-accent/15 to-accent/[0.06] border-accent/30'
          : cn(cls.mobileBg, cls.mobileBorder, 'lg:bg-surface lg:border-border'),
        cls.hoverBorder,
        // Padding: denser on mobile
        'p-3 lg:p-[18px]',
      )}
    >
      {/* Soft radial glow — featured only */}
      {featured && (
        <span
          className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-accent/20 blur-2xl pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* ── FEATURED CARD ─────────────────────────────────────────
          Single DOM tree, responsive layout via Tailwind:
          · mobile (<lg):  flex-row — [icon+value+label] [mini-stats]
          · desktop (≥lg): flex-col — [icon] / [value] / [label]
          Value is rendered ONCE so tests find exactly one element. */}
      {featured && (
        <div className="relative flex items-center justify-between gap-2 lg:flex-col lg:items-start lg:justify-start lg:gap-2">
          {/* Left on mobile / full column on desktop */}
          <div className="flex items-center gap-2.5 min-w-0 lg:flex-col lg:items-start lg:gap-2">
            <span
              className={cn(
                'w-8 h-8 rounded-[9px] inline-flex items-center justify-center flex-shrink-0',
                cls.iconBox,
              )}
              aria-hidden="true"
            >
              <Icon name={icon} size={15} />
            </span>
            <div className="min-w-0">
              {/* ~28px on mobile, 32px on desktop */}
              <div className="text-[28px] lg:text-[32px] font-bold leading-none tracking-tight tabular-nums text-text-primary">
                {value ?? '—'}
              </div>
              <div className={cn('text-[11px] lg:text-[11.5px] mt-0.5 leading-tight truncate', cls.label)}>
                {label}
              </div>
            </div>
          </div>

          {/* Right mini-stats — visible on mobile only */}
          {heroStats && (
            <div className="flex gap-3 flex-shrink-0 lg:hidden" aria-hidden="true">
              {heroStats.map((s, i) => (
                <div key={i} className="text-center">
                  <div
                    className={cn(
                      'text-[17px] font-mono font-bold leading-none tabular-nums',
                      s.tone === 'success' ? 'text-success' : 'text-info',
                    )}
                  >
                    {s.value ?? '—'}
                  </div>
                  <div className="text-[9.5px] text-text-subtle mt-0.5 leading-none">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NON-FEATURED CARD ─────────────────────────────────────
          Single DOM tree, responsive layout:
          · mobile (<lg):  [icon(24px) + label] / [value(22px)]
          · desktop (≥lg): [icon(32px)] / [value(32px)] / [label]
          Value is rendered ONCE so tests find exactly one element.
          Label renders at two positions (mobile inline, desktop below)
          via `lg:hidden` / `hidden lg:block` — acceptable since no test
          queries label text for these cards.                        */}
      {!featured && (
        <div className="relative flex flex-col gap-2">
          {/* Top row: icon + label(mobile) / icon-only(desktop) */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center justify-center flex-shrink-0',
                // 24px on mobile, 32px on desktop
                'w-6 h-6 lg:w-8 lg:h-8',
                'rounded-[7px] lg:rounded-[9px]',
                cls.iconBox,
              )}
              aria-hidden="true"
            >
              <Icon name={icon} size={12} />
            </span>
            {/* Label next to icon — mobile only */}
            <div className={cn('text-[11px] leading-tight truncate lg:hidden', cls.label)}>
              {label}
            </div>
          </div>

          {/* Number — 22px on mobile, 32px on desktop */}
          <div
            className={cn(
              'text-[22px] lg:text-[32px] font-bold leading-none tracking-tight tabular-nums',
              cls.number,
            )}
          >
            {value ?? '—'}
          </div>

          {/* Label below number — desktop only */}
          <div className={cn('text-[11.5px] hidden lg:block', cls.label)}>{label}</div>
        </div>
      )}
    </Link>
  )
}
