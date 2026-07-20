/**
 * AssetDetailSkeleton — shimmer skeleton that mirrors the real loaded layout
 * for BOTH breakpoints while asset data loads from Firestore.
 *
 * Two fully separate branches (P1 — skeleton = exact copy per breakpoint):
 *   - Mobile  (md:hidden)  — mirrors AssetDetailMobileView + DetailHeroMobile footprint.
 *   - Desktop (max-md:hidden) — mirrors AssetDetailDesktopView left-column layout.
 *
 * P2 — local chrome renders real immediately; only async Firebase data is shimmered.
 * All blocks are aria-hidden="true" so screen readers skip them.
 */
export function AssetDetailSkeleton() {
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

        {/* ② TABS — mt-3, mirrors DetailTabs mobile classes:
            max-md:bg-bg max-md:border-x-0 max-md:border-t-0 max-md:border-b max-md:rounded-none max-md:px-3 */}
        <div className="mt-3 flex-shrink-0">
          <div className="bg-bg border-b border-border px-3 flex items-center h-[40px]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center px-3 py-3 flex-shrink-0">
                <div
                  className="h-[12px] rounded anim-skeleton"
                  style={{ width: i === 0 ? 80 : i === 1 ? 64 : 72 }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ③ SCROLL REGION — flex-1 min-h-0 overflow-y-auto */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Tab body: px-3.5 pt-3 (mirrors AssetDetailMobileView scroll inner) */}
          <div className="px-3.5 pt-3">
            {/* Spec tiles — 1-col on mobile (category-dependent async) */}
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
          </div>

          {/* Bottom sections (Назначение / Местонахождение / Ремонт):
              px-3.5 pb-6 space-y-2.5 mt-3 (mirrors AssetDetailMobileView line ~195) */}
          <div className="px-3.5 pb-6 space-y-2.5 mt-3">
            {Array.from({ length: 3 }).map((_, cardIdx) => (
              <div key={cardIdx} className="bg-surface border border-border rounded-xl overflow-hidden">
                {/* SectionCard-like header: px-3.5 py-3 */}
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
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          DESKTOP skeleton  (hidden on max-md)
          Mirrors AssetDetailDesktopView:
            grid-cols-3, lg:gap-x-5 gap-y-[10px]
            LEFT col-span-2: hero + tabs (space-y-[10px])
            RIGHT col-span-1: sidebar (space-y-2)
          ════════════════════════════════════════════════════════ */}
      <div
        className="max-md:hidden grid grid-cols-1 lg:grid-cols-3 lg:gap-x-5 gap-y-[10px] items-start"
        aria-hidden="true"
      >
        {/* ── LEFT COLUMN: hero block + tabs — ONE div, space-y-[10px] ── */}
        {/* Mirrors AssetDetailDesktopView line ~129:
            lg:col-span-2 space-y-[10px] */}
        <div className="lg:col-span-2 space-y-[10px]">

          {/* Hero card — mirrors DetailHero (rounded-2xl, accent bar h-1, p-3.5/sm:p-6) */}
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
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

          {/* Tab strip + panel */}
          <div className="space-y-0">
            {/* Tab strip — base rounded-t-2xl; mobile overrides live in the mobile branch above.
                Mirrors DetailTabs className:
                  rounded-t-2xl … max-md:rounded-none max-md:border-x-0 max-md:border-t-0 max-md:border-b */}
            <div className="bg-surface border-x border-t border-border rounded-t-2xl px-5 flex items-center gap-1 h-[44px]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-3 flex-shrink-0">
                  <div className="w-[14px] h-[14px] rounded anim-skeleton flex-shrink-0" />
                  <div
                    className="h-[12px] rounded anim-skeleton"
                    style={{ width: i === 0 ? 72 : i === 1 ? 64 : 56 }}
                  />
                </div>
              ))}
            </div>

            {/* Tab panel body */}
            <div className="bg-surface rounded-b-2xl border-x border-b border-border px-5 sm:px-6 py-5">
              {/* Card header shimmer (section icon + title + copy-button) */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-[18px] h-[18px] rounded anim-skeleton flex-shrink-0" />
                  <div className="h-[10px] w-[120px] rounded anim-skeleton" />
                </div>
                <div className="h-8 w-[96px] rounded-lg anim-skeleton flex-shrink-0" />
              </div>

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
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: 3 sidebar cards — space-y-2 (mirrors line ~211) ── */}
        <div className="space-y-2 lg:row-span-2">
          {Array.from({ length: 3 }).map((_, cardIdx) => (
            <div key={cardIdx} className="bg-surface border border-border rounded-xl overflow-hidden">
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
          ))}
        </div>
      </div>
    </>
  )
}
