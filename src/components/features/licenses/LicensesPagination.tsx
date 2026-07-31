import { useTranslation } from 'react-i18next'
import { Pagination } from '@/components/ui'

export interface LicensesPaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}

/**
 * Licenses pagination bar — thin i18n adapter over ui/Pagination.
 *
 * Builds the localised "Показано X–Y из Z" info node using licenses namespace
 * and passes it alongside aria strings to the generic Pagination component.
 *
 * Intentional unification vs the previous standalone implementation:
 *   • GAINS max-md:border-t border-border (was missing)
 *   • GAINS safe-area inset bottom padding (was plain pb-1)
 *   • Desktop text/button size raised to 14px to match PaginationBar etalon
 */
export function LicensesPagination({ page, pageSize, total, onPage }: LicensesPaginationProps) {
  const { t } = useTranslation('licenses')

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  const info = (
    <span>
      {t('pagination.showing')}{' '}
      <span className="font-semibold text-text-secondary">
        {from}–{to}
      </span>{' '}
      {t('pagination.of')}{' '}
      <span className="font-semibold text-text-secondary">{total}</span>
    </span>
  )

  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPage={onPage}
      info={info}
      ariaLabel={`${String(from)}–${String(to)} ${t('pagination.of')} ${String(total)}`}
      prevLabel={t('pagination.prev')}
      nextLabel={t('pagination.next')}
    />
  )
}
