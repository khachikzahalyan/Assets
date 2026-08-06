import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import { MiniBarChart } from './MiniBarChart'

export type StatCardAccent = 'orange' | 'green' | 'blue' | 'violet' | 'amber' | 'rose'

/**
 * Display variant:
 *   'hero'    — Row 1, card 1 (span 5 cols).
 *               Large card with warm-tinted gradient bg, colored border ~15%,
 *               icon-box 38px, delta chip top-right, number 52px (3.25rem)
 *               white text-text-primary, muted 14px label, bar chart h-28px.
 *   'wide'    — Row 1, cards 2–3 (span 4 and 3).
 *               Same gradient/border style; flex-col justify-between;
 *               icon-box top, number+label at bottom. Number 44px (2.75rem).
 *   'compact' — Row 2. Neutral bg-surface, border white/6%, radius 16px,
 *               padding 18px 22px, flex row, icon-box 32px radius 9px,
 *               number 22px (1.375rem) white (text-text-primary).
 *
 * If omitted, defaults to 'wide'.
 */
export type StatCardVariant = 'hero' | 'wide' | 'compact'

export interface StatCardHeroStat {
  value: number | null
  label: string
  tone: 'success' | 'info'
}

export interface StatCardProps {
  icon: string
  label: string
  value: number | null
  /** Navigation target. Omit to render a non-clickable card. */
  to?: string
  accent: StatCardAccent
  variant?: StatCardVariant
  /**
   * @deprecated Use variant='hero' + days/delta7d instead.
   */
  featured?: boolean
  heroStats?: [StatCardHeroStat, StatCardHeroStat]
  days?: number[]
  delta7d?: number
  barClass?: string
  testId?: string
}

// ── Per-accent token sets ─────────────────────────────────────────────────────
// Row 1 cards: warm/tinted gradient bg per spec (from-accent/[0.07] style).
// Row 2 compact: neutral bg-surface, no per-accent bg needed.
const ACCENT: Record<
  StatCardAccent,
  {
    iconBox:     string   // icon badge bg + text color
    cardBg:      string   // gradient bg for row-1 cards
    cardBorder:  string   // colored border ~15%
    hoverBorder: string
    glow:        string   // radial glow blob
  }
> = {
  orange: {
    iconBox:     'bg-accent/15 text-accent',
    cardBg:      'from-accent/[0.07] to-surface/0',
    cardBorder:  'border-accent/15',
    hoverBorder: 'hover:border-accent/40',
    glow:        'bg-accent/10',
  },
  green: {
    iconBox:     'bg-success/15 text-success',
    cardBg:      'from-success/[0.07] to-surface/0',
    cardBorder:  'border-success/15',
    hoverBorder: 'hover:border-success/40',
    glow:        'bg-success/10',
  },
  blue: {
    iconBox:     'bg-info/15 text-info',
    cardBg:      'from-info/[0.07] to-surface/0',
    cardBorder:  'border-info/15',
    hoverBorder: 'hover:border-info/40',
    glow:        'bg-info/10',
  },
  violet: {
    iconBox:     'bg-violet-500/15 text-violet-300 light:text-violet-700',
    cardBg:      'from-violet-500/[0.07] to-surface/0',
    cardBorder:  'border-violet-500/15',
    hoverBorder: 'hover:border-violet-500/40',
    glow:        'bg-violet-500/10',
  },
  amber: {
    iconBox:     'bg-warning/15 text-warning',
    cardBg:      'from-warning/[0.07] to-surface/0',
    cardBorder:  'border-warning/15',
    hoverBorder: 'hover:border-warning/40',
    glow:        'bg-warning/10',
  },
  rose: {
    iconBox:     'bg-rose-500/15 text-rose-300 light:text-rose-700',
    cardBg:      'from-rose-500/[0.07] to-surface/0',
    cardBorder:  'border-rose-500/15',
    hoverBorder: 'hover:border-rose-500/40',
    glow:        'bg-rose-500/10',
  },
}

export function StatCard({
  icon,
  label,
  value,
  to,
  accent,
  variant,
  featured = false,
  heroStats,
  days,
  delta7d,
  barClass,
  testId,
}: StatCardProps) {
  const { t } = useTranslation('dashboard')
  const cls = ACCENT[accent]
  const effectiveVariant: StatCardVariant = variant ?? 'wide'

  // ── COMPACT variant (Row 2) ───────────────────────────────────────────────────
  // bg-surface, border white/6%, radius 16px (1rem), padding 18px 22px,
  // flex row items-center gap 14px, icon-box 32px radius 9px,
  // number 22px (1.375rem) bold WHITE, label 13px muted.
  if (effectiveVariant === 'compact') {
    const wrapperClass = cn(
      'block rounded-[1rem] border relative overflow-hidden',
      // border-border (theme token) stays visible in light mode; hover mirrors
      // the row-1 KPI cards (owner request: every block gets border + hover).
      'bg-surface border-border transition-colors duration-150',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      'px-[1.375rem] py-[1.125rem]',
      'hover:border-text-tertiary/40',
    )
    const inner = (
      <>
        <span
          className={cn('absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl pointer-events-none', cls.glow)}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-[0.875rem]">
          {/* Icon box: 32px (2rem), radius 9px */}
          <span
            className={cn(
              'w-8 h-8 rounded-[0.5625rem] inline-flex items-center justify-center flex-shrink-0',
              cls.iconBox,
            )}
            aria-hidden="true"
          >
            <Icon name={icon} size={15} />
          </span>
          <div className="min-w-0 flex-1">
            {/* Number: 22px (1.375rem) bold white */}
            <div
              className="font-bold leading-none tracking-tight tabular-nums text-text-primary"
              style={{ fontSize: '1.375rem' }}
            >
              {value ?? '—'}
            </div>
            {/* Label: 13px muted */}
            <div className="text-13 mt-[0.1875rem] leading-tight text-text-tertiary">
              {label}
            </div>
          </div>
        </div>
      </>
    )
    return to
      ? <Link to={to} data-testid={testId} className={wrapperClass}>{inner}</Link>
      : <div data-testid={testId} className={wrapperClass}>{inner}</div>
  }

  // ── Shared wrapper for HERO and WIDE (Row 1) ──────────────────────────────────
  // radius 20px (1.25rem), padding 26px 28px, tinted gradient bg, colored border ~15%.
  const wrapperClass = cn(
    'block rounded-[1.25rem] border relative overflow-hidden',
    'transition-colors duration-150',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'bg-gradient-to-br bg-surface', cls.cardBg, cls.cardBorder,
    to && cls.hoverBorder,
    // padding: 26px top/bottom = 1.625rem, 28px left/right = 1.75rem
    'px-[1.75rem] py-[1.625rem]',
    // hero: spans 2 cols on mobile (full width), 1 col on desktop via grid
    effectiveVariant === 'hero' && 'col-span-2 lg:col-span-1',
  )

  // ── HERO variant (Row 1, card 1) ──────────────────────────────────────────────
  // Top row: icon-box 38px (2.375rem) radius 11px + delta chip «+N за 7д» green.
  // Number: 52px (3.25rem) bold white (text-text-primary), letter-spacing -0.03em.
  // Label: 14px muted (text-text-secondary), mt 4px.
  // Bar chart: h-28px (1.75rem), gap 4px, bars flex-1, accent/33%, radius 2px, mt 20px.
  if (effectiveVariant === 'hero') {
    const inner = (
      <>
        <span
          className={cn('absolute -top-6 -right-6 w-28 h-28 rounded-full blur-2xl pointer-events-none', cls.glow)}
          aria-hidden="true"
        />
        <div className="relative flex flex-col h-full">
          {/* Top row: icon-box + delta chip */}
          <div className="flex items-center justify-between flex-shrink-0">
            {/* Icon box: 38px (2.375rem), radius 11px */}
            <span
              className={cn(
                'inline-flex items-center justify-center flex-shrink-0',
                'rounded-[0.6875rem]',
                cls.iconBox,
              )}
              style={{ width: '2.375rem', height: '2.375rem' }}
              aria-hidden="true"
            >
              <Icon name={icon} size={18} />
            </span>
            {/* Delta chip: font 12px, py 4px px 10px, rounded-full, green */}
            {delta7d !== undefined && (
              <span
                className="inline-flex items-center rounded-full font-medium tabular-nums text-success bg-success/10 flex-shrink-0"
                style={{ fontSize: '0.75rem', paddingTop: '0.25rem', paddingBottom: '0.25rem', paddingLeft: '0.625rem', paddingRight: '0.625rem' }}
              >
                {t('boxes.delta7dShort', { n: delta7d })}
              </span>
            )}
          </div>

          {/* Number: 52px (3.25rem) bold white, letter-spacing -0.03em, mt 22px */}
          <div
            className="font-bold text-text-primary leading-none tabular-nums"
            style={{ fontSize: '3.25rem', letterSpacing: '-0.03em', marginTop: '1.375rem' }}
          >
            {value ?? '—'}
          </div>

          {/* Label: 14px muted, mt 4px */}
          <div
            className="text-14 text-text-secondary leading-tight"
            style={{ marginTop: '0.25rem' }}
          >
            {label}
          </div>

          {/* Bar chart: h-28px (1.75rem), mt 20px */}
          {days && barClass && (
            <div style={{ marginTop: '1.25rem' }}>
              <MiniBarChart days={days} barClass={barClass} variant="full" />
            </div>
          )}
        </div>

        {/* heroStats mobile only */}
        {heroStats && (
          <div className="absolute top-[1.625rem] right-[1.75rem] flex gap-3 lg:hidden" aria-hidden="true">
            {heroStats.map(s => (
              <div key={s.label} className="text-center">
                <div
                  className={cn(
                    'text-17 font-mono font-bold leading-none tabular-nums',
                    s.tone === 'success' ? 'text-success' : 'text-info',
                  )}
                >
                  {s.value ?? '—'}
                </div>
                <div className="text-10 text-text-subtle mt-0.5 leading-none">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )
    return to
      ? <Link to={to} data-testid={testId} className={wrapperClass}>{inner}</Link>
      : <div data-testid={testId} className={wrapperClass}>{inner}</div>
  }

  // ── WIDE variant (Row 1, cards 2–3) ──────────────────────────────────────────
  // flex-col justify-between: icon-box top, number+label at bottom.
  // Number: 44px (2.75rem) bold white. Label: 14px muted.
  const inner = (
    <>
      <span
        className={cn('absolute -top-6 -right-6 w-28 h-28 rounded-full blur-2xl pointer-events-none', cls.glow)}
        aria-hidden="true"
      />
      <div className="relative flex flex-col justify-between h-full min-h-0">
        {/* Icon box: 38px (2.375rem), radius 11px — top */}
        <span
          className={cn(
            'inline-flex items-center justify-center flex-shrink-0',
            'rounded-[0.6875rem]',
            cls.iconBox,
          )}
          style={{ width: '2.375rem', height: '2.375rem' }}
          aria-hidden="true"
        >
          <Icon name={icon} size={18} />
        </span>

        {/* Number + label — bottom */}
        <div>
          {/* Number: 44px (2.75rem) bold white */}
          <div
            className="font-bold text-text-primary leading-none tabular-nums"
            style={{ fontSize: '2.75rem', letterSpacing: '-0.02em' }}
          >
            {value ?? '—'}
          </div>
          {/* Label: 14px muted, mt 4px */}
          <div
            className="text-14 text-text-secondary leading-tight"
            style={{ marginTop: '0.25rem' }}
          >
            {label}
          </div>
        </div>
      </div>

      {/* Legacy featured heroStats (mobile only) */}
      {featured && heroStats && (
        <div className="flex gap-3 flex-shrink-0 lg:hidden mt-2" aria-hidden="true">
          {heroStats.map(s => (
            <div key={s.label} className="text-center">
              <div
                className={cn(
                  'text-17 font-mono font-bold leading-none tabular-nums',
                  s.tone === 'success' ? 'text-success' : 'text-info',
                )}
              >
                {s.value ?? '—'}
              </div>
              <div className="text-10 text-text-subtle mt-0.5 leading-none">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  return to
    ? <Link to={to} data-testid={testId} className={wrapperClass}>{inner}</Link>
    : <div data-testid={testId} className={wrapperClass}>{inner}</div>
}
