/**
 * PartsPageSkeleton — mirrors the active-tab footprint while async parts data
 * loads from Firestore. The active tab is passed in because the URL can pin
 * `?tab=warehouse` on reload; a devices-only skeleton would cause a tab jump.
 *
 * P1: skeleton = exact copy of the real loaded block per breakpoint.
 * P2: local/static chrome renders real immediately — only async Firebase data shimmered.
 *
 * ── DEVICES branch (default) — mirrors DevicesTab ──
 * Desktop (lg): 12-col grid:
 *   Left  (col-span-5): REAL family pills (disabled) + REAL search input (disabled)
 *                       + 2-col grid of DeviceGridCard-footprint shimmer cards.
 *   Right (col-span-7): InstalledDetailPanel no-selection footprint (local chrome — real).
 * Mobile (max-md): real family pills row + px-[14px] pt-[10px] wrapper + CardListSkeleton.
 *
 * ── WAREHOUSE branch — mirrors WarehouseTab ──
 * Desktop (lg): grid-cols-12 master-detail:
 *   Left  (col-span-5): vertical list of PartCard-footprint shimmer cards.
 *   Right (col-span-7): one card (shadow-sm shadow-black/30 light:shadow-slate-300/60) with a SKU list zone
 *                       + a real «ИСТОРИЯ» metrics strip (local chrome) + placeholder
 *                       history rows mirroring HistoryPanel's empty-state slots.
 * Mobile (max-md): category header row + placeholder detail rows (WarehouseMobileDetail
 *                  footprint). The CategoryChipStrip lives in PartsTabsHeader (rendered real).
 */
import { useTranslation } from 'react-i18next'
import { Icon, CardListSkeleton } from '@/components/ui'

/** Mirrors FAMILIES constant in DevicesTab — local constants, not async. */
const FAMILIES = [
  { id: 'all',     labelKey: 'devices.familyAll',    labelFallback: 'Все'       },
  { id: 'desktop', labelKey: 'devices.familyDesktop', labelFallback: 'ПК'        },
  { id: 'laptop',  labelKey: 'devices.familyLaptop',  labelFallback: 'Ноутбуки'  },
  { id: 'server',  labelKey: 'devices.familyServer',  labelFallback: 'Серверы'   },
] as const

export interface PartsPageSkeletonProps {
  /** Active tab on this load — decides which real layout the skeleton mirrors. */
  activeTab?: 'warehouse' | 'devices'
}

export function PartsPageSkeleton({ activeTab = 'devices' }: PartsPageSkeletonProps = {}) {
  if (activeTab === 'warehouse') {
    return <WarehouseSkeleton />
  }

  return <DevicesSkeleton />
}

/* ══════════════════════════ DEVICES BRANCH ══════════════════════════ */

function DevicesSkeleton() {
  const { t } = useTranslation('parts')
  /** Rendered for BOTH breakpoints — disabled, first pill styled as active ('all' is default). */
  const familyPills = (
    <div
      className="grid grid-cols-4 gap-1.5 flex-shrink-0 max-md:flex max-md:gap-[7px] max-md:overflow-x-auto max-md:pl-0"
      style={{ scrollbarWidth: 'none' }}
    >
      {FAMILIES.map((f, i) => (
        <button
          key={f.id}
          type="button"
          disabled
          className={
            'h-7 w-full rounded-md text-14 font-medium border inline-flex items-center justify-center cursor-not-allowed whitespace-nowrap ' +
            // Mobile overrides — compact pill shape matching DevicesTab
            'max-md:w-auto max-md:rounded-full max-md:h-auto max-md:py-[7px] max-md:px-[18px] ' +
            'max-md:text-12.5 max-md:font-semibold max-md:flex-shrink-0 ' +
            // First pill = 'all' — active style
            (i === 0
              ? 'bg-accent border-accent text-white opacity-80'
              : 'bg-surface border-border text-text-tertiary max-md:border-white/10 light:max-md:border-black/10 opacity-80')
          }
        >
          {t(f.labelKey, f.labelFallback)}
        </button>
      ))}
    </div>
  )

  return (
    /* Mirrors DevicesTab root: flex flex-col gap-2.5 h-full min-h-0 */
    <div className="flex flex-col gap-2.5 h-full min-h-0">

      {/* 12-col grid — matches DevicesTab line ~127 */}
      <div className="lg:grid lg:grid-cols-12 lg:auto-rows-fr lg:gap-4 flex flex-col gap-4 flex-1 min-h-0">

        {/* ── LEFT COLUMN (col-span-5) ── */}
        <div className="lg:col-span-5 flex flex-col gap-2.5 min-h-0 flex-1 max-md:px-[14px] max-md:pt-[10px]">

          {/* REAL family pills (disabled) — local constants, not async */}
          {familyPills}

          {/* REAL search input (disabled) — desktop only; mirrors DevicesTab line ~158 */}
          <div className="relative flex-shrink-0 max-md:hidden">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none"
            />
            <input
              type="search"
              disabled
              placeholder={t('devices.searchPlaceholder')}
              aria-label={t('devices.searchPlaceholder')}
              className="w-full h-8 pl-7 pr-2.5 rounded-md bg-surface border border-border text-14.5 text-text-primary placeholder:text-text-subtle outline-none opacity-60 cursor-not-allowed"
            />
          </div>

          {/* Desktop: 2-col shimmer card grid — mirrors DeviceGridCard desktop footprint.
              MUST be `hidden md:grid` (display via classes) — an inline `display:grid`
              here would OVERRIDE max-md:hidden's display:none and leak the desktop
              grid onto mobile (the exact bug). */}
          <div className="hidden md:grid md:grid-cols-2 gap-2 content-start flex-1 overflow-y-auto min-h-0 devices-scroll">
            {Array.from({ length: 6 }).map((_, i) => (
              /* DeviceGridCard desktop: rounded-xl p-2.5 flex flex-col */
              <div key={i} className="bg-surface border border-border rounded-xl p-2.5 flex flex-col">
                {/* top row: 36×36 icon plaque + status dot + component count */}
                <div className="flex items-start justify-between gap-1">
                  <div className="w-9 h-9 rounded-lg anim-skeleton flex-shrink-0" />
                  <div className="flex items-center gap-1 pt-0.5 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full anim-skeleton" />
                    <div className="h-[13px] w-[40px] rounded anim-skeleton" />
                  </div>
                </div>
                {/* name + subtitle — mt-2 */}
                <div className="mt-2 space-y-1">
                  <div className="h-[15px] w-[78%] rounded anim-skeleton" />
                  <div className="h-[13px] w-[58%] rounded anim-skeleton" />
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: CardListSkeleton variant="part-device" matches DeviceGridCard isMobile */}
          <div className="md:hidden flex-1 min-h-0">
            <CardListSkeleton variant="part-device" rows={7} />
          </div>
        </div>

        {/* ── RIGHT COLUMN (col-span-7): InstalledDetailPanel no-selection state ──
            Local chrome only (translated prompts, no async data) — rendered real.
            Mirrors InstalledDetailPanel when asset=null (lines ~117-128). */}
        <div className="hidden lg:flex lg:col-span-7 min-h-0 flex-col overflow-hidden">
          <div className="h-full bg-surface border border-border rounded-xl shadow-sm shadow-black/30 light:shadow-slate-300/60 flex items-center justify-center p-8">
            <div className="text-center max-w-xs">
              <span className="w-12 h-12 rounded-full bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
                <Icon name="monitor" size={20} aria-hidden="true" />
              </span>
              <div className="text-15.5 font-semibold text-text-secondary">
                {t('device.selectPrompt')}
              </div>
              <div className="text-14 text-text-tertiary mt-1">
                {t('device.selectHint')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════ WAREHOUSE BRANCH ══════════════════════════ */

function WarehouseSkeleton() {
  const { t } = useTranslation('parts')

  return (
    <>
      {/* ──────────── DESKTOP: grid-cols-12 master-detail (mirrors WarehouseTab line ~213) ──────────── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-4" aria-hidden="true">

        {/* LEFT: category card list — col-span-5 (mirrors WarehouseTab line ~215).
            One PartCard-footprint shimmer per category (8 default part categories). */}
        <div className="col-span-5 flex flex-col min-h-0">
          <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
            {Array.from({ length: 8 }).map((_, i) => (
              /* PartCard footprint: bg-surface border rounded-xl, header px-4 py-3.5 */
              <div key={i} className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 light:shadow-slate-300/60 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Icon plaque — w-10 h-10 rounded-lg (PartCard line ~176) */}
                  <div className="w-10 h-10 rounded-lg anim-skeleton flex-shrink-0" />
                  {/* Label + subtitle */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="h-[15px] w-[46%] rounded anim-skeleton" />
                    <div className="h-[12px] w-[30%] rounded anim-skeleton" />
                  </div>
                  {/* Right side: green count chip footprint */}
                  <div className="h-[22px] w-[52px] rounded-full anim-skeleton flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: SKU list + history — col-span-7 (mirrors WarehouseTab line ~238 + renderRightPanel).
            Single card: bg-surface border rounded-xl shadow-sm shadow-black/30 light:shadow-slate-300/60. */}
        <div className="col-span-7 flex flex-col gap-3 min-h-0">
          <div className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 light:shadow-slate-300/60 flex flex-col">
            {/* SKU rows — mirror WarehouseSkuList <li> geometry: px-5 py-3, 8×8 icon plaque,
                divide-y between rows. */}
            <ul className="divide-y divide-border flex-shrink-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-lg anim-skeleton flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="h-[15px] w-[42%] rounded anim-skeleton" />
                  </div>
                  <div className="h-[22px] w-[52px] rounded-full anim-skeleton flex-shrink-0" />
                </li>
              ))}
            </ul>

            {/* History block — REAL «ИСТОРИЯ» metrics strip (local chrome, P2) mirroring
                HistoryPanel line ~203: px-5 py-2.5 border-t bg-bg + label + two chips.
                The Добавлено/Использовано quantities are async → shimmered. */}
            <div className="px-5 py-2.5 border-t border-border flex items-center gap-3 flex-shrink-0 bg-bg">
              <span className="text-13 uppercase tracking-wider text-text-subtle font-semibold">
                {t('warehouse.history')}
              </span>
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="h-[22px] w-[120px] rounded-full anim-skeleton" />
                <div className="h-[22px] w-[120px] rounded-full anim-skeleton" />
              </div>
            </div>

            {/* Placeholder history rows — mirror HistoryPanel empty-state slots
                (h-[56px], px-5, border-b, dashed rule) so there is zero jump when
                the first real row lands. minHeight matches the real min(700px,62vh). */}
            <div
              className="border-t border-border flex-shrink-0"
              style={{ minHeight: 'min(700px, 62vh)' }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="relative flex items-center px-5 h-[56px] border-b border-border last:border-b-0"
                >
                  <div className="absolute left-5 right-5 top-1/2 -translate-y-1/2 border-t border-dashed border-border/40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ──────────── MOBILE: detail panel (mirrors WarehouseMobileDetail footprint) ────────────
          The CategoryChipStrip lives in PartsTabsHeader row 2 — rendered real, not here.
          Body: category header row + a real «ИСТОРИЯ» metrics strip + placeholder rows. */}
      <div className="lg:hidden flex flex-col" aria-hidden="true">
        {/* Category header — px-3.5 pt-3.5 mb-3.5 (WarehouseMobileDetail line ~46) */}
        <div className="px-3.5 pt-3.5 flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] anim-skeleton flex-shrink-0" />
            <div className="h-[16px] w-[110px] rounded anim-skeleton" />
          </div>
          <div className="h-[24px] w-[64px] rounded-full anim-skeleton flex-shrink-0" />
        </div>

        {/* REAL «ИСТОРИЯ» metrics strip — HistoryPanel mobile line ~203
            (px-[14px] py-1.5, border-t, bg-bg). Quantities async → shimmered. */}
        <div className="px-[14px] py-1.5 border-t border-border flex items-center gap-3 flex-shrink-0 bg-bg">
          <span className="text-10 font-bold tracking-[1.4px] text-text-secondary uppercase">
            {t('warehouse.history')}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="h-[20px] w-[96px] rounded-full anim-skeleton" />
            <div className="h-[20px] w-[96px] rounded-full anim-skeleton" />
          </div>
        </div>

        {/* Placeholder history rows — mirror HistoryPanel mobile empty slots (~48px, dashed) */}
        <div className="border-t border-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="relative border-b border-border last:border-b-0"
              style={{ minHeight: 48 }}
            >
              <div className="opacity-0 px-[14px] py-[7px]">
                <div className="text-13 font-bold leading-snug mb-[2px]">&nbsp;</div>
                <div className="text-11 leading-snug">&nbsp;</div>
              </div>
              <div className="absolute left-[14px] right-[14px] top-1/2 -translate-y-1/2 border-t border-dashed border-border/40" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
