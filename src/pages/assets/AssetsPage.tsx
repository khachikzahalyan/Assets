import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { ListCard, ListPageShell, EmptyState, ErrorState, Btn, Icon, TableSkeleton } from '@/components/ui'
import { AssetsToolbar, AssetsFilterBar, AssetsTable } from '@/components/features/assets'
import { PaginationBar } from '@/components/features/assets/PaginationBar'
import { useAssets } from '@/hooks'
import type { AssetListQuery, Asset } from '@/domain/asset'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import { FirestoreAssetRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'
import { exportAssetsXlsx } from '@/lib/exportXlsx'
import type { ExportRow } from '@/lib/exportXlsx'
import { deriveDisplayStatusId, isTemporaryAssignment } from '@/components/features/assets/assetFormat'

const PAGE_SIZE = 10

const DEFAULT_QUERY: Required<AssetListQuery> = {
  group: 'all',
  statusId: 'all',
  branchId: 'all',
  search: '',
  sort: 'updated_desc',
}

export interface AssetsPageProps {
  repository?: AssetRepository
}

export function AssetsPage({ repository }: AssetsPageProps) {
  const { t } = useTranslation(['assets', 'nav'])
  const navigate = useNavigate()
  const { role } = useAuth()

  // Composition root: build default Firestore repo lazily; test callers pass their own.
  const defaultRepo = useMemo<AssetRepository>(
    () => new FirestoreAssetRepository(db()),
    // db() is stable across renders — the firebase sdk returns the same Firestore instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const canMutate = role === 'super_admin' || role === 'asset_admin'

  const [query, setQuery] = useState<AssetListQuery>({ ...DEFAULT_QUERY })
  const [page, setPage] = useState(1)
  const [showTemp, setShowTemp] = useState(false)

  const handleQueryChange = useCallback((patch: Partial<AssetListQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  // ── Display query: pass statusId:'all' to the repo, filter derived-status client-side ──
  // This ensures the status chip filter matches the derived status shown in the table.
  const repoQuery = useMemo<AssetListQuery>(
    () => ({ ...query, statusId: 'all' }),
    [query],
  )

  // ── Count query: group:'all' + statusId:'all' to get all groups for tab counts ──
  const countQuery = useMemo<AssetListQuery>(
    () => ({ ...query, group: 'all', statusId: 'all' }),
    [query],
  )

  // Primary hook: filtered display list (group, search, branch, sort applied by repo; status applied below)
  const { assets, ref, loading, error, reload } = useAssets(repo, repoQuery)

  // Secondary hook: all groups (same branch/search/sort) for accurate group tab counts
  const { assets: allGroupsAssets } = useAssets(repo, countQuery)

  // ── Group counts over the all-groups set ────────────────────────────────────
  const groupCounts = useMemo(() => {
    const catGroupMap = new Map(
      (ref?.categories ?? []).map(c => [c.id, c.group]),
    )
    const tempFiltered = showTemp
      ? allGroupsAssets.filter(a => isTemporaryAssignment(a))
      : allGroupsAssets
    const statusFiltered =
      (query.statusId ?? 'all') === 'all'
        ? tempFiltered
        : tempFiltered.filter(a => deriveDisplayStatusId(a) === query.statusId)

    const counts = { all: 0, devices: 0, network: 0, furniture: 0 }
    for (const a of statusFiltered) {
      counts.all++
      const g = catGroupMap.get(a.categoryId)
      if (g === 'devices' || g === 'network' || g === 'furniture') {
        counts[g]++
      }
    }
    return counts
  }, [allGroupsAssets, ref, query.statusId, showTemp])

  // ── Client-side status + temp filter over the display list ─────────────────
  const displayed = useMemo<Asset[]>(() => {
    let out = assets
    if ((query.statusId ?? 'all') !== 'all') {
      out = out.filter(a => deriveDisplayStatusId(a) === query.statusId)
    }
    if (showTemp) {
      out = out.filter(a => isTemporaryAssignment(a))
    }
    return out
  }, [assets, query.statusId, showTemp])

  // ── Temp count ──────────────────────────────────────────────────────────────
  const tempCount = useMemo(
    () => allGroupsAssets.filter(a => isTemporaryAssignment(a)).length,
    [allGroupsAssets],
  )

  // Paginate the displayed list
  const totalCount = displayed.length
  const pageRows: Asset[] = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Active filters check (for EmptyState icon) ──────────────────────────────
  const hasActiveFilters =
    (query.group ?? 'all') !== 'all' ||
    (query.statusId ?? 'all') !== 'all' ||
    (query.branchId ?? 'all') !== 'all' ||
    (query.search ?? '') !== '' ||
    showTemp

  // Temp toggle handler
  const handleToggleTemp = useCallback(() => {
    setShowTemp(v => !v)
    setPage(1)
  }, [])

  // Full reset handler — resets all filters + temp
  const handleReset = useCallback(() => {
    setQuery({ ...DEFAULT_QUERY })
    setShowTemp(false)
    setPage(1)
  }, [])

  // Export handler — exports the displayed (filtered) set
  const handleExport = useCallback(() => {
    if (!ref) return
    const statusMap = new Map(ref.statuses.map(s => [s.id, s.name]))
    const branchMap = new Map(ref.branches.map(b => [b.id, b.name]))
    const categoryMap = new Map(ref.categories.map(c => [c.id, c.name]))
    const employeeMap = new Map(ref.employees.map(e => [e.id, e]))

    const rows: ExportRow[] = displayed.map(a => {
      let assigneeName = t('assignee.shelf', { ns: 'assets' })
      if (a.assignment?.mode === 'employee' && a.assignment.employeeId) {
        const emp = employeeMap.get(a.assignment.employeeId)
        if (emp) {
          assigneeName = [emp.lastName, emp.firstName].filter(Boolean).join(' ') || assigneeName
        }
      } else if (a.assignment?.mode === 'department' && a.assignment.departmentId) {
        assigneeName = ref.departments.find(d => d.id === a.assignment!.departmentId)?.name ?? assigneeName
      } else if (a.assignment?.mode === 'branch' && a.assignment.branchId) {
        assigneeName = branchMap.get(a.assignment.branchId) ?? assigneeName
      }

      return {
        category: categoryMap.get(a.categoryId) ?? a.categoryId,
        brand: a.brand ?? '',
        model: a.model ?? '',
        invCode: a.invCode,
        serial: a.serial ?? '',
        branch: branchMap.get(a.branchId) ?? a.branchId,
        status: statusMap.get(a.statusId) ?? a.statusId,
        assignee: assigneeName,
        updatedAt: a.updatedAt,
      }
    })

    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    exportAssetsXlsx(rows, `АМС-активы-${y}-${m}-${d}.xlsx`)
  }, [displayed, ref, t])

  function renderTableRegion() {
    if (loading) return <TableSkeleton rows={PAGE_SIZE} columns={7} firstColWide lastColAction gridTemplate="minmax(240px,2.4fr) minmax(130px,1fr) minmax(100px,0.85fr) minmax(150px,1.2fr) minmax(110px,1fr) minmax(100px,0.9fr) 56px" />
    if (error) return <ErrorState onRetry={reload} />
    if (displayed.length === 0) {
      return (
        <EmptyState
          icon={hasActiveFilters ? 'search-x' : 'inbox'}
          title={t(hasActiveFilters ? 'empty.titleFiltered' : 'empty.titleEmpty', { ns: 'assets' })}
          description={t(hasActiveFilters ? 'empty.descFiltered' : 'empty.descEmpty', { ns: 'assets' })}
          action={
            hasActiveFilters ? (
              <Btn variant="primary" size="sm" onClick={handleReset}>
                <Icon name="rotate-ccw" size={13} />
                {t('empty.reset', { ns: 'assets' })}
              </Btn>
            ) : undefined
          }
        />
      )
    }
    return (
      <AssetsTable
        rows={pageRows}
        ref={ref!}
        canMutate={canMutate}
        onRowClick={(a) => navigate(`/assets/${a.id}`)}
        minRows={PAGE_SIZE}
      />
    )
  }

  return (
    <ListPageShell flushMobile>
      <ListCard
        flushMobile
        toolbar={
          <>
            {/* Row 1: Group tabs + Search + Import + Export + Create */}
            {ref ? (
              <AssetsToolbar
                query={query}
                onChange={handleQueryChange}
                groupCounts={groupCounts}
                totalCount={totalCount}
                canMutate={canMutate}
                onExport={handleExport}
                onNavigateCreate={() => navigate('/assets/new')}
              />
            ) : (
              /* Toolbar skeleton while ref is loading */
              <div className="h-[52px] px-5 py-2">
                <div className="h-8 rounded-lg anim-skeleton w-full" />
              </div>
            )}

            {/* Divider between Row 1 and Row 2 */}
            <div className="border-t border-border" />

            {/* Row 2: Status + Branch + Sort + Temp toggle + Reset */}
            {ref ? (
              <AssetsFilterBar
                query={query}
                onChange={handleQueryChange}
                ref={ref}
                showTemp={showTemp}
                onToggleTemp={handleToggleTemp}
                tempCount={tempCount}
                onReset={handleReset}
              />
            ) : (
              <div className="h-[40px] px-5 py-2">
                <div className="h-8 rounded-lg anim-skeleton w-full" />
              </div>
            )}

            {/* Divider between filter row and table */}
            <div className="border-t border-border" />
          </>
        }
        pagination={
          /* Pagination — only rendered when there are rows; gate matches old renderBody() behavior */
          !loading && !error && displayed.length > 0 ? (
            <PaginationBar
              page={page}
              pageSize={PAGE_SIZE}
              total={totalCount}
              onPage={setPage}
            />
          ) : undefined
        }
      >
        {renderTableRegion()}
      </ListCard>
    </ListPageShell>
  )
}
