import { type ReactNode } from 'react'
import { Icon } from './icon'

export interface SectionCardProps {
  title?: string
  icon?: string
  action?: ReactNode
  children: ReactNode
  noHeader?: boolean
  className?: string
  /** Extra classes applied to the inner body wrapper (the div that wraps children). */
  bodyClassName?: string
}

export function SectionCard({
  title,
  icon,
  action,
  children,
  noHeader = false,
  className = '',
  bodyClassName = '',
}: SectionCardProps) {
  return (
    <section
      className={`bg-surface border border-border rounded-xl overflow-hidden ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.4),0 4px 12px rgba(0,0,0,0.25)' }}
    >
      {!noHeader && (
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="w-7 h-7 rounded-md bg-surface-2 text-text-tertiary inline-flex items-center justify-center">
                <Icon name={icon} size={14} />
              </span>
            )}
            <h2 className="text-[13px] font-bold uppercase tracking-[0.04em] text-text-primary">{title}</h2>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={`p-5 ${bodyClassName}`}>{children}</div>
    </section>
  )
}
