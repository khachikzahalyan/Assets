import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon, ErrorState } from '@/components/ui'
import {
  StatTile,
  WarehouseTab,
  DevicesTab,
  InstallModal,
  UninstallModal,
  GpuAddModal,
  ServiceRecordModal,
  PartsTabsHeader,
} from '@/components/features/parts'
import { useParts } from '@/hooks/useParts'
import type { Part, PartsAsset, UpgradeSlot } from '@/domain/part/types'
import { workingStock, deriveStock } from '@/domain/part/partStock'
import type { PartRepository, PartWriteRepository } from '@/domain/part/PartRepository'
import { getSharedPartRepository } from '@/infra/repositories'
import { buildPartCatMeta, buildCategoryTint, buildComponentOrder, groupSkusByCategoryDef } from '@/components/features/parts/partsTokens'
import { PartsPageSkeleton } from './PartsPageSkeleton'

type ActiveTab = 'warehouse' | 'devices'

export interface PartsPageProps {
  /** Injected repo — for tests. Production callers omit this; the page uses the singleton. */
  repository?: PartRepository & PartWriteRepository
}

/**
 * PartsPage — the /parts route page.
 *
 * Shell layout (prototype parity):
 *   - stat-strip (4-tile grid, always visible) + tab-strip + inline add-button
 *   - Tab order: «Устройства» (devices) first, «Склад» (warehouse) second.
 *   - Default active tab: devices ('warehouse' only when ?tab=warehouse is set).
 *   - Active tab: white text + orange bottom underline (not orange text).
 *   - Mobile FAB: fixed round «+» button centred at bottom, max-md only.
 *
 * Composes WarehouseTab, DevicesTab, and all the write modals.
 */
export function PartsPage({ repository }: PartsPageProps = {}) {
  const { t, i18n } = useTranslation('parts')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // URL-driven focus: /parts?tab=devices&assetId=<id>
  // Read once on mount — stable values used only as initializers below.
  const urlTab = searchParams.get('tab')
  const urlAssetId = searchParams.get('assetId')

  const repo = repository ?? getSharedPartRepository()

  const { ref, partCategories, loading, error, reload, installPart, uninstallPart, recordService, createModelSku } = useParts(repo)

  // Localize helper — uses i18n.language with ru fallback
  const localizeName = useCallback(
    (name: { ru: string; en: string; hy: string }) =>
      name[i18n.language as 'ru' | 'en' | 'hy'] ?? name.ru,
    [i18n.language],
  )

  const partCatMeta = useMemo(
    () => buildPartCatMeta(partCategories, localizeName),
    [partCategories, localizeName],
  )

  const categoryTints = useMemo(
    () => buildCategoryTint(partCategories),
    [partCategories],
  )

  const componentOrder = useMemo(
    () => buildComponentOrder(partCategories),
    [partCategories],
  )
  // componentOrder is available for future consumers (e.g. DevicesTab installed-row sorting)
  void componentOrder

  const [activeTab, setActiveTab] = useState<ActiveTab>(
    urlTab === 'warehouse' ? 'warehouse' : 'devices',
  )
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )

  // ── Lifted state (T2) ───────────────────────────────────────────────────────
  // Warehouse category selection — lifted so PartsTabsHeader can drive the chip strip.
  const [selectedCatId, setSelectedCatId] = useState<string>(
    partCatMeta[0]?.id ?? 'psu',
  )
  // Device search — lifted so PartsTabsHeader row-2 can own the input on mobile.
  const [deviceSearch, setDeviceSearch] = useState('')

  // Sync isMobile on resize
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [gpuModalOpen, setGpuModalOpen] = useState(false)

  // InstallModal: triggered from WarehouseTab (via a SKU) or DevicesTab (via an asset)
  const [installModalSku, setInstallModalSku] = useState<Part | null>(null)

  // UninstallModal: triggered from InstalledDetailPanel with a specific slot
  const [uninstallTarget, setUninstallTarget] = useState<{
    sku: Part | null
    asset: PartsAsset | null
    slot: UpgradeSlot | null
  }>({ sku: null, asset: null, slot: null })

  // ServiceRecordModal: for service devices
  const [serviceAsset, setServiceAsset] = useState<PartsAsset | null>(null)

  // ── Error banner (write failures) ───────────────────────────────────────────
  const [writeError, setWriteError] = useState<string | null>(null)

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  // ── Derived stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!ref) return { onHand: 0, installed: 0, broken: 0, devices: 0 }

    const stockMap = deriveStock(ref.movements)
    let totalOnHand = 0
    let totalBroken = 0

    for (const sku of ref.parts) {
      const s = stockMap[sku.id] ?? { onHand: 0, broken: 0 }
      totalOnHand += workingStock(s)
      totalBroken += s.broken
    }

    // Installed = sum of install movements - uninstall movements (net installed count)
    const installMap: Record<string, number> = {}
    for (const m of ref.movements) {
      if (m.serviceReplace) continue
      if (!m.skuId) continue
      if (m.type === 'install') installMap[m.skuId] = (installMap[m.skuId] ?? 0) + (m.qty ?? 1)
      else if (m.type === 'uninstall') installMap[m.skuId] = (installMap[m.skuId] ?? 0) - (m.qty ?? 1)
    }
    const installed = Math.max(0, Object.values(installMap).reduce((s, v) => s + Math.max(0, v), 0))

    return {
      onHand: totalOnHand,
      installed,
      broken: totalBroken,
      devices: ref.partsAssets.length,
    }
  }, [ref])

  // ── Stock map for UninstallModal flow preview ────────────────────────────────
  const stockMap = useMemo(
    () => (ref ? deriveStock(ref.movements) : {}),
    [ref],
  )

  // ── SKUs grouped by category — computed before early returns so it can be
  //    passed to PartsTabsHeader (for the mobile CategoryChipStrip) ──────────
  const skusByCategory = useMemo(
    () => groupSkusByCategoryDef(ref?.parts ?? [], partCategories),
    [ref, partCategories],
  )

  // ── Install handler ──────────────────────────────────────────────────────────
  const handleInstallSku = useCallback((sku: Part) => {
    setInstallModalSku(sku)
  }, [])

  const handleInstallConfirm = useCallback(async (input: Parameters<typeof installPart>[0]) => {
    setWriteError(null)
    try {
      await installPart(input)
      setToast(t('toast.installed', { name: installModalSku?.name ?? input.skuId, assetCode: input.assetInvCode }))
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : t('installModal.errorFailed'))
    } finally {
      setInstallModalSku(null)
    }
  }, [installPart, t, installModalSku])

  // ── Uninstall handler ────────────────────────────────────────────────────────
  const handleUninstall = useCallback((asset: PartsAsset, slot: UpgradeSlot, _slotIdx: number) => {
    const matchedSku = ref?.parts.find(p => {
      const specLabel = p.name + (p.variantLabel ? ` ${p.variantLabel}` : '')
      return slot.spec === specLabel || slot.spec.startsWith(p.name)
    }) ?? null
    setUninstallTarget({ sku: matchedSku, asset, slot })
  }, [ref])

  const handleUninstallConfirm = useCallback(async (input: Parameters<typeof uninstallPart>[0]) => {
    setWriteError(null)
    try {
      await uninstallPart(input)
      setToast(t('toast.uninstalled', { name: uninstallTarget.sku?.name ?? input.skuId, assetCode: input.assetInvCode }))
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : t('uninstallModal.errorFailed'))
    } finally {
      setUninstallTarget({ sku: null, asset: null, slot: null })
    }
  }, [uninstallPart, t, uninstallTarget.sku])

  // ── GPU modal open handler (stable for PartCard.memo GPU card) ──────────────
  const handleOpenGpuModal = useCallback(() => setGpuModalOpen(true), [])

  // ── GPU add handler ──────────────────────────────────────────────────────────
  const handleGpuConfirm = useCallback(async (name: string, qty: number) => {
    setWriteError(null)
    try {
      await createModelSku({ categoryId: 'gpu', name, initialQty: qty })
      setToast(t('toast.gpuCreated', { name, qty }))
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : t('gpuModal.errorFailed'))
    }
  }, [createModelSku, t])

  // ── Service record handler ───────────────────────────────────────────────────
  const handleServiceConfirm = useCallback(async (kindId: string, kindLabel: string, note: string | null) => {
    if (!serviceAsset) return
    setWriteError(null)
    try {
      await recordService({
        assetId: serviceAsset.assetId,
        assetInvCode: serviceAsset.id,
        kindId,
        kindLabel,
        note,
      })
      setToast(t('toast.serviced', { kindLabel }))
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : t('serviceModal.errorFailed'))
    } finally {
      setServiceAsset(null)
    }
  }, [recordService, serviceAsset, t])

  if (error && !ref) {
    return (
      <div className="space-y-5">
        <div className="text-text-primary text-xl font-semibold">{t('title')}</div>
        <ErrorState onRetry={reload} />
      </div>
    )
  }

  const parts = ref?.parts ?? []
  const movements = ref?.movements ?? []
  const partsAssets = ref?.partsAssets ?? []

  // Per-SKU stock for UninstallModal: onHand from stockMap
  const uninstallStock = uninstallTarget.sku
    ? { onHand: workingStock(stockMap[uninstallTarget.sku.id] ?? { onHand: 0, broken: 0 }) }
    : undefined

  return (
    /*
     * Page root — desktop: h-full overflow-hidden (pinned strips, inner grid scrolls).
     * Mobile (flush mode): mx-[10px] gutters, flex-1 min-h-0, no own overflow/padding;
     * the shell's .app-shell-content-flush provides 0 side padding + 74px bottom clearance.
     */
    <div className="flex flex-col h-full p-2 gap-3 overflow-hidden max-md:h-auto max-md:overflow-visible max-md:p-0 max-md:gap-0 max-md:mx-[10px] max-md:flex-1 max-md:min-h-0">

      {/* ── HEADER: stat strip + tab strip + row 2 ── */}
      {/*
       * Mobile: card chrome (bg-surface rounded-t-xl border border-border border-b-0)
       * so the header card fuses with the body card below; border-b-0 means the shared
       * border comes from the body card's top-border-0 instead (seamless join).
       */}
      <div className="flex flex-col gap-2.5 flex-shrink-0 max-md:bg-surface max-md:border max-md:border-border max-md:rounded-t-xl max-md:overflow-hidden max-md:border-b-0">
        {/* Stat strip — Desktop: 4-tile grid. Mobile: hidden. */}
        <div className="grid grid-cols-4 gap-2.5 max-md:hidden">
          <StatTile
            tone="emerald"
            icon="inbox"
            label={t('stats.onHand')}
            value={stats.onHand}
            loading={loading}
          />
          <StatTile
            tone="violet"
            icon="wrench"
            label={t('stats.installed')}
            value={stats.installed}
            loading={loading}
          />
          <StatTile
            tone="rose"
            icon="x-octagon"
            label={t('stats.broken')}
            value={stats.broken}
            loading={loading}
          />
          <StatTile
            tone="blue"
            icon="monitor-smartphone"
            label={t('stats.devices')}
            value={stats.devices}
            loading={loading}
          />
        </div>

        {/* Responsive tab strip + row 2 */}
        <PartsTabsHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          devicesCount={partsAssets.length}
          onAdd={() => navigate('/parts/new')}
          deviceSearch={deviceSearch}
          onDeviceSearchChange={setDeviceSearch}
          skusByCategory={skusByCategory}
          selectedCatId={selectedCatId}
          onSelectCat={setSelectedCatId}
          stockMap={stockMap}
          partCategories={partCategories}
          partCatMeta={partCatMeta}
          categoryTints={categoryTints}
        />
      </div>

      {/* Write-error banner — max-md:my-2 so it isn't glued between cards */}
      {writeError && (
        <div
          className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 light:text-rose-700 px-4 py-3 rounded-xl text-[13.5px] flex-shrink-0 max-md:my-2"
          role="alert"
        >
          <Icon name="triangle-alert" size={15} className="flex-shrink-0" />
          <span className="flex-1">{writeError}</span>
          <button
            type="button"
            onClick={() => setWriteError(null)}
            aria-label={t('actions.dismiss')}
            className="p-1 rounded hover:bg-rose-500/20 transition-colors"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      )}

      {/*
       * Tab body — desktop: flex-1 min-h-0 overflow-hidden (inner grid scrolls).
       * Mobile: fused content card (bg-surface rounded-b-xl border border-border
       * border-t-0 — the missing top border fuses with the header card's border-b-0).
       * overflow-visible + flex flex-col flex-1 min-h-0 so inner content can stretch
       * to fill; bottom clearance provided by .app-shell-content-flush (74px).
       */}
      <div className="flex-1 min-h-0 overflow-hidden max-md:overflow-visible max-md:bg-surface max-md:border max-md:border-border max-md:border-t-0 max-md:rounded-b-xl max-md:flex max-md:flex-col max-md:flex-1 max-md:min-h-0">
        {loading ? (
          // Skeleton mirrors whichever tab is active on this load — the URL can pin
          // ?tab=warehouse on reload, so a devices-only skeleton would cause a jump.
          //   devices  (default): 12-col grid — real family pills + real search input +
          //                       shimmer card grid + no-selection InstalledDetailPanel.
          //   warehouse:          master-detail — real category list rows (left) + SKU
          //                       list + history zone (right), local chrome rendered real.
          <PartsPageSkeleton activeTab={activeTab} />
        ) : activeTab === 'warehouse' ? (
          <WarehouseTab
            parts={parts}
            movements={movements}
            isMobile={isMobile}
            onInstall={handleInstallSku}
            onAddGpu={handleOpenGpuModal}
            selectedCatId={selectedCatId}
            onSelectCat={setSelectedCatId}
            partsAssets={partsAssets}
            partCategories={partCategories}
            partCatMeta={partCatMeta}
            categoryTints={categoryTints}
          />
        ) : (
          <DevicesTab
            partsAssets={partsAssets}
            parts={parts}
            movements={movements}
            isMobile={isMobile}
            onUninstall={handleUninstall}
            onService={setServiceAsset}
            initialAssetId={urlAssetId}
            search={deviceSearch}
            onSearchChange={setDeviceSearch}
          />
        )}
      </div>

      {/* ── Modals ── */}
      <InstallModal
        open={installModalSku !== null}
        onClose={() => setInstallModalSku(null)}
        sku={installModalSku}
        partsAssets={partsAssets}
        onConfirm={handleInstallConfirm}
      />

      <UninstallModal
        open={uninstallTarget.asset !== null}
        onClose={() => setUninstallTarget({ sku: null, asset: null, slot: null })}
        sku={uninstallTarget.sku}
        asset={uninstallTarget.asset}
        slot={uninstallTarget.slot}
        {...(uninstallStock !== undefined ? { stock: uninstallStock } : {})}
        onConfirm={handleUninstallConfirm}
      />

      <GpuAddModal
        open={gpuModalOpen}
        onClose={() => setGpuModalOpen(false)}
        onConfirm={handleGpuConfirm}
      />

      {serviceAsset && (
        <ServiceRecordModal
          open={serviceAsset !== null}
          onClose={() => setServiceAsset(null)}
          asset={serviceAsset}
          onConfirm={handleServiceConfirm}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[90]"
          style={{ animation: 'toastSlide 220ms cubic-bezier(.22,1,.36,1) both' }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 bg-surface border border-border text-text-primary px-4 py-3 rounded-xl shadow-xl shadow-black/60 light:shadow-slate-300/60 text-[14px] font-medium max-w-sm">
            <span className="w-5 h-5 rounded-full bg-emerald-500 inline-flex items-center justify-center flex-shrink-0">
              <Icon name="check" size={11} className="text-white" />
            </span>
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
