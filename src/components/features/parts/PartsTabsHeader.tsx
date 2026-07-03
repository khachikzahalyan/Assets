import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { CategoryChipStrip } from './CategoryChipStrip'
import type { Part, PartStock } from '@/domain/part/types'

type ActiveTab = 'warehouse' | 'devices'

const TABS: Array<{ id: ActiveTab; labelKey: string; icon: string }> = [
  { id: 'devices', labelKey: 'tabs.devices', icon: 'monitor-smartphone' },
  { id: 'warehouse', labelKey: 'tabs.warehouse', icon: 'package' },
]

export interface PartsTabsHeaderProps {
  activeTab: ActiveTab
  onTabChange: (t: ActiveTab) => void
  devicesCount: number
  onAdd: () => void
  deviceSearch: string
  onDeviceSearchChange: (v: string) => void
  skusByCategory: Record<string, Part[]>
  selectedCatId: string
  onSelectCat: (id: string) => void
  stockMap: Record<string, PartStock>
}

/**
 * Responsive tab strip + mobile row 2 for the /parts page.
 *
 * Desktop: existing tab strip with «Получить» button — layout byte-identical
 *   to the original PartsPage inline strip.
 * Mobile: surface-2 tab strip (max-md: overrides) + a row-2 bar below the tabs
 *   that shows either the CategoryChipStrip (warehouse tab) or a search input
 *   (devices tab), always paired with a 36×36 accent «+» button.
 *
 * Placed inside the header card chrome (rounded-t-xl) in PartsPage; the body
 * card (rounded-b-xl, border-t-0) fuses with it visually.
 */
export function PartsTabsHeader({
  activeTab,
  onTabChange,
  devicesCount,
  onAdd,
  deviceSearch,
  onDeviceSearchChange,
  skusByCategory,
  selectedCatId,
  onSelectCat,
  stockMap,
}: PartsTabsHeaderProps) {
  const { t } = useTranslation('parts')

  return (
    <>
      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border max-md:bg-surface-2 max-md:px-[6px]">
        <div className="flex items-center gap-1" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={[
                  'inline-flex items-center gap-1.5 px-4 py-3',
                  'text-[15px] font-semibold max-md:text-[13.5px] max-md:font-medium',
                  'transition-all relative',
                  isActive
                    ? 'text-text-primary max-md:text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-accent after:rounded-t'
                    : 'text-text-subtle max-md:text-text-primary hover:text-text-tertiary hover:bg-surface-2/50',
                ].join(' ')}
              >
                <Icon name={tab.icon} size={14} className="max-md:hidden" />
                {t(tab.labelKey)}
                {tab.id === 'devices' && devicesCount > 0 && (
                  <span
                    className={[
                      'ml-0.5 px-1.5 rounded text-[12.5px] tabular-nums',
                      'max-md:text-[12px] max-md:font-semibold max-md:py-0.5 max-md:rounded-md',
                      isActive
                        ? 'bg-accent/15 text-accent max-md:text-accent-light'
                        : 'bg-surface-2 text-text-subtle',
                    ].join(' ')}
                  >
                    {devicesCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Desktop «Получить» button — hidden on mobile (square «+» in row 2 handles mobile) */}
        <button
          type="button"
          onClick={onAdd}
          aria-label={t('actions.add')}
          className="mr-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-white text-[13.5px] font-semibold transition-colors max-md:hidden"
        >
          <Icon name="plus" size={14} />
          <span>{t('actions.add')}</span>
        </button>
      </div>

      {/* ── Row 2 — mobile only ────────────────────────────────────────────── */}
      {/*
       * Warehouse tab: CategoryChipStrip bare (no own padding/border) as flex-1
       * Devices tab: search input flex-1
       * Always: 36×36 square accent «+» button
       */}
      <div className="md:hidden flex items-center gap-[8px] bg-bg px-[14px] py-[7px]">
        {activeTab === 'warehouse' ? (
          <CategoryChipStrip
            skusByCategory={skusByCategory}
            selectedId={selectedCatId}
            onSelect={onSelectCat}
            stockMap={stockMap}
            bare
          />
        ) : (
          <div className="relative flex-1">
            <Icon
              name="search"
              size={14}
              className="absolute left-[10px] top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none"
            />
            <input
              type="search"
              value={deviceSearch}
              onChange={(e) => onDeviceSearchChange(e.target.value)}
              placeholder={t('devices.searchPlaceholder')}
              aria-label={t('devices.searchPlaceholder')}
              className="w-full rounded-[9px] py-[9px] pl-[30px] pr-[12px] text-[11.5px] caret-accent bg-bg border border-border text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition-all"
            />
          </div>
        )}
        <button
          type="button"
          onClick={onAdd}
          aria-label={t('actions.add')}
          className="w-[36px] h-[36px] min-w-[36px] flex-shrink-0 rounded-[9px] bg-accent text-white inline-flex items-center justify-center shadow-[0_2px_10px] shadow-accent/35 transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Icon name="plus" size={15} />
        </button>
      </div>
    </>
  )
}
