import { useTranslation } from 'react-i18next'
import { Pagination } from '@/components/ui'
import { PAGE_SIZE } from './employeesHelpers'

interface EmployeesPaginationProps {
  from: number
  to: number
  totalCount: number
  page: number
  totalPages: number
  goTo: (p: number) => void
}

/**
 * Employees pagination bar — thin i18n adapter over ui/Pagination.
 *
 * All windowing/layout/behaviour lives in ui/Pagination (the canonical etalon).
 * This adapter only supplies the localised info + aria strings from the
 * `employees` namespace. `totalPages` is retained on the props for call-site
 * parity; ui/Pagination recomputes it from total/pageSize identically.
 */
export function EmployeesPagination({
  from,
  to,
  totalCount,
  page,
  goTo,
}: EmployeesPaginationProps) {
  const { t } = useTranslation('employees')

  const info = t('pagination.showing', { from, to, total: totalCount })

  return (
    <Pagination
      page={page}
      pageSize={PAGE_SIZE}
      total={totalCount}
      onPage={goTo}
      info={info}
      ariaLabel={info}
      prevLabel={t('pagination.prev')}
      nextLabel={t('pagination.next')}
    />
  )
}
