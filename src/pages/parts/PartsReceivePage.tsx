import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icon, ErrorState, Chip } from '@/components/ui'
import { StatTile, PartsReceiveMobileForm } from '@/components/features/parts'
import { PART_CATEGORY_META, categoryTint, variantRank } from '@/components/features/parts/partsTokens'
import { useParts } from '@/hooks/useParts'
import { useIsMobile } from '@/hooks/useIsMobile'
import { workingStock, deriveStock } from '@/domain/part/partStock'
import type { Part } from '@/domain/part/types'
import type { PartRepository, PartWriteRepository } from '@/domain/part/PartRepository'
import { createDefaultPartRepository } from '@/infra/repositories/factories'

export interface PartsReceivePageProps {
  /** Injected repo — for tests. Production callers omit this; the page creates the default. */
  repository?: PartRepository & PartWriteRepository
}

/**
 * PartsReceivePage — the /parts/new route page.
 *
 * Full-page receive-stock form. Mirrors AddPartModal logic but lives on its own
 * route so the user gets a proper URL, browser history, and full-width layout.
 * Category sections + SKU qty cards + DDR filter for RAM.
 * On submit: receiveParts() → navigate('/parts').
 * On cancel: navigate('/parts').
 */
export function PartsReceivePage({ repository }: PartsReceivePageProps = {}) {
  const { t } = useTranslation('parts')
  const navigate = useNavigate()

  const defaultRepo = useMemo(
    () => createDefaultPartRepository(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const { ref, loading, error, reload, receiveParts } = useParts(repo)
  const isMobile = useIsMobile()

  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [ramDdr, setRamDdr] = useState('DDR4')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleCancel = useCallback(() => {
    navigate('/parts')
  }, [navigate])

  const bumpQty = useCallback((skuId: string, delta: number) => {
    setQtys(prev => {
      const cur = parseInt(prev[skuId] ?? '0', 10) || 0
      const next = Math.max(0, cur + delta)
      return { ...prev, [skuId]: next === 0 ? '' : String(next) }
    })
  }, [])

  const parts = ref?.parts ?? []

  // Stat strip values — mirrors PartsPage (НА СКЛАДЕ / УСТАНОВЛЕНО / НЕИСПРАВНЫХ / УСТРОЙСТВ)
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
    const installMap: Record<string, number> = {}
    for (const m of ref.movements) {
      if (m.serviceReplace || !m.skuId) continue
      if (m.type === 'install') installMap[m.skuId] = (installMap[m.skuId] ?? 0) + (m.qty ?? 1)
      else if (m.type === 'uninstall') installMap[m.skuId] = (installMap[m.skuId] ?? 0) - (m.qty ?? 1)
    }
    const installed = Math.max(0, Object.values(installMap).reduce((s, v) => s + Math.max(0, v), 0))
    return { onHand: totalOnHand, installed, broken: totalBroken, devices: ref.partsAssets.length }
  }, [ref])

  // Derived totals
  const totalQty = useMemo(
    () => Object.values(qtys).reduce((a, v) => a + (parseInt(v, 10) || 0), 0),
    [qtys],
  )
  const itemsCount = useMemo(
    () => Object.values(qtys).filter(v => (parseInt(v, 10) || 0) > 0).length,
    [qtys],
  )
  const canSubmit = totalQty > 0

  const handleSubmit = useCallback(async () => {
    const items = parts
      .map(p => ({ skuId: p.id, qty: parseInt(qtys[p.id] ?? '0', 10) || 0 }))
      .filter(i => i.qty > 0)

    if (items.length === 0) {
      setSubmitError(t('addModal.errorNoQty'))
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await receiveParts(items)
      navigate('/parts')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('addModal.errorFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [parts, qtys, receiveParts, navigate, t])

  // Group parts by category — preserve PART_CATEGORY_META order
  const partsByCategory = useMemo(() => {
    const map: Record<string, Part[]> = {}
    for (const cat of PART_CATEGORY_META) {
      map[cat.id] = []
    }
    for (const p of parts) {
      if (p.category in map) {
        map[p.category]!.push(p)
      }
    }
    return map
  }, [parts])

  // Render a single category section
  const renderSection = (catId: string) => {
    const cat = PART_CATEGORY_META.find(c => c.id === catId)
    if (!cat) return null

    const catParts = partsByCategory[catId] ?? []
    if (catParts.length === 0) return null

    const isRam = catId === 'ram'
    const visibleParts = (isRam ? catParts.filter(p => p.ddr === ramDdr) : catParts)
      .slice()
      .sort((a, b) => variantRank(catId, a.variantId) - variantRank(catId, b.variantId))
    const tint = categoryTint(catId)

    return (
      <section key={catId}>
        {/* Section header */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`w-7 h-7 rounded-lg ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
            <Icon name={cat.icon} size={13} />
          </span>
          <h2 className="text-[14.5px] font-bold text-text-primary">{cat.label}</h2>
          {/* RAM DDR filter pills */}
          {isRam && (
            <div className="flex items-center gap-1">
              {['DDR3', 'DDR4', 'DDR5'].map(ddr => (
                <button
                  key={ddr}
                  type="button"
                  onClick={() => setRamDdr(ddr)}
                  className={`px-2.5 h-6 rounded-full text-[13px] font-semibold transition-all border
                    ${ramDdr === ddr
                      ? 'bg-accent border-accent text-white shadow-sm shadow-[#FB923C]/40'
                      : 'bg-surface border-border text-text-tertiary hover:border-border-strong hover:text-text-secondary'}`}
                >
                  {ddr}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 h-px bg-border" />
          <span className="text-[13px] text-text-subtle tabular-nums">{visibleParts.length} {t('addModal.positions')}</span>
        </div>

        {/* SKU card grid — full page width, same card size as modal */}
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
        >
          {visibleParts.map(p => {
            const qtyRaw = qtys[p.id]
            const qtyValue = qtyRaw == null ? '' : qtyRaw
            const qtyNum = parseInt(qtyValue, 10) || 0
            const isActive = qtyNum > 0
            const sizeLabel = p.variantLabel || p.name

            return (
              <div
                key={p.id}
                className={`bg-surface border rounded-lg p-2 transition-all
                  ${isActive
                    ? 'border-accent shadow-sm shadow-[#FB923C]/40'
                    : 'border-border hover:border-border-strong'}`}
              >
                {/* Top row: size label + onHand chip */}
                <div className="flex items-center justify-between gap-2 mb-1.5 min-w-0">
                  <span className="font-mono text-[14px] font-semibold text-text-primary truncate">{sizeLabel}</span>
                  <span className="flex-shrink-0" title={`${t('addModal.inStock')}: ${p.onHand}`}>
                    <Chip color="gray" size="sm">{p.onHand}</Chip>
                  </span>
                </div>
                {/* Qty stepper */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => bumpQty(p.id, -1)}
                    disabled={qtyNum <= 0}
                    aria-label={t('addModal.decrease')}
                    className="w-7 h-7 rounded-md border border-border text-text-tertiary hover:bg-bg disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center flex-shrink-0"
                  >
                    <Icon name="minus" size={12} />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={qtyValue}
                    onChange={e => setQtys(q => ({ ...q, [p.id]: e.target.value.replace(/[^\d]/g, '') }))}
                    aria-label={`${p.name} ${t('addModal.qty')}`}
                    placeholder="0"
                    className={`flex-1 h-7 px-1 text-center text-[15px] font-semibold rounded-md tabular-nums min-w-0 focus:outline-none transition-colors
                      ${isActive
                        ? 'bg-[#F97316]/10 border border-accent text-accent focus:border-accent'
                        : 'bg-bg border border-border text-text-secondary focus:border-accent'}`}
                  />
                  <button
                    type="button"
                    onClick={() => bumpQty(p.id, +1)}
                    aria-label={t('addModal.increase')}
                    className="w-7 h-7 rounded-md border border-border text-text-tertiary hover:bg-bg inline-flex items-center justify-center flex-shrink-0"
                  >
                    <Icon name="plus" size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  // Build visible category list (no GPU — GPU uses GpuAddModal flow on PartsPage)
  const visibleCats = PART_CATEGORY_META
    .filter(cat => cat.id !== 'gpu')
    .filter(cat => (partsByCategory[cat.id] ?? []).length > 0)

  // Pair small sections (≤2 SKUs) side-by-side; large sections go full-width
  const buildSectionElements = () => {
    const elements: React.ReactNode[] = []
    let i = 0
    while (i < visibleCats.length) {
      const cur = visibleCats[i]!
      const next = visibleCats[i + 1]
      const curSmall = (partsByCategory[cur.id] ?? []).length <= 2
      const nextSmall = next ? (partsByCategory[next.id] ?? []).length <= 2 : false

      if (curSmall && nextSmall && next) {
        elements.push(
          <div key={`pair_${i}`} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderSection(cur.id)}
            {renderSection(next.id)}
          </div>
        )
        i += 2
      } else {
        elements.push(renderSection(cur.id))
        i += 1
      }
    }
    return elements
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      /*
       * PartsReceive skeleton — mirrors real layout:
       *   Back-button stub + stat strip (4 tiles, always 4-col) + form card skeleton
       */
      <div className="flex flex-col h-full gap-2.5" aria-hidden="true">
        <div className="flex-shrink-0 space-y-2.5">
          {/* Back-button stub */}
          <div className="h-[20px] w-[80px] rounded anim-skeleton" />
          {/* Stat strip — 4 cols desktop, 2 cols mobile */}
          <div className="grid grid-cols-4 max-md:grid-cols-2 gap-2.5 max-md:gap-[10px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg anim-skeleton flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-[10px] w-[60%] rounded anim-skeleton" />
                  <div className="h-[16px] w-[45%] rounded anim-skeleton" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Form area skeleton */}
        <div className="flex-1 min-h-0 rounded-xl bg-surface-2 px-4 py-3 space-y-3">
          {Array.from({ length: 3 }).map((_, s) => (
            <div key={s} className="space-y-2">
              {/* Section header: icon + title */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg anim-skeleton flex-shrink-0" />
                <div className="h-[14px] w-[25%] rounded anim-skeleton" />
                <div className="flex-1 h-px bg-border" />
              </div>
              {/* SKU cards row */}
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                {Array.from({ length: 4 }).map((__, c) => (
                  <div key={c} className="bg-surface border border-border rounded-lg p-2 space-y-2">
                    <div className="h-[14px] w-[60%] rounded anim-skeleton" />
                    <div className="h-[28px] rounded-md anim-skeleton" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-5">
        <ErrorState onRetry={reload} />
      </div>
    )
  }

  // ── Mobile branch (≤767px) ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <PartsReceiveMobileForm
        partsByCategory={partsByCategory}
        visibleCats={visibleCats}
        qtys={qtys}
        bumpQty={bumpQty}
        ramDdr={ramDdr}
        setRamDdr={setRamDdr}
        totalQty={totalQty}
        canSubmit={canSubmit}
        submitting={submitting}
        submitError={submitError}
        onDismissError={() => setSubmitError(null)}
        onSubmit={() => { void handleSubmit() }}
        onCancel={handleCancel}
      />
    )
  }

  // ── Desktop branch (≥768px — unchanged) ─────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-2.5">
      {/* Fixed top: back button + stat strip (do not scroll) */}
      <div className="flex-shrink-0 space-y-2.5">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-tertiary hover:text-text-primary transition-colors"
        >
          <Icon name="arrow-left" size={15} />
          {t('actions.back')}
        </button>
        <div className="grid grid-cols-4 max-md:grid-cols-2 gap-2.5 max-md:gap-[10px]">
          <StatTile tone="emerald" icon="inbox" label={t('stats.onHand')} value={stats.onHand} />
          <StatTile tone="violet" icon="wrench" label={t('stats.installed')} value={stats.installed} />
          <StatTile tone="rose" icon="x-octagon" label={t('stats.broken')} value={stats.broken} />
          <StatTile tone="blue" icon="monitor-smartphone" label={t('stats.devices')} value={stats.devices} />
        </div>
      </div>
      {/* Scrollable form — sits between the fixed strip and the fixed footer */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5">
      {/* Error banner for submit failures */}
      {submitError && (
        <div
          className="flex items-center gap-2.5 bg-rose-950/30 border border-rose-800/40 text-rose-400 px-4 py-3 rounded-xl text-[13.5px]"
          role="alert"
        >
          <Icon name="triangle-alert" size={14} className="flex-shrink-0" />
          <span className="flex-1">{submitError}</span>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            aria-label={t('actions.dismiss')}
            className="p-1 rounded hover:bg-rose-500/20 transition-colors"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      )}

      {/* Category sections — full-width, bg-surface-2 band */}
      <div className="rounded-xl bg-surface-2 px-4 py-3 space-y-3">
        {visibleCats.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[15px] font-semibold text-text-primary mb-1">{t('warehouse.emptyTitle')}</p>
            <p className="text-[13.5px] text-text-tertiary">{t('warehouse.emptyDesc')}</p>
          </div>
        ) : (
          buildSectionElements()
        )}
      </div>
      </div>

      {/* Footer: summary + actions — pinned to the bottom */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 border-t border-border pt-3 pb-1 mt-3 max-md:flex-col max-md:items-stretch max-md:gap-2">
        <div className="text-[14.5px] text-text-tertiary min-w-0 truncate max-md:text-[13.5px]">
          {itemsCount > 0 ? (
            <>
              {t('addModal.summaryLabel')}{' '}
              <span className="font-bold text-text-primary tabular-nums">{itemsCount}</span>{' '}
              {itemsCount === 1 ? t('addModal.summaryOne') : t('addModal.summaryMany')},{' '}
              <span className="font-bold text-text-primary tabular-nums">{totalQty}</span>{' '}
              {t('addModal.summaryUnit')}
            </>
          ) : (
            t('addModal.summaryEmpty')
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 max-md:flex-shrink max-md:w-full max-md:justify-end">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="h-9 px-3.5 text-[13.5px] font-medium rounded-lg text-text-primary hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('addModal.cancel')}
          </button>
          <button
            type="button"
            onClick={() => { void handleSubmit() }}
            disabled={!canSubmit || submitting}
            className="h-9 px-3.5 text-[13.5px] font-medium rounded-lg bg-gradient-to-b from-accent-light to-accent text-white shadow-sm shadow-[#F97316]/20 hover:shadow-md hover:shadow-[#F97316]/30 ring-1 ring-[#F97316]/10 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-all"
          >
            {submitting ? (
              <><Icon name="loader-2" size={14} className="animate-spin" />{t('addModal.saving')}</>
            ) : (
              <>
                <Icon name="inbox" size={14} />
                {canSubmit
                  ? `${t('addModal.confirmBtn')} · ${totalQty} ${t('addModal.summaryUnit')}`
                  : t('addModal.confirmBtn')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
