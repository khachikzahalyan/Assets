import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DetailHero } from '@/components/features/assets/detail/DetailHero'
import { DetailTabs, type TabId } from '@/components/features/assets/detail/DetailTabs'
import { TechSpecsCard } from '@/components/features/assets/detail/TechSpecsCard'
import { HistoryCard } from '@/components/features/assets/detail/HistoryCard'
import { DocumentsTab } from '@/components/features/assets/detail/DocumentsTab'
import { LocationCard } from '@/components/features/assets/detail/LocationCard'
import { AssignmentCard } from '@/components/features/assets/detail/AssignmentCard'
import { RepairCard } from '@/components/features/assets/detail/RepairCard'
import { WriteOffModal } from '@/components/features/assets/detail/WriteOffModal'
import { LabelPreviewDialog } from '@/components/features/assets/label/LabelPreviewDialog'
import type {
  Asset,
  AssetReferenceData,
  CategoryRow,
  StatusRow,
} from '@/domain/asset'
import type { TransferPatch } from '@/domain/asset/transferRules'
import type { WorkstationLicense } from '@/domain/license'
import type { AttachChoice } from '@/components/features/assets/detail/LicenseBlock'
import type { HistoryEventVM } from '@/components/features/assets/detail/detailFormat'
import type { CategoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import type { ActRecord } from './useAssetDetail'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AssetDetailDesktopViewProps {
  asset: Asset
  category: CategoryRow | null
  statusRow: StatusRow
  caps: CategoryCapabilities | null
  refData: AssetReferenceData
  acts: ActRecord[]
  historyEvents: HistoryEventVM[]
  licenses: WorkstationLicense[]
  decoupledLicenses: WorkstationLicense[]
  retiredWithAssetLicenses: WorkstationLicense[]
  licensePool: { id: string; name: string; vendor: string | null }[]
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  transferOpen: boolean
  setTransferOpen: (v: boolean) => void
  writeOffOpen: boolean
  setWriteOffOpen: (v: boolean) => void
  busy: boolean
  printing: boolean
  setPrinting: (v: boolean) => void
  actionError: string | null
  canRepair: boolean
  canAssign: boolean
  canWriteOff: boolean
  isDisposed: boolean
  canManageLicense: boolean
  hasSpecsFlag: boolean
  onTransfer: (patch: TransferPatch) => Promise<void>
  onSendToRepair: (reason: string) => Promise<void>
  onReturnFromRepair: () => Promise<void>
  onOpenWriteOff: () => void
  onConfirmWriteOff: (reason: string) => Promise<void>
  onOpenScan: (path: string) => void
  onAttachLicense: (choice: AttachChoice) => Promise<void>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssetDetailDesktopView({
  asset, category, statusRow, caps, refData,
  acts, historyEvents, licenses, decoupledLicenses, retiredWithAssetLicenses, licensePool,
  activeTab, setActiveTab,
  transferOpen, setTransferOpen,
  writeOffOpen, setWriteOffOpen,
  busy, printing, setPrinting,
  actionError,
  canRepair, canAssign, canWriteOff, isDisposed, canManageLicense, hasSpecsFlag,
  onTransfer, onSendToRepair, onReturnFromRepair,
  onOpenWriteOff, onConfirmWriteOff, onOpenScan, onAttachLicense,
}: AssetDetailDesktopViewProps) {
  const { t } = useTranslation('assets')
  const navigate = useNavigate()

  // Tab body visibility — mirrors hasSpecsFlag computed above (used by the effect).
  const showSpecs = hasSpecsFlag

  // Derive creation date from history events (the event with kind === 'created')
  const creationEvent = historyEvents.find(ev => ev.kind === 'created')
  const addedDate = creationEvent?.date ?? asset.updatedAt

  return (
    <>
      {/* lg: fill .app-shell-content height so the page never causes a page scrollbar.
          Mobile: natural block flow unchanged (no fixed heights). */}
      <div className="lg:h-full lg:flex lg:flex-col lg:min-h-0">
      {/* Action error banner */}
      {actionError && (
        <p role="alert" className="mb-3 text-[12px] text-[#FDA4AF] px-1">{actionError}</p>
      )}

      {/*
       * Two-column layout on large screens (lg:grid-cols-3, left=col-span-2).
       *
       * LEFT COLUMN  (lg:col-span-2): hero block → tabs.  Always contiguous
       *   with a 10px gap.  Completely independent of the right column.
       *
       * RIGHT COLUMN (lg:col-span-1): AssignmentCard → LocationCard → RepairCard.
       *   The AssignmentCard wrapper has lg:min-h-[155px] + flex-col + [&>*]:flex-1
       *   so it stretches to match the hero block's idle height (N=155px).
       *   When the transfer panel opens, AssignmentCard grows freely below 155px
       *   in its own column — the left column is completely unaffected.
       *
       * N=155px derivation: hero card ≈106px (4px accent bar + 1px top border +
       *   24px pt + ~101px content, border-b-0) + print bar ≈49px (py-2.5=20px +
       *   h-7 btn=28px + 1px bottom border) = 155px.  AssignmentCard idle ≈151px,
       *   stretches 4px via flex-1 to meet N.
       *
       * Mobile (single column): DOM order gives hero → tabs → assignment →
       *   location → repair naturally — no order classes needed.
       */}
      {/* Grid: on lg: fills remaining height (flex-1) and stretches columns to row height */}
      <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-x-5 gap-y-[10px] max-md:gap-y-3 items-start lg:items-stretch lg:flex-1 lg:min-h-0">

        {/* ---------------------------------------------------------------- */}
        {/* LEFT COLUMN — hero block + tabs (lg:col-span-2)                 */}
        {/* space-y-[10px] keeps the 10px hero↔tabs gap on all breakpoints  */}
        {/* ---------------------------------------------------------------- */}
        {/* Left column: flex-col so hero stays fixed and tab area fills remaining height */}
        <div className="lg:col-span-2 space-y-[10px] lg:flex lg:flex-col lg:min-h-0">

          {/* Hero block — hugs its own content (~108px). The print action now
              lives inside the hero cluster (no bottom bar), so we no longer
              reserve extra height here; the 10px gap to the tabs stays exact. */}
          <div className="flex flex-col lg:flex-shrink-0">
            <DetailHero
              asset={asset}
              category={category}
              statusRow={statusRow}
              canWriteOff={canWriteOff && !isDisposed}
              isDisposed={isDisposed}
              onWriteOff={onOpenWriteOff}
              roundedBottom
              {...(asset.barcode ? { onPrint: () => setPrinting(true) } : {})}
            />
          </div>

          {/* Tab strip + Tab body: fills remaining left-column height on lg: */}
          <div className="space-y-0 lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
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
              className={`bg-surface rounded-b-2xl border-x border-b border-border px-5 sm:px-6 py-5 max-md:px-4 max-md:py-4${
                // Only История needs to fill + scroll internally (it can be long).
                // Specs/Docs keep their natural height — no flex stretch.
                activeTab === 'history' ? ' lg:flex-1 lg:min-h-0 lg:overflow-y-auto' : ''
              }`}
            >
              {activeTab === 'specs' && (
                <div className="space-y-5">
                  {(caps?.hasSpecs || caps?.hasOemLicense || licenses.length > 0 || decoupledLicenses.length > 0 || retiredWithAssetLicenses.length > 0) ? (
                    <TechSpecsCard
                      asset={asset}
                      licenses={licenses}
                      decoupledLicenses={decoupledLicenses}
                      retiredWithAssetLicenses={retiredWithAssetLicenses}
                      hasOemLicenseCap={Boolean(caps?.hasOemLicense)}
                      canManageLicense={canManageLicense}
                      onAttachLicense={onAttachLicense}
                      licensePool={licensePool}
                      licenseBusy={busy}
                      onOpenParts={() => navigate(`/parts?tab=devices&assetId=${asset.id}`)}
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
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* RIGHT COLUMN — AssignmentCard, LocationCard, RepairCard          */}
        {/* (lg:col-span-1, stacked with space-y-2)                          */}
        {/* AssignmentCard wrapper: lg:min-h-[155px] + [&>*]:flex-1 →        */}
        {/*   card stretches to N in idle, grows freely when transfer opens.  */}
        {/* ---------------------------------------------------------------- */}
        {/* Right column: internal scroll if sidebar grows taller than viewport (e.g. transfer panel) */}
        <div className="space-y-2 lg:min-h-0 lg:overflow-y-auto">

          {/* AssignmentCard — min-height for idle bottom-alignment with hero */}
          <div className="lg:min-h-[155px] flex flex-col [&>*]:flex-1">
            {refData && (
              <AssignmentCard
                asset={asset}
                refData={refData}
                caps={caps}
                canAssign={canAssign && !isDisposed}
                busy={busy}
                transferOpen={transferOpen}
                onOpenTransfer={() => setTransferOpen(true)}
                onCloseTransfer={() => setTransferOpen(false)}
                onCommit={onTransfer}
              />
            )}
          </div>

          {/* Location card */}
          {refData && (
            <LocationCard asset={asset} refData={refData} />
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
      </div>{/* /lg:h-full flex wrapper */}

      {/* Write-off modal — portal */}
      {writeOffOpen && (
        <WriteOffModal
          asset={asset}
          busy={busy}
          onClose={() => setWriteOffOpen(false)}
          onConfirm={onConfirmWriteOff}
        />
      )}

      {/* Label preview dialog — portal */}
      {printing && asset.barcode && (
        <LabelPreviewDialog assets={[asset]} onClose={() => setPrinting(false)} />
      )}
    </>
  )
}
