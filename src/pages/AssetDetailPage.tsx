import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, LoadingState, ErrorState, EmptyState,
} from '@/components/ui'
import { DetailHero } from '@/components/features/assets/detail/DetailHero'
import { DetailTabs, type TabId } from '@/components/features/assets/detail/DetailTabs'
import { TechSpecsCard } from '@/components/features/assets/detail/TechSpecsCard'
import { HistoryCard } from '@/components/features/assets/detail/HistoryCard'
import { DocumentsTab } from '@/components/features/assets/detail/DocumentsTab'
import { LocationCard } from '@/components/features/assets/detail/LocationCard'
import { AssignmentCard } from '@/components/features/assets/detail/AssignmentCard'
import { RepairCard } from '@/components/features/assets/detail/RepairCard'
import { WriteOffModal } from '@/components/features/assets/detail/WriteOffModal'
import { auditToHistoryEvent } from '@/components/features/assets/detail/auditToHistoryEvent'
import { categoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import { deriveDisplayStatus } from '@/components/features/assets/assetFormat'
import { useAuth } from '@/contexts/AuthContext'
import type {
  Asset,
  AssetReferenceData,
  AssetWriteRepository,
  AssetRepository,
  CategoryRow,
} from '@/domain/asset'
import type { AuditLog } from '@/domain/audit'
import type { Assignment, AssignmentRepository } from '@/domain/assignment'
import type { TransferPatch } from '@/domain/asset/transferRules'
import type { WorkstationLicense } from '@/domain/license'
import { FirestoreAssetRepository, FirestoreAssignmentRepository, FirestoreWorkstationLicenseRepository } from '@/infra/repositories'
import { actScanUrl } from '@/infra/storage'
import { db, storage } from '@/lib/firebase'
import type { WorkstationLicenseRepository } from '@/domain/license'
import { WriteOffAssetService } from '@/domain/services/WriteOffAssetService'
import { setLicenseKey } from '@/lib/licenses/revealKey'
import type { AttachChoice } from '@/components/features/assets/detail/LicenseBlock'

// ---------------------------------------------------------------------------
// Act record type (derived from assignment list)
// ---------------------------------------------------------------------------

interface ActRecord {
  id: string
  name: string
  date: string
  path: string
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface AssetDetailPageProps {
  repository?: AssetRepository & AssetWriteRepository
  assignmentRepository?: AssignmentRepository
  licenseRepository?: WorkstationLicenseRepository
  /**
   * Optional hook to persist the raw OEM key to the secrets store after license creation.
   * Defaults to the `setLicenseKey` Cloud Function via httpsCallable.
   * Inject a stub in tests to avoid calling Firebase Functions.
   *
   * NOTE: The raw key must never reach Firestore directly — it is routed through the
   * Cloud Function which writes to `licenses/{id}/secrets/current` under admin SDK.
   */
  onPersistOemSecret?: (licenseId: string, rawKey: string) => Promise<void>
}

export function AssetDetailPage({ repository, assignmentRepository, licenseRepository, onPersistOemSecret }: AssetDetailPageProps) {
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

  const defaultLicenseRepo = useMemo<WorkstationLicenseRepository>(
    () => new FirestoreWorkstationLicenseRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const licenseRepo = licenseRepository ?? defaultLicenseRepo

  // ---- Data state ----
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [ref, setRef] = useState<AssetReferenceData | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [licenses, setLicenses] = useState<WorkstationLicense[]>([])
  const [licensePool, setLicensePool] = useState<{ id: string; name: string; vendor: string | null }[]>([])

  // ---- UI state ----
  const [activeTab, setActiveTab] = useState<TabId>('specs')
  const [transferOpen, setTransferOpen] = useState(false)
  const [writeOffOpen, setWriteOffOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const [a, logs, refData, asnList, licList, poolList] = await Promise.all([
        repo.getAsset(id),
        (repo as AssetWriteRepository).listAudit(id),
        repo.loadReferenceData(),
        repoAsn.listAssignments(id).catch(() => [] as Assignment[]),
        licenseRepo.listForAsset(id).catch(() => [] as WorkstationLicense[]),
        licenseRepo.listAssignablePool().catch(() => [] as WorkstationLicense[]),
      ])
      setAsset(a)
      setAuditLogs(logs)
      setRef(refData)
      setAssignments(asnList)
      setLicenses(licList)
      const freeOem = poolList.filter(
        l => l.type === 'OEM' && l.assignmentType === 'unassigned' && l.lifecycleStatus === 'active',
      )
      setLicensePool(freeOem.map(l => ({ id: l.id, name: l.name, vendor: l.vendor ?? null })))
    } catch {
      setLoadError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, repo, repoAsn, licenseRepo, t])

  useEffect(() => {
    void load()
  }, [load])

  // ---- Derived data ----
  const category: CategoryRow | null = asset && ref
    ? (ref.categories.find(c => c.id === asset.categoryId) ?? null)
    : null
  const caps = category ? categoryCapabilities(category) : null
  const statusRow = asset && ref
    ? deriveDisplayStatus(asset, ref.statuses)
    : null

  // Acts derived from assignment list (those with an actStoragePath)
  const acts: ActRecord[] = useMemo(() => {
    return assignments
      .filter(a => Boolean((a as { actStoragePath?: string | null }).actStoragePath))
      .map((a, i) => ({
        id: a.id ?? String(i),
        name: t('detail.docs.actName', { n: String(i + 1) }),
        date: a.startedAt ?? a.createdAt ?? '',
        path: (a as { actStoragePath?: string | null }).actStoragePath ?? '',
      }))
  }, [assignments, t])

  const historyEvents = useMemo(() => {
    if (!ref) return []
    return auditLogs.map(log => auditToHistoryEvent(log, ref, { currentUid: user.id }))
  }, [auditLogs, ref, user.id])

  const canRepair  = role === 'super_admin' || role === 'tech_admin'
  const canAssign  = role === 'super_admin' || role === 'asset_admin'
  const canWriteOff = role === 'super_admin' || role === 'asset_admin'

  const isDisposed = asset?.statusId === 'st_disposed'

  const canManageLicense = (role === 'super_admin' || role === 'tech_admin') && !isDisposed && Boolean(caps?.hasOemLicense)

  // ---- Transfer handler ----
  async function onTransfer(patch: TransferPatch) {
    if (!asset) return
    setBusy(true)
    setActionError(null)
    try {
      await (repo as AssetWriteRepository).changeStatus(
        asset.id,
        patch.toStatusId,
        actor,
        { assignment: patch.assignment ?? null },
      )
      setTransferOpen(false)
      await load()
    } catch {
      setActionError(t('assign.assignFailed'))
    } finally {
      setBusy(false)
    }
  }

  // ---- Repair handlers ----
  async function onSendToRepair(reason: string) {
    if (!asset) return
    setBusy(true)
    setActionError(null)
    try {
      await (repo as AssetWriteRepository).changeStatus(asset.id, 'st_repair', actor, { comment: reason })
      await load()
    } catch {
      setActionError(t('validation.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function onReturnFromRepair() {
    if (!asset) return
    setBusy(true)
    setActionError(null)
    try {
      await (repo as AssetWriteRepository).changeStatus(asset.id, 'st_assigned', actor)
      await load()
    } catch {
      setActionError(t('validation.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  // ---- Write-off handlers ----
  function onOpenWriteOff() {
    setWriteOffOpen(true)
  }

  async function onConfirmWriteOff(reason: string) {
    if (!asset) return
    setBusy(true)
    setActionError(null)
    try {
      const svc = new WriteOffAssetService(repo as AssetWriteRepository, licenseRepo)
      await svc.writeOff(asset.id, actor, reason)
      setWriteOffOpen(false)
      await load()
    } catch {
      setActionError(t('validation.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  // ---- Scan viewer ----
  function onOpenScan(path: string) {
    void actScanUrl(storage(), path)
      .then(u => window.open(u, '_blank', 'noopener'))
      .catch(() => setActionError(t('assign.scanFailed')))
  }

  // ---- License attach handler ----
  async function onAttachLicense(choice: AttachChoice) {
    if (!asset) return
    setBusy(true)
    setActionError(null)
    try {
      if (choice.kind === 'existing') {
        await licenseRepo.assignLicense(choice.licenseId, { to: 'device', assetId: asset.id }, actor)
      } else if (choice.kind === 'new-key') {
        // Manual/retail product key — type:'Retail', isReusable:true
        const manualName = [asset.brand, asset.model].filter(Boolean).join(' ').trim()
          ? `${[asset.brand, asset.model].filter(Boolean).join(' ').trim()} — Ключ продукта`
          : 'Лицензия ОС'
        const created = await licenseRepo.createLicense(
          {
            name: manualName,
            type: 'Retail',
            isReusable: true,
            rawKey: choice.rawKey,
            assign: { to: 'device', assetId: asset.id },
          },
          actor,
        )
        if (choice.rawKey) {
          // Persist the raw secret via the callable — never write the raw key to Firestore directly.
          try {
            const licenseId = created.value.id
            if (licenseId) {
              const persist = onPersistOemSecret ?? ((lid: string, key: string) => setLicenseKey('licenses', lid, key))
              await persist(licenseId, choice.rawKey)
            } else {
              setActionError(t('validation.oemKeyNotStored'))
            }
          } catch {
            setActionError(t('validation.oemKeyNotStored'))
          }
        }
      } else {
        // oem-digital: firmware-embedded OEM license — type:'OEM', isReusable:false, NO rawKey
        const oemName = ['OEM —', asset.brand, asset.model].filter(Boolean).join(' ').trim() || 'OEM'
        await licenseRepo.createLicense(
          {
            name: oemName,
            type: 'OEM',
            isReusable: false,
            assign: { to: 'device', assetId: asset.id },
          },
          actor,
        )
      }
      await load()
    } catch {
      setActionError(t('detail.license.attachFailed'))
    } finally {
      setBusy(false)
    }
  }

  // ---- License detach handler (kept for Licenses module — not wired into asset card) ----
  // detach lives in the Licenses module, not the asset card; removed from TechSpecsCard prop

  // ---- Render states ----
  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader icon="package" title="…" />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <PageHeader icon="package" title="—" />
        <ErrorState onRetry={load} />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="space-y-5">
        <PageHeader icon="package" title={t('form.notFound')} />
        <EmptyState icon="search-x" title={t('form.notFound')} />
      </div>
    )
  }

  if (!statusRow) {
    return (
      <div className="space-y-5">
        <PageHeader icon="package" title={asset.invCode} />
        <LoadingState rows={3} />
      </div>
    )
  }

  // Tab body visibility
  const showSpecs = Boolean(caps?.hasSpecs)

  // Derive creation date from history events (the event with kind === 'created')
  const creationEvent = historyEvents.find(ev => ev.kind === 'created')
  const addedDate = creationEvent?.date ?? asset.updatedAt

  return (
    <>
      {/* Action error banner */}
      {actionError && (
        <p role="alert" className="mb-3 text-[12px] text-[#FDA4AF] px-1">{actionError}</p>
      )}

      {/* Two-column grid on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* ---------------------------------------------------------------- */}
        {/* LEFT column — hero + tabs + tab body                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="lg:col-span-2 space-y-0">
          {/* Hero */}
          <DetailHero
            asset={asset}
            category={category}
            statusRow={statusRow}
            canWriteOff={canWriteOff && !isDisposed}
            isDisposed={isDisposed}
            onWriteOff={onOpenWriteOff}
          />

          {/* Tabs */}
          <DetailTabs
            active={activeTab}
            onChange={setActiveTab}
            showSpecs={showSpecs}
            showDocs={true}
            addedDate={addedDate}
          />

          {/* Tab body — WAI-ARIA tabpanel */}
          <div
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
            className="bg-surface rounded-b-2xl border-x border-b border-border px-5 sm:px-6 py-5"
          >
            {activeTab === 'specs' && (
              <div className="space-y-5">
                {(caps?.hasSpecs || canManageLicense || licenses.length > 0 || caps?.hasOemLicense) ? (
                  <TechSpecsCard
                    asset={asset}
                    licenses={licenses}
                    hasOemLicenseCap={Boolean(caps?.hasOemLicense)}
                    canManageLicense={canManageLicense}
                    onAttachLicense={onAttachLicense}
                    licensePool={licensePool}
                    licenseBusy={busy}
                  />
                ) : (
                  <p className="text-[13px] text-text-subtle italic">{t('detail.specs.empty')}</p>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <HistoryCard events={historyEvents} />
            )}

            {activeTab === 'docs' && (
              <DocumentsTab
                acts={acts}
                onOpen={onOpenScan}
                purchaseDate={asset.purchaseDate ?? null}
                warrantyEndsAt={asset.warrantyEndsAt ?? null}
              />
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* RIGHT column — assignment + location + repair                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-4">
          {/* Assignment card */}
          {ref && (
            <AssignmentCard
              asset={asset}
              refData={ref}
              caps={caps}
              canAssign={canAssign && !isDisposed}
              busy={busy}
              transferOpen={transferOpen}
              onOpenTransfer={() => setTransferOpen(true)}
              onCloseTransfer={() => setTransferOpen(false)}
              onCommit={onTransfer}
            />
          )}

          {/* Location card */}
          {ref && (
            <LocationCard asset={asset} refData={ref} />
          )}

          {/* Repair card */}
          <RepairCard
            asset={asset}
            canRepair={canRepair && !isDisposed}
            busy={busy}
            onSendToRepair={onSendToRepair}
            onReturnFromRepair={onReturnFromRepair}
          />
        </div>
      </div>

      {/* Write-off modal — portal */}
      {writeOffOpen && (
        <WriteOffModal
          asset={asset}
          busy={busy}
          onClose={() => setWriteOffOpen(false)}
          onConfirm={onConfirmWriteOff}
        />
      )}
    </>
  )
}
