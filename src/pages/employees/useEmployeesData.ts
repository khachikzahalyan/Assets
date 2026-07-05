import { useMemo, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Employee, EmployeeListQuery, EmployeeRepository, SortValue } from '@/domain/employee'
import type { AssetRepository, AssetWriteRepository, RefRow, CategoryRow } from '@/domain/asset'
import type { AssignmentRepository } from '@/domain/assignment'
import {
  FirestoreEmployeeRepository,
  FirestoreAssetRepository,
  FirestoreAssignmentRepository,
  FirestoreUserRepository,
} from '@/infra/repositories'
import { db } from '@/lib/firebase'
import type { DrawerLinkedAsset, HandoverAsset, PickerStockRow } from '@/components/features/employees'
import { DEFAULT_QUERY, sortEmployees, normalizePhone } from './employeesHelpers'

export interface UseEmployeesDataOptions {
  repository?: EmployeeRepository | undefined
  assetRepository?: (AssetRepository & Pick<AssetWriteRepository, 'changeStatus'>) | undefined
  assignmentRepository?: AssignmentRepository | undefined
  loadRefData?: (() => Promise<{ branches: RefRow[]; departments: RefRow[] }>) | undefined
  assetCounts?: Record<string, number> | undefined
}

export function useEmployeesData({
  repository,
  assetRepository,
  assignmentRepository,
  loadRefData,
  assetCounts: assetCountsProp,
}: UseEmployeesDataOptions) {
  const { t } = useTranslation('employees')

  // Lazy default repos — test callers inject their own
  const defaultRepo = useMemo<EmployeeRepository>(
    () => new FirestoreEmployeeRepository(
      db(),
      async (targetUid: string) => (await new FirestoreUserRepository(db()).countSuperAdmins(targetUid)) === 0,
    ),
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

  // ── Query / filter state ──────────────────────────────────────────────────
  const [query, setQuery]             = useState<EmployeeListQuery>({ ...DEFAULT_QUERY })
  const [search, setSearch]           = useState('')
  const [kind, setKind]               = useState<'all' | 'staff'>('all')
  const [page, setPage]               = useState(1)

  // ── Data state ────────────────────────────────────────────────────────────
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [former, setFormer]           = useState<Employee[]>([])
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

  // Derive head office branch id
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
      const { sort: _sort, search: _search, status, ...repoQuery } = query
      const statusFilter = status ?? 'active'

      const activePromise = repo.listEmployees({ ...repoQuery })
      const formerPromise = (statusFilter === 'terminated' || statusFilter === 'all')
        ? repo.listFormerEmployees({ ...repoQuery })
        : Promise.resolve<Employee[]>([])

      const [activeEmps, formerEmps, ref] = await Promise.all([
        activePromise,
        formerPromise,
        refLoader(),
      ])

      setEmployees(activeEmps)
      setFormer(formerEmps)
      setBranches(ref.branches)
      setDepts(ref.departments)

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

  useEffect(() => {
    void reload()
  }, [reload])

  // ── Filter pipeline ───────────────────────────────────────────────────────
  const displaySet = useMemo(() => {
    const s = query.status ?? 'active'
    if (s === 'terminated') return former
    if (s === 'all') return [...employees, ...former]
    return employees
  }, [employees, former, query.status])

  const statusFiltered = displaySet

  const kindCounts = useMemo(() => ({
    all: statusFiltered.length,
    staff: statusFiltered.length,
  }), [statusFiltered])

  // After kind filter (no-op for now — staff === all)
  const kindFiltered = statusFiltered

  const deptBranchFiltered = useMemo(() => {
    let result = kindFiltered
    const dept = query.departmentId ?? 'all'
    const branch = query.branchId ?? 'all'
    if (dept !== 'all') result = result.filter(e => e.departmentId === dept)
    if (branch !== 'all') result = result.filter(e => e.branchId === branch)
    return result
  }, [kindFiltered, query.departmentId, query.branchId])

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

  const sorted = useMemo(
    () => sortEmployees(searched, (query.sort ?? 'updated_desc') as SortValue, deptNameOf, assetCountOf),
    [searched, query.sort, deptNameOf, assetCountOf],
  )

  const hasActiveFilters = (
    (query.status ?? 'active') !== 'active' ||
    (query.branchId ?? 'all') !== 'all' ||
    (query.departmentId ?? 'all') !== 'all' ||
    search !== '' ||
    (query.sort ?? 'updated_desc') !== 'updated_desc'
  )

  const handleQueryChange = useCallback((patch: Partial<EmployeeListQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  function resetFilters() {
    setQuery({ ...DEFAULT_QUERY })
    setSearch('')
  }

  return {
    // Repos (forwarded to actions hook)
    repo, assetRepo, asnRepo, defaultLoadAssetCounts, assetCountsProp,
    // Data state
    employees, setEmployees,
    former, setFormer,
    branches, setBranches,
    departments, setDepts,
    assetCounts, setAssetCounts,
    loading, error,
    // Derived
    branchMap, deptMap, catMap, deptNameOf, assetCountOf, headOfficeBranchId,
    // Query / filter state
    query, setQuery, search, setSearch, kind, setKind, page, setPage,
    // Filter results
    sorted, kindCounts, hasActiveFilters,
    // Query helpers
    handleQueryChange, resetFilters,
    // Modal state
    formOpen, setFormOpen,
    formInitial, setFormInitial,
    detailId, setDetailId,
    detailLinkedAssets, setDetailLinkedAssets,
    handoverTarget, setHandoverTarget,
    handoverAssets, setHandoverAssets,
    pickerTarget, setPickerTarget,
    pickerStock, setPickerStock,
    restoreTarget, setRestoreTarget,
    // Reload
    reload,
  }
}

export type EmployeesDataBag = ReturnType<typeof useEmployeesData>
