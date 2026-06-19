import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader, LoadingState, ErrorState } from '@/components/ui'
import { EmployeeForm } from '@/components/features/employees'
import type { EmployeeFormSubmit } from '@/components/features/employees/EmployeeForm'
import { useAuth } from '@/contexts/AuthContext'
import type { EmployeeRepository } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'
import { FirestoreEmployeeRepository, FirestoreAssetRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

export interface EmployeeCreatePageProps {
  repository?: EmployeeRepository
  loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }>
}

export function EmployeeCreatePage({ repository, loadRefData }: EmployeeCreatePageProps) {
  const { t } = useTranslation('employees')
  const { user, role } = useAuth()
  const navigate = useNavigate()

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

  const [branches, setBranches] = useState<RefRow[]>([])
  const [departments, setDepts] = useState<RefRow[]>([])
  const [loadError, setLoadError]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)

  const loadRef = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    refLoader()
      .then(ref => {
        setBranches(ref.branches)
        setDepts(ref.departments)
        setLoading(false)
      })
      .catch(() => {
        setLoadError(t('validation.saveFailed'))
        setLoading(false)
      })
  }, [refLoader, t])

  useEffect(() => {
    loadRef()
  }, [loadRef])

  async function handleSubmit(v: EmployeeFormSubmit) {
    if (!v.id) return // uid required in create mode — EmployeeForm guarantees it
    setSubmitting(true)
    setSaveError(null)
    try {
      const { value } = await repo.createEmployee(
        {
          id: v.id,
          firstName: v.firstName,
          lastName: v.lastName,
          email: v.email,
          position: v.position,
          branchId: v.branchId,
          departmentId: v.departmentId,
        },
        { uid: user.id, role },
      )
      navigate(`/employees/${value.id}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/email already in use/i.test(msg)) {
        setSaveError(t('validation.emailTaken'))
      } else {
        setSaveError(t('validation.saveFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="users" title={t('form.createTitle')} />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="users" title={t('form.createTitle')} />
        <ErrorState onRetry={loadRef} />
      </div>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="users" title={t('form.createTitle')} />
      <EmployeeForm
        mode="create"
        branches={branches}
        departments={departments}
        submitting={submitting}
        submitError={saveError}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/employees')}
      />
    </div>
  )
}
