import { useTranslation } from 'react-i18next'
import { Btn, Icon, MobileAddButton, SearchInput } from '@/components/ui'
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

        {/* Desktop «Получить» button — hidden on mobile; shared Btn (assets etalon) */}
        <Btn
          variant="primary"
          size="sm"
          onClick={onAdd}
          aria-label={t('actions.add')}
          className="mr-1 max-md:hidden"
        >
          <Icon name="plus" size={13} />
          {t('actions.add')}
        </Btn>

        {/* Mobile «+» — shared MobileAddButton, inline at the right end of the tab strip */}
        <MobileAddButton
          onClick={onAdd}
          ariaLabel={t('actions.add')}
          className="md:hidden mr-[8px]"
        />
      </div>

      {/* ── Row 2 — mobile only ────────────────────────────────────────────── */}
      {/*
       * Warehouse tab: CategoryChipStrip bare (no own padding/border) as flex-1
       * Devices tab: search input flex-1
       * (the «+» add button lives on the tab strip above, per prototype)
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
          <SearchInput
            value={deviceSearch}
            onChange={onDeviceSearchChange}
            placeholder={t('devices.searchPlaceholder')}
            aria-label={t('devices.searchPlaceholder')}
            containerClassName="flex-1"
          />
        )}
      </div>
    </>
  )
}
