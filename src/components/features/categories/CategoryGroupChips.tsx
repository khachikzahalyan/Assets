import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { CategoryGroup } from '@/domain/category'

export interface CategoryGroupChipsProps {
  groups: CategoryGroup[]
  counts: Record<string, number>
  selectedId: string
  onSelect: (id: string) => void
  onEdit: (g: CategoryGroup) => void
  onDelete: (g: CategoryGroup) => void
  onAdd: () => void
  canMutate: boolean
}

/** Chip styles — mirror assets GroupTabs desktop chips exactly (filled accent active). */
const ACTIVE_CHIP =
  'bg-accent text-white'
const IDLE_CHIP =
  'bg-surface text-text-primary border border-border hover:border-border-strong'

export function CategoryGroupChips({
  groups, counts, selectedId,
  onSelect, onEdit, onDelete, onAdd,
  canMutate,
}: CategoryGroupChipsProps) {
  const { t } = useTranslation('categories')

  return (
    <div
      data-testid="category-group-chips"
      /* Desktop: wrapping chip cloud. Mobile: single-row horizontal scroll strip
         (same pattern as assets GroupTabs) — no vertical stack. */
      className="flex flex-wrap items-center gap-2 max-md:flex-nowrap max-md:overflow-x-auto max-md:w-full no-scrollbar scroll-fade-x"
    >
      {groups.map(g => {
        const isSelected = g.id === selectedId
        return (
          <div key={g.id} className="group flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => onSelect(g.id)}
              aria-pressed={isSelected}
              className={[
                'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-semibold tracking-tight',
                'whitespace-nowrap flex-shrink-0',
                'transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong',
                isSelected ? ACTIVE_CHIP : IDLE_CHIP,
              ].join(' ')}
            >
              <Icon
                name={g.lucideIcon}
                size={13}
                className={`flex-shrink-0 ${isSelected ? 'text-white' : 'text-text-primary'}`}
              />
              <span>{g.name}</span>
              <span className={`tabular-nums text-[12px] ${isSelected ? 'text-white/70' : 'text-text-subtle'}`}>
                {counts[g.id] ?? 0}
              </span>
            </button>

            {canMutate && (
              <div
                className={[
                  'flex items-center gap-0.5 transition-opacity duration-100',
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onEdit(g) }}
                  className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
                  aria-label={`${t('groupForm.editTitle')} — ${g.name}`}
                >
                  <Icon name="pencil" size={11} />
                </button>
                <button
                  type="button"
                  data-testid={`group-delete-${g.id}`}
                  onClick={e => { e.stopPropagation(); onDelete(g) }}
                  className="w-5 h-5 flex items-center justify-center rounded text-text-tertiary hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                  aria-label={`${t('groupDelete.title')} — ${g.name}`}
                >
                  <Icon name="trash-2" size={11} />
                </button>
              </div>
            )}
          </div>
        )
      })}

      {canMutate && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-dashed border-border text-text-tertiary text-[13px] font-semibold tracking-tight whitespace-nowrap flex-shrink-0 hover:border-border-strong hover:text-text-secondary transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
        >
          <Icon name="plus" size={13} />
          {t('create')}
        </button>
      )}
    </div>
  )
}
