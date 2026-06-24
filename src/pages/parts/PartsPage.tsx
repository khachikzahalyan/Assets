import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, ErrorState } from '@/components/ui'
import {
  StatTile,
  WarehouseTab,
  DevicesTab,
  InstallModal,
  UninstallModal,
  GpuAddModal,
  ServiceRecordModal,
} from '@/components/features/parts'
import { useParts } from '@/hooks/useParts'
import type { Part, PartsAsset, UpgradeSlot } from '@/domain/part/types'
import { workingStock, deriveStock } from '@/domain/part/partStock'
import type { PartRepository, PartWriteRepository } from '@/domain/part/PartRepository'
import { createDefaultPartRepository } from '@/infra/repositories/factories'

type ActiveTab = 'warehouse' | 'devices'

export interface PartsPageProps {
  /** Injected repo — for tests. Production callers omit this; the page creates the default. */
  repository?: PartRepository & PartWriteRepository
}

/**
 * PartsPage — the /parts route page.
 *
 * Shell layout (prototype parity):
 *   - stat-strip (4-tile grid, always visible) + tab-strip + inline add-button
 *   - Tab order: «Устройства» (devices) first, «Склад» (warehouse) second.
 *   - Default active tab: warehouse.
 *   - Active tab: white text + orange bottom underline (not orange text).
 *   - Mobile FAB: fixed round «+» button centred at bottom, max-md only.
 *
 * Composes WarehouseTab, DevicesTab, and all the write modals.
 */
export function PartsPage({ repository }: PartsPageProps = {}) {
  const { t } = useTranslation('parts')
  const navigate = useNavigate()

  // Composition root: stable default repo; test callers inject their own.
  const defaultRepo = useMemo(
    () => createDefaultPartRepository(),
    // createDefaultPartRepository() wraps db() which is a stable singleton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const { ref, loading, error, reload, installPart, uninstallPart, recordService, createGpu } = useParts(repo)

  const [activeTab, setActiveTab] = useState<ActiveTab>('warehouse')
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )

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

  // ── GPU add handler ──────────────────────────────────────────────────────────
  const handleGpuConfirm = useCallback(async (name: string, qty: number) => {
    setWriteError(null)
    try {
      await createGpu({ name, initialQty: qty })
      setToast(t('toast.gpuCreated', { name, qty }))
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : t('gpuModal.errorFailed'))
    }
  }, [createGpu, t])

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

  // ── Tab config — devices FIRST, warehouse SECOND (prototype order) ───────────
  const TABS: Array<{ id: ActiveTab; labelKey: string; icon: string }> = [
    { id: 'devices', labelKey: 'tabs.devices', icon: 'monitor-smartphone' },
    { id: 'warehouse', labelKey: 'tabs.warehouse', icon: 'package' },
  ]

  // ── Render states ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-full p-2 gap-3 overflow-hidden max-md:overflow-y-auto max-md:overflow-x-hidden max-md:h-auto max-md:p-0 max-md:gap-3" aria-hidden="true">
        {/* Stat strip — REAL icons and REAL labels, shimmer values */}
        <div className="relative grid grid-cols-4 gap-2.5 max-md:grid-cols-2 max-md:gap-[10px] flex-shrink-0">
          {(
            [
              { labelKey: 'stats.onHand',    icon: 'inbox' },
              { labelKey: 'stats.installed', icon: 'wrench' },
              { labelKey: 'stats.broken',    icon: 'x-octagon' },
              { labelKey: 'stats.devices',   icon: 'monitor-smartphone' },
            ] as const
          ).map(({ labelKey, icon }) => (
            <div key={labelKey} className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3">
              <Icon name={icon} size={18} className="text-text-subtle flex-shrink-0 w-8 h-8 flex items-center justify-center" />
              <div className="flex-1 min-w-0 space-y-2">
                <span className="block text-[11px] uppercase tracking-[0.07em] font-semibold text-text-subtle">
                  {t(labelKey)}
                </span>
                <div className="h-[16px] w-[45%] rounded anim-skeleton" />
              </div>
            </div>
          ))}
        </div>

        {/* Tab strip — REAL tab labels + REAL disabled add button */}
        <div className="flex items-center justify-between border-b border-border flex-shrink-0 h-[44px]">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'devices',   labelKey: 'tabs.devices',   icon: 'monitor-smartphone' },
                { id: 'warehouse', labelKey: 'tabs.warehouse', icon: 'package' },
              ] as const
            ).map(({ id, labelKey, icon }) => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-4 py-3 text-[15px] font-semibold text-text-subtle"
              >
                <Icon name={icon} size={14} />
                {t(labelKey)}
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled
            className="mr-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[13.5px] font-semibold opacity-50 cursor-default max-md:hidden"
            aria-label={t('actions.add')}
          >
            <Icon name="plus" size={14} />
            <span>{t('actions.add')}</span>
          </button>
        </div>

        {/* Content region */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
          {/* LEFT — category card list (shimmer — DB data) */}
          <div className="lg:col-span-5 space-y-2 min-h-0">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl min-h-[64px] max-md:min-h-[56px]">
                <div className="w-10 h-10 rounded-lg anim-skeleton flex-shrink-0 max-md:w-7 max-md:h-7" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-[13px] w-[40%] rounded anim-skeleton" />
                  <div className="h-[10px] w-[55%] rounded anim-skeleton" />
                </div>
                <div className="h-[22px] w-[44px] rounded-md anim-skeleton flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* RIGHT — detail/history panel (desktop only) */}
          <div className="hidden lg:flex lg:col-span-7 min-h-0 flex-col bg-surface border border-border rounded-xl overflow-hidden">
            {/* Panel header: icon+title (shimmer — DB: selected category) + qty chip (shimmer) */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
              <div className="w-8 h-8 rounded-lg anim-skeleton flex-shrink-0" />
              <div className="h-[15px] w-[180px] rounded anim-skeleton" />
              <div className="h-[22px] w-[44px] rounded-md anim-skeleton ml-auto flex-shrink-0" />
            </div>
            {/* REAL «История» subheader + summary chips (shimmer — DB: movement counts) */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-shrink-0">
              <span className="text-[11px] uppercase tracking-[0.07em] font-semibold text-text-tertiary">
                {t('warehouse.history')}
              </span>
              <div className="h-[20px] w-[112px] rounded-md anim-skeleton ml-auto" />
              <div className="h-[20px] w-[120px] rounded-md anim-skeleton" />
            </div>
            {/* Filter chips (shimmer) */}
            <div className="flex items-center gap-2 px-5 pt-3 flex-shrink-0">
              <div className="h-[24px] w-[124px] rounded-md anim-skeleton" />
              <div className="h-[24px] w-[110px] rounded-md anim-skeleton" />
            </div>
            {/* History rows (shimmer — DB) */}
            <div className="p-5 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full anim-skeleton flex-shrink-0" />
                  <div className="w-7 h-7 rounded-md anim-skeleton flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-[12px] w-[38%] rounded anim-skeleton" />
                    <div className="h-[10px] w-[56px] rounded anim-skeleton" />
                  </div>
                  <div className="h-[22px] w-[140px] rounded-md anim-skeleton flex-shrink-0" />
                  <div className="h-[11px] w-[82px] rounded anim-skeleton flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
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
     * Page root:
     * Desktop: flex-col h-full p-2 gap-3 overflow-hidden (unchanged)
     * Mobile:  overflow-y-auto overflow-x-hidden h-auto p-0 gap-3 (§11 spec)
     *          width/max-width 100% so stat grid reaches both edges symmetrically
     */
    <div className="flex flex-col h-full p-2 gap-3 overflow-hidden max-md:overflow-y-auto max-md:overflow-x-hidden max-md:h-auto max-md:p-0 max-md:gap-3 max-md:w-full max-md:max-w-full max-md:box-border">
      {/* ── HEADER: stat strip + tab strip + add button ── */}
      <div className="flex flex-col gap-2.5 flex-shrink-0 max-md:w-full max-md:max-w-full max-md:box-border">
        {/*
         * Stat strip — 4 tiles, always visible
         * Desktop: grid-cols-4 gap-2.5 relative
         * Mobile:  grid-cols-2 gap-[10px] relative  (override; prevents sm:grid-cols-4 at 640px)
         *          position:relative is needed for the center FAB absolute positioning
         */}
        <div className="relative grid grid-cols-4 gap-2.5 max-md:grid-cols-2 max-md:gap-[10px] max-md:w-full max-md:max-w-full max-md:box-border">
          <StatTile
            tone="emerald"
            icon="inbox"
            label={t('stats.onHand')}
            value={stats.onHand}
          />
          <StatTile
            tone="violet"
            icon="wrench"
            label={t('stats.installed')}
            value={stats.installed}
          />
          <StatTile
            tone="rose"
            icon="x-octagon"
            label={t('stats.broken')}
            value={stats.broken}
          />
          <StatTile
            tone="blue"
            icon="monitor-smartphone"
            label={t('stats.devices')}
            value={stats.devices}
          />
          {/*
           * Center FAB — mobile only (md:hidden).
           * Sits at the intersection of the 2×2 stat grid (center of the grid's
           * relative container). Ring uses bg token #111315 (var --color-bg).
           * Wired to the SAME navigate('/parts/new') as the desktop add button.
           * §11 spec: 56×56px, radius 50%, orange #F97316, ring shadow 4px bg color.
           */}
          <button
            type="button"
            className="md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-full bg-accent text-white inline-flex items-center justify-center border-0 p-0 cursor-pointer [box-shadow:0_4px_18px_rgba(249,115,22,0.5),0_0_0_4px_#111315] hover:bg-[#EA580C] active:[transform:translate(-50%,-50%)_scale(0.96)]"
            onClick={() => navigate('/parts/new')}
            aria-label={t('actions.add')}
          >
            <Icon name="plus" size={22} />
          </button>
        </div>

        {/* Tab strip + inline add-button on the same border-b line */}
        <div className="flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-1" role="tablist">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-3 text-[15px] font-semibold transition-all relative
                    ${isActive
                      ? 'text-text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-accent after:rounded-t'
                      : 'text-text-subtle hover:text-text-tertiary hover:bg-surface-2/50'}`}
                >
                  <Icon name={tab.icon} size={14} />
                  {t(tab.labelKey)}
                  {tab.id === 'devices' && partsAssets.length > 0 && (
                    <span
                      className={`ml-0.5 px-1.5 rounded text-[12.5px] tabular-nums ${
                        isActive ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-text-subtle'
                      }`}
                    >
                      {partsAssets.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {/*
           * Desktop inline add button.
           * Hidden on mobile via max-md:hidden (Tailwind, replaces the isMobile JS flag).
           * The center FAB in the stat grid handles add on mobile.
           */}
          <button
            type="button"
            onClick={() => navigate('/parts/new')}
            className="mr-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-white text-[13.5px] font-semibold transition-colors max-md:hidden"
            aria-label={t('actions.add')}
          >
            <Icon name="plus" size={14} />
            <span>{t('actions.add')}</span>
          </button>
        </div>
      </div>

      {/* Write-error banner */}
      {writeError && (
        <div
          className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-[13.5px] flex-shrink-0"
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

      {/* Tab body — mobile: height auto (no flex-1 overflow-hidden clamping) */}
      <div className="flex-1 min-h-0 overflow-hidden max-md:flex-none max-md:min-h-0 max-md:overflow-visible">
        {activeTab === 'warehouse' && (
          <WarehouseTab
            parts={parts}
            movements={movements}
            isMobile={isMobile}
            onInstall={handleInstallSku}
            onAddGpu={() => setGpuModalOpen(true)}
          />
        )}

        {activeTab === 'devices' && (
          <DevicesTab
            partsAssets={partsAssets}
            parts={parts}
            movements={movements}
            isMobile={isMobile}
            onUninstall={handleUninstall}
            onService={setServiceAsset}
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
        stock={uninstallStock}
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
          <div className="flex items-center gap-2.5 bg-surface border border-border text-text-primary px-4 py-3 rounded-xl shadow-xl shadow-black/60 text-[14px] font-medium max-w-sm">
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
