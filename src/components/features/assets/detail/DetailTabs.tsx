import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { TabStrip, type TabStripItem } from '@/components/ui'
import { fmtRuDate } from './detailFormat'

export type TabId = 'specs' | 'history' | 'docs'

interface TabDef {
  id: TabId
  icon: string
  labelKey: string
}

const TABS: TabDef[] = [
  { id: 'specs',   icon: 'cpu',       labelKey: 'detail.tabs.specs'   },
  { id: 'history', icon: 'history',   labelKey: 'detail.tabs.history' },
  { id: 'docs',    icon: 'file-text', labelKey: 'detail.tabs.docs'    },
]

interface DetailTabsProps {
  active: TabId
  onChange: (tab: TabId) => void
  showSpecs: boolean
  showDocs: boolean
  addedDate?: string | null
}

export function DetailTabs({ active, onChange, showSpecs, showDocs, addedDate }: DetailTabsProps) {
  const { t } = useTranslation('assets')

  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'specs'   && !showSpecs) return false
    if (tab.id === 'docs'    && !showDocs)  return false
    return true
  })

  const tabItems: TabStripItem<TabId>[] = visibleTabs.map(tab => ({
    id: tab.id,
    label: t(tab.labelKey),
    icon: tab.icon,
    ariaControls: `panel-${tab.id}`,
  }))

  return (
    <div
      className="bg-surface border-x border-t border-border rounded-t-2xl px-5 sm:px-6 flex items-center gap-1 max-md:flex-nowrap max-md:overflow-x-auto max-md:gap-0 max-md:px-3 no-scrollbar max-md:scroll-fade-x max-md:sticky max-md:top-0 max-md:z-20 max-md:bg-bg max-md:rounded-none max-md:border-x-0 max-md:border-t-0 max-md:border-b max-md:[&_[role=tab]]:pt-0"
    >
      <TabStrip<TabId>
        tabs={tabItems}
        active={active}
        onChange={onChange}
        size="md"
        className="min-w-0"
      />
      <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-text-subtle max-md:hidden">
        <Icon name="calendar-days" size={13} />
        <span className="text-emerald-400">{t('detail.added')}</span>
        <span className="font-semibold text-[#E2E8F0]">{addedDate ? fmtRuDate(addedDate) : '—'}</span>
      </span>
    </div>
  )
}
