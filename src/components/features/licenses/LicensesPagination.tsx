import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'

export interface LicensesPaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}

export function LicensesPagination({ page, pageSize, total, onPage }: LicensesPaginationProps) {
  const { t } = useTranslation('licenses')
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  const goto = (p: number) => onPage(Math.min(Math.max(1, p), totalPages))

  const WINDOW = 5
  let start = Math.max(1, page - Math.floor(WINDOW / 2))
  let end = Math.min(totalPages, start + WINDOW - 1)
  if (end - start + 1 < WINDOW) start = Math.max(1, end - WINDOW + 1)
  const pages: number[] = []
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center justify-between px-5 py-2 border-t border-border">
      <div className="text-[13px] text-text-tertiary tabular-nums">
        {t('pagination.showing')}{' '}
        <span className="font-semibold text-text-secondary">{from}–{to}</span>{' '}
        {t('pagination.of')}{' '}
        <span className="font-semibold text-text-secondary">{total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goto(page - 1)}
          disabled={page === 1}
          aria-label={t('pagination.prev')}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Icon name="chevron-left" size={14} />
        </button>

        {start > 1 && (
          <>
            <button
              type="button"
              onClick={() => goto(1)}
              className="w-8 h-8 rounded-md text-[13px] font-semibold text-text-primary hover:bg-surface-2"
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-text-subtle text-[13px]">…</span>}
          </>
        )}

        {pages.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => goto(p)}
            className={[
              'w-8 h-8 rounded-md text-[13px] font-semibold tabular-nums transition-colors',
              p === page
                ? 'bg-accent text-white shadow-sm shadow-accent/25'
                : 'text-text-primary hover:bg-surface-2',
            ].join(' ')}
          >
            {p}
          </button>
        ))}

        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-text-subtle text-[13px]">…</span>}
            <button
              type="button"
              onClick={() => goto(totalPages)}
              className="w-8 h-8 rounded-md text-[13px] font-semibold text-text-primary hover:bg-surface-2"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => goto(page + 1)}
          disabled={page === totalPages}
          aria-label={t('pagination.next')}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </div>
    </div>
  )
}
