import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './icon'

export interface EmptyStateProps {
  icon?: string
  title?: string
  description?: string
  action?: ReactNode
  /**
   * Inline mode: drops the full-height fill (`h-full min-h-[18rem] flex-1`) so
   * the block sizes to its content. Use when the empty state renders inside a
   * card/tab alongside other content rather than as the sole occupant of a
   * page/table region.
   */
  compact?: boolean
}

export function EmptyState({ icon = 'inbox', title, description, action, compact = false }: EmptyStateProps) {
  const { t } = useTranslation('common')
  const resolvedTitle = title ?? t('states.emptyTitle')
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${
      compact ? 'py-8' : 'h-full min-h-[18rem] flex-1 py-16'
    }`}>
      <span className="w-14 h-14 rounded-2xl bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-4">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="text-14 font-semibold text-text-primary mb-1">{resolvedTitle}</h3>
      {description && <p className="max-w-sm text-12.5 text-text-subtle mb-4">{description}</p>}
      {action}
    </div>
  )
}
