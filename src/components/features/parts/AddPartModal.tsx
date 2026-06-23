import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, MobileSheet, Chip } from '@/components/ui'
import type { Part } from '@/domain/part/types'
import { PART_CATEGORY_META, categoryTint } from './partsTokens'

export interface AddPartModalProps {
  open: boolean
  onClose: () => void
  parts: Part[]
  onConfirm: (items: Array<{ skuId: string; qty: number }>) => Promise<void>
}

/**
 * Receive-stock modal: a qty card grid across all SKUs, grouped by category.
 * Emits one `receive` movement per non-zero qty row.
 * Uses MobileSheet on mobile (≤767 px), dialog overlay on desktop.
 *
 * Prototype parity (parts.html lines 1345-1557):
 *  - Header title "Добавить запчасть" + subtitle
 *  - max-w-3xl dialog, bg-surface-2 body band
 *  - card grid: repeat(auto-fill, minmax(160px, 1fr))
 *  - RAM DDR3/DDR4/DDR5 filter pills
 *  - Section header: coloured icon plaque + label + DDR pills + divider + count
 *  - Small sections (≤2 SKUs) paired side-by-side in a 2-col grid
 *  - Each SKU card: active=orange ring, top row: mono size label + gray chip with onHand
 *  - Footer: summary text + ghost cancel + primary "Принять · N шт"
 */
export function AddPartModal({ open, onClose, parts, onConfirm }: AddPartModalProps) {
  const { t } = useTranslation('parts')
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [ramDdr, setRamDdr] = useState('DDR4')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setQtys({})
    setRamDdr('DDR4')
    setError(null)
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async () => {
    const items = parts
      .map(p => ({ skuId: p.id, qty: parseInt(qtys[p.id] ?? '0', 10) || 0 }))
      .filter(i => i.qty > 0)

    if (items.length === 0) {
      setError(t('addModal.errorNoQty'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(items)
      setQtys({})
      handleClose()
    } catch {
      setError(t('addModal.errorFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [parts, qtys, onConfirm, handleClose, t])

  const bumpQty = useCallback((skuId: string, delta: number) => {
    setQtys(prev => {
      const cur = parseInt(prev[skuId] ?? '0', 10) || 0
      const next = Math.max(0, cur + delta)
      return { ...prev, [skuId]: next === 0 ? '' : String(next) }
    })
  }, [])

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
    const visibleParts = isRam ? catParts.filter(p => p.ddr === ramDdr) : catParts
    const tint = categoryTint(catId)

    return (
      <section key={catId}>
        {/* Section header */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`w-7 h-7 rounded-lg ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
            <Icon name={cat.icon} size={13} />
          </span>
          <h3 className="text-[14.5px] font-bold text-text-primary">{cat.label}</h3>
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

        {/* SKU card grid */}
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
                className={`bg-surface border rounded-lg p-2.5 transition-all
                  ${isActive
                    ? 'border-accent ring-2 ring-[#F97316]/15 shadow-sm shadow-[#FB923C]/40'
                    : 'border-border hover:border-border-strong'}`}
              >
                {/* Top row: size label + onHand chip (bare number, prototype-faithful) */}
                <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
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
                        ? 'bg-[#F97316]/10 border border-accent text-accent focus:border-accent focus:ring-2 focus:ring-[#F97316]/15'
                        : 'bg-bg border border-border text-text-secondary focus:border-accent focus:ring-2 focus:ring-[#F97316]/15'}`}
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

  // Build visible category list (no GPU — GPU uses GpuAddModal flow)
  const visibleCats = PART_CATEGORY_META
    .filter(cat => cat.id !== 'gpu')
    .filter(cat => (partsByCategory[cat.id] ?? []).length > 0)

  // Pair small sections (≤2 SKUs) side-by-side; large sections go full-width
  const buildSectionElements = () => {
    const elements: React.ReactNode[] = []
    let i = 0
    while (i < visibleCats.length) {
      const cur = visibleCats[i]
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

  const content = (
    <div className="flex flex-col" style={{ maxHeight: '88vh' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
        <div>
          <h2 className="text-[17px] font-bold text-text-primary leading-tight">{t('addModal.title')}</h2>
          <p className="mt-0.5 text-[14.5px] text-text-tertiary">
            {t('addModal.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('addModal.close')}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-subtle hover:text-text-primary hover:bg-surface-2 transition-colors flex-shrink-0"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Body — scrollable, bg-surface-2 band */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 bg-surface-2">
        {buildSectionElements()}
      </div>

      {/* Inline error */}
      {error && (
        <div
          className="mx-5 mt-3 text-[12.5px] text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2 flex-shrink-0"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-border flex items-center justify-between gap-3 flex-shrink-0 bg-surface">
        <div className="text-[14.5px] text-text-tertiary min-w-0 truncate">
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
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
                {canSubmit ? `${t('addModal.confirmBtn')} · ${totalQty} ${t('addModal.summaryUnit')}` : t('addModal.confirmBtn')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  // MobileSheet on mobile (≤767 px), dialog overlay on desktop
  return (
    <>
      {open && (
        <>
          {/* Desktop: dialog overlay */}
          <div className="md:block hidden fixed inset-0 z-[80]">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={handleClose} />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label={t('addModal.title')}
            >
              {content}
            </div>
          </div>
          {/* Mobile: bottom sheet */}
          <MobileSheet open={open} onClose={handleClose} title={t('addModal.title')}>
            {content}
          </MobileSheet>
        </>
      )}
    </>
  )
}
