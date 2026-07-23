import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { auditToHistoryEvent } from '@/components/features/assets/detail/auditToHistoryEvent'
import { categoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import { deriveDisplayStatus } from '@/components/features/assets/assetFormat'
import { actScanUrl } from '@/infra/storage'
import { storage } from '@/lib/firebase'
import { WriteOffAssetService } from '@/domain/services/WriteOffAssetService'
import { setLicenseKey } from '@/lib/licenses/revealKey'
import type {
  Asset,
  AssetReferenceData,
  AssetWriteRepository,
  AssetRepository,
  CategoryRow,
  StatusRow,
} from '@/domain/asset'
import { ASSET_STATUS } from '@/domain/asset'
import type { AuditLog } from '@/domain/audit'
import type { Assignment, AssignmentRepository } from '@/domain/assignment'
import type { TransferPatch } from '@/domain/asset/transferRules'
import type { WorkstationLicense, WorkstationLicenseRepository } from '@/domain/license'
import type { AttachChoice } from '@/components/features/assets/detail/LicenseBlock'
import type { TabId } from '@/components/features/assets/detail/DetailTabs'
import type { HistoryEventVM } from '@/components/features/assets/detail/detailFormat'
import type { CategoryCapabilities } from '@/components/features/assets/create/CategoryPicker'

// Act record derived from assignment list (assignments with actStoragePath present).
export interface ActRecord {
  id: string
  name: string
  date: string
  path: string
}

interface Params {
  id: string | undefined
  repo: AssetRepository & AssetWriteRepository
  repoAsn: AssignmentRepository
  licenseRepo: WorkstationLicenseRepository
  onPersistOemSecret?: ((licenseId: string, rawKey: string) => Promise<void>) | undefined
}

export function useAssetDetail({ id, repo, repoAsn, licenseRepo, onPersistOemSecret }: Params) {
  const { t } = useTranslation('assets')
  const { user, role } = useAuth()
  const actor = useMemo(() => ({ uid: user.id, role, displayName: user.name }), [user.id, role, user.name])

  // Keep the latest `t` in a ref so `load` can read fresh error strings WITHOUT
  // depending on `t` — otherwise a new `t` identity (e.g. language switch) would
  // rebuild `load` and re-fire the fetch effect, risking an infinite refetch loop.
  const tRef = useRef(t)
  tRef.current = t

  // ---- Data state ----
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [ref, setRef] = useState<AssetReferenceData | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [licenses, setLicenses] = useState<WorkstationLicense[]>([])
  const [decoupledLicenses, setDecoupledLicenses] = useState<WorkstationLicense[]>([])
  const [retiredWithAssetLicenses, setRetiredWithAssetLicenses] = useState<WorkstationLicense[]>([])
  const [licensePool, setLicensePool] = useState<{ id: string; name: string; vendor: string | null }[]>([])

  // ---- UI state ----
  const [activeTab, setActiveTab] = useState<TabId>('specs')
  const [transferOpen, setTransferOpen] = useState(false)
  const [writeOffOpen, setWriteOffOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    /* Two-phase load (mobile scan flow was skeleton-bound for seconds):
       Phase 1 — ONLY what the first paint needs (asset + ref data for the
       hero/status; the default tab is specs, derived from those two). The
       skeleton drops as soon as these two land.
       Phase 2 — history/acts/licenses stream in after first paint; their
       sections render from [] and fill when ready. Previously ALL six queries
       gated the skeleton, so time-to-content was the SLOWEST of ~11 reads
       (incl. the full assignable-license pool, needed only for a dialog). */
    try {
      const [a, refData] = await Promise.all([
        repo.getAsset(id),
        repo.loadReferenceData(),
      ])
      setAsset(a)
      setRef(refData)
    } catch {
      setLoadError(tRef.current('validation.saveFailed'))
      setLoading(false)
      return
    }
    setLoading(false)

    const [logs, asnList, licList, poolList] = await Promise.all([
      (repo as AssetWriteRepository).listAudit(id).catch(() => [] as AuditLog[]),
      repoAsn.listAssignments(id).catch(() => [] as Assignment[]),
      licenseRepo.listForAsset(id).catch(() => [] as WorkstationLicense[]),
      licenseRepo.listAssignablePool().catch(() => [] as WorkstationLicense[]),
    ])
    setAuditLogs(logs)
    setAssignments(asnList)
    setLicenses(licList)
    const freeOem = poolList.filter(
      l => l.type === 'OEM' && l.assignmentType === 'unassigned' && l.lifecycleStatus === 'active',
    )
    setLicensePool(freeOem.map(l => ({ id: l.id, name: l.name, vendor: l.vendor ?? null })))

    // For disposed assets: load decoupled (Retail freed) and retired-with-asset (OEM) licenses.
    if (licList.length === 0) {
      const decoupled = await licenseRepo.listDecoupledFromAsset(id).catch(() => [] as WorkstationLicense[])
      setDecoupledLicenses(decoupled)
    } else {
      setDecoupledLicenses([])
    }

    // Load retired-with-asset licenses (OEM path — retired non-reusable licenses).
    const allRetired = await licenseRepo.listLicenses({ lifecycleStatus: 'retired' }).catch(() => [] as WorkstationLicense[])
    const retiredHere = allRetired.filter(l => l.retiredWithAssetId === id)
    setRetiredWithAssetLicenses(retiredHere)
  }, [id, repo, repoAsn, licenseRepo])

  useEffect(() => {
    void load()
  }, [load])

  // ---- Derived data ----
  const category: CategoryRow | null = asset && ref
    ? (ref.categories.find(c => c.id === asset.categoryId) ?? null)
    : null
  const caps: CategoryCapabilities | null = category ? categoryCapabilities(category) : null
  const statusRow: StatusRow | null = asset && ref
    ? deriveDisplayStatus(asset, ref.statuses)
    : null

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

  const historyEvents: HistoryEventVM[] = useMemo(() => {
    if (!ref) return []
    // Asset history shows only the asset's OWN lifecycle/transfer records.
    // Parts/component events (Запчасти — `upgrade_added`, `part_installed`,
    // `part_removed`, …) belong to the Parts module, not the asset timeline,
    // so any upgrade/part_* action is excluded here.
    return auditLogs
      .filter(log => log.action !== 'upgrade_added' && !log.action.startsWith('part'))
      .map(log => auditToHistoryEvent(log, ref, { currentUid: user.id }))
  }, [auditLogs, ref, user.id])

  const canRepair  = role === 'super_admin' || role === 'tech_admin'
  const canAssign  = role === 'super_admin' || role === 'asset_admin'
  const canWriteOff = role === 'super_admin' || role === 'asset_admin'
  const isDisposed = asset?.statusId === ASSET_STATUS.disposed
  const canManageLicense = (role === 'super_admin' || role === 'tech_admin') && !isDisposed && Boolean(caps?.hasOemLicense)

  // Derived once here so the effect dep is a stable boolean (not a full object ref).
  const hasSpecsFlag = Boolean(caps?.hasSpecs)

  // Normalize activeTab: when the specs tab is hidden (furniture, peripherals, etc.)
  // and the tab is still set to 'specs' from the initial default, fall back to 'history'.
  // Guard on !loading so the effect only fires after caps are resolved — during loading
  // caps is null (hasSpecsFlag=false) and we must NOT switch a spec-capable asset to 'history'.
  useEffect(() => {
    if (loading) return
    if (!hasSpecsFlag && activeTab === 'specs') {
      setActiveTab('history')
    }
  }, [loading, hasSpecsFlag, activeTab])

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
        { assignment: patch.assignment ?? null, branchId: patch.branchId, deptId: patch.deptId },
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
      await (repo as AssetWriteRepository).changeStatus(asset.id, ASSET_STATUS.repair, actor, { comment: reason })
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
      await (repo as AssetWriteRepository).changeStatus(asset.id, ASSET_STATUS.assigned, actor)
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

  return {
    loading, loadError, load,
    asset, auditLogs, ref, assignments, licenses, decoupledLicenses, retiredWithAssetLicenses, licensePool,
    category, caps, statusRow, acts, historyEvents,
    canRepair, canAssign, canWriteOff, isDisposed, canManageLicense, hasSpecsFlag,
    activeTab, setActiveTab,
    transferOpen, setTransferOpen,
    writeOffOpen, setWriteOffOpen,
    busy, printing, setPrinting,
    actionError,
    onTransfer, onSendToRepair, onReturnFromRepair,
    onOpenWriteOff, onConfirmWriteOff, onOpenScan, onAttachLicense,
  }
}
