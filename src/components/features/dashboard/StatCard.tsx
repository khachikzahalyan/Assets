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
    /** Tinted gradient card background (from-X/15 → to-X/[0.06]) — every card. */
    cardBg: string
    /** Accent card border colour. */
    cardBorder: string
    /** Soft corner glow colour. */
    glow: string
  }
> = {
  orange: {
    iconBox:     'bg-accent/15 text-accent',
    number:      'text-text-primary',
    label:       'text-accent',
    hoverBorder: 'hover:border-accent/50',
    cardBg:      'from-accent/15 to-accent/[0.06]',
    cardBorder:  'border-accent/30',
    glow:        'bg-accent/20',
  },
  green: {
    iconBox:     'bg-success/15 text-success',
    number:      'text-success',
    label:       'text-success',
    hoverBorder: 'hover:border-success/50',
    cardBg:      'from-success/15 to-success/[0.06]',
    cardBorder:  'border-success/30',
    glow:        'bg-success/20',
  },
  blue: {
    iconBox:     'bg-info/15 text-info',
    number:      'text-info',
    label:       'text-info',
    hoverBorder: 'hover:border-info/50',
    cardBg:      'from-info/15 to-info/[0.06]',
    cardBorder:  'border-info/30',
    glow:        'bg-info/20',
  },
  violet: {
    iconBox:     'bg-violet-500/15 text-violet-300',
    number:      'text-violet-300',
    label:       'text-violet-300',
    hoverBorder: 'hover:border-violet-500/50',
    cardBg:      'from-violet-500/15 to-violet-500/[0.06]',
    cardBorder:  'border-violet-500/30',
    glow:        'bg-violet-500/20',
  },
  amber: {
    iconBox:     'bg-warning/15 text-warning',
    number:      'text-warning',
    label:       'text-warning',
    hoverBorder: 'hover:border-warning/50',
    cardBg:      'from-warning/15 to-warning/[0.06]',
    cardBorder:  'border-warning/30',
    glow:        'bg-warning/20',
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
        // Background + border — every card gets its own accent gradient
        'bg-gradient-to-br', cls.cardBg, cls.cardBorder,
        cls.hoverBorder,
        // Padding: denser on mobile
        'p-3 lg:p-[18px]',
      )}
    >
      {/* Soft radial glow — accent-tinted, every card */}
      <span
        className={cn('absolute -top-6 -right-6 w-28 h-28 rounded-full blur-2xl pointer-events-none', cls.glow)}
        aria-hidden="true"
      />

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
          Same vertical arrangement as the featured «Всего активов» card
          on every breakpoint: icon plaque / big number / label.        */}
      {!featured && (
        <div className="relative flex flex-col gap-2">
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
            <div
              className={cn(
                'text-[28px] lg:text-[32px] font-bold leading-none tracking-tight tabular-nums',
                cls.number,
              )}
            >
              {value ?? '—'}
            </div>
            <div className={cn('text-[11px] lg:text-[11.5px] mt-0.5 leading-tight truncate', cls.label)}>
              {label}
            </div>
          </div>
        </div>
      )}
    </Link>
  )
}
