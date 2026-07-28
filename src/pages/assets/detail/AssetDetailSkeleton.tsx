import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { DetailTabs } from '@/components/features/assets/detail/DetailTabs'

// SectionCard's inline drop-shadow — mirrored on the nested skeleton cards so the
// desktop tab-panel bodies match the real TechSpecsCard / HistoryCard chrome exactly
// (see src/components/ui/section-card.tsx line ~47).
const SECTION_CARD_SHADOW = '0 1px 2px rgba(0,0,0,0.4),0 4px 12px rgba(0,0,0,0.25)'

/**
 * AssetDetailSkeleton — shimmer skeleton that mirrors the real loaded layout
 * for BOTH breakpoints while asset data loads from Firestore.
 *
 * Two fully separate branches (P1 — skeleton = exact copy per breakpoint):
 *   - Mobile  (md:hidden)  — mirrors AssetDetailMobileView + DetailHeroMobile footprint.
 *   - Desktop (max-md:hidden) — mirrors AssetDetailDesktopView left-column layout.
 *
 * P2 — local chrome renders real immediately; only async Firebase data is shimmered.
 * The tab strip labels (Характеристики / История / Документы) are static known
 * strings, so we render the REAL DetailTabs component (non-interactive) instead of
 * shimmer bars — same t() keys, same geometry, zero layout shift on the strip when
 * data arrives. All shimmer blocks are aria-hidden.
 *
 * ── hasSpecs branch (Finding 2) ──
 * The real page renders 3 tabs (specs active, spec-tiles body) for spec-capable
 * categories, but only 2 tabs (history active, HistoryCard body) for spec-less
 * ones (furniture, peripherals). Without a hint the skeleton would always show
 * the 3-tab specs variant, causing a visible tab + body jump on spec-less assets.
 *
 * `hasSpecs` is a NAVIGATION HINT (router state from the asset-list row click —
 * NOT a data fetch). When known we branch:
 *   - hasSpecs === true  → 3-tab specs-active variant (spec tiles + license block).
 *   - hasSpecs === false → 2-tab history-active variant (HistoryCard footprint).
 *   - hasSpecs undefined → fall back to the 3-tab specs variant. LIMITATION: on a
 *     cold reload / deep link there is no router state and category caps are not
 *     synchronously derivable at mount (they need the async category catalog), so a
 *     spec-less asset can still show a brief specs→history tab shift in that case.
 */
export interface AssetDetailSkeletonProps {
  /**
   * Navigation hint from the asset-list row click (router state). When false the
   * skeleton mirrors the 2-tab history-active variant; when true or undefined it
   * mirrors the 3-tab specs-active variant.
   */
  hasSpecs?: boolean
}

export function AssetDetailSkeleton({ hasSpecs }: AssetDetailSkeletonProps = {}) {
  const { t } = useTranslation('assets')
  // Unknown (undefined) falls back to the specs variant — see class doc LIMITATION.
  const showSpecs = hasSpecs !== false

  return (
    <>
      {/* ════════════════════════════════════════════════════════
          MOBILE skeleton  (hidden on md+)
          Mirrors AssetDetailMobileView:
            h-[calc(100dvh-128px)] / flex-col / overflow-hidden
          ════════════════════════════════════════════════════════ */}
      <div
        className="md:hidden flex flex-col h-[calc(100dvh-128px)] overflow-hidden"
        aria-hidden="true"
      >
        {/* ① HERO — px-3.5 pt-1 wrapper, mirrors DetailHeroMobile footprint */}
        <div className="px-3.5 pt-1 flex-shrink-0">
          {/* card: bg-surface rounded-2xl border border-border p-4 */}
          <div className="bg-surface rounded-2xl border border-border p-4">
            {/* top row: 50×50 icon tile + title / meta block */}
            <div className="flex items-start gap-3">
              {/* Category icon box — 50×50 rounded-xl (DetailHeroMobile line ~59) */}
              <div className="w-[50px] h-[50px] rounded-xl anim-skeleton flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {/* First line: title (left) + status chip (right) — chip h-7 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="h-[19px] w-[55%] rounded anim-skeleton" />
                  {/* chip h-7 matches DetailHeroMobile chip (line ~72) */}
                  <div className="h-7 w-[80px] rounded-lg anim-skeleton flex-shrink-0" />
                </div>
                {/* Second line: inv-code + category chips */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="h-[20px] w-[72px] rounded-md anim-skeleton" />
                  <div className="h-[20px] w-[60px] rounded-md anim-skeleton" />
                </div>
              </div>
            </div>
            {/* Action row — mt-3.5, two flex-1 h-8 buttons (DetailHeroMobile line ~109-130) */}
            <div className="flex gap-2 mt-3.5">
              <div className="flex-1 h-8 rounded-lg anim-skeleton" />
              <div className="flex-1 h-8 rounded-lg anim-skeleton" />
            </div>
          </div>
        </div>

        {/* ② TABS — mt-3, REAL DetailTabs (labels are static chrome, P2).
            showSpecs drives 3-tab (specs active) vs 2-tab (history active). */}
        <div className="mt-3 flex-shrink-0">
          <DetailTabs
            active={showSpecs ? 'specs' : 'history'}
            onChange={() => {}}
            showSpecs={showSpecs}
            showDocs
            addedDate={null}
          />
        </div>

        {/* ③ SCROLL REGION — flex-1 min-h-0 overflow-y-auto */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Tab body: px-3.5 pt-3 (mirrors AssetDetailMobileView scroll inner) */}
          <div className="px-3.5 pt-3">
            {showSpecs ? (
              /* Spec tiles — 1-col on mobile (category-dependent async) */
              <div className="grid grid-cols-1 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-bg border border-border">
                    <div className="w-9 h-9 rounded-lg anim-skeleton flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="h-[9px] w-[42%] rounded anim-skeleton" />
                      <div className="h-[12px] w-[68%] rounded anim-skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* No-specs: history-active body → real render is <HistoryCard mobileBare />
                 → SectionCard noHeader → NO header row (icon+title+count), just the
                 section chrome (with SectionCard's inline boxShadow) wrapping a single
                 body div (p-3.5). Inside: the mobileBare «Создан … · count» line
                 (flex justify-between · mb-3 pb-2.5 border-b) then the event list.
                 Mirror that structure exactly — no header block. */
              <section
                className="bg-surface border border-border rounded-xl overflow-hidden"
                style={{ boxShadow: SECTION_CARD_SHADOW }}
                data-testid="skeleton-mobile-history-body"
              >
                <div className="p-3.5">
                  {/* mobileBare «Создан … · count» line — flex justify-between, mb-3 pb-2.5 border-b */}
                  <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border">
                    <div className="h-[12px] w-[72%] rounded anim-skeleton" />
                    <div className="h-[12px] w-[52px] rounded anim-skeleton flex-shrink-0" />
                  </div>
                  {/* Event rows */}
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full anim-skeleton flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="h-[12px] rounded anim-skeleton" style={{ width: `${68 - i * 6}%` }} />
                          <div className="h-[10px] w-[40%] rounded anim-skeleton" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Bottom sections (Назначение / Местонахождение / Ремонт):
              px-3.5 pb-6 space-y-2.5 mt-3 (mirrors AssetDetailMobileView line ~200).
              The real mobile view renders these ONLY on the «Тех. характеристики» tab
              (showBottomSections === activeTab === 'specs'). A spec-less asset is
              normalized to the История tab, so it shows ZERO bottom cards — gate the
              trio on showSpecs to match exactly (Finding 1). */}
          {showSpecs && (
            <div className="px-3.5 pb-6 space-y-2.5 mt-3" data-testid="skeleton-mobile-bottom-sections">
              {Array.from({ length: 3 }).map((_, cardIdx) => (
                <div key={cardIdx} className="bg-surface border border-border rounded-xl overflow-hidden">
                  {/* SectionCard-like header: max-md:px-3.5 max-md:py-3 */}
                  <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border">
                    <div className="w-[15px] h-[15px] rounded anim-skeleton flex-shrink-0" />
                    <div className="h-[10px] w-[40%] rounded anim-skeleton" />
                  </div>
                  <div className="p-3.5 space-y-3">
                    {Array.from({ length: 2 }).map((__, r) => (
                      <div
                        key={r}
                        className="h-[13px] rounded anim-skeleton"
                        style={{ width: `${65 - r * 10}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          DESKTOP skeleton  (hidden on max-md)
          Mirrors AssetDetailDesktopView fill chain:
            outer lg:h-full lg:flex lg:flex-col lg:min-h-0
            grid  lg:items-stretch lg:flex-1 lg:min-h-0
            LEFT col-span-2: hero + tabs (lg:flex lg:flex-col lg:min-h-0)
            RIGHT col-span-1: sidebar (space-y-2 lg:overflow-y-auto)
          ════════════════════════════════════════════════════════ */}
      <div className="max-md:hidden lg:h-full lg:flex lg:flex-col lg:min-h-0" aria-hidden="true">
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-x-5 gap-y-[10px] items-start lg:items-stretch lg:flex-1 lg:min-h-0">
          {/* ── LEFT COLUMN: hero block + tabs ──
              Mirrors AssetDetailDesktopView line ~131:
                lg:col-span-2 space-y-[10px] lg:flex lg:flex-col lg:min-h-0 */}
          <div className="lg:col-span-2 space-y-[10px] lg:flex lg:flex-col lg:min-h-0">

            {/* Hero card — mirrors DetailHero (rounded-2xl, accent bar h-1, p-3.5/sm:p-6).
                lg:flex-shrink-0 matches the real hero wrapper (line ~136). */}
            <div className="bg-surface rounded-2xl border border-border overflow-hidden lg:flex-shrink-0">
              <div className="h-1 w-full anim-skeleton opacity-50" />
              <div className="p-3.5 sm:p-6">
                <div className="flex items-start gap-4">
                  {/* Category icon box — w-12 h-12 rounded-xl */}
                  <div className="w-12 h-12 rounded-xl anim-skeleton flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Title shimmer */}
                    <div className="h-[18px] w-[55%] rounded anim-skeleton" />
                    {/* Inv-code + category chips */}
                    <div className="flex items-center gap-2">
                      <div className="h-[20px] w-[88px] rounded-md anim-skeleton" />
                      <div className="h-[20px] w-[72px] rounded-md anim-skeleton" />
                    </div>
                  </div>
                  {/* Status chip — h-8 matches DetailHero desktop chip (line ~79) */}
                  <div className="h-8 w-[80px] rounded-md anim-skeleton flex-shrink-0" />
                </div>
              </div>
            </div>

            {/* Tab strip + panel — mirrors real tab wrapper (line ~150):
                space-y-0 lg:flex lg:flex-col lg:flex-1 lg:min-h-0 */}
            <div className="space-y-0 lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
              {/* REAL DetailTabs — labels are static chrome (P2). showSpecs drives
                  3-tab specs-active vs 2-tab history-active. rounded-t-2xl + border-x/top
                  matches the panel's border-x/bottom below exactly. */}
              <DetailTabs
                active={showSpecs ? 'specs' : 'history'}
                onChange={() => {}}
                showSpecs={showSpecs}
                showDocs
                addedDate={null}
              />

              {/* Tab panel body. History-active fills + scrolls (lg:flex-1 lg:min-h-0);
                  specs keeps natural height — matches real panel (line ~165-169). */}
              <div
                className={
                  'bg-surface rounded-b-2xl border-x border-b border-border px-5 sm:px-6 py-5' +
                  (showSpecs ? '' : ' lg:flex-1 lg:min-h-0 lg:overflow-y-auto')
                }
              >
                {showSpecs ? (
                  /* Specs-active body → real desktop renders <TechSpecsCard> as a full
                     SectionCard inside the panel (AssetDetailDesktopView ~171-190). Mirror
                     SectionCard's exact chrome: bg-surface border border-border rounded-xl
                     overflow-hidden + inline boxShadow; header px-5 py-3.5 border-b; body p-5.
                     The card TITLE is a static known string («Тех. характеристики») so it
                     renders REAL with the same t() key — zero shift. The header icon box
                     (w-7 h-7) and copy button (h-8) are shimmered. */
                  <section
                    className="bg-surface border border-border rounded-xl overflow-hidden"
                    style={{ boxShadow: SECTION_CARD_SHADOW }}
                  >
                    <header className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        {/* Icon box — SectionCard w-7 h-7 rounded-md */}
                        <div className="w-7 h-7 rounded-md anim-skeleton flex-shrink-0" />
                        {/* Real static title — text-[13px] font-bold uppercase tracking-[0.04em] */}
                        <span className="text-[13px] font-bold uppercase tracking-[0.04em] text-text-primary">
                          {t('detail.specs.title')}
                        </span>
                      </div>
                      {/* Copy button (h-8) — shimmer */}
                      <div className="h-8 w-[96px] rounded-lg anim-skeleton flex-shrink-0" />
                    </header>

                    <div className="p-5">
                      {/* Spec tiles — category-dependent (async) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-bg border border-border">
                            <div className="w-9 h-9 rounded-lg anim-skeleton flex-shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="h-[9px] w-[42%] rounded anim-skeleton" />
                              <div className="h-[12px] w-[68%] rounded anim-skeleton" />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-border my-4" />

                      {/* License block — async (license name + key) */}
                      <div className="flex items-center gap-3.5 p-4 rounded-xl bg-bg border border-border">
                        <div className="w-11 h-11 rounded-lg anim-skeleton flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="h-[14px] w-[46%] rounded anim-skeleton" />
                          <div className="h-[12px] w-[62%] rounded anim-skeleton" />
                        </div>
                        <div className="h-8 w-[96px] rounded-lg anim-skeleton flex-shrink-0" />
                      </div>

                      {/* Parts-note FOOTER — real TechSpecsCard always renders this on
                          desktop (bare=false, partsNote=true, onOpenParts supplied). Its
                          note text and «Открыть Запчасти →» label are static t() strings,
                          so per P2 they render REAL (zero shift); the button is inert
                          (no onClick). Classes copied verbatim from TechSpecsCard ~183-200. */}
                      <div className="mt-5 pt-3 border-t border-dashed border-border flex items-center justify-between gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-text-tertiary">
                          <Icon name="info" size={12} className="text-text-subtle" />
                          {t('detail.parts.note')}
                        </span>
                        <button
                          type="button"
                          tabIndex={-1}
                          className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-xl text-[14px] font-semibold text-accent-light bg-accent/10 ring-1 ring-inset ring-accent/30 hover:bg-accent/20 transition-colors"
                        >
                          {t('detail.parts.openParts')}
                          <Icon name="arrow-right" size={13} />
                        </button>
                      </div>
                    </div>
                  </section>
                ) : (
                  /* No-specs: history-active body → real desktop renders <HistoryCard> as a
                     full SectionCard that fills the panel height and scrolls only its event
                     list (HistoryCard className="lg:h-full lg:flex lg:flex-col lg:min-h-0").
                     Mirror SectionCard chrome exactly. TITLE is static («История») → real
                     t() key. Icon box (w-7 h-7) + count action are shimmered. */
                  <section
                    className="bg-surface border border-border rounded-xl overflow-hidden lg:h-full lg:flex lg:flex-col lg:min-h-0"
                    style={{ boxShadow: SECTION_CARD_SHADOW }}
                  >
                    <header className="flex items-center justify-between px-5 py-3.5 border-b border-border lg:flex-shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md anim-skeleton flex-shrink-0" />
                        <span className="text-[13px] font-bold uppercase tracking-[0.04em] text-text-primary">
                          {t('detail.history.title')}
                        </span>
                      </div>
                      {/* Record count (async) — shimmer */}
                      <div className="h-[13px] w-[60px] rounded anim-skeleton flex-shrink-0" />
                    </header>

                    <div className="p-5 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
                      {/* «Создан…» line — mb-3 pb-2.5 border-b */}
                      <div className="mb-3 pb-2.5 border-b border-border lg:flex-shrink-0">
                        <div className="h-[12px] w-[64%] rounded anim-skeleton" />
                      </div>
                      {/* Event rows — the scrolling list */}
                      <div className="space-y-3 lg:flex-1 lg:min-h-0">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full anim-skeleton flex-shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="h-[13px] rounded anim-skeleton" style={{ width: `${70 - i * 5}%` }} />
                              <div className="h-[11px] w-[38%] rounded anim-skeleton" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: 3 sidebar cards — mirrors AssetDetailDesktopView's
              real right container: space-y-2 lg:min-h-0 lg:overflow-y-auto ── */}
          <div className="space-y-2 lg:min-h-0 lg:overflow-y-auto">
            {Array.from({ length: 3 }).map((_, cardIdx) => {
              const card = (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                    <div className="w-[15px] h-[15px] rounded anim-skeleton flex-shrink-0" />
                    <div className="h-[10px] w-[40%] rounded anim-skeleton" />
                  </div>
                  <div className="p-5 space-y-3">
                    {Array.from({ length: 3 }).map((__, r) => (
                      <div
                        key={r}
                        className="h-[13px] rounded anim-skeleton"
                        style={{ width: `${65 - r * 10}%` }}
                      />
                    ))}
                  </div>
                </div>
              )
              // First sidebar card = AssignmentCard. Real desktop wraps it in
              // lg:min-h-[155px] flex flex-col [&>*]:flex-1 so it stretches to the hero
              // block's idle height (AssetDetailDesktopView ~218). Without the wrapper the
              // skeleton's first card is ~27px shorter → visible pop when data arrives.
              return cardIdx === 0 ? (
                <div key={cardIdx} className="lg:min-h-[155px] flex flex-col [&>*]:flex-1">
                  {card}
                </div>
              ) : (
                <div key={cardIdx}>{card}</div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
