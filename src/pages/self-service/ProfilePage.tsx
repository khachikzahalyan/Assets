import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, SectionCard, Field, Chip, ErrorState, EmptyState,
} from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import type { Employee, EmployeeRepository } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'
import { FirestoreEmployeeRepository, FirestoreAssetRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

export interface ProfilePageProps {
  repository?: EmployeeRepository
  loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }>
}

export function ProfilePage({ repository, loadRefData }: ProfilePageProps) {
  const { t } = useTranslation('employees')
  const { user } = useAuth()

  const defaultRepo = useMemo<EmployeeRepository>(
    () => new FirestoreEmployeeRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const defaultLoadRefData = useMemo(
    () => async () => {
      const assetRepo = new FirestoreAssetRepository(db())
      const r = await assetRepo.loadSelfServiceRefData()
      return { branches: r.branches, departments: r.departments }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const refLoader = loadRefData ?? defaultLoadRefData

  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [employee, setEmployee]   = useState<Employee | null>(null)
  const [branches, setBranches]   = useState<RefRow[]>([])
  const [departments, setDepts]   = useState<RefRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [emp, ref] = await Promise.all([
        repo.getEmployee(user.id),
        refLoader()
          .catch((): { branches: RefRow[]; departments: RefRow[] } => ({ branches: [], departments: [] })),
      ])
      setEmployee(emp)
      setBranches(ref.branches)
      setDepts(ref.departments)
    } catch {
      setLoadError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [repo, user.id, refLoader, t])

  useEffect(() => {
    void load()
  }, [load])

  const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches])
  const deptMap   = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments])

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="h-8 w-[140px] rounded-lg anim-skeleton" />
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
            <div className="w-7 h-7 rounded-lg anim-skeleton flex-shrink-0" />
            <div className="h-[10px] w-[80px] rounded anim-skeleton" />
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  {/* field label — shimmer */}
                  <div className="h-[10px] w-[60%] rounded anim-skeleton" />
                  {/* field value — shimmer */}
                  <div className="h-[13px] rounded anim-skeleton" style={{ width: `${50 + (i % 3) * 15}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <PageHeader icon="user" title={t('self.profile')} />
        <ErrorState onRetry={load} />
      </div>
    )
  }

  if (employee === null) {
    return (
      <div className="space-y-5">
        <PageHeader icon="user" title={t('self.profile')} />
        <EmptyState icon="user" title={t('self.noProfile')} />
      </div>
    )
  }

  const fullName   = [employee.firstName, employee.lastName].filter(Boolean).join(' ') || '—'
  const branchName = employee.branchId ? (branchMap.get(employee.branchId) ?? '—') : '—'
  const deptName   = employee.departmentId ? (deptMap.get(employee.departmentId) ?? '—') : '—'

  return (
    <div className="space-y-5">
      <PageHeader
        icon="user"
        title={fullName}
        actions={
          <Chip color={employee.status === 'active' ? 'green' : 'gray'} dot>
            {t(`status.${employee.status}`)}
          </Chip>
        }
      />

      <SectionCard title={t('detail.profile')} icon="user">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label={t('form.firstName')}>
            <p className="text-[13px] text-text-primary">{employee.firstName || '—'}</p>
          </Field>
          <Field label={t('form.lastName')}>
            <p className="text-[13px] text-text-primary">{employee.lastName || '—'}</p>
          </Field>
          <Field label={t('form.email')}>
            <p className="text-[13px] text-text-primary font-mono">{employee.email || '—'}</p>
          </Field>
          <Field label={t('form.position')}>
            <p className="text-[13px] text-text-primary">{employee.position ?? '—'}</p>
          </Field>
          <Field label={t('form.branch')}>
            <p className="text-[13px] text-text-primary">{branchName}</p>
          </Field>
          <Field label={t('form.department')}>
            <p className="text-[13px] text-text-primary">{deptName}</p>
          </Field>
        </dl>
      </SectionCard>
    </div>
  )
}
