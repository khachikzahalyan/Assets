import { type ReactNode } from 'react'
import { Icon } from './icon'

export interface SectionCardProps {
  title?: string
  icon?: string
  action?: ReactNode
  children: ReactNode
  noHeader?: boolean
  className?: string
}

export function SectionCard({
  title,
  icon,
  action,
  children,
  noHeader = false,
  className = '',
}: SectionCardProps) {
  return (
    <section
      className={`bg-[#1B1F24] border border-[#2A2F36] rounded-xl overflow-hidden ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.4),0 4px 12px rgba(0,0,0,0.25)' }}
    >
      {!noHeader && (
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-[#2A2F36]">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="w-7 h-7 rounded-md bg-[#22272E] text-[#94A3B8] inline-flex items-center justify-center">
                <Icon name={icon} size={14} />
              </span>
            )}
            <h2 className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#F8FAFC]">{title}</h2>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}
