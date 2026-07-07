/**
 * AssetDetailSkeleton — plain shimmer skeleton that mirrors the real desktop/mobile
 * layout while the asset data is loading from Firestore.
 *
 * Mobile order: hero (order-1) → sidebar (order-2) → tabs/specs (order-3).
 * Desktop: standard lg:grid-cols-3 layout.
 *
 * Rule: no real text, labels, titles, headers, or icons — shimmer blocks only.
 */
export function AssetDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-md:gap-3 items-start" aria-hidden="true">

      {/* Hero card — order-1 on mobile; self-contained card matching <DetailHero> */}
      <div className="lg:col-span-2 space-y-0 max-md:order-1">
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="h-1 w-full anim-skeleton opacity-50" />
          <div className="p-3.5 sm:p-6">
            <div className="flex items-start gap-4 max-md:flex-wrap">
              <div className="w-12 h-12 rounded-xl anim-skeleton flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-[18px] w-[55%] rounded anim-skeleton" />
                <div className="flex items-center gap-2">
                  <div className="h-[20px] w-[88px] rounded-md anim-skeleton" />
                  <div className="h-[20px] w-[72px] rounded-md anim-skeleton" />
                </div>
              </div>
              <div className="h-[22px] w-[80px] rounded-md anim-skeleton flex-shrink-0 max-md:mt-1" />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT column — 3 sidebar cards; order-3 on mobile (below tab content) */}
      <div className="space-y-4 max-md:order-3 lg:row-span-2">
        {Array.from({ length: 3 }).map((_, cardIdx) => (
          <div key={cardIdx} className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
              {/* icon shimmer */}
              <div className="w-[15px] h-[15px] rounded anim-skeleton flex-shrink-0" />
              {/* title shimmer */}
              <div className="h-[10px] w-[40%] rounded anim-skeleton" />
            </div>
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((__, r) => (
                <div key={r} className="h-[13px] rounded anim-skeleton" style={{ width: `${65 - r * 10}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tab strip + panel — order-2 on mobile (above sidebar) */}
      <div className="lg:col-span-2 space-y-0 max-md:order-2">
        {/* Tab strip — shimmer (not interactive during loading) */}
        <div className="bg-surface border-x border-t max-md:rounded-t-2xl border-border px-5 flex items-center gap-1 h-[44px]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1.5 px-3 py-3 flex-shrink-0">
              <div className="w-[14px] h-[14px] rounded anim-skeleton flex-shrink-0" />
              <div className="h-[12px] rounded anim-skeleton" style={{ width: i === 0 ? 72 : i === 1 ? 64 : 56 }} />
            </div>
          ))}
        </div>

        {/* Tab panel body */}
        <div className="bg-surface rounded-b-2xl border-x border-b border-border px-5 sm:px-6 py-5 max-md:px-4 max-md:py-4">
          {/* Card header — shimmer (no real text/icon/button) */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              {/* icon shimmer */}
              <div className="w-[18px] h-[18px] rounded anim-skeleton flex-shrink-0" />
              {/* title shimmer */}
              <div className="h-[10px] w-[120px] rounded anim-skeleton" />
            </div>
            {/* copy button shimmer */}
            <div className="h-8 w-[96px] rounded-lg anim-skeleton flex-shrink-0" />
          </div>

          {/* Spec tiles — shimmer (category-dependent, DB) */}
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

          {/* License block — shimmer (DB: license name + key) */}
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
  )
}
