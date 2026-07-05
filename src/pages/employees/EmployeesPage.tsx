import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  Btn, Icon, EmptyState, ErrorState,
  ListCard, ListPageShell, TableSkeleton, CardListSkeleton,
} from '@/components/ui'
import {
  EmployeesFilterBar,
  EmployeesTable,
  EmployeeKindTabs,
} from '@/components/features/employees'
import type { AssetRepository, AssetWriteRepository, RefRow } from '@/domain/asset'
import type { EmployeeRepository } from '@/domain/employee'
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
    loading, error, sorted, kindCounts, hasActiveFilters,
    query, search, setSearch, kind, setKind, page, setPage,
    branches, departments, assetCounts, headOfficeBranchId,
    handleQueryChange, resetFilters,
    reload,
  } = data

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalCount = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const from       = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to         = Math.min(page * PAGE_SIZE, totalCount)
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function goTo(p: number) { setPage(Math.min(Math.max(1, p), totalPages)) }

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
      <div className="h-full">
        <EmployeesTable
          rows={pageRows}
          branches={branches}
          departments={departments}
          assetCounts={assetCounts}
          headOfficeBranchId={headOfficeBranchId}
          onRowClick={e => { void actions.handleOpenDetail(e.id) }}
          onRestore={id => actions.handleRestore(id)}
        />
      </div>
    )
  }

  return (
    <>
      <ListPageShell
        header={
          <>
            {/* Single row: KindTabs (left) + search + add button (right).
                On mobile: KindTabs on first row (scroll-strip); search+add on same row full-width. */}
            <div className="flex items-center justify-between gap-3 flex-wrap max-md:flex-col max-md:items-stretch max-md:gap-2">
              <EmployeeKindTabs
                selected={kind}
                onSelect={v => { setKind(v as 'all' | 'staff'); setPage(1) }}
                counts={kindCounts}
              />
              <div className="flex items-center gap-2 max-md:w-full">
                {/* Search input */}
                <div
                  className="flex items-center gap-2 bg-bg rounded-xl px-3 py-1.5 ring-1 ring-border max-md:flex-1"
                  style={{ width: 220 }}
                >
                  <Icon name="search" size={13} className="text-text-subtle shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1) }}
                    placeholder={t('filter.search')}
                    aria-label={t('filter.search')}
                    className="flex-1 text-[14px] bg-transparent border-none outline-none placeholder:text-text-subtle text-text-primary min-w-0"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => { setSearch(''); setPage(1) }}
                      className="text-text-subtle hover:text-text-tertiary transition-colors"
                      aria-label={t('filter.reset')}
                    >
                      <Icon name="x" size={11} />
                    </button>
                  )}
                </div>
                {canMutate && (
                  <Btn variant="primary" size="md" onClick={actions.handleCreate}>
                    <Icon name="user-plus" size={14} />
                    {t('addButton')}
                  </Btn>
                )}
              </div>
            </div>
          </>
        }
      >
        <ListCard
          toolbar={
            <>
              <EmployeesFilterBar
                query={query}
                onChange={patch => {
                  handleQueryChange(patch)
                  if ('search' in patch && patch.search === '') setSearch('')
                }}
                branches={branches}
                departments={departments}
                headOfficeBranchId={headOfficeBranchId}
              />
              {!loading && hasActiveFilters && sorted.length === 0 && (
                <div className="px-4 pb-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-[13px] text-accent hover:underline"
                  >
                    {t('filter.reset')}
                  </button>
                </div>
              )}
            </>
          }
          pagination={
            <EmployeesPagination
              from={from} to={to} totalCount={totalCount}
              page={page} totalPages={totalPages}
              goTo={goTo}
            />
          }
        >
          {renderTableRegion()}
        </ListCard>
      </ListPageShell>

      <EmployeesModals data={data} actions={actions} currentUserId={user.id} />
    </>
  )
}
