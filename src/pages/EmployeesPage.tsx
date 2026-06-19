import { useMemo, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState,
} from '@/components/ui'
import { EmployeesFilterBar, EmployeesTable } from '@/components/features/employees'
import type { Employee, EmployeeListQuery, EmployeeRepository } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'
import { FirestoreEmployeeRepository, FirestoreAssetRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 15

const DEFAULT_QUERY: Required<EmployeeListQuery> = {
  status: 'all',
  branchId: 'all',
  departmentId: 'all',
  search: '',
}

export interface EmployeesPageProps {
  repository?: EmployeeRepository
  loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }>
}

export function EmployeesPage({ repository, loadRefData }: EmployeesPageProps) {
  const { t } = useTranslation('employees')
  const navigate = useNavigate()
  const { role } = useAuth()

  // Lazy default repos — test callers inject their own
  const defaultRepo = useMemo<EmployeeRepository>(
    () => new FirestoreEmployeeRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const defaultLoadRefData = useMemo(
    () => async () => {
      const assetRepo = new FirestoreAssetRepository(db())
      const r = await assetRepo.loadReferenceData()
      return { branches: r.branches, departments: r.departments }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const refLoader = loadRefData ?? defaultLoadRefData

  const canMutate = role === 'super_admin' || role === 'asset_admin'

  const [query, setQuery]         = useState<EmployeeListQuery>({ ...DEFAULT_QUERY })
  const [page, setPage]           = useState(1)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches]   = useState<RefRow[]>([])
  const [departments, setDepts]   = useState<RefRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const handleQueryChange = useCallback((patch: Partial<EmployeeListQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [emps, ref] = await Promise.all([
        repo.listEmployees(query),
        refLoader(),
      ])
      setEmployees(emps)
      setBranches(ref.branches)
      setDepts(ref.departments)
    } catch {
      setError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [repo, refLoader, query, t])

  useEffect(() => {
    void load()
  }, [load])

  // Pagination
  const totalCount = employees.length
  const from       = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to         = Math.min(page * PAGE_SIZE, totalCount)
  const pageRows   = employees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const canPrev    = page > 1
  const canNext    = to < totalCount

  function renderBody() {
    if (loading) return <LoadingState rows={8} />
    if (error)   return <ErrorState onRetry={load} />
    if (employees.length === 0) {
      return (
        <EmptyState
          icon="users"
          title={t('empty.title')}
          description={t('empty.desc')}
        />
      )
    }
    return (
      <>
        <EmployeesTable
          rows={pageRows}
          branches={branches}
          departments={departments}
          onRowClick={e => navigate(`/employees/${e.id}`)}
        />

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4 border-t border-[#2A2F36] mt-2">
            <span className="text-[12px] text-[#64748B]">
              {t('pagination.range', { from, to, total: totalCount })}
            </span>
            <div className="flex items-center gap-2">
              <Btn
                variant="secondary"
                size="sm"
                disabled={!canPrev}
                onClick={() => setPage(p => p - 1)}
              >
                <Icon name="chevron-right" size={13} className="rotate-180" />
              </Btn>
              <Btn
                variant="secondary"
                size="sm"
                disabled={!canNext}
                onClick={() => setPage(p => p + 1)}
              >
                <Icon name="chevron-right" size={13} />
              </Btn>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader
        icon="users"
        title={t('title')}
        {...(!loading ? { count: totalCount } : {})}
        {...(canMutate ? {
          actions: (
            <Btn variant="primary" size="md" onClick={() => navigate('/employees/new')}>
              <Icon name="users" size={14} />
              {t('create')}
            </Btn>
          ),
        } : {})}
      />

      <SectionCard noHeader>
        <div className="space-y-4">
          <EmployeesFilterBar
            query={query}
            onChange={handleQueryChange}
            branches={branches}
            departments={departments}
          />
          {renderBody()}
        </div>
      </SectionCard>
    </div>
  )
}
