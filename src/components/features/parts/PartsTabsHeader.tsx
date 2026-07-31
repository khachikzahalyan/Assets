import { useTranslation } from 'react-i18next'
import { Btn, Icon, MobileAddButton, SearchInput } from '@/components/ui'
import { TabStrip, type TabStripItem } from '@/components/ui'
import { CategoryChipStrip } from './CategoryChipStrip'
import type { Part, PartStock } from '@/domain/part/types'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import type { PartCatMeta, Tint } from './partsTokens'

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
  /** Live category defs — threads through to CategoryChipStrip for behavior dispatch */
  partCategories?: PartCategoryDef[]
  /** Pre-built display meta — threads through to CategoryChipStrip */
  partCatMeta?: PartCatMeta[]
  /** Pre-built tint map */
  categoryTints?: Record<string, Tint>
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
  partCategories,
  partCatMeta,
}: PartsTabsHeaderProps) {
  const { t } = useTranslation('parts')

  const tabItems: TabStripItem<ActiveTab>[] = TABS.map(tab => ({
    id: tab.id,
    label: t(tab.labelKey),
    icon: tab.icon,
    ...(tab.id === 'devices' && devicesCount > 0 ? { count: devicesCount } : {}),
  }))

  return (
    <>
      {/* ── Tab strip ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border max-md:bg-surface-2 max-md:px-1.5">
        <TabStrip<ActiveTab>
          tabs={tabItems}
          active={activeTab}
          onChange={onTabChange}
          size="md"
        />

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
          className="md:hidden mr-2"
        />
      </div>

      {/* ── Row 2 — mobile only ────────────────────────────────────────────── */}
      {/*
       * Warehouse tab: CategoryChipStrip bare (no own padding/border) as flex-1
       * Devices tab: search input flex-1
       * (the «+» add button lives on the tab strip above, per prototype)
       */}
      <div className="md:hidden flex items-center gap-2 bg-bg px-3.5 py-[0.4375rem]">
        {activeTab === 'warehouse' ? (
          <CategoryChipStrip
            skusByCategory={skusByCategory}
            selectedId={selectedCatId}
            onSelect={onSelectCat}
            stockMap={stockMap}
            bare
            {...(partCategories !== undefined ? { partCategories } : {})}
            {...(partCatMeta !== undefined ? { partCatMeta } : {})}
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
