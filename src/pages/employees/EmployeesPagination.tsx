import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'

interface EmployeesPaginationProps {
  from: number
  to: number
  totalCount: number
  page: number
  totalPages: number
  goTo: (p: number) => void
}

export function EmployeesPagination({
  from,
  to,
  totalCount,
  page,
  totalPages,
  goTo,
}: EmployeesPaginationProps) {
  const { t } = useTranslation('employees')

  const windowSize = 5
  const winStart = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1))
  const winEnd = Math.min(totalPages, winStart + windowSize - 1)
  const pageNums = Array.from({ length: Math.max(0, winEnd - winStart + 1) }, (_, i) => winStart + i)

  return (
    <div className="flex items-center justify-between px-5 py-2 border-t border-border bg-bg max-md:justify-center">
      {/* Info text — hidden on mobile */}
      <span className="text-[14px] text-text-tertiary tabular-nums max-md:hidden">
        {t('pagination.showing', { from, to, total: totalCount })}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={page === 1}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
          aria-label={t('pagination.prev')}
        >
          <Icon name="chevron-right" size={14} className="rotate-180" />
        </button>
        {/* Mobile-only compact page indicator */}
        <span className="hidden max-md:inline text-[14px] font-semibold tabular-nums text-text-primary px-2">
          {page} / {totalPages}
        </span>
        {winStart > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(1)}
              className="w-8 h-8 rounded-md text-[14px] font-semibold text-text-primary hover:bg-surface-2 max-md:hidden"
            >
              1
            </button>
            {winStart > 2 && <span className="px-1 text-text-subtle text-[14px] max-md:hidden">…</span>}
          </>
        )}
        {pageNums.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => goTo(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`w-8 h-8 rounded-md text-[14px] font-semibold tabular-nums transition-colors duration-100 ${
              p === page
                ? 'bg-accent text-white shadow-sm shadow-accent/25'
                : 'text-text-primary hover:bg-surface-2'
            }${p !== page ? ' max-md:hidden' : ''}`}
          >
            {p}
          </button>
        ))}
        {winEnd < totalPages && (
          <>
            {winEnd < totalPages - 1 && <span className="px-1 text-text-subtle text-[14px] max-md:hidden">…</span>}
            <button
              type="button"
              onClick={() => goTo(totalPages)}
              className="w-8 h-8 rounded-md text-[14px] font-semibold text-text-primary hover:bg-surface-2 max-md:hidden"
            >
              {totalPages}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={page === totalPages}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
          aria-label={t('pagination.next')}
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
    </div>
  )
}
