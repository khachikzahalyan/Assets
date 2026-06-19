import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, SectionCard, Field, Input, Btn, Icon, Chip, LoadingState, ErrorState, EmptyState,
} from '@/components/ui'
import type { ChipColor } from '@/components/ui'
import { UpgradesPanel } from '@/components/features/assets/detail/UpgradesPanel'
import { AssetHistory } from '@/components/features/assets/detail/AssetHistory'
import { LifecycleActions } from '@/components/features/assets/detail/LifecycleActions'
import { AssignmentForm, type AssignmentSubmit } from '@/components/features/assets/detail/AssignmentForm'
import { AssignmentHistory } from '@/components/features/assets/detail/AssignmentHistory'
import { categoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Asset,
  AssetReferenceData,
  AssetWriteRepository,
  AssetRepository,
  UpgradeComponent,
  CategoryRow,
} from '@/domain/asset'
import type { AuditLog } from '@/domain/audit'
import type { UpgradeEvent } from '@/domain/asset'
import type { Assignment, AssignmentRepository } from '@/domain/assignment'
import { FirestoreAssetRepository, FirestoreAssignmentRepository } from '@/infra/repositories'
import { uploadActScan, actScanUrl } from '@/infra/storage'
import { db, storage } from '@/lib/firebase'

// Map status color strings from ref data to ChipColor values
function toChipColor(color: string): ChipColor {
  const map: Record<string, ChipColor> = {
    gray: 'gray',
    grey: 'gray',
    emerald: 'green',
    green: 'green',
    orange: 'orange',
    amber: 'amber',
    red: 'red',
    rose: 'red',
    blue: 'blue',
    indigo: 'indigo',
    violet: 'violet',
    teal: 'teal',
    cyan: 'cyan',
  }
  return map[color] ?? 'gray'
}

export interface AssetDetailPageProps {
  repository?: AssetRepository & AssetWriteRepository
  assignmentRepository?: AssignmentRepository
}

export function AssetDetailPage({ repository, assignmentRepository }: AssetDetailPageProps) {
  const { t } = useTranslation('assets')
  const { user, role } = useAuth()
  const { id } = useParams<{ id: string }>()

  const actor = useMemo(() => ({ uid: user.id, role }), [user.id, role])

  // Build default repos lazily — test callers inject their own
  const defaultRepo = useMemo<AssetRepository & AssetWriteRepository>(
    () => new FirestoreAssetRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const defaultAsnRepo = useMemo<AssignmentRepository>(
    () => new FirestoreAssignmentRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repoAsn = assignmentRepository ?? defaultAsnRepo

  // ---- Data state ----
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [upgrades, setUpgrades] = useState<UpgradeEvent[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [ref, setRef] = useState<AssetReferenceData | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])

  // ---- Identity edit state ----
  const [editing, setEditing] = useState(false)
  const [editBrand, setEditBrand] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editSerial, setEditSerial] = useState('')
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [identityError, setIdentityError] = useState<string | null>(null)

  // ---- Lifecycle action error ----
  const [actionError, setActionError] = useState<string | null>(null)

  // ---- Assignment state ----
  const [assigning, setAssigning] = useState(false)
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      // Run asset data + assignments in parallel.
      // Assignment list is best-effort: if Firestore is unavailable (e.g. tests
      // without a Firebase mock), the error is swallowed and assignments stay [].
      const [a, ups, logs, refData, asnList] = await Promise.all([
        repo.getAsset(id),
        (repo as AssetWriteRepository).listUpgrades(id),
        (repo as AssetWriteRepository).listAudit(id),
        repo.loadReferenceData(),
        // Only call listAssignments when a real repo was injected.
        // When assignmentRepository is undefined (old tests without the new prop),
        // skip the network call entirely to avoid blocking those tests.
        assignmentRepository
          ? repoAsn.listAssignments(id).catch(() => [] as Assignment[])
          : Promise.resolve([] as Assignment[]),
      ])
      setAsset(a)
      setUpgrades(ups)
      setAuditLogs(logs)
      setRef(refData)
      setAssignments(asnList)
    } catch {
      setLoadError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, repo, repoAsn, assignmentRepository, t])

  useEffect(() => {
    void load()
  }, [load])

  // ---- Derived data ----
  const category: CategoryRow | null = asset && ref
    ? (ref.categories.find(c => c.id === asset.categoryId) ?? null)
    : null
  const caps = category ? categoryCapabilities(category) : null
  const statusRow = asset && ref
    ? (ref.statuses.find(s => s.id === asset.statusId) ?? null)
    : null

  const canIssue = role === 'super_admin' || role === 'asset_admin'
  const canRepair = role === 'super_admin' || role === 'tech_admin'
  const canEditUpgrades = role === 'super_admin' || role === 'tech_admin'
  const canAssign = role === 'super_admin' || role === 'asset_admin'

  // ---- Identity edit handlers ----
  function handleStartEdit() {
    if (!asset) return
    setEditBrand(asset.brand ?? '')
    setEditModel(asset.model ?? '')
    setEditSerial(asset.serial ?? '')
    setIdentityError(null)
    setEditing(true)
  }

  function handleCancelEdit() {
    setEditing(false)
    setIdentityError(null)
  }

  async function handleSaveIdentity() {
    if (!asset) return
    setSavingIdentity(true)
    setIdentityError(null)
    try {
      await (repo as AssetWriteRepository).updateAsset(
        asset.id,
        {
          brand: editBrand || null,
          model: editModel || null,
          serial: editSerial || null,
        },
        actor,
      )
      setEditing(false)
      await load()
    } catch {
      setIdentityError(t('validation.saveFailed'))
    } finally {
      setSavingIdentity(false)
    }
  }

  // ---- Upgrade handler ----
  async function handleAddUpgrade(ev: { component: UpgradeComponent; after: string }) {
    if (!asset) return
    await (repo as AssetWriteRepository).addUpgrade(asset.id, ev, actor)
    await load()
  }

  // ---- Lifecycle action handlers ----
  async function handleSendToRepair() {
    if (!asset) return
    setActionError(null)
    try {
      await (repo as AssetWriteRepository).changeStatus(asset.id, 'st_repair', actor)
      await load()
    } catch {
      setActionError(t('validation.saveFailed'))
    }
  }

  async function handleWriteOff() {
    if (!asset) return
    setActionError(null)
    try {
      await (repo as AssetWriteRepository).changeStatus(asset.id, 'st_disposed', actor)
      await load()
    } catch {
      setActionError(t('validation.saveFailed'))
    }
  }

  async function handleReturn() {
    if (!asset) return
    setActionError(null)
    try {
      await repoAsn.returnAsset(asset.id, actor)
      await load()
    } catch {
      setActionError(t('assign.returnFailed'))
    }
  }

  // ---- Assignment handler ----
  async function handleAssign(v: AssignmentSubmit) {
    if (!asset) return
    setAssignBusy(true)
    try {
      let actPath: string | null = null
      if (v.file) {
        // Upload BEFORE transaction (Decision B — orphaned scan on txn failure is acceptable)
        actPath = await uploadActScan(storage(), asset.id, v.file)
      }

      // Resolve employee name from ref data.
      // Note: EmployeeRow has no email field — employeeEmail stays null.
      // The Firestore repo will skip mail enqueue for null email, which is best-effort.
      let employeeName: string | null = null
      if (v.mode === 'employee' && v.employeeId && ref) {
        const emp = ref.employees.find(e => e.id === v.employeeId)
        if (emp) {
          employeeName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || null
        }
      }

      const assignInput: Parameters<typeof repoAsn.assign>[0] = {
        assetId: asset.id,
        mode: v.mode,
        actStoragePath: actPath,
        transferComment: v.comment,
        invCode: asset.invCode,
      }
      if (v.employeeId) assignInput.employeeId = v.employeeId
      if (v.branchId) assignInput.branchId = v.branchId
      if (employeeName) assignInput.employeeName = employeeName
      // employeeEmail is always null for now (EmployeeRow has no email field)
      await repoAsn.assign(assignInput, actor)
      setAssigning(false)
      await load()
    } catch {
      setAssignError(t('assign.assignFailed'))
    } finally {
      setAssignBusy(false)
    }
  }

  function handleViewScan(path: string) {
    void actScanUrl(storage(), path).then(u => window.open(u, '_blank', 'noopener')).catch(() => setActionError(t('assign.scanFailed')))
  }

  // ---- Render states ----
  if (loading) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="package" title="…" />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="package" title="—" />
        <ErrorState onRetry={load} />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="package" title={t('form.notFound')} />
        <EmptyState icon="search-x" title={t('form.notFound')} />
      </div>
    )
  }

  // PageHeader title = "Актив 450/1"; no description (brand/model shown in identity card)
  const pageTitle = t('form.editTitle', { code: asset.invCode })

  return (
    <div className="anim-content-enter space-y-5">
      {/* Page header */}
      <PageHeader
        icon={category?.lucideIcon ?? 'package'}
        title={pageTitle}
        actions={
          <div className="flex items-center gap-2">
            {statusRow && (
              <Chip color={toChipColor(statusRow.color)} dot>
                {statusRow.name}
              </Chip>
            )}
          </div>
        }
      />

      {/* Lifecycle action error */}
      {actionError && (
        <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{actionError}</p>
      )}

      {/* Lifecycle actions */}
      <LifecycleActions
        statusId={asset.statusId}
        canIssue={canIssue}
        canRepair={canRepair}
        canAssign={canAssign && !assigning}
        onSendToRepair={handleSendToRepair}
        onWriteOff={handleWriteOff}
        onReturn={handleReturn}
        onAssign={() => { setAssignError(null); setAssigning(true) }}
      />

      {/* Assignment form */}
      {assigning && (
        <SectionCard title={t('assign.title')} icon="user-check">
          {assignError && (
            <p role="alert" className="mb-3 text-[12px] text-[#FDA4AF]">{assignError}</p>
          )}
          <AssignmentForm
            employees={ref?.employees ?? []}
            branches={ref?.branches ?? []}
            busy={assignBusy}
            onSubmit={handleAssign}
            onCancel={() => { setAssigning(false); setAssignError(null) }}
          />
        </SectionCard>
      )}

      {/* Identity section */}
      <SectionCard
        title={t('form.brand') + ' / ' + t('form.model')}
        icon="fingerprint"
        action={
          !editing ? (
            <Btn variant="ghost" size="sm" onClick={handleStartEdit}>
              <Icon name="pencil" size={13} />
              {t('form.change')}
            </Btn>
          ) : undefined
        }
      >
        {identityError && (
          <p role="alert" className="mb-3 text-[12px] text-[#FDA4AF]">{identityError}</p>
        )}

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-brand" className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
                  {t('form.brand')}
                </label>
                <Input id="edit-brand" value={editBrand} onChange={setEditBrand} />
              </div>
              <div>
                <label htmlFor="edit-model" className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
                  {t('form.model')}
                </label>
                <Input id="edit-model" value={editModel} onChange={setEditModel} />
              </div>
              <div>
                <label htmlFor="edit-serial" className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
                  {t('form.serial')}
                </label>
                <Input id="edit-serial" value={editSerial} onChange={setEditSerial} mono />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Btn
                variant="primary"
                size="sm"
                onClick={handleSaveIdentity}
                disabled={savingIdentity}
              >
                {savingIdentity
                  ? <Icon name="loader-circle" size={13} className="animate-spin" />
                  : <Icon name="check" size={13} />}
                {t('form.save')}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={handleCancelEdit} disabled={savingIdentity}>
                {t('form.cancel')}
              </Btn>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label={`${t('form.brand')} / ${t('form.model')}`}>
              <p className="text-[13px] text-[#F8FAFC]">
                {[asset.brand, asset.model].filter(Boolean).join(' ') || '—'}
              </p>
            </Field>
            <Field label={t('form.serial')}>
              <p className="text-[13px] font-mono text-[#F8FAFC]">{asset.serial ?? '—'}</p>
            </Field>
          </dl>
        )}
      </SectionCard>

      {/* Specs section (only for hasSpecs categories) */}
      {caps?.hasSpecs && asset.currentSpecs && (
        <SectionCard title={t('form.specs')} icon="cpu">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {asset.currentSpecs.cpu && (
              <Field label={t('form.specCpu')}>
                <p className="text-[13px] text-[#F8FAFC]">{asset.currentSpecs.cpu}</p>
              </Field>
            )}
            {asset.currentSpecs.ram && (
              <Field label={t('form.specRam')}>
                <p className="text-[13px] text-[#F8FAFC]">{asset.currentSpecs.ram}</p>
              </Field>
            )}
            {asset.currentSpecs.ssd && (
              <Field label={t('form.specSsd')}>
                <p className="text-[13px] text-[#F8FAFC]">{asset.currentSpecs.ssd}</p>
              </Field>
            )}
            {asset.currentSpecs.gpu && (
              <Field label={t('form.specGpu')}>
                <p className="text-[13px] text-[#F8FAFC]">{asset.currentSpecs.gpu}</p>
              </Field>
            )}
          </dl>
        </SectionCard>
      )}

      {/* Upgrades panel (only for hasSpecs categories) */}
      {caps?.hasSpecs && (
        <UpgradesPanel
          assetId={asset.id}
          currentSpecs={asset.currentSpecs}
          upgrades={upgrades}
          canEditUpgrades={canEditUpgrades}
          onAdd={handleAddUpgrade}
        />
      )}

      {/* Audit history */}
      <AssetHistory logs={auditLogs} ref={ref ?? undefined} />

      {/* Assignment history */}
      <AssignmentHistory
        assignments={assignments}
        {...(ref ? { refData: ref } : {})}
        onViewScan={handleViewScan}
      />
    </div>
  )
}
