import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { CategoryRow, CategoryGroupRow } from '@/domain/asset'

/** Active chip styling — uniform accent (our primary color) for every group. */
const ACTIVE_CHIP = 'bg-accent/[0.12] border-accent ring-1 ring-accent/15'

export interface GroupTabsProps {
  /** Dynamic top-level groups loaded from Firestore via loadReferenceData(). */
  categoryGroups: CategoryGroupRow[]
  categories: CategoryRow[]
  /** The id of the currently selected CategoryGroupRow (or null if none). */
  selected: string | null
  onSelect: (id: string) => void
}

/** Group pills — driven by dynamic categoryGroups from loadReferenceData(). */
export function GroupTabs({ categoryGroups, categories, selected, onSelect }: GroupTabsProps) {
  const { t } = useTranslation('assets')
  // Desktop: 3-col grid. Mobile: single-row horizontal scroll strip with nowrap pills
  return (
    <div
      role="tablist"
      aria-label={t('form.category')}
      className="grid grid-cols-3 gap-2 max-md:grid-cols-none max-md:flex max-md:flex-row max-md:overflow-x-auto max-md:gap-2 max-md:pb-0.5"
    >
      {categoryGroups.map(g => {
        const active = selected === g.id
        const count = categories.filter(c => c.categoryGroupId === g.id).length
        return (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(g.id)}
            className={`flex items-center gap-2 px-4 py-2 max-md:px-3 max-md:py-1.5 max-md:shrink-0 max-md:whitespace-nowrap rounded-2xl border transition-all duration-200 text-left
              ${active
                ? ACTIVE_CHIP
                : 'bg-surface border-border text-text-primary hover:border-border-strong hover:bg-surface-2'}`}
          >
            <Icon name={g.lucideIcon} size={15} className={active ? 'text-accent' : 'text-text-subtle'} />
            <span className="text-[15px] font-medium tracking-tight truncate max-md:truncate-none text-text-primary">{g.name}</span>
            <span className={`text-[14px] tabular-nums font-semibold shrink-0${active ? ' text-text-primary' : ' text-text-subtle'}`}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}
