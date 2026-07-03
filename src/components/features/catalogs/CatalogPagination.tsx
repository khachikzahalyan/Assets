import { Trans, useTranslation } from 'react-i18next'
import { Pagination } from '@/components/ui'

export interface CatalogPaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}

/**
 * Catalog pagination bar — thin i18n adapter over ui/Pagination.
 *
 * Mirrors features/assets/PaginationBar exactly but uses the `common`
 * namespace so catalog pages do not pull in the assets namespace.
 */
export function CatalogPagination({ page, pageSize, total, onPage }: CatalogPaginationProps) {
  const { t } = useTranslation('common')

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  const info = (
    <Trans
      i18nKey="pagination.shownBold"
      ns="common"
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
}
