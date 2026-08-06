import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'
import type { DomainEventVM, DomainEventKind } from '@/domain/dashboard'
import { relativeTime } from './relativeTime'

/**
 * DomainBox layout variants:
 *
 *   'standard'  — Rows 3 (assets) and 4 (employees, subscriptions, branches).
 *                 Header: bare colored icon 16px + title 13px semibold uppercase.
 *                 For assets (headerLink=true): «Все активы →» accent link in header.
 *                 Body: feed with bullet dots (4 rows, py 13px each).
 *                 Row 4 boxes: min-h-200px (12.5rem), flex-col, empty-state circle.
 *
 *   'parts'     — Row 3 right box (span 5).
 *                 Header: bare icon + title + delta chip.
 *                 Body: «N единиц на складе» hero row (30px number + 13px muted inline),
 *                 NO divider, feed flex-1 justify-center (2-line rows: primary / secondary),
 *                 footer «Все запчасти →» rose link align-self:flex-end mt 8px.
 *
 *   'slim'      — Row 5, full-width Отделы strip.
 *                 flex items-center gap 28px, padding 24px 26px:
 *                 [bare icon 16px cyan + title] → [1px×24px vertical divider]
 *                 → [bullet dot + event name + author + green delta chip] flex-1
 *                 → time 12.5px muted → link «Все отделы →» cyan.
 */
export type DomainBoxVariant = 'standard' | 'parts' | 'slim'

// Per-tone color classes for bare icons and links.
// Bare icons: just text-<tone>, no bg badge.
const ICON_TONE_CLASSES: Record<string, string> = {
  blue:   'text-sky-300 light:text-sky-700',
  green:  'text-emerald-300 light:text-emerald-700',
  orange: 'text-amber-300 light:text-amber-700',
  accent: 'text-accent',
  amber:  'text-amber-300 light:text-amber-700',
  violet: 'text-violet-300 light:text-violet-700',
  cyan:   'text-cyan-300 light:text-cyan-700',
  rose:   'text-rose-300 light:text-rose-700',
}

// View-all link color by tone
const LINK_TONE_CLASSES: Record<string, string> = {
  blue:   'text-sky-300 light:text-sky-700',
  green:  'text-emerald-300 light:text-emerald-700',
  orange: 'text-amber-300 light:text-amber-700',
  accent: 'text-accent',
  amber:  'text-amber-300 light:text-amber-700',
  violet: 'text-violet-300 light:text-violet-700',
  cyan:   'text-cyan-300 light:text-cyan-700',
  rose:   'text-rose-300 light:text-rose-700',
}

/** A compact chip in the standard-variant exception row (assets box only). */
export interface DomainBoxAlert {
  id: string
  label: string
  chipClass: string
  to?: string
}

export interface DomainBoxProps {
  icon: string
  /** Color tone key — drives bare icon color, link color, bullet dot color. */
  iconTone?: keyof typeof ICON_TONE_CLASSES
  title: string
  total: number | null
  delta7d: number
  events: DomainEventVM[]
  barClass: string
  viewAllTo?: string
  viewAllLabel: string
  emptyLabel: string
  /** Caption after the hero number in 'parts' variant (e.g. «единиц на складе»). */
  totalCaption?: string
  /**
   * When set, the view-all link appears in the box header (right side).
   * Used for the АКТИВЫ box (Row 3 left).
   */
  headerLink?: boolean
  /**
   * When true, the box wrapper stretches to h-full so the parent grid row
   * can enforce uniform height. Internal feed switches to flex-1 min-h-0.
   */
  fillHeight?: boolean
  variant?: DomainBoxVariant
  testId?: string
  /**
   * Exception chips rendered between the header and the feed (standard variant
   * only). When non-empty the feed slices to 3 rows instead of 4. Used by the
   * АКТИВЫ box for «awaiting confirmation» / «in repair» counts.
   */
  alerts?: DomainBoxAlert[]
}

// Shared card base classes for standard + parts + slim.
// border-border (theme token) instead of raw white/6% so the border stays
// visible in light mode; hover mirrors the row-1 KPI cards (owner request:
// every dashboard block gets a border + hover highlight).
const CARD_BASE = 'bg-surface border border-border rounded-[1.125rem] overflow-hidden transition-colors duration-150 hover:border-text-tertiary/40'

// Per-kind bullet-dot colour override for the АКТИВЫ feed. 'created' is
// intentionally absent → falls back to the box tone (barClass / accent).
const EVENT_KIND_DOT: Partial<Record<DomainEventKind, string>> = {
  issued:   'bg-emerald-400/70',
  returned: 'bg-sky-400/70',
  disposed: 'bg-rose-400/70',
  repair:   'bg-amber-400/70',
}

// Bullet dot for feed rows — uses a Tailwind bg class derived from the box tone.
function BulletDot({ barClass }: { barClass: string }) {
  const base = barClass.split('/')[0] ?? barClass
  return (
    <span
      className={`w-[0.4375rem] h-[0.4375rem] rounded-full flex-shrink-0 opacity-90 ${base}`}
      aria-hidden="true"
    />
  )
}

export function DomainBox({
  icon,
  iconTone,
  title,
  total,
  delta7d,
  events,
  barClass,
  viewAllTo,
  viewAllLabel,
  emptyLabel,
  totalCaption,
  headerLink = false,
  fillHeight = false,
  variant = 'standard',
  testId,
  alerts,
}: DomainBoxProps) {
  const { t } = useTranslation('dashboard')

  const iconColorClass = iconTone ? (ICON_TONE_CLASSES[iconTone] ?? 'text-text-tertiary') : 'text-text-tertiary'
  const linkColorClass = iconTone ? (LINK_TONE_CLASSES[iconTone] ?? 'text-text-secondary') : 'text-text-secondary'

  const deltaChipClass =
    delta7d === 0
      ? 'text-text-subtle bg-surface-2'
      : 'text-success bg-success/10'

  const deltaChip = (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium tabular-nums flex-shrink-0',
        deltaChipClass,
      )}
      style={{ fontSize: '0.75rem', paddingTop: '0.1875rem', paddingBottom: '0.1875rem', paddingLeft: '0.5625rem', paddingRight: '0.5625rem' }}
    >
      {t('boxes.delta7d', { n: delta7d })}
    </span>
  )

  // ── SLIM variant (Row 5 — Отделы) ──────────────────────────────────────────
  // flex items-center gap 28px (1.75rem), padding 24px 26px
  // [bare icon 16px + title] | [1px×24px divider] | [bullet + event + author + delta chip] flex-1 | time | link
  if (variant === 'slim') {
    const lastEvent = events[0] ?? null
    return (
      <div
        {...(testId ? { 'data-testid': testId } : {})}
        className={cn(CARD_BASE, 'flex items-center')}
        style={{ padding: '1.5rem 1.625rem', gap: '1.75rem', boxShadow: 'var(--shadow-card)' }}
      >
        {/* [1] Icon + title */}
        <div className="flex items-center flex-shrink-0" style={{ gap: '0.625rem' }}>
          <Icon name={icon} size={16} className={cn('flex-shrink-0', iconColorClass)} aria-hidden="true" />
          <h2
            className="font-semibold uppercase leading-none text-text-secondary whitespace-nowrap"
            style={{ fontSize: '0.8125rem', letterSpacing: '0.06em' }}
          >
            {title}
          </h2>
        </div>

        {/* [2] Vertical divider: 1px × 24px */}
        <div
          className="flex-shrink-0 rounded-full"
          style={{ width: '1px', height: '1.5rem', background: 'rgb(var(--rgb-border) / 0.08)' }}
          aria-hidden="true"
        />

        {/* [3] Event area: bullet + primary + secondary + delta chip — flex-1 */}
        <div className="flex-1 min-w-0 flex items-center" style={{ gap: '0.5rem' }}>
          {lastEvent ? (
            <>
              <BulletDot barClass={barClass} />
              <span
                className="text-text-primary truncate min-w-0 font-semibold"
                style={{ fontSize: '0.90625rem' }}
              >
                {lastEvent.primary}
              </span>
              {lastEvent.secondary && (
                <span
                  className="text-text-subtle truncate min-w-0 hidden lg:block"
                  style={{ fontSize: '0.78125rem' }}
                >
                  {lastEvent.secondary}
                </span>
              )}
              {deltaChip}
            </>
          ) : (
            <span className="text-text-subtle italic" style={{ fontSize: '0.75rem' }}>
              {emptyLabel}
            </span>
          )}
        </div>

        {/* [4] Relative time */}
        {lastEvent && (
          <span
            className="text-text-subtle tabular-nums flex-shrink-0 hidden lg:block"
            style={{ fontSize: '0.78125rem', marginRight: '0.5rem' }}
          >
            {relativeTime(lastEvent.at, t)}
          </span>
        )}

        {/* [5] View-all link */}
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className={cn(
              'flex-shrink-0 font-semibold whitespace-nowrap hover:underline',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              linkColorClass,
            )}
            style={{ fontSize: '0.8125rem' }}
          >
            {viewAllLabel} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    )
  }

  // ── PARTS variant (Row 3, right box) ─────────────────────────────────────────
  // Header: bare icon + title + delta chip
  // Body: «N единиц на складе» hero row (no divider below it),
  //       feed flex-1 justify-center (2-line rows: primary / arrow-secondary),
  //       footer: rose «Все запчасти →» link, align-self:flex-end, mt 8px
  if (variant === 'parts') {
    const cardClass = cn(CARD_BASE, 'flex flex-col', fillHeight && 'h-full')
    const feedContainerClass = fillHeight
      ? 'flex-1 min-h-0 flex flex-col justify-center overflow-hidden'
      : 'flex flex-col justify-center overflow-hidden'

    return (
      <div
        {...(testId ? { 'data-testid': testId } : {})}
        className={fillHeight ? 'h-full' : undefined}
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className={cardClass}>
          {/* Header */}
          <div
            className="flex items-center justify-between flex-shrink-0"
            style={{ padding: '1.5rem 1.625rem 0' }}
          >
            <div className="flex items-center" style={{ gap: '0.625rem' }}>
              <Icon name={icon} size={16} className={cn('flex-shrink-0', iconColorClass)} aria-hidden="true" />
              <h2
                className="font-semibold uppercase leading-none text-text-secondary"
                style={{ fontSize: '0.8125rem', letterSpacing: '0.06em' }}
              >
                {title}
              </h2>
            </div>
            {deltaChip}
          </div>

          {/* Body */}
          <div
            className="flex flex-col flex-1 min-h-0"
            style={{ padding: '0 1.625rem 1.5rem' }}
          >
            {/* Hero number: 30px (1.875rem) bold white + caption 13px muted inline */}
            <div className="flex items-baseline flex-shrink-0" style={{ gap: '0.375rem', marginTop: '1.125rem' }}>
              <span
                className="font-bold text-text-primary leading-none tabular-nums"
                style={{ fontSize: '1.875rem' }}
              >
                {total === null ? '—' : total}
              </span>
              {totalCaption !== undefined && totalCaption !== '' && (
                <span className="text-13 text-text-subtle leading-tight">
                  {totalCaption}
                </span>
              )}
            </div>

            {/* Feed: flex-1 justify-center (vertically centered in remaining space) */}
            {events.length === 0 ? (
              <div className={cn(feedContainerClass, 'items-center gap-2 text-center')}>
                {/* Empty state circle: 36px (2.25rem), border white/10 */}
                <span
                  className="rounded-full inline-flex items-center justify-center text-text-subtle flex-shrink-0"
                  style={{ width: '2.25rem', height: '2.25rem', border: '1px solid rgb(255 255 255 / 0.10)' }}
                >
                  <Icon name="history" size={15} />
                </span>
                <span className="text-13 text-text-subtle">{emptyLabel}</span>
              </div>
            ) : (
              <div className={feedContainerClass} style={{ marginTop: '0.5rem' }}>
                {events.slice(0, 4).map((ev, idx) => {
                  const arrowIdx = ev.primary.indexOf(' → ')
                  const primaryLine = arrowIdx !== -1 ? ev.primary.slice(0, arrowIdx) : ev.primary
                  const arrowLine  = arrowIdx !== -1 ? `→ ${ev.primary.slice(arrowIdx + 3)}` : null
                  const secondLine = ev.secondary !== null ? ev.secondary : arrowLine

                  const rowContent = (
                    <div
                      // items-center — the dot and the time sit at the VERTICAL
                      // middle of the two-line block (mockup), not at its top.
                      className="flex items-center"
                      style={{
                        gap: '0.75rem',
                        paddingTop: '0.8125rem',
                        paddingBottom: '0.8125rem',
                        paddingLeft: '0.375rem',
                        paddingRight: '0.375rem',
                        // border-top on all except first
                        ...(idx > 0 ? { borderTop: '1px solid rgb(255 255 255 / 0.04)' } : {}),
                      }}
                    >
                      <BulletDot barClass={(ev.kind && EVENT_KIND_DOT[ev.kind]) || barClass} />
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-text-primary truncate leading-snug font-semibold"
                          style={{ fontSize: '0.90625rem' }}
                        >
                          {primaryLine}
                        </div>
                        {secondLine !== null && (
                          <div
                            className="text-text-subtle truncate leading-snug"
                            style={{ fontSize: '0.78125rem', marginTop: '0.125rem' }}
                          >
                            {secondLine}
                          </div>
                        )}
                      </div>
                      <span
                        className="text-text-subtle tabular-nums flex-shrink-0"
                        style={{ fontSize: '0.78125rem' }}
                      >
                        {relativeTime(ev.at, t)}
                      </span>
                    </div>
                  )

                  if (ev.linkTo !== undefined) {
                    return (
                      <Link
                        key={ev.id}
                        to={ev.linkTo}
                        className="block hover:bg-surface-2 rounded-lg transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      >
                        {rowContent}
                      </Link>
                    )
                  }
                  return <div key={ev.id}>{rowContent}</div>
                })}
              </div>
            )}

            {/* Footer: «Все запчасти →» rose link, align-self flex-end, mt 8px */}
            {viewAllTo !== undefined && (
              <div className="flex justify-end" style={{ marginTop: '0.5rem' }}>
                <Link
                  to={viewAllTo}
                  className={cn(
                    'font-semibold hover:underline',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                    linkColorClass,
                  )}
                  style={{ fontSize: '0.8125rem' }}
                >
                  {viewAllLabel} <span aria-hidden="true">→</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── STANDARD variant ─────────────────────────────────────────────────────────
  // Rows 3 (assets, headerLink=true) and Row 4 (employees/subscriptions/branches).
  //
  // Header: bare icon 16px + title 13px semibold uppercase tracking 0.06em.
  //   assets (headerLink=true): «Все активы →» accent link in header.
  //   mb header: 18px (1.125rem).
  //
  // Feed rows: py 13px (0.8125rem) px 6px (0.375rem), border-bottom white/4%,
  //   bullet dot 7px accent, name 14.5px semibold, secondary 12.5px muted, time 12.5px muted.
  //   4 rows, natural height (no fixed heights, no flex-1 on feed).
  //
  // Row 4 boxes: min-h-200px (12.5rem), flex-col.
  //   empty-state: circle 36px border white/10 with history icon 15px muted,
  //   text 13px muted «Нет событий за 7 дней».
  //   footer link: mt 14px, color = tone.

  const isRow3Assets = headerLink // assets box in Row 3 has headerLink=true

  const cardClass = cn(
    CARD_BASE,
    'flex flex-col',
    fillHeight ? 'h-full' : 'min-h-[12.5rem]',
  )

  return (
    <div
      {...(testId ? { 'data-testid': testId } : {})}
      className={fillHeight ? 'h-full' : undefined}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className={cardClass}>
        {/* Header: padding 24px 26px top only, mb 18px */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '1.5rem 1.625rem 0' }}
        >
          <div className="flex items-center" style={{ gap: '0.625rem' }}>
            <Icon name={icon} size={16} className={cn('flex-shrink-0', iconColorClass)} aria-hidden="true" />
            <h2
              className="font-semibold uppercase leading-none text-text-secondary"
              style={{ fontSize: '0.8125rem', letterSpacing: '0.06em' }}
            >
              {title}
            </h2>
          </div>
          {/* assets: «Все активы →» accent link in header */}
          {isRow3Assets && viewAllTo && (
            <Link
              to={viewAllTo}
              className={cn(
                'font-semibold whitespace-nowrap hover:underline flex-shrink-0',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                linkColorClass,
              )}
              style={{ fontSize: '0.8125rem' }}
            >
              {viewAllLabel} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>

        {/* Exception chip row (assets box): between header and feed. */}
        {alerts && alerts.length > 0 && (
          <div
            data-testid="domain-box-alerts"
            className="flex flex-wrap flex-shrink-0"
            style={{ padding: '0 1.625rem', marginTop: '1.125rem', marginBottom: '0.5rem', gap: '0.5rem' }}
          >
            {alerts.map((alert) => {
              const chip = (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full font-medium tabular-nums',
                    alert.chipClass,
                  )}
                  style={{ fontSize: '0.75rem', paddingTop: '0.1875rem', paddingBottom: '0.1875rem', paddingLeft: '0.5625rem', paddingRight: '0.5625rem' }}
                >
                  {alert.label}
                </span>
              )
              if (alert.to !== undefined) {
                return (
                  <Link
                    key={alert.id}
                    to={alert.to}
                    className="rounded-full hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                  >
                    {chip}
                  </Link>
                )
              }
              return <span key={alert.id}>{chip}</span>
            })}
          </div>
        )}

        {/* Body */}
        <div
          className={cn('flex flex-col', fillHeight ? 'flex-1 min-h-0' : '')}
          style={{ padding: '0 1.625rem 1.5rem', marginTop: alerts && alerts.length > 0 ? '0' : '1.125rem' }}
        >
          {events.length === 0 ? (
            /* Empty state: centered, circle 36px border white/10 */
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-4">
              <span
                className="rounded-full inline-flex items-center justify-center text-text-subtle flex-shrink-0"
                style={{ width: '2.25rem', height: '2.25rem', border: '1px solid rgb(255 255 255 / 0.10)' }}
              >
                <Icon name="history" size={15} />
              </span>
              <span className="text-13 text-text-subtle">{emptyLabel}</span>
            </div>
          ) : (
            /* Feed: 4 rows (3 when alerts present), py 13px px 6px, border-bottom white/4% */
            (() => {
              const feedCount = alerts && alerts.length > 0 ? 3 : 4
              const lastIdx = Math.min(feedCount - 1, events.length - 1)
              return (
            <div className={cn('flex flex-col', fillHeight && 'flex-1 min-h-0 overflow-hidden')}>
              {events.slice(0, feedCount).map((ev, idx) => {
                const isLast = idx === lastIdx
                const rowContent = (
                  <div
                    className="flex items-center"
                    style={{
                      gap: '0.75rem',
                      paddingTop: '0.8125rem',
                      paddingBottom: '0.8125rem',
                      paddingLeft: '0.375rem',
                      paddingRight: '0.375rem',
                      ...(!isLast ? { borderBottom: '1px solid rgb(255 255 255 / 0.04)' } : {}),
                    }}
                  >
                    <BulletDot barClass={(ev.kind && EVENT_KIND_DOT[ev.kind]) || barClass} />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-text-primary truncate leading-snug font-semibold"
                        style={{ fontSize: '0.90625rem' }}
                      >
                        {ev.primary}
                      </div>
                      {ev.kind ? (
                        <div
                          className="text-text-subtle truncate"
                          style={{ fontSize: '0.78125rem', marginTop: '0.125rem' }}
                        >
                          {[t('boxes.events.' + ev.kind), ev.secondary].filter(Boolean).join(' · ')}
                        </div>
                      ) : (
                        ev.secondary !== null && (
                          <div
                            className="text-text-subtle truncate"
                            style={{ fontSize: '0.78125rem', marginTop: '0.125rem' }}
                          >
                            {ev.secondary}
                          </div>
                        )
                      )}
                    </div>
                    <span
                      className="text-text-subtle tabular-nums flex-shrink-0"
                      style={{ fontSize: '0.78125rem' }}
                    >
                      {relativeTime(ev.at, t)}
                    </span>
                  </div>
                )

                if (ev.linkTo !== undefined) {
                  return (
                    <Link
                      key={ev.id}
                      to={ev.linkTo}
                      className="block hover:bg-surface-2 rounded-lg transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                    >
                      {rowContent}
                    </Link>
                  )
                }
                return <div key={ev.id}>{rowContent}</div>
              })}
            </div>
              )
            })()
          )}

          {/* Footer: Row 4 boxes only (no headerLink), mt 14px, tone link */}
          {!isRow3Assets && viewAllTo !== undefined && (
            <div className="flex justify-end" style={{ marginTop: '0.875rem' }}>
              <Link
                to={viewAllTo}
                className={cn(
                  'font-semibold hover:underline',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                  linkColorClass,
                )}
                style={{ fontSize: '0.8125rem' }}
              >
                {viewAllLabel} <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
