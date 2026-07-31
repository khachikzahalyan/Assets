import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, SectionCard, Field, Chip, ErrorState, EmptyState, Icon,
} from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import type { Employee, EmployeeRepository } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'
import { getSharedEmployeeRepository, getSharedAssetRepository } from '@/infra/repositories'

export interface ProfilePageProps {
  repository?: EmployeeRepository
  loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }>
}

export function ProfilePage({ repository, loadRefData }: ProfilePageProps) {
  const { t } = useTranslation('employees')
  const { user } = useAuth()
  // Invited employees: HR record id differs from uid — server-provisioned link wins.
  const employeeDocId = user.employeeId ?? user.id

  const repo = repository ?? getSharedEmployeeRepository()

  const defaultLoadRefData = useMemo(
    () => async () => {
      const r = await getSharedAssetRepository().loadSelfServiceRefData()
      return { branches: r.branches, departments: r.departments }
    },
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
        repo.getEmployee(employeeDocId),
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
  }, [repo, employeeDocId, refLoader, t])

  useEffect(() => {
    void load()
  }, [load])

  const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches])
  const deptMap   = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments])

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        {/* PageHeader footprint — real icon tile (local chrome); only title (fullName) is async.
            Replicates PageHeader's exact wrapper classes + max-md:hidden from real loaded state. */}
        <header className="flex items-start justify-between gap-4 mb-5 max-md:mb-2 max-md:hidden">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-surface border border-border text-accent inline-flex items-center justify-center flex-shrink-0">
              <Icon name="user" size={18} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Title shimmer — text-18 font-bold leading-normal ≈ 22px */}
                <div className="h-[22px] w-[140px] rounded anim-skeleton" />
              </div>
            </div>
          </div>
          {/* Status chip placeholder — employee status is also async */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="h-[22px] w-[56px] rounded-full anim-skeleton" />
          </div>
        </header>
        {/* SectionCard: title and icon are local i18n — render real */}
        <SectionCard title={t('detail.profile')} icon="user">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {/* Field labels are local i18n — render real; only values are async */}
            <Field label={t('form.firstName')}>
              <div className="h-[13px] w-[65%] rounded anim-skeleton" />
            </Field>
            <Field label={t('form.lastName')}>
              <div className="h-[13px] w-[55%] rounded anim-skeleton" />
            </Field>
            <Field label={t('form.email')}>
              <div className="h-[13px] w-[80%] rounded anim-skeleton" />
            </Field>
            <Field label={t('form.position')}>
              <div className="h-[13px] w-[60%] rounded anim-skeleton" />
            </Field>
            <Field label={t('form.branch')}>
              <div className="h-[13px] w-[50%] rounded anim-skeleton" />
            </Field>
            <Field label={t('form.department')}>
              <div className="h-[13px] w-[55%] rounded anim-skeleton" />
            </Field>
          </dl>
        </SectionCard>
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
      {/* SectionCard below already shows the title on mobile — hide PageHeader to avoid duplicate */}
      <PageHeader
        icon="user"
        title={fullName}
        className="max-md:hidden"
        actions={
          <Chip color={employee.status === 'active' ? 'green' : 'gray'} dot>
            {t(`status.${employee.status}`)}
          </Chip>
        }
      />

      <SectionCard title={t('detail.profile')} icon="user">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label={t('form.firstName')}>
            <p className="text-13 text-text-primary">{employee.firstName || '—'}</p>
          </Field>
          <Field label={t('form.lastName')}>
            <p className="text-13 text-text-primary">{employee.lastName || '—'}</p>
          </Field>
          <Field label={t('form.email')}>
            <p className="text-13 text-text-primary font-mono">{employee.email || '—'}</p>
          </Field>
          <Field label={t('form.position')}>
            <p className="text-13 text-text-primary">{employee.position ?? '—'}</p>
          </Field>
          <Field label={t('form.branch')}>
            <p className="text-13 text-text-primary">{branchName}</p>
          </Field>
          <Field label={t('form.department')}>
            <p className="text-13 text-text-primary">{deptName}</p>
          </Field>
        </dl>
      </SectionCard>
    </div>
  )
}
