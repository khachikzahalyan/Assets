import { memo } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Pagination } from '@/components/ui'

export interface PaginationBarProps {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}

/**
 * Assets pagination bar — thin i18n adapter over ui/Pagination.
 *
 * Builds the localised "Показано X–Y из Z" info node (with bolded numbers via Trans)
 * and passes it alongside aria strings to the generic Pagination component.
 *
 * All layout/behaviour logic lives in ui/Pagination (the canonical etalon).
 */
export const PaginationBar = memo(function PaginationBar({ page, pageSize, total, onPage }: PaginationBarProps) {
  const { t } = useTranslation('assets')

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  const info = (
    <Trans
      i18nKey="pagination.shownBold"
      ns="assets"
      values={{ from, to, total }}
      components={[
        <span key="from-to" className="font-semibold text-text-secondary" />,
        <span key="total" className="font-semibold text-text-secondary" />,
      ]}
    />
  )

  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPage={onPage}
      info={info}
      ariaLabel={t('pagination.shown', { from, to, total })}
      prevLabel={t('pagination.prev')}
      nextLabel={t('pagination.next')}
    />
  )
})
