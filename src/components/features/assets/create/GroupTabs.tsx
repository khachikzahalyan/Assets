import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { CategoryRow } from '@/domain/asset'

export type CategoryGroup = 'devices' | 'network' | 'furniture'

export const CATEGORY_GROUPS: { id: CategoryGroup; lucideIcon: string }[] = [
  { id: 'devices', lucideIcon: 'monitor-smartphone' },
  { id: 'network', lucideIcon: 'server' },
  { id: 'furniture', lucideIcon: 'armchair' },
]

export interface GroupTabsProps {
  categories: CategoryRow[]
  selected: CategoryGroup | null
  onSelect: (g: CategoryGroup) => void
}

/** Group pills (Устройства / Сетевые устройства / Мебель) with live counts. */
export function GroupTabs({ categories, selected, onSelect }: GroupTabsProps) {
  const { t } = useTranslation('assets')
  const label: Record<CategoryGroup, string> = {
    devices: t('groups.devices'),
    network: t('groups.network'),
    furniture: t('groups.furniture'),
  }
  // Desktop: 3-col grid. Mobile: single-row horizontal scroll strip with nowrap pills
  return (
    <div
      role="tablist"
      aria-label={t('form.category')}
      className="grid grid-cols-3 gap-2 max-md:grid-cols-none max-md:flex max-md:flex-row max-md:overflow-x-auto max-md:gap-2 max-md:pb-0.5"
    >
      {CATEGORY_GROUPS.map(g => {
        const active = selected === g.id
        const count = categories.filter(c => c.group === g.id).length
        return (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(g.id)}
            className={`flex items-center gap-2 px-4 py-2 max-md:px-3 max-md:py-1.5 max-md:shrink-0 max-md:whitespace-nowrap rounded-2xl border transition-all duration-200 text-left
              ${active
                ? 'bg-[rgba(249,115,22,0.12)] border-[#F4CFB8] text-accent-hover'
                : 'bg-surface border-border/70 text-text-primary hover:border-[#F4CFB8]/70 hover:bg-surface-2/60'}`}
          >
            <Icon name={g.lucideIcon} size={15} className={active ? 'text-accent' : 'text-text-subtle'} />
            <span className={`text-[15px] font-medium tracking-tight truncate max-md:truncate-none${active ? ' text-accent-hover' : ' text-text-primary'}`}>{label[g.id]}</span>
            <span className={`text-[14px] tabular-nums font-semibold shrink-0${active ? ' text-[#E29772]' : ' text-text-subtle'}`}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}
