import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  Btn, Icon, EmptyState, ErrorState,
  ListCard, ListPageShell, TableSkeleton, CardListSkeleton, SearchInput,
  MobileAddButton,
} from '@/components/ui'
import {
  EmployeesFilterBar,
  EmployeesTable,
} from '@/components/features/employees'
import type { AssetRepository, AssetWriteRepository, RefRow } from '@/domain/asset'
import type { Employee, EmployeeRepository } from '@/domain/employee'
import type { AssignmentRepository } from '@/domain/assignment'
import { PAGE_SIZE } from './employeesHelpers'
import { useEmployeesData } from './useEmployeesData'
import { useEmployeesActions } from './useEmployeesActions'
import { EmployeesPagination } from './EmployeesPagination'
import { EmployeesModals } from './EmployeesModals'

export interface EmployeesPageProps {
  repository?: EmployeeRepository
  /** Must implement changeStatus — both FirestoreAssetRepository and InMemoryAssetRepository do. */
  assetRepository?: AssetRepository & Pick<AssetWriteRepository, 'changeStatus'>
  assignmentRepository?: AssignmentRepository
  loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }>
  /** Optional: pre-loaded asset counts map. If omitted, the page loads assets via FirestoreAssetRepository. */
  assetCounts?: Record<string, number>
  initialModal?: 'create'
  initialDetailId?: string
}

export function EmployeesPage({
  repository,
  assetRepository,
  assignmentRepository,
  loadRefData,
  assetCounts: assetCountsProp,
  initialModal,
  initialDetailId,
}: EmployeesPageProps) {
  const { t } = useTranslation('employees')
  const { user, role } = useAuth()
  const isMobile = useIsMobile()
  const canMutate = role === 'super_admin' || role === 'asset_admin'

  const data = useEmployeesData({
    repository, assetRepository, assignmentRepository, loadRefData,
    assetCounts: assetCountsProp,
  })
  const actions = useEmployeesActions(data)

  // Apply initial props after first load
  const initialMountDone = useRef(false)
  useEffect(() => {
    if (data.loading || initialMountDone.current) return
    initialMountDone.current = true
    if (initialModal === 'create') {
      data.setFormInitial(null)
      data.setFormOpen(true)
    }
    if (initialDetailId) {
      void actions.handleOpenDetail(initialDetailId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loading, initialModal, initialDetailId])

  const {
    loading, error, sorted,
    query, search, setSearch, page, setPage,
    branches, departments, assetCounts, headOfficeBranchId,
    handleQueryChange,
    reload,
  } = data

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalCount = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const from       = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to         = Math.min(page * PAGE_SIZE, totalCount)
  // useMemo prevents allocating a new slice array on every render (e.g. modal open/close).
  const pageRows   = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  )

  // Stable handlers for memoized EmployeeRowMobile — avoids inline closure creation
  // per row. Full benefit lands once useEmployeesActions memoizes its functions.
  const handleRowClick = useCallback(
    (e: Employee) => { void actions.handleOpenDetail(e.id) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions.handleOpenDetail],
  )
  const handleRestoreEmployee = useCallback(
    (id: string) => { actions.handleRestore(id) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions.handleRestore],
  )

  function goTo(p: number) { setPage(Math.min(Math.max(1, p), totalPages)) }

  const paginationProps = { from, to, totalCount, page, totalPages, goTo }

  // ── Shared handlers ───────────────────────────────────────────────────────
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const handleFilterChange = (patch: Partial<typeof query>) => {
    handleQueryChange(patch)
    if ('search' in patch && patch.search === '') setSearch('')
  }

  // ── Table region ──────────────────────────────────────────────────────────
  function renderTableRegion() {
    if (loading) return isMobile
      ? <CardListSkeleton rows={PAGE_SIZE} variant="employee" />
      : <TableSkeleton
          rows={PAGE_SIZE}
          columns={8}
          firstColWide
          lastColAction
          gridTemplate="minmax(180px,1.6fr) minmax(120px,0.9fr) minmax(140px,1.2fr) minmax(110px,0.85fr) minmax(160px,1.4fr) minmax(80px,0.6fr) minmax(100px,0.9fr) 56px"
        />
    if (error)   return <ErrorState onRetry={reload} />
    if (sorted.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon="users" title={t('empty.title')} description={t('empty.desc')} />
        </div>
      )
    }
    return (
      <EmployeesTable
        rows={pageRows}
        branches={branches}
        departments={departments}
        assetCounts={assetCounts}
        headOfficeBranchId={headOfficeBranchId}
        onRowClick={handleRowClick}
        onRestore={handleRestoreEmployee}
      />
    )
  }

  // ── Mobile toolbar (matchMedia branch — no element duplication) ───────────
  // Search + add live either in the filter row (desktop) or in ListCard
  // Zone-1 (mobile). Using isMobile avoids double-DOM and keeps getByRole()
  // queries unambiguous in tests (jsdom = isMobile false).
  const mobileToolbarRows = isMobile ? (
    <>
      {/* Search input + MobileAddButton */}
      <div className="bg-bg px-[14px] py-[7px] flex items-center gap-[8px]">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder={t('filter.search')}
          aria-label={t('filter.search')}
          containerClassName="flex-1"
        />
        {canMutate && (
          <MobileAddButton
            onClick={actions.handleCreate}
            ariaLabel={t('addButton')}
          />
        )}
      </div>
    </>
  ) : null

  return (
    <>
      <ListPageShell flushMobile>
        {/* Same floating-card model as AssetsPage: NO flushMobile (keeps the
            rounded-lg border radius on mobile); 10px side gutters; the
            .app-shell-content-flush flex chain stretches the card to the
            BottomNav top. */}
        <ListCard
          className="max-md:mx-[10px]"
          toolbar={
            <>
              {mobileToolbarRows}

              {/* Divider between toolbar / mobile-rows and filter bar */}
              <div className="border-t border-border" />

              {/* One line (owner request): filter chips left, search + add right.
                  Mobile keeps its own search row above, so the right cluster is
                  desktop-only. */}
              <div className="flex items-center gap-2 md:pr-4">
                <div className="flex-1 min-w-0">
                  <EmployeesFilterBar
                    query={query}
                    onChange={handleFilterChange}
                    branches={branches}
                    departments={departments}
                    headOfficeBranchId={headOfficeBranchId}
                  />
                </div>
                {!isMobile && (
                  <div className="flex items-center gap-2 shrink-0">
                    <SearchInput
                      value={search}
                      onChange={handleSearchChange}
                      placeholder={t('filter.search')}
                      aria-label={t('filter.search')}
                      containerClassName="w-[280px]"
                    />
                    {canMutate && (
                      <Btn variant="primary" size="sm" onClick={actions.handleCreate}>
                        <Icon name="plus" size={13} />
                        {t('addButton')}
                      </Btn>
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-border" />
            </>
          }
          pagination={
            /* Desktop-only pinned pagination; mobile copy lives inside the scroller */
            <div className="max-md:hidden">
              <EmployeesPagination {...paginationProps} />
            </div>
          }
        >
          {/* Mobile: outer scroll container — single scroller for rows + pagination.
              flex-1/min-h-0 (Zone-2 is a flex col) gives it Zone-2's exact height —
              h-full percentages fail to resolve through this chain and leave a
              dead band under the paginator. Identical to AssetsPage. */}
          <div className="flex-1 min-h-0 max-md:overflow-y-auto max-md:flex max-md:flex-col">
            {/* Mobile: INNER flex-fill wrapper — grows to push pagination to the bottom.
                flex-shrink-0 allows content to exceed the container via outer scroll.
                Desktop: h-full pass-through for table's height fill. */}
            <div className="h-full max-md:h-auto max-md:grow max-md:shrink-0 max-md:flex max-md:flex-col">
              {renderTableRegion()}
            </div>
            {/* Mobile-only pagination copy inside the scroller */}
            {isMobile && !loading && !error && sorted.length > 0 && (
              <EmployeesPagination {...paginationProps} />
            )}
          </div>
        </ListCard>
      </ListPageShell>

      <EmployeesModals data={data} actions={actions} currentUserId={user.id} />
    </>
  )
}
