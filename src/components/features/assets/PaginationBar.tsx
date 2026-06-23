import { useTranslation, Trans } from 'react-i18next'
import { Icon } from '@/components/ui'

export interface PaginationBarProps {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}

/**
 * Numbered windowed pagination bar — exact match of the HTML prototype
 * (asset-list.html lines 1796–1850 + mobile.css §15).
 *
 * Layout:
 *   Left  — "Показано {from}–{to} из {total}" with the numbers bolded
 *   Right — prev / [1 …] / window / [… N] / next
 *
 * Mobile (≤767px):
 *   - Pinned at bottom as flex-shrink-0 Zone 3 in ListCard (NOT sticky overlay).
 *     40px tall, compact. Safe-area padding via pb-[calc(8px+env(...))].
 *   - Shows only prev / active-number / next; all other numbered buttons
 *     and ellipsis spans are hidden via max-md:hidden
 *   - Count line ("Показано 1–9 из 9") is ALWAYS visible on mobile
 *   - Prev/number/next buttons are ALWAYS visible on mobile (even at 1 page,
 *     prev+next render disabled with opacity-30)
 */
export function PaginationBar({ page, pageSize, total, onPage }: PaginationBarProps) {
  const { t } = useTranslation('assets')

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  // Clamped navigation helper — mirrors prototype's goto()
  const goto = (p: number) => onPage(Math.min(Math.max(1, p), totalPages))

  // Build the contiguous 5-wide window — verbatim from prototype
  const windowSize = 5
  let start = Math.max(1, page - Math.floor(windowSize / 2))
  let end = Math.min(totalPages, start + windowSize - 1)
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)

  const btnBase =
    'w-8 h-8 rounded-md text-[14px] font-semibold tabular-nums inline-flex items-center justify-center transition-colors duration-100'
  const btnActive = 'bg-accent text-white shadow-sm shadow-accent/25'
  const btnIdle = 'text-text-primary hover:bg-surface-2'
  const btnNav = `${btnBase} ${btnIdle} disabled:opacity-30 disabled:cursor-not-allowed`

  // Accessible full sentence for screen readers (aria-label on container).
  // The visible version uses <Trans> to bold the numbers inline.
  const ariaRange = t('pagination.shown', { from, to, total })

  return (
    <div
      aria-label={ariaRange}
      className={[
        // Desktop base styles
        'flex items-center justify-between px-5 py-2 border-t border-border',
        // Mobile overrides (§15 of mobile.css, translated to Tailwind).
        // The bar is already pinned as flex-shrink-0 Zone 3 in ListCard — no
        // sticky needed. We only need the visual treatment + safe-area padding.
        'max-md:bg-surface',
        'max-md:border-t max-md:border-white/[0.06]',
        'max-md:px-[14px] max-md:pt-[8px] max-md:pb-[calc(8px+env(safe-area-inset-bottom,0px))]',
        'max-md:min-h-[40px] max-md:gap-[6px]',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Left: range text — numbers bolded visually; full sentence on aria-label above */}
      <span
        aria-hidden="true"
        className="text-[14px] text-text-tertiary tabular-nums max-md:text-[11px] max-md:text-white/45 max-md:whitespace-nowrap max-md:shrink-0"
      >
        <Trans
          i18nKey="pagination.shownBold"
          ns="assets"
          values={{ from, to, total }}
          components={[
            <span key="from-to" className="font-semibold text-text-secondary" />,
            <span key="total" className="font-semibold text-text-secondary" />,
          ]}
        />
      </span>

      {/* Right: page buttons — ALWAYS visible on mobile (even at 1 page, prev+next show disabled) */}
      <div className="flex items-center gap-1 max-md:gap-[2px] max-md:shrink-0">
        {/* Prev */}
        <button
          type="button"
          aria-label={t('pagination.prev')}
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
                className="px-1 text-text-subtle text-[14px] max-md:hidden"
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
                className="px-1 text-text-subtle text-[14px] max-md:hidden"
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
          aria-label={t('pagination.next')}
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
