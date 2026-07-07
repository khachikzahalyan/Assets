import { useTranslation, Trans } from 'react-i18next'
import { Pagination } from '@/components/ui'

export interface AuditPaginationProps {
  /** 1-based current page. */
  page: number
  pageSize: number
  /** Number of rows on the CURRENT page (cursor pagination — total unknown). */
  rowsOnPage: number
  /** True when a next page exists (nextCursor != null). */
  hasNext: boolean
  /** Jump handler — useAuditLogs.goto (back to any visited page, forward one). */
  onPage: (p: number) => void
}

/**
 * Audit pagination bar — thin i18n adapter over ui/Pagination, same family as
 * CatalogPagination / PaginationBar / LicensesPagination.
 *
 * Audit is CURSOR-paginated (no total count), so the adapter synthesises the
 * smallest total consistent with what is known: rows seen so far, plus one
 * phantom row when hasNext — that makes ui/Pagination render a page+1 button
 * and an enabled Next. The info text shows the row range without "of N".
 */
export function AuditPagination({ page, pageSize, rowsOnPage, hasNext, onPage }: AuditPaginationProps) {
  const { t } = useTranslation('audit')

  const from = rowsOnPage === 0 ? 0 : (page - 1) * pageSize + 1
  const to = (page - 1) * pageSize + rowsOnPage
  // Smallest total consistent with the cursor state (+1 phantom enables Next).
  const total = to + (hasNext ? 1 : 0)

  const info = (
    <Trans
      i18nKey="pagination.shownRange"
      ns="audit"
      values={{ from, to }}
      components={[<span key="from-to" className="font-semibold text-text-secondary" />]}
    />
  )

  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPage={onPage}
      info={info}
      ariaLabel={t('pagination.shownRangePlain', { from, to })}
      prevLabel={t('pagination.prev')}
      nextLabel={t('pagination.next')}
    />
  )
}
