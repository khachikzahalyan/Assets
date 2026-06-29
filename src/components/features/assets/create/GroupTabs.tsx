import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { CategoryRow } from '@/domain/asset'

export type CategoryGroup = 'devices' | 'network' | 'furniture'

export const CATEGORY_GROUPS: { id: CategoryGroup; lucideIcon: string }[] = [
  { id: 'devices', lucideIcon: 'monitor-smartphone' },
  { id: 'network', lucideIcon: 'server' },
  { id: 'furniture', lucideIcon: 'armchair' },
]

/** Per-group active chip color tokens (border / bg / icon). */
const GROUP_ACTIVE: Record<CategoryGroup, { chip: string; icon: string }> = {
  devices: {
    chip: 'bg-accent/[0.12] border-accent ring-1 ring-accent/15',
    icon: 'text-accent',
  },
  network: {
    chip: 'bg-info/[0.12] border-info ring-1 ring-info/15',
    icon: 'text-info',
  },
  furniture: {
    chip: 'bg-violet-500/[0.12] border-violet-500 ring-1 ring-violet-500/15',
    icon: 'text-violet-400',
  },
}

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
    network: t('groups.networkShort'),
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
        const color = GROUP_ACTIVE[g.id]
        return (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(g.id)}
            className={`flex items-center gap-2 px-4 py-2 max-md:px-3 max-md:py-1.5 max-md:shrink-0 max-md:whitespace-nowrap rounded-2xl border transition-all duration-200 text-left
              ${active
                ? color.chip
                : 'bg-surface border-[#2A2F36]/70 text-text-primary hover:border-border-strong hover:bg-[#22272E]/60'}`}
          >
            <Icon name={g.lucideIcon} size={15} className={active ? color.icon : 'text-text-subtle'} />
            <span className="text-[15px] font-medium tracking-tight truncate max-md:truncate-none text-text-primary">{label[g.id]}</span>
            <span className={`text-[14px] tabular-nums font-semibold shrink-0${active ? ' text-text-primary' : ' text-text-subtle'}`}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}
