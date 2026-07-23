import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '@/hooks/useIsMobile'
import { AssetDetailMobileView } from '@/components/features/assets/detail/AssetDetailMobileView'
import {
  PageHeader, ErrorState, EmptyState,
} from '@/components/ui'
import { AssetDetailSkeleton } from './detail/AssetDetailSkeleton'
import { AssetDetailDesktopView } from './detail/AssetDetailDesktopView'
import { useAssetDetail } from './detail/useAssetDetail'
import type {
  AssetRepository,
  AssetWriteRepository,
} from '@/domain/asset'
import type { AssignmentRepository } from '@/domain/assignment'
import type { WorkstationLicenseRepository } from '@/domain/license'
import { getSharedAssetRepository, getSharedAssignmentRepository, getSharedWorkstationLicenseRepository } from '@/infra/repositories'

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
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()

  // Shared production singletons — test callers inject their own repos.
  const repo = repository ?? getSharedAssetRepository()
  const repoAsn = assignmentRepository ?? getSharedAssignmentRepository()
  const licenseRepo = licenseRepository ?? getSharedWorkstationLicenseRepository()

  const {
    loading, loadError, load,
    asset, ref, category, caps, statusRow,
    acts, historyEvents, licenses, decoupledLicenses, retiredWithAssetLicenses, licensePool,
    canRepair, canAssign, canWriteOff, isDisposed, canManageLicense, hasSpecsFlag,
    activeTab, setActiveTab,
    transferOpen, setTransferOpen,
    writeOffOpen, setWriteOffOpen,
    busy, printing, setPrinting,
    actionError,
    onTransfer, onSendToRepair, onReturnFromRepair,
    onOpenWriteOff, onConfirmWriteOff, onOpenScan, onAttachLicense,
  } = useAssetDetail({ id, repo, repoAsn, licenseRepo, onPersistOemSecret })

  // ---- Render states ----
  if (loading) {
    return <AssetDetailSkeleton />
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
    // Status row resolves from ref data — if ref is somehow absent, show a slim skeleton
    return (
      <div className="space-y-5" aria-hidden="true">
        <PageHeader icon="package" title={asset.invCode} />
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[13px] rounded anim-skeleton" style={{ width: `${60 - i * 8}%` }} />
          ))}
        </div>
      </div>
    )
  }

  // ---- Mobile branch (≤767px) — rendered before the desktop JSX ----
  // isMobile returns false under jsdom (no matchMedia) so existing tests render the
  // desktop branch unchanged.
  if (isMobile) {
    return (
      <AssetDetailMobileView
        asset={asset}
        category={category}
        statusRow={statusRow}
        caps={caps}
        refData={ref!}
        acts={acts}
        historyEvents={historyEvents}
        licenses={licenses}
        decoupledLicenses={decoupledLicenses}
        retiredWithAssetLicenses={retiredWithAssetLicenses}
        licensePool={licensePool}
        hasSpecsFlag={hasSpecsFlag}
        canWriteOff={canWriteOff}
        canAssign={canAssign}
        canRepair={canRepair}
        isDisposed={isDisposed}
        canManageLicense={canManageLicense}
        busy={busy}
        actionError={actionError}
        transferOpen={transferOpen}
        writeOffOpen={writeOffOpen}
        printing={printing}
        onOpenTransfer={() => setTransferOpen(true)}
        onCloseTransfer={() => setTransferOpen(false)}
        onTransfer={onTransfer}
        onWriteOff={onOpenWriteOff}
        onCloseWriteOff={() => setWriteOffOpen(false)}
        onConfirmWriteOff={onConfirmWriteOff}
        onSendToRepair={onSendToRepair}
        onReturnFromRepair={onReturnFromRepair}
        onOpenScan={onOpenScan}
        onAttachLicense={onAttachLicense}
        {...(asset.barcode ? { onPrint: () => setPrinting(true) } : {})}
        onClosePrint={() => setPrinting(false)}
      />
    )
  }

  return (
    <AssetDetailDesktopView
      asset={asset}
      category={category}
      statusRow={statusRow}
      caps={caps}
      refData={ref!}
      acts={acts}
      historyEvents={historyEvents}
      licenses={licenses}
      decoupledLicenses={decoupledLicenses}
      retiredWithAssetLicenses={retiredWithAssetLicenses}
      licensePool={licensePool}
      hasSpecsFlag={hasSpecsFlag}
      canRepair={canRepair}
      canAssign={canAssign}
      canWriteOff={canWriteOff}
      isDisposed={isDisposed}
      canManageLicense={canManageLicense}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      transferOpen={transferOpen}
      setTransferOpen={setTransferOpen}
      writeOffOpen={writeOffOpen}
      setWriteOffOpen={setWriteOffOpen}
      busy={busy}
      printing={printing}
      setPrinting={setPrinting}
      actionError={actionError}
      onTransfer={onTransfer}
      onSendToRepair={onSendToRepair}
      onReturnFromRepair={onReturnFromRepair}
      onOpenWriteOff={onOpenWriteOff}
      onConfirmWriteOff={onConfirmWriteOff}
      onOpenScan={onOpenScan}
      onAttachLicense={onAttachLicense}
    />
  )
}
