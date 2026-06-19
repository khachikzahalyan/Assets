import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './icon'

export interface EmptyStateProps {
  icon?: string
  title?: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon = 'inbox', title, description, action }: EmptyStateProps) {
  const { t } = useTranslation('common')
  const resolvedTitle = title ?? t('states.emptyTitle')
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="w-14 h-14 rounded-2xl bg-[#22272E] text-[#64748B] inline-flex items-center justify-center mb-4">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="text-[14px] font-semibold text-[#F8FAFC] mb-1">{resolvedTitle}</h3>
      {description && <p className="max-w-sm text-[12.5px] text-[#64748B] mb-4">{description}</p>}
      {action}
    </div>
  )
}
