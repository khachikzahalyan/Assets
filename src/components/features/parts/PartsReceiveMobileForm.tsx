import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { PartCatMeta } from './partsTokens'
import type { Part } from '@/domain/part/types'
import { PartsReceiveSmallCatCard } from './PartsReceiveSmallCatCard'
import { PartsReceiveSizedCatCard } from './PartsReceiveSizedCatCard'

export interface PartsReceiveMobileFormProps {
  partsByCategory: Record<string, Part[]>
  visibleCats: PartCatMeta[]
  qtys: Record<string, string>
  bumpQty: (skuId: string, delta: number) => void
  ramDdr: string
  setRamDdr: (ddr: string) => void
  totalQty: number
  canSubmit: boolean
  submitting: boolean
  submitError: string | null
  onDismissError: () => void
  onSubmit: () => void
  onCancel: () => void
  /** When true, renders shimmer skeleton for async data; header/footer stay real (Principle 2). */
  loading?: boolean
}

/**
 * Skeleton body — mirrors PartsReceiveSizedCatCard / SmallCatCard footprints.
 * Header and footer are local chrome rendered real (Principle 2).
 */
function MobileLoadingBody() {
  return (
    <>
      {/* 2 small-cat shimmer cards (PSU / Cooler) side-by-side */}
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map(i => (
          <div key={i} className="bg-surface border border-border rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="w-5 h-5 rounded-md anim-skeleton" />
              <div className="h-[12px] w-[45%] rounded anim-skeleton" />
              <div className="ml-auto h-[10px] w-[38px] rounded anim-skeleton" />
            </div>
            {[0, 1].map(j => (
              <div key={j} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="h-[11px] w-[55%] anim-skeleton rounded" />
                  <div className="h-[10px] w-[24px] anim-skeleton rounded" />
                </div>
                <div className="h-8 rounded-lg anim-skeleton" />
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* 3 sized-cat shimmer cards (SSD / HDD / M.2 / RAM) full-width */}
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-surface border border-border rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-5 h-5 rounded-md anim-skeleton" />
            <div className="h-[13px] w-[30%] rounded anim-skeleton" />
            <div className="ml-auto h-[10px] w-[48px] rounded anim-skeleton" />
          </div>
          <div className="flex gap-[7px] overflow-x-hidden pb-1">
            {[0, 1, 2, 3].map(j => (
              <div key={j} className="flex-shrink-0 w-[72px]">
                <div className="h-[10px] w-[70%] mb-1 rounded anim-skeleton" />
                <div className="h-7 rounded-md anim-skeleton" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

/**
 * PartsReceiveMobileForm — full-screen mobile layout for the /parts/new route.
 * Renders on ≤767px only (gated by useIsMobile in PartsReceivePage).
 * Layout: fixed header → scrollable category cards → fixed footer bar.
 * Receives all logic from the parent page as props — no data fetching here.
 */
export function PartsReceiveMobileForm({
  partsByCategory,
  visibleCats,
  qtys,
  bumpQty,
  ramDdr,
  setRamDdr,
  totalQty,
  canSubmit,
  submitting,
  submitError,
  onDismissError,
  onSubmit,
  onCancel,
  loading,
}: PartsReceiveMobileFormProps) {
  const { t } = useTranslation('parts')

  // PSU + Cooler rendered side-by-side; all other sized cats go full-width
  const SMALL_IDS = new Set(['psu', 'cooler'])
  const smallCats = visibleCats.filter(c => SMALL_IDS.has(c.id))
  const sizedCats = visibleCats.filter(c => !SMALL_IDS.has(c.id))

  return (
    /* Viewport-locked column (topbar 52 + content pt 12 + bottom nav 64 = 128):
       header + footer stay pinned, ONLY the category-card body scrolls, and the
       footer lands flush on the global bottom nav — no dead band below. */
    <div className="flex flex-col h-[calc(100dvh-128px)] overflow-hidden bg-bg">
      {/* ── Fixed header ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3.5 bg-surface-2 border-b border-border">
        <span className="text-[15px] font-bold text-text-primary">{t('addModal.title')}</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('addModal.close')}
          className="w-[30px] h-[30px] rounded-[9px] bg-white/6 flex items-center justify-center text-text-secondary hover:bg-white/10 transition-colors"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 pt-3 pb-4 space-y-1.5">
        {loading === true ? (
          <MobileLoadingBody />
        ) : (
          <>
            {/* Submit-error banner */}
            {submitError && (
              <div
                className="flex items-center gap-2.5 bg-rose-950/30 border border-rose-800/40 text-rose-400 px-3.5 py-2.5 rounded-xl text-[13px]"
                role="alert"
              >
                <Icon name="triangle-alert" size={13} className="flex-shrink-0" />
                <span className="flex-1">{submitError}</span>
                <button
                  type="button"
                  onClick={onDismissError}
                  aria-label={t('actions.dismiss')}
                  className="p-1 rounded hover:bg-rose-500/20 transition-colors"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            )}

            {/* Empty state */}
            {visibleCats.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[15px] font-semibold text-text-primary mb-1">
                  {t('warehouse.emptyTitle')}
                </p>
                <p className="text-[13.5px] text-text-tertiary">{t('warehouse.emptyDesc')}</p>
              </div>
            ) : (
              <>
                {/* PSU + Cooler — 2-col grid */}
                {smallCats.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {smallCats.map(cat => (
                      <PartsReceiveSmallCatCard
                        key={cat.id}
                        cat={cat}
                        catParts={partsByCategory[cat.id] ?? []}
                        qtys={qtys}
                        bumpQty={bumpQty}
                        t={t}
                      />
                    ))}
                  </div>
                )}

                {/* Sized cats (SSD / HDD / M.2 / RAM) — full-width each */}
                {sizedCats.map(cat => (
                  <PartsReceiveSizedCatCard
                    key={cat.id}
                    cat={cat}
                    catParts={partsByCategory[cat.id] ?? []}
                    qtys={qtys}
                    bumpQty={bumpQty}
                    ramDdr={ramDdr}
                    setRamDdr={setRamDdr}
                    t={t}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Fixed footer bar ───────────────────────────────────────────── */}
      {/* pb-3 (not pb-6): the global bottom nav sits directly below — no extra bulk */}
      <div className="flex-shrink-0 flex gap-2.5 px-3.5 pt-3 pb-3 bg-surface-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-shrink-0 px-5 py-3.5 rounded-xl text-[13.5px] font-semibold text-text-secondary border border-border bg-transparent hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('addModal.cancel')}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="flex-1 py-3.5 rounded-xl text-[14px] font-bold text-white bg-accent shadow-lg shadow-accent/30 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 transition-all active:opacity-90"
        >
          {submitting ? (
            <>
              <Icon name="loader-2" size={14} className="animate-spin" />
              {t('addModal.saving')}
            </>
          ) : canSubmit ? (
            `${t('addModal.confirmBtn')} · ${totalQty} ${t('addModal.summaryUnit')}`
          ) : (
            t('addModal.confirmBtn')
          )}
        </button>
      </div>
    </div>
  )
}
