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

/** Accent classes for the selected chip — uniform primary accent (never rainbow). */
const ACTIVE_CHIP =
  'bg-accent/[0.12] border-accent text-accent'
const IDLE_CHIP =
  'bg-surface-2/50 border-border text-text-secondary hover:border-border-strong hover:text-text-primary'

export function CategoryGroupChips({
  groups, counts, selectedId,
  onSelect, onEdit, onDelete, onAdd,
  canMutate,
}: CategoryGroupChipsProps) {
  const { t } = useTranslation('categories')

  return (
    <div data-testid="category-group-chips" className="flex flex-wrap items-center gap-2">
      {groups.map(g => {
        const isSelected = g.id === selectedId
        return (
          <div key={g.id} className="group flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onSelect(g.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-medium',
                'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                isSelected ? ACTIVE_CHIP : IDLE_CHIP,
              ].join(' ')}
            >
              <Icon name={g.lucideIcon} size={13} className="flex-shrink-0" />
              <span>{g.name}</span>
              <span className={`text-[11px] tabular-nums ${isSelected ? 'opacity-70' : 'opacity-50'}`}>
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border text-text-tertiary text-[13px] font-medium hover:border-border-strong hover:text-text-secondary transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Icon name="plus" size={13} />
          {t('create')}
        </button>
      )}
    </div>
  )
}
