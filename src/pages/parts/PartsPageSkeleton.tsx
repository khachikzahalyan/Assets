/**
 * PartsPageSkeleton — mirrors the DevicesTab default-tab footprint while
 * async parts data loads from Firestore.
 *
 * P1: skeleton = exact copy of the real loaded block per breakpoint.
 * P2: local/static chrome renders real immediately — only async Firebase data shimmered.
 *
 * Desktop (lg): 12-col grid matching DevicesTab:
 *   Left  (col-span-5): REAL family pills (disabled) + REAL search input (disabled)
 *                       + 2-col grid of DeviceGridCard-footprint shimmer cards.
 *   Right (col-span-7): InstalledDetailPanel no-selection footprint (local chrome — rendered real,
 *                       because the prompt is pure translated text with no async data).
 *
 * Mobile (max-md): real family pills row (local) + max-md:px-[14px] max-md:pt-[10px]
 *                  wrapper + CardListSkeleton variant="part-device".
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

export function PartsPageSkeleton() {
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
            'h-7 w-full rounded-md text-[14px] font-medium border inline-flex items-center justify-center cursor-not-allowed ' +
            // Mobile overrides — compact pill shape matching DevicesTab
            'max-md:w-auto max-md:rounded-full max-md:h-auto max-md:py-[7px] max-md:px-[18px] ' +
            'max-md:text-[12.5px] max-md:font-semibold max-md:whitespace-nowrap max-md:flex-shrink-0 ' +
            // First pill = 'all' — active style
            (i === 0
              ? 'bg-accent border-accent text-white opacity-80'
              : 'bg-surface border-border text-text-tertiary max-md:border-white/10 opacity-80')
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
              className="w-full h-8 pl-7 pr-2.5 rounded-md bg-surface border border-border text-[14.5px] text-text-primary placeholder:text-text-subtle outline-none opacity-60 cursor-not-allowed"
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
          <div className="h-full bg-surface border border-border rounded-xl shadow-sm shadow-black/30 flex items-center justify-center p-8">
            <div className="text-center max-w-xs">
              <span className="w-12 h-12 rounded-full bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
                <Icon name="monitor" size={20} aria-hidden="true" />
              </span>
              <div className="text-[15.5px] font-semibold text-text-secondary">
                {t('device.selectPrompt')}
              </div>
              <div className="text-[14px] text-text-tertiary mt-1">
                {t('device.selectHint')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
