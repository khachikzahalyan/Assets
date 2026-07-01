import { useState, useEffect } from 'react'
import type { Asset, AssetReferenceData, CategoryRow, StatusRow } from '@/domain/asset'
import type { CategoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import type { HistoryEventVM } from '@/components/features/assets/detail/detailFormat'
import type { WorkstationLicense } from '@/domain/license'
import type { TransferPatch } from '@/domain/asset/transferRules'
import type { AttachChoice } from '@/components/features/assets/detail/LicenseBlock'
import { DetailHeroMobile } from './DetailHeroMobile'
import { DetailTabs, type TabId } from './DetailTabs'
import { TechSpecsCard } from './TechSpecsCard'
import { HistoryCard } from './HistoryCard'
import { DocumentsTab } from './DocumentsTab'
import { AssignmentCardMobile } from './AssignmentCardMobile'
import { LocationCard } from './LocationCard'
import { RepairCard } from './RepairCard'
import { WriteOffModal } from './WriteOffModal'
import { LabelPreviewDialog } from '@/components/features/assets/label/LabelPreviewDialog'

// Mirrors the same shape in AssetDetailPage — structural typing keeps them compatible.
interface ActRecord {
  id: string
  name: string
  date: string
  path: string
}

export interface AssetDetailMobileViewProps {
  asset: Asset
  category: CategoryRow | null
  statusRow: StatusRow
  caps: CategoryCapabilities | null
  refData: AssetReferenceData
  acts: ActRecord[]
  historyEvents: HistoryEventVM[]
  licenses: WorkstationLicense[]
  licensePool: { id: string; name: string; vendor: string | null }[]
  hasSpecsFlag: boolean
  canWriteOff: boolean
  canAssign: boolean
  canRepair: boolean
  isDisposed: boolean
  canManageLicense: boolean
  busy: boolean
  actionError: string | null
  transferOpen: boolean
  writeOffOpen: boolean
  printing: boolean
  onOpenTransfer: () => void
  onCloseTransfer: () => void
  onTransfer: (patch: TransferPatch) => void
  onWriteOff: () => void
  onCloseWriteOff: () => void
  onConfirmWriteOff: (reason: string) => void
  onSendToRepair: (reason: string) => void
  onReturnFromRepair: () => void
  onOpenScan: (path: string) => void
  onAttachLicense: (choice: AttachChoice) => Promise<void>
  /** Present only when asset.barcode exists — wires «Печать наклейки» in the hero. */
  onPrint?: () => void
  onClosePrint: () => void
}

/**
 * Full mobile layout for the Asset Detail page (≤767px).
 *
 * Architecture note: AssetDetailPage calls useIsMobile() and returns this component
 * early when isMobile=true. The desktop JSX below that guard is byte-identical to the
 * original. All data + handlers are passed as typed props — no Firebase imports here.
 *
 * Layout order (matches prototype _asset_detail_mobile_decoded.html §588–987):
 *   ① Hero card
 *   ② Sticky tab strip (Тех.хар. / История / Документы)
 *   ③ Tab body (TechSpecsCard | HistoryCard | DocumentsTab)
 *   ④ Назначение  ⑤ Местонахождение  ⑥ Ремонт — hidden when Historia tab active
 */
export function AssetDetailMobileView({
  asset,
  category,
  statusRow,
  caps,
  refData,
  acts,
  historyEvents,
  licenses,
  licensePool,
  hasSpecsFlag,
  canWriteOff,
  canAssign,
  canRepair,
  isDisposed,
  canManageLicense,
  busy,
  actionError,
  transferOpen: _transferOpen,
  writeOffOpen,
  printing,
  onOpenTransfer: _onOpenTransfer,
  onCloseTransfer: _onCloseTransfer,
  onTransfer,
  onWriteOff,
  onCloseWriteOff,
  onConfirmWriteOff,
  onSendToRepair,
  onReturnFromRepair,
  onOpenScan,
  onAttachLicense,
  onPrint,
  onClosePrint,
}: AssetDetailMobileViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('specs')

  // Normalize: if the category has no spec tiles, fall back to история tab.
  // Mirrors the same effect in AssetDetailPage (desktop branch).
  useEffect(() => {
    if (!hasSpecsFlag && activeTab === 'specs') setActiveTab('history')
  }, [hasSpecsFlag, activeTab])

  // Bottom sections (Назначение / Местонахождение / Ремонт) show ONLY on the
  // «Тех. характеристики» tab — hidden on both История and Документы.
  const showBottomSections = activeTab === 'specs'

  return (
    /*
     * Viewport-locked column: the topbar (52px) + bottom nav (64px) frame the
     * page, so the view fills the remaining height and ONLY its inner region
     * scrolls — the hero + tab strip stay fixed (prototype behaviour). This
     * component renders on mobile only, so no max-md gating is needed.
     */
    <div className="flex flex-col h-[calc(100dvh-128px)] overflow-hidden">
      {/* Action error banner */}
      {actionError && (
        <p role="alert" className="mx-3.5 mt-2 text-[12px] text-rose-300 px-1 flex-shrink-0">
          {actionError}
        </p>
      )}

      {/* ① HERO — fixed (does not scroll) */}
      <div className="px-3.5 pt-1 flex-shrink-0">
        <DetailHeroMobile
          asset={asset}
          category={category}
          statusRow={statusRow}
          canWriteOff={canWriteOff && !isDisposed}
          isDisposed={isDisposed}
          onWriteOff={onWriteOff}
          {...(onPrint ? { onPrint } : {})}
        />
      </div>

      {/* ② TABS — fixed */}
      <div className="mt-3 flex-shrink-0">
        <DetailTabs
          active={activeTab}
          onChange={setActiveTab}
          showSpecs={hasSpecsFlag}
          showDocs={true}
          addedDate={null}
        />
      </div>

      {/* ③ SCROLL REGION — the only scroller: tab body + bottom sections */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
          className="px-3.5 pt-3"
        >
          {activeTab === 'specs' && (
            <TechSpecsCard
              asset={asset}
              licenses={licenses}
              hasOemLicenseCap={Boolean(caps?.hasOemLicense)}
              canManageLicense={canManageLicense}
              onAttachLicense={onAttachLicense}
              licensePool={licensePool}
              licenseBusy={busy}
              bare
            />
          )}
          {activeTab === 'history' && <HistoryCard events={historyEvents} mobileBare />}
          {activeTab === 'docs' && (
            <DocumentsTab
              acts={acts}
              onOpen={onOpenScan}
              purchaseDate={asset.purchaseDate ?? null}
              warrantyEndsAt={asset.warrantyEndsAt ?? null}
            />
          )}
        </div>

        {/* ④ ⑤ ⑥ BOTTOM SECTIONS — only on «Тех. характеристики» */}
        {showBottomSections && (
          <div className="px-3.5 pb-6 space-y-2.5 mt-3">
            {/* ④ НАЗНАЧЕНИЕ — mobile-only inline-always-open card (prototype §857–931) */}
            <AssignmentCardMobile
              asset={asset}
              refData={refData}
              caps={caps}
              canAssign={canAssign && !isDisposed}
              busy={busy}
              onCommit={onTransfer}
            />

            {/* ⑤ МЕСТОНАХОЖДЕНИЕ */}
            <LocationCard asset={asset} refData={refData} />

            {/* ⑥ РЕМОНТ — RepairCard returns null when canRepair=false */}
            <RepairCard
              asset={asset}
              canRepair={canRepair && !isDisposed}
              busy={busy}
              onSendToRepair={onSendToRepair}
              onReturnFromRepair={onReturnFromRepair}
            />
          </div>
        )}
      </div>

      {/* Write-off modal (portal) */}
      {writeOffOpen && (
        <WriteOffModal
          asset={asset}
          busy={busy}
          onClose={onCloseWriteOff}
          onConfirm={onConfirmWriteOff}
        />
      )}

      {/* Label preview dialog (portal) */}
      {printing && asset.barcode && (
        <LabelPreviewDialog assets={[asset]} onClose={onClosePrint} />
      )}
    </div>
  )
}
