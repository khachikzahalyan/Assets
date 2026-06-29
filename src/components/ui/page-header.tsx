import { type ReactNode } from 'react'
import { Icon } from './icon'
import { Badge } from './badge'

export interface PageHeaderProps {
  icon?: string
  title: string
  count?: number
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  icon,
  title,
  count,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`flex items-start justify-between gap-4 mb-5 max-md:mb-2 ${className}`}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className="w-10 h-10 rounded-xl bg-surface border border-border text-accent inline-flex items-center justify-center flex-shrink-0">
            <Icon name={icon} size={18} />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[18px] font-bold tracking-tight text-text-primary truncate">{title}</h1>
            {count != null && <Badge tone="slate">{count}</Badge>}
          </div>
          {description && <p className="mt-0.5 text-[12.5px] text-text-subtle">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </header>
  )
}
