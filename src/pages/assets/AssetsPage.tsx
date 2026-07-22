import { useMemo, useState, useCallback, useEffect } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { ListCard, ListPageShell, EmptyState, ErrorState, Btn, Icon, TableSkeleton, CardListSkeleton } from '@/components/ui'
import { AssetsToolbar, AssetsFilterBar, AssetsTable } from '@/components/features/assets'
import { PaginationBar } from '@/components/features/assets/PaginationBar'
import { useAssets } from '@/hooks'
import type { AssetListQuery, Asset } from '@/domain/asset'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import { getSharedAssetRepository } from '@/infra/repositories'
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

  // Shared singleton keeps the repo's reference-data cache (60s TTL) alive across
  // navigations, so returning to /assets doesn't refetch 7 catalog collections
  // before the toolbar can render. Test callers pass their own repo.
  const repo = repository ?? getSharedAssetRepository()

  const canMutate = role === 'super_admin' || role === 'asset_admin'
  const isMobile = useIsMobile()

  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState<AssetListQuery>({ ...DEFAULT_QUERY })
  const [page, setPage] = useState(1)
  const [showTemp, setShowTemp] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)

  const handleQueryChange = useCallback((patch: Partial<AssetListQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  // ── Single fetch: group:'all' + statusId:'all' (branch/search/sort applied by repo).
  // The old two-hook shape (display query + count query) issued TWO full collection
  // reads per mount/filter change that differed ONLY in `group` — and the repo's
  // group filter is client-side anyway. Fetch the superset once; derive both the
  // group-filtered display list and the tab counts from it below.
  const fetchQuery = useMemo<AssetListQuery>(
    () => ({ ...query, group: 'all', statusId: 'all' }),
    [query],
  )
  const { assets: allGroupsAssets, ref, loading, error, reload } = useAssets(repo, fetchQuery)

  // Group-filtered set (same category→group lookup the repo used to apply server-side)
  const assets = useMemo<Asset[]>(() => {
    if ((query.group ?? 'all') === 'all') return allGroupsAssets
    const catGroupMap = new Map((ref?.categories ?? []).map(c => [c.id, c.group]))
    return allGroupsAssets.filter(a => catGroupMap.get(a.categoryId) === query.group)
  }, [allGroupsAssets, ref, query.group])

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

  // ── Focus-from-URL effect ────────────────────────────────────────────────────
  // Runs when the URL has ?focus=<id> AND ref + allGroupsAssets are loaded.
  // Determines the asset's group, resets filters to make it visible, sets focusId,
  // then clears the URL param so a refresh doesn't re-trigger.
  const rawFocusParam = searchParams.get('focus')
  useEffect(() => {
    if (!rawFocusParam) return
    if (loading || !ref) return

    const targetAsset = allGroupsAssets.find(a => a.id === rawFocusParam)
    if (targetAsset) {
      const catGroupMap = new Map(ref.categories.map(c => [c.id, c.group]))
      const assetGroup = catGroupMap.get(targetAsset.categoryId)
      const groupValue: AssetListQuery['group'] =
        assetGroup === 'devices' || assetGroup === 'network' || assetGroup === 'furniture'
          ? assetGroup
          : 'all'
      setQuery({ ...DEFAULT_QUERY, group: groupValue })
      setShowTemp(false)
      setPage(1)
      setFocusId(rawFocusParam)
    }
    // Clear the URL param so a page refresh doesn't re-trigger
    setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawFocusParam, loading, ref])

  // ── Pagination jump to the focused row ──────────────────────────────────────
  // After displayed list settles, jump to the page that contains the focused asset.
  useEffect(() => {
    if (!focusId) return
    const idx = displayed.findIndex(a => a.id === focusId)
    if (idx < 0) return
    const targetPage = Math.floor(idx / PAGE_SIZE) + 1
    setPage(prev => (prev !== targetPage ? targetPage : prev))
  }, [focusId, displayed])

  // Paginate the displayed list
  const totalCount = displayed.length
  const pageRows = useMemo<Asset[]>(
    () => displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [displayed, page],
  )

  // ── Active filters check (for EmptyState icon) ──────────────────────────────
  const hasActiveFilters =
    (query.group ?? 'all') !== 'all' ||
    (query.statusId ?? 'all') !== 'all' ||
    (query.branchId ?? 'all') !== 'all' ||
    (query.search ?? '') !== '' ||
    showTemp

  // Row and create navigation handlers — stable references for memoized children.
  const handleRowClick = useCallback((a: Asset) => navigate(`/assets/${a.id}`), [navigate])
  const handleNavigateCreate = useCallback(() => navigate('/assets/new'), [navigate])

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

  // Export handler — exports the displayed (filtered) set.
  // The xlsx library (~300 KB) is imported ON CLICK — a static import shipped it
  // inside the AssetsPage route chunk and slowed every page open for a button
  // most visits never press.
  const handleExport = useCallback(async () => {
    if (!ref) return
    const { exportAssetsXlsx } = await import('@/lib/exportXlsx')
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
    if (loading) return isMobile
      ? <CardListSkeleton rows={PAGE_SIZE} variant="asset" />
      : <TableSkeleton
          rows={PAGE_SIZE}
          columns={6}
          firstColWide
          lastColAction
          gridTemplate="minmax(240px,2.4fr) minmax(130px,1fr) minmax(100px,0.85fr) minmax(150px,1.2fr) minmax(110px,1fr) 56px"
          headers={[t('cols.asset'), t('cols.branch'), t('cols.code'), t('cols.assignee'), t('cols.status'), '']}
        />
    if (error && !ref) return <ErrorState onRetry={reload} />
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
        onRowClick={handleRowClick}
        minRows={PAGE_SIZE}
        {...(focusId ? { focusId } : {})}
      />
    )
  }

  // Pagination element — mobile only (rendered INSIDE the scroll region after rows).
  // Desktop pagination lives in Zone 3 and is always mounted to prevent layout shift
  // when data arrives (EmployeesPage precedent — P2 zero-layout-shift).
  const paginationEl =
    !loading && !error && displayed.length > 0 ? (
      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        total={totalCount}
        onPage={setPage}
      />
    ) : undefined

  return (
    <ListPageShell flushMobile>
      <ListCard
        /* Mobile: the card stretches to the exact bottom of the content area
           (= BottomNav top) via the flex chain .app-shell-content-flush →
           ListPageShell(flex-1) → ListCard(flex-1 base) — no dvh math (the old
           calc(100dvh-128px) left a dead band above the BottomNav on some
           devices). Header stack stays fixed, only the list scrolls.
           10px side gutters (owner request). */
        className="max-md:mx-[10px]"
        toolbar={
          <>
            {/* Row 1: Group tabs + Search + Import + Export + Create */}
            <AssetsToolbar
              query={query}
              onChange={handleQueryChange}
              groupCounts={groupCounts}
              totalCount={totalCount}
              canMutate={canMutate}
              onExport={handleExport}
              onNavigateCreate={handleNavigateCreate}
            />

            {/* Divider between Row 1 and Row 2 */}
            <div className="border-t border-border" />

            {/* Row 2: Status + Branch + Sort + Temp toggle + Reset */}
            <AssetsFilterBar
              query={query}
              onChange={handleQueryChange}
              ref={ref}
              showTemp={showTemp}
              onToggleTemp={handleToggleTemp}
              tempCount={tempCount}
              onReset={handleReset}
            />

            {/* Divider between filter row and table */}
            <div className="border-t border-border" />
          </>
        }
        pagination={
          /* Desktop-only pinned pagination (Zone 3).
             Always mounted — total=0 during load renders disabled prev/next, preventing
             the ~44px layout shift when data arrives (EmployeesPage precedent). */
          <div className="max-md:hidden">
            <PaginationBar
              page={page}
              pageSize={PAGE_SIZE}
              total={totalCount}
              onPage={setPage}
            />
          </div>
        }
      >
        {/* Mobile: outer scroll container — single scroller for rows + pagination.
            flex-1/min-h-0 (Zone-2 is a flex col) gives it Zone-2's exact height —
            h-full percentages failed to resolve here and left a dead band under
            the paginator. Desktop: same exact-height pass-through. */}
        <div className="flex-1 min-h-0 max-md:overflow-y-auto max-md:flex max-md:flex-col">
          {/* Mobile: INNER flex-fill wrapper — grows to push pagination to the bottom
              of the scroll container on tall phones (no dead space). flex-shrink-0 means
              that when content (rows × natural height) exceeds the container, INNER stays
              at its natural content size and the OUTER scroll container scrolls instead of
              items squishing.
              Desktop: h-full block pass-through — AssetsTable's height:100% resolves
              against this wrapper which is 100% of the scroll container (= Zone-2 height). */}
          <div className="h-full max-md:h-auto max-md:grow max-md:shrink-0 max-md:flex max-md:flex-col">
            {renderTableRegion()}
          </div>
          {paginationEl !== undefined && (
            <div className="md:hidden">{paginationEl}</div>
          )}
        </div>
      </ListCard>
    </ListPageShell>
  )
}
