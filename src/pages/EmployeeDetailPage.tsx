import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, SectionCard, Field, Btn, Icon, Chip, LoadingState, ErrorState, EmptyState,
} from '@/components/ui'
import { EmployeeForm } from '@/components/features/employees'
import type { EmployeeFormSubmit } from '@/components/features/employees/EmployeeForm'
import { useAuth } from '@/contexts/AuthContext'
import type { Employee, EmployeeRepository } from '@/domain/employee'
import type { Asset, AssetRepository, RefRow } from '@/domain/asset'
import type { Assignment, AssignmentRepository } from '@/domain/assignment'
import {
  FirestoreEmployeeRepository,
  FirestoreAssetRepository,
  FirestoreAssignmentRepository,
} from '@/infra/repositories'
import { actScanUrl } from '@/infra/storage'
import { db, storage } from '@/lib/firebase'

export interface EmployeeDetailPageProps {
  repository?: EmployeeRepository
  assetRepository?: AssetRepository
  assignmentRepository?: AssignmentRepository
  loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }>
}

export function EmployeeDetailPage({
  repository,
  assetRepository,
  assignmentRepository,
  loadRefData,
}: EmployeeDetailPageProps) {
  const { t } = useTranslation('employees')
  const { user, role } = useAuth()
  const { id } = useParams<{ id: string }>()

  const actor = useMemo(() => ({ uid: user.id, role }), [user.id, role])

  // Lazy default repos
  const defaultRepo = useMemo<EmployeeRepository>(
    () => new FirestoreEmployeeRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const defaultAssetRepo = useMemo<AssetRepository>(
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

  // State
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [employee, setEmployee]   = useState<Employee | null>(null)
  const [assets, setAssets]       = useState<Asset[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [branches, setBranches]   = useState<RefRow[]>([])
  const [departments, setDepts]   = useState<RefRow[]>([])

  // Edit state
  const [editing, setEditing]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Action error (terminate/reactivate)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionBusy, setActionBusy]   = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const [emp, empAssets, empAssignments, ref] = await Promise.all([
        repo.getEmployee(id),
        assetRepo.listAssetsForEmployee(id).catch(() => [] as Asset[]),
        asnRepo.listAssignmentsForEmployee(id).catch(() => [] as Assignment[]),
        refLoader(),
      ])
      setEmployee(emp)
      setAssets(empAssets)
      setAssignments(empAssignments)
      setBranches(ref.branches)
      setDepts(ref.departments)
    } catch {
      setLoadError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, repo, assetRepo, asnRepo, refLoader, t])

  useEffect(() => {
    void load()
  }, [load])

  const canMutate = role === 'super_admin' || role === 'asset_admin'

  // Derived lookups
  const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches])
  const deptMap   = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments])

  async function handleEditSubmit(v: EmployeeFormSubmit) {
    if (!employee) return
    setSubmitting(true)
    setEditError(null)
    try {
      await repo.updateEmployee(
        employee.id,
        {
          firstName: v.firstName,
          lastName:  v.lastName,
          email:     v.email,
          position:  v.position,
          branchId:  v.branchId,
          departmentId: v.departmentId,
        },
        actor,
      )
      setEditing(false)
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/email already in use/i.test(msg)) {
        setEditError(t('validation.emailTaken'))
      } else {
        setEditError(t('validation.saveFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleStatus() {
    if (!employee || actionBusy) return
    setActionBusy(true)
    setActionError(null)
    try {
      await repo.setStatus(
        employee.id,
        employee.status === 'active' ? 'terminated' : 'active',
        actor,
      )
      await load()
    } catch {
      setActionError(t('validation.saveFailed'))
    } finally {
      setActionBusy(false)
    }
  }

  function handleViewScan(path: string) {
    void actScanUrl(storage(), path)
      .then(u => window.open(u, '_blank', 'noopener'))
      .catch(() => setActionError(t('validation.saveFailed')))
  }

  // Acts = assignments with an actStoragePath
  const acts = assignments.filter(a => a.actStoragePath)

  // Render states
  if (loading) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="user" title="…" />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="user" title="—" />
        <ErrorState onRetry={load} />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="user" title={t('form.notFound')} />
        <EmptyState icon="search" title={t('form.notFound')} />
      </div>
    )
  }

  const fullName    = [employee.firstName, employee.lastName].filter(Boolean).join(' ') || '—'
  const branchName  = employee.branchId ? (branchMap.get(employee.branchId) ?? '—') : '—'
  const deptName    = employee.departmentId ? (deptMap.get(employee.departmentId) ?? '—') : '—'

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader
        icon="user"
        title={fullName}
        actions={
          <div className="flex items-center gap-2">
            <Chip color={employee.status === 'active' ? 'green' : 'gray'} dot>
              {t(`status.${employee.status}`)}
            </Chip>
            {canMutate && !editing && (
              <Btn
                variant="ghost"
                size="sm"
                disabled={actionBusy}
                onClick={() => { setEditError(null); setEditing(true) }}
              >
                <Icon name="settings" size={13} />
                {t('form.editTitle')}
              </Btn>
            )}
            {canMutate && (
              <Btn
                variant="ghost"
                size="sm"
                disabled={actionBusy}
                onClick={handleToggleStatus}
              >
                <Icon name="user" size={13} />
                {employee.status === 'active' ? t('detail.terminate') : t('detail.reactivate')}
              </Btn>
            )}
          </div>
        }
      />

      {/* Action error */}
      {actionError && (
        <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{actionError}</p>
      )}

      {/* Profile section */}
      <SectionCard title={t('detail.profile')} icon="user">
        {editing ? (
          <EmployeeForm
            mode="edit"
            initial={employee}
            branches={branches}
            departments={departments}
            submitting={submitting}
            submitError={editError}
            onSubmit={handleEditSubmit}
            onCancel={() => { setEditing(false); setEditError(null) }}
          />
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label={t('form.firstName')}>
              <p className="text-[13px] text-[#F8FAFC]">{employee.firstName || '—'}</p>
            </Field>
            <Field label={t('form.lastName')}>
              <p className="text-[13px] text-[#F8FAFC]">{employee.lastName || '—'}</p>
            </Field>
            <Field label={t('form.email')}>
              <p className="text-[13px] text-[#F8FAFC] font-mono">{employee.email || '—'}</p>
            </Field>
            <Field label={t('form.position')}>
              <p className="text-[13px] text-[#F8FAFC]">{employee.position ?? '—'}</p>
            </Field>
            <Field label={t('form.branch')}>
              <p className="text-[13px] text-[#F8FAFC]">{branchName}</p>
            </Field>
            <Field label={t('form.department')}>
              <p className="text-[13px] text-[#F8FAFC]">{deptName}</p>
            </Field>
          </dl>
        )}
      </SectionCard>

      {/* Assigned assets */}
      <SectionCard title={t('detail.assets')} icon="package">
        {assets.length === 0 ? (
          <p className="text-[12.5px] text-[#64748B]">{t('detail.noAssets')}</p>
        ) : (
          <ul className="space-y-2">
            {assets.map(a => (
              <li key={a.id} className="flex items-center gap-3 text-[13px] text-[#F8FAFC]">
                <span className="font-mono text-[12px] text-[#94A3B8]">{a.invCode}</span>
                <span className="text-[#64748B]">
                  {[a.brand, a.model].filter(Boolean).join(' ') || '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Signed acts */}
      <SectionCard title={t('detail.acts')} icon="file-text">
        {acts.length === 0 ? (
          <p className="text-[12.5px] text-[#64748B]">{t('detail.noActs')}</p>
        ) : (
          <ul className="space-y-2">
            {acts.map(a => (
              <li key={a.id} className="flex items-center gap-3">
                <span className="text-[12px] text-[#94A3B8] font-mono">{a.assetId}</span>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => a.actStoragePath && handleViewScan(a.actStoragePath)}
                >
                  <Icon name="arrow-right-left" size={13} />
                  {t('detail.viewScan')}
                </Btn>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
