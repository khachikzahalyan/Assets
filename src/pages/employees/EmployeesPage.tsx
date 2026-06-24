import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  Btn, Icon, EmptyState, ErrorState,
  ListCard, ListPageShell, TableSkeleton, CardListSkeleton,
} from '@/components/ui'
import {
  EmployeesFilterBar,
  EmployeesTable,
  EmployeeKindTabs,
  EmployeeFormModal,
  EmployeeDetailDrawer,
  HandoverModal,
  AssetPickerSheet,
  RestoreConfirmModal,
} from '@/components/features/employees'
import type { EmployeeFormSubmit } from '@/components/features/employees/EmployeeFormModal'
import type { DrawerLinkedAsset, HandoverAsset, PickerStockRow } from '@/components/features/employees'
import type { Employee, EmployeeListQuery, EmployeeRepository, SortValue } from '@/domain/employee'
import type { AssetRepository, AssetWriteRepository, RefRow, CategoryRow, TransferPatch } from '@/domain/asset'
import type { AssignmentRepository } from '@/domain/assignment'
import { buildTransferPatch, type TransferTarget } from '@/domain/asset'
import type { Destination } from '@/components/features/employees/DestPicker'
import { FirestoreEmployeeRepository, FirestoreAssetRepository, FirestoreAssignmentRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 10

/**
 * Map a DestPicker Destination to the asset-cache transfer patch.
 * Pure helper — no hooks, no side effects.
 */
function destToPatch(dest: Destination, employees: Employee[]): TransferPatch {
  if (dest.kind === 'warehouse') return buildTransferPatch({ mode: 'warehouse' })
  if (dest.kind === 'temporary') {
    return buildTransferPatch({
      mode: 'temporary',
      tempKind: dest.tempKind,
      expiresAt: dest.expiresAt,
    })
  }
  const empDeptId =
    dest.kind === 'employee'
      ? (employees.find(e => e.id === dest.id)?.departmentId ?? null)
      : null
  const target: TransferTarget =
    dest.kind === 'employee'
      ? { mode: 'employee', employeeId: dest.id }
      : dest.kind === 'department'
        ? { mode: 'department', departmentId: dest.id }
        : { mode: 'branch', branchId: dest.id }
  return buildTransferPatch(target, empDeptId)
}

const DEFAULT_QUERY: Required<EmployeeListQuery> = {
  status: 'active',
  branchId: 'all',
  departmentId: 'all',
  search: '',
  sort: 'updated_desc',
}

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

function sortEmployees(
  employees: Employee[],
  sort: SortValue,
  deptNameOf: (e: Employee) => string,
  assetCountOf: (id: string) => number,
): Employee[] {
  const copy = [...employees]
  switch (sort) {
    case 'updated_desc':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    case 'updated_asc':
      return copy.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    case 'name_asc':
      return copy.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'ru'),
      )
    case 'name_desc':
      return copy.sort((a, b) =>
        `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`, 'ru'),
      )
    case 'dept_asc':
      return copy.sort((a, b) =>
        deptNameOf(a).localeCompare(deptNameOf(b), 'ru'),
      )
    case 'assets_desc':
      return copy.sort((a, b) => assetCountOf(b.id) - assetCountOf(a.id))
    default:
      return copy
  }
}

/** Normalize phone to digits only for search matching */
function normalizePhone(p: string | null): string {
  if (!p) return ''
  return p.replace(/\D/g, '')
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
  const { showToast } = useToast()

  const actor = useMemo(() => ({ uid: user.id, role }), [user.id, role])

  // Lazy default repos — test callers inject their own
  const defaultRepo = useMemo<EmployeeRepository>(
    () => new FirestoreEmployeeRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const defaultAssetRepo = useMemo(
    () => new FirestoreAssetRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const assetRepo = assetRepository ?? defaultAssetRepo

  const defaultAsnRepo = useMemo<AssignmentRepository>(
    () => new FirestoreAssignmentRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const asnRepo = assignmentRepository ?? defaultAsnRepo

  const defaultLoadRefData = useMemo(
    () => async () => {
      const r = await defaultAssetRepo.loadReferenceData()
      return { branches: r.branches, departments: r.departments }
    },
    [defaultAssetRepo],
  )
  const refLoader = loadRefData ?? defaultLoadRefData

  const defaultLoadAssetCounts = useMemo(
    () => async (): Promise<Record<string, number>> => {
      const assets = await assetRepo.listAssets({ statusId: 'all' })
      const counts: Record<string, number> = {}
      for (const asset of assets) {
        if (asset.assignment?.mode === 'employee' && asset.assignment.employeeId) {
          const eid = asset.assignment.employeeId
          counts[eid] = (counts[eid] ?? 0) + 1
        }
      }
      return counts
    },
    [assetRepo],
  )

  const canMutate = role === 'super_admin' || role === 'asset_admin'
  const isMobile = useIsMobile()

  // ── Query / filter state ──────────────────────────────────────────────────
  const [query, setQuery]             = useState<EmployeeListQuery>({ ...DEFAULT_QUERY })
  const [search, setSearch]           = useState('')
  const [kind, setKind]               = useState<'all' | 'staff'>('all')
  const [page, setPage]               = useState(1)

  // ── Data state ────────────────────────────────────────────────────────────
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [branches, setBranches]       = useState<RefRow[]>([])
  const [departments, setDepts]       = useState<RefRow[]>([])
  const [categories, setCategories]   = useState<CategoryRow[]>([])
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>(assetCountsProp ?? {})
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // ── Modal / drawer state ──────────────────────────────────────────────────
  const [formOpen, setFormOpen]             = useState(false)
  const [formInitial, setFormInitial]       = useState<Employee | null>(null)
  const [detailId, setDetailId]             = useState<string | null>(null)
  const [detailLinkedAssets, setDetailLinkedAssets] = useState<DrawerLinkedAsset[]>([])
  const [handoverTarget, setHandoverTarget] = useState<Employee | null>(null)
  const [handoverAssets, setHandoverAssets] = useState<HandoverAsset[]>([])
  const [pickerTarget, setPickerTarget]     = useState<Employee | null>(null)
  const [pickerStock, setPickerStock]       = useState<PickerStockRow[]>([])
  const [restoreTarget, setRestoreTarget]   = useState<Employee | null>(null)

  // ── Derived lookups ───────────────────────────────────────────────────────
  const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches])
  const deptMap   = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments])
  const catMap    = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  const deptNameOf = useCallback((e: Employee) =>
    e.departmentId ? (deptMap.get(e.departmentId) ?? '') : '', [deptMap])
  const assetCountOf = useCallback((id: string) => assetCounts[id] ?? 0, [assetCounts])

  // Derive head office branch id — match the seeded head-office branch
  // explicitly (br_main / «Головной офис»); never rely on list order.
  const headOfficeBranchId =
    branches.find(b => b.id === 'br_main')?.id ??
    branches.find(b => b.name === 'Головной офис')?.id ??
    branches[0]?.id ??
    null

  // ── Load / reload ─────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { sort: _sort, search: _search, ...repoQuery } = query
      const [emps, ref] = await Promise.all([
        repo.listEmployees(repoQuery),
        refLoader(),
      ])
      setEmployees(emps)
      setBranches(ref.branches)
      setDepts(ref.departments)

      // Also load categories from asset repo if we have the full loadReferenceData
      try {
        const fullRef = await defaultAssetRepo.loadReferenceData()
        setCategories(fullRef.categories)
      } catch {
        // categories optional
      }

      if (!assetCountsProp) {
        const counts = await defaultLoadAssetCounts()
        setAssetCounts(counts)
      }
    } catch {
      setError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [repo, refLoader, query, t, assetCountsProp, defaultLoadAssetCounts, defaultAssetRepo])

  // Track whether initial mounts have run to avoid double-firing
  const initialMountDone = useRef(false)

  useEffect(() => {
    void reload()
  }, [reload])

  // Apply initial props after first load
  useEffect(() => {
    if (loading || initialMountDone.current) return
    initialMountDone.current = true
    if (initialModal === 'create') {
      setFormInitial(null)
      setFormOpen(true)
    }
    if (initialDetailId) {
      void handleOpenDetail(initialDetailId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialModal, initialDetailId])

  // ── Filter pipeline ───────────────────────────────────────────────────────

  // Base: status-filtered employees (for KindTabs counts)
  const statusFiltered = useMemo(() => {
    const s = query.status ?? 'active'
    if (s === 'all') return employees
    return employees.filter(e => e.status === s)
  }, [employees, query.status])

  // KindTabs counts (staff === all in prod — only one type exists)
  const kindCounts = useMemo(() => ({
    all: statusFiltered.length,
    staff: statusFiltered.length,
  }), [statusFiltered])

  // After kind filter (no-op for now — staff === all)
  const kindFiltered = statusFiltered

  // Department + branch filters
  const deptBranchFiltered = useMemo(() => {
    let result = kindFiltered
    const dept = query.departmentId ?? 'all'
    const branch = query.branchId ?? 'all'
    if (dept !== 'all') result = result.filter(e => e.departmentId === dept)
    if (branch !== 'all') result = result.filter(e => e.branchId === branch)
    return result
  }, [kindFiltered, query.departmentId, query.branchId])

  // Client-side search (by name / position / phone(normalized) / email)
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return deptBranchFiltered
    return deptBranchFiltered.filter(e => {
      const fullName = `${e.firstName} ${e.lastName}`.toLowerCase()
      const phone = normalizePhone(e.phone)
      return (
        fullName.includes(q) ||
        (e.position ?? '').toLowerCase().includes(q) ||
        phone.includes(q.replace(/\D/g, '')) ||
        (e.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [deptBranchFiltered, search])

  // Client-side sort
  const sorted = useMemo(
    () => sortEmployees(searched, (query.sort ?? 'updated_desc') as SortValue, deptNameOf, assetCountOf),
    [searched, query.sort, deptNameOf, assetCountOf],
  )

  // ── hasActiveFilters ──────────────────────────────────────────────────────
  const hasActiveFilters = (
    (query.status ?? 'active') !== 'active' ||
    (query.branchId ?? 'all') !== 'all' ||
    (query.departmentId ?? 'all') !== 'all' ||
    search !== '' ||
    (query.sort ?? 'updated_desc') !== 'updated_desc'
  )

  function resetFilters() {
    setQuery({ ...DEFAULT_QUERY })
    setSearch('')
  }

  const handleQueryChange = useCallback((patch: Partial<EmployeeListQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalCount = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const from       = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to         = Math.min(page * PAGE_SIZE, totalCount)
  const pageRows   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const windowSize = 5
  const winStart   = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1))
  const winEnd     = Math.min(totalPages, winStart + windowSize - 1)
  const pageNums   = Array.from({ length: Math.max(0, winEnd - winStart + 1) }, (_, i) => winStart + i)

  function goTo(p: number) { setPage(Math.min(Math.max(1, p), totalPages)) }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCreate() {
    setFormInitial(null)
    setFormOpen(true)
  }

  async function handleSaveForm(submit: EmployeeFormSubmit) {
    try {
      if (!submit.id) {
        // Create mode
        const id = 'pending_' + crypto.randomUUID()
        await repo.createEmployee(
          {
            id,
            firstName: submit.firstName,
            lastName: submit.lastName,
            email: submit.email,
            phone: submit.phone,
            position: submit.position,
            branchId: headOfficeBranchId,
            departmentId: submit.departmentId,
          },
          actor,
        )
        showToast(t('toast.created'))
      } else {
        // Edit mode — only editable fields
        await repo.updateEmployee(
          submit.id,
          {
            position: submit.position,
            phone: submit.phone,
            departmentId: submit.departmentId,
          },
          actor,
        )
        showToast(t('toast.updated'))
      }
      setFormOpen(false)
      await reload()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/email already in use/i.test(msg)) {
        showToast(t('validation.emailTaken'))
      } else {
        showToast(t('validation.saveFailed'))
      }
    }
  }

  async function handleOpenDetail(empId: string) {
    setDetailId(empId)
    try {
      const assets = await assetRepo.listAssetsForEmployee(empId)
      const linked: DrawerLinkedAsset[] = assets.map(a => {
        const cat = catMap.get(a.categoryId)
        const catName = cat?.name ?? ''
        const icon = cat?.lucideIcon ?? 'box'
        const title = a.brand && a.model ? `${a.brand} ${a.model}` : (catName || '—')
        return {
          id: a.id,
          icon,
          title,
          invCode: a.invCode,
          cat: catName,
          transferredAt: a.updatedAt,
        }
      })
      setDetailLinkedAssets(linked)
    } catch {
      setDetailLinkedAssets([])
    }
  }

  async function handleArchive(empId: string) {
    // Close detail drawer first
    setDetailId(null)
    const emp = employees.find(e => e.id === empId)
    if (!emp) return
    if (assetCountOf(empId) === 0) {
      try {
        await repo.setStatus(empId, 'terminated', actor)
        showToast(t('toast.archived'))
        await reload()
      } catch {
        showToast(t('validation.saveFailed'))
      }
    } else {
      // Load assets for handover
      try {
        const assets = await assetRepo.listAssetsForEmployee(empId)
        const handAssets: HandoverAsset[] = assets.map(a => {
          const cat = catMap.get(a.categoryId)
          const catName = cat?.name ?? ''
          const icon = cat?.lucideIcon ?? 'box'
          const title = a.brand && a.model ? `${a.brand} ${a.model}` : (catName || '—')
          return {
            id: a.id,
            icon,
            title,
            invCode: a.invCode,
            sn: a.serial ?? '',
          }
        })
        setHandoverAssets(handAssets)
        setHandoverTarget(emp)
      } catch {
        setHandoverAssets([])
        setHandoverTarget(emp)
      }
    }
  }

  async function handleHandoverConfirm(rows: { id: string; received: boolean; destination: Destination }[]) {
    if (!handoverTarget) return
    try {
      for (const r of rows) {
        if (!r.received) continue
        if (r.destination.kind === 'warehouse') {
          // Return to warehouse
          await asnRepo.returnAsset(r.id, actor)
        } else {
          // Redirected destinations — persist via changeStatus + destToPatch
          const patch = destToPatch(r.destination, employees)
          await assetRepo.changeStatus(r.id, patch.toStatusId, actor, { assignment: patch.assignment })
        }
      }
      await repo.setStatus(handoverTarget.id, 'terminated', actor)
      showToast(t('toast.handover'))
      setHandoverTarget(null)
      await reload()
    } catch {
      showToast(t('validation.saveFailed'))
    }
  }

  async function handleTransferAssets(assetIds: string[], dest: Destination) {
    const patch = destToPatch(dest, employees)
    let okCount = 0
    let failCount = 0
    for (const id of assetIds) {
      try {
        await assetRepo.changeStatus(id, patch.toStatusId, actor, { assignment: patch.assignment })
        okCount++
      } catch {
        failCount++
      }
    }
    const total = assetIds.length
    if (failCount === 0) {
      showToast(t('transfer.toastDone', { count: okCount }))
    } else if (okCount === 0) {
      showToast(t('transfer.toastFailed'))
    } else {
      showToast(t('transfer.toastPartial', { ok: okCount, total, failed: failCount }))
    }
    if (okCount > 0) {
      if (detailId) await handleOpenDetail(detailId)
      if (!assetCountsProp) {
        const counts = await defaultLoadAssetCounts()
        setAssetCounts(counts)
      }
    }
  }

  function handleRestore(empId: string) {
    // Close detail drawer first
    setDetailId(null)
    const emp = employees.find(e => e.id === empId)
    if (!emp) return
    setRestoreTarget(emp)
  }

  async function handleConfirmRestore() {
    if (!restoreTarget) return
    try {
      await repo.setStatus(restoreTarget.id, 'active', actor)
      showToast(t('toast.restored'))
      setRestoreTarget(null)
      await reload()
    } catch {
      showToast(t('validation.saveFailed'))
    }
  }

  async function handleLinkAssets(empId: string) {
    // Close detail drawer first
    setDetailId(null)
    const emp = employees.find(e => e.id === empId)
    if (!emp) return
    try {
      const assets = await assetRepo.listAssets({ statusId: 'st_warehouse', branchId: emp.branchId ?? 'all' })
      const stock: PickerStockRow[] = assets.map(a => {
        const cat = catMap.get(a.categoryId)
        const catName = cat?.name ?? ''
        const icon = cat?.lucideIcon ?? 'box'
        const group = cat?.group ?? 'devices'
        const title = a.brand && a.model ? `${a.brand} ${a.model}` : (catName || '—')
        return {
          id: a.id,
          title,
          invCode: a.invCode,
          cat: catName,
          icon,
          group,
        }
      })
      setPickerStock(stock)
      setPickerTarget(emp)
    } catch {
      setPickerStock([])
      setPickerTarget(emp)
    }
  }

  async function handleConfirmLink(ids: string[]) {
    if (!pickerTarget) return
    const byId = new Map(pickerStock.map(s => [s.id, s]))
    try {
      for (const id of ids) {
        const row = byId.get(id)
        await asnRepo.assign(
          {
            assetId: id,
            mode: 'employee',
            employeeId: pickerTarget.id,
            employeeEmail: pickerTarget.email,
            employeeName: `${pickerTarget.firstName} ${pickerTarget.lastName}`,
            invCode: row?.invCode ?? null,
          },
          actor,
        )
      }
      showToast(t('toast.linked', { count: ids.length }))
      setPickerTarget(null)
      await reload()
    } catch {
      showToast(t('validation.saveFailed'))
    }
  }

  // ── Derived emp shapes for modals ─────────────────────────────────────────
  const detailEmp = detailId ? (employees.find(e => e.id === detailId) ?? null) : null
  const detailBranchName     = detailEmp?.branchId ? (branchMap.get(detailEmp.branchId) ?? '—') : '—'
  const detailDeptName       = detailEmp?.departmentId ? (deptMap.get(detailEmp.departmentId) ?? '—') : '—'

  // Build HandoverModal emp shape
  const handoverEmpShape = handoverTarget ? {
    id: handoverTarget.id,
    firstName: handoverTarget.firstName,
    lastName: handoverTarget.lastName,
    position: handoverTarget.position,
    departmentName: handoverTarget.departmentId ? (deptMap.get(handoverTarget.departmentId) ?? null) : null,
  } : null

  // Build AssetPickerSheet emp shape
  const pickerEmpShape = pickerTarget ? {
    id: pickerTarget.id,
    firstName: pickerTarget.firstName,
    lastName: pickerTarget.lastName,
    position: pickerTarget.position,
    departmentName: pickerTarget.departmentId ? (deptMap.get(pickerTarget.departmentId) ?? null) : null,
    branchName: pickerTarget.branchId ? (branchMap.get(pickerTarget.branchId) ?? null) : null,
  } : null

  // HandoverModal needs employees/departments/branches in {id, name} shape
  const handoverEmployees = employees
    .filter(e => e.status === 'active')
    .map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, status: e.status }))

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderPagination() {
    return (
      <div className="flex items-center justify-between px-5 py-2 border-t border-border bg-bg">
        <span className="text-[14px] text-text-tertiary tabular-nums">
          {t('pagination.showing', { from, to, total: totalCount })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
            aria-label={t('pagination.prev')}
          >
            <Icon name="chevron-right" size={14} className="rotate-180" />
          </button>
          {winStart > 1 && (
            <>
              <button type="button" onClick={() => goTo(1)} className="w-8 h-8 rounded-md text-[14px] font-semibold text-text-primary hover:bg-surface-2">1</button>
              {winStart > 2 && <span className="px-1 text-text-subtle text-[14px]">…</span>}
            </>
          )}
          {pageNums.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`w-8 h-8 rounded-md text-[14px] font-semibold tabular-nums transition-colors duration-100 ${
                p === page
                  ? 'bg-accent text-white shadow-sm shadow-accent/25'
                  : 'text-text-primary hover:bg-surface-2'
              }`}
            >
              {p}
            </button>
          ))}
          {winEnd < totalPages && (
            <>
              {winEnd < totalPages - 1 && <span className="px-1 text-text-subtle text-[14px]">…</span>}
              <button type="button" onClick={() => goTo(totalPages)} className="w-8 h-8 rounded-md text-[14px] font-semibold text-text-primary hover:bg-surface-2">{totalPages}</button>
            </>
          )}
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-text-primary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-100"
            aria-label={t('pagination.next')}
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </div>
    )
  }

  function renderTableRegion() {
    if (loading) return isMobile
      ? <CardListSkeleton rows={PAGE_SIZE} variant="employee" />
      : <TableSkeleton
          rows={PAGE_SIZE}
          columns={8}
          firstColWide
          lastColAction
          gridTemplate="minmax(180px,1.6fr) minmax(120px,0.9fr) minmax(140px,1.2fr) minmax(110px,0.85fr) minmax(160px,1.4fr) minmax(80px,0.6fr) minmax(100px,0.9fr) 56px"
          headers={[
            t('table.employee'),
            t('table.branch'),
            t('table.position'),
            t('table.phone'),
            t('table.gmail'),
            t('table.assets'),
            t('table.status'),
            '',
          ]}
        />
    if (error)   return <ErrorState onRetry={reload} />
    if (sorted.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon="users"
            title={t('empty.title')}
            description={t('empty.desc')}
          />
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
          onRowClick={e => { void handleOpenDetail(e.id) }}
          onRestore={id => handleRestore(id)}
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
                  <Btn variant="primary" size="md" onClick={handleCreate}>
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
                  // If filter bar resets search (via reset button)
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
          pagination={renderPagination()}
        >
          {renderTableRegion()}
        </ListCard>
      </ListPageShell>

      {/* ── Modals / Drawers ── */}

      <EmployeeFormModal
        open={formOpen}
        initial={formInitial}
        departments={departments}
        onSave={submit => { void handleSaveForm(submit) }}
        onClose={() => setFormOpen(false)}
      />

      <EmployeeDetailDrawer
        open={!!detailId}
        emp={detailEmp}
        branchName={detailBranchName}
        departmentName={detailDeptName}
        linkedAssets={detailLinkedAssets}
        onClose={() => setDetailId(null)}
        onArchive={id => { void handleArchive(id) }}
        onRestore={id => { handleRestore(id) }}
        onLinkAssets={id => { void handleLinkAssets(id) }}
        employees={handoverEmployees}
        departments={departments}
        branches={branches}
        onTransferAssets={handleTransferAssets}
      />

      <HandoverModal
        open={!!handoverTarget}
        emp={handoverEmpShape}
        assets={handoverAssets}
        employees={handoverEmployees}
        departments={departments}
        branches={branches}
        onConfirm={rows => { void handleHandoverConfirm(rows) }}
        onClose={() => setHandoverTarget(null)}
      />

      <AssetPickerSheet
        open={!!pickerTarget}
        emp={pickerEmpShape}
        stock={pickerStock}
        onConfirm={ids => { void handleConfirmLink(ids) }}
        onClose={() => setPickerTarget(null)}
      />

      <RestoreConfirmModal
        open={!!restoreTarget}
        emp={restoreTarget}
        onConfirm={() => { void handleConfirmRestore() }}
        onClose={() => setRestoreTarget(null)}
      />
    </>
  )
}
