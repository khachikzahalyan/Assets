import type { ReactNode } from 'react'
import { Icon } from './icon'

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  /**
   * Pre-built "Показано X–Y из Z" content node.
   * The caller builds this (with Trans, plain spans, etc.) so this component
   * stays i18n-agnostic and has no useTranslation call.
   */
  info: ReactNode
  /** Full accessible sentence for aria-label on the outer container. */
  ariaLabel: string
  /** aria-label for the Prev button */
  prevLabel: string
  /** aria-label for the Next button */
  nextLabel: string
}

/**
 * Windowed pagination bar — i18n-agnostic presentational primitive.
 * Caller provides all localised strings via props.
 *
 * Algorithm (verbatim from asset-list.html prototype):
 *   5-wide window centred on the current page;
 *   leading "1 …" and trailing "… N" jump buttons when window doesn't reach ends.
 *
 * Mobile (max-md):
 *   - border-t separator + safe-area bottom padding
 *   - Only prev / active page number / next visible; all other numbered buttons
 *     and ellipsis spans hidden via max-md:hidden
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  info,
  ariaLabel,
  prevLabel,
  nextLabel,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Clamped navigation helper — mirrors prototype goto()
  const goto = (p: number) => onPage(Math.min(Math.max(1, p), totalPages))

  // Build the contiguous 5-wide window
  const windowSize = 5
  let start = Math.max(1, page - Math.floor(windowSize / 2))
  let end = Math.min(totalPages, start + windowSize - 1)
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)

  // Button base classes — mobile overrides size and rounding
  const btnBase =
    'w-8 h-8 rounded-md text-14 font-semibold tabular-nums inline-flex items-center justify-center transition-colors duration-100' +
    ' max-md:w-[var(--ctl-h-xs)] max-md:h-[var(--ctl-h-xs)] max-md:rounded-[7px]'
  const btnActive =
    'bg-accent text-white shadow-sm shadow-accent/25 max-md:text-12 max-md:font-bold'
  const btnIdle = 'text-text-primary hover:bg-surface-2'
  const btnNav = `${btnBase} ${btnIdle} disabled:opacity-30 disabled:cursor-not-allowed max-md:border max-md:border-border`

  return (
    <div
      aria-label={ariaLabel}
      className={[
        // Desktop base
        'flex items-center justify-between px-5 py-2 bg-bg',
        // Mobile: compact bar, border-t, safe-area bottom padding
        'max-md:bg-surface',
        'max-md:border-t max-md:border-border',
        'max-md:px-3.5 max-md:pt-1 max-md:pb-[calc(4px+env(safe-area-inset-bottom,0px))]',
        'max-md:gap-1.5',
      ].join(' ')}
    >
      {/* Left: range text — rendered by caller (may use Trans for bold numbers) */}
      <span
        aria-hidden="true"
        className="text-14 text-text-tertiary tabular-nums max-md:text-11.5 max-md:whitespace-nowrap max-md:shrink-0"
      >
        {info}
      </span>

      {/* Right: page buttons — ALWAYS visible on mobile (prev+next show disabled at 1 page) */}
      <div className="flex items-center gap-1 max-md:gap-0.5 max-md:shrink-0">
        {/* Prev */}
        <button
          type="button"
          aria-label={prevLabel}
          disabled={page === 1}
          onClick={() => goto(page - 1)}
          className={btnNav}
        >
          <Icon name="chevron-left" size={14} />
        </button>

        {/* Leading "1 …" when window doesn't start at 1 */}
        {start > 1 && (
          <>
            <button
              type="button"
              aria-label="1"
              onClick={() => goto(1)}
              className={`${btnBase} ${btnIdle} max-md:hidden`}
            >
              1
            </button>
            {start > 2 && (
              <span
                aria-hidden="true"
                className="px-1 text-text-subtle text-14 max-md:hidden"
              >
                …
              </span>
            )}
          </>
        )}

        {/* Window buttons */}
        {pages.map(p => (
          <button
            key={p}
            type="button"
            aria-label={String(p)}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => goto(p)}
            className={[
              btnBase,
              p === page ? btnActive : btnIdle,
              // On mobile: hide all non-active numbered buttons
              p !== page ? 'max-md:hidden' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {p}
          </button>
        ))}

        {/* Trailing "… N" when window doesn't end at totalPages */}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && (
              <span
                aria-hidden="true"
                className="px-1 text-text-subtle text-14 max-md:hidden"
              >
                …
              </span>
            )}
            <button
              type="button"
              aria-label={String(totalPages)}
              onClick={() => goto(totalPages)}
              className={`${btnBase} ${btnIdle} max-md:hidden`}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next */}
        <button
          type="button"
          aria-label={nextLabel}
          disabled={page === totalPages}
          onClick={() => goto(page + 1)}
          className={btnNav}
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
    </div>
  )
}
