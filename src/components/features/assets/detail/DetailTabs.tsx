import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
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

  return (
    <div
      role="tablist"
      className="bg-surface border-x border-t border-border rounded-t-2xl px-5 sm:px-6 flex items-center gap-1 max-md:flex-nowrap max-md:overflow-x-auto max-md:gap-0 max-md:px-3 no-scrollbar max-md:scroll-fade-x"
    >
      {visibleTabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-3 py-3 text-[13.5px] font-medium transition-colors shrink-0 max-md:min-h-[40px] max-md:whitespace-nowrap ${
              isActive ? 'text-accent-light' : 'text-text-subtle hover:text-text-tertiary'
            }`}
          >
            <Icon name={tab.icon} size={14} />
            {t(tab.labelKey)}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-light rounded-full" />
            )}
          </button>
        )
      })}
      <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-text-subtle max-md:hidden">
        <Icon name="calendar-days" size={13} />
        <span className="text-emerald-400">{t('detail.added')}</span>
        <span className="font-semibold text-[#E2E8F0]">{addedDate ? fmtRuDate(addedDate) : '—'}</span>
      </span>
    </div>
  )
}
