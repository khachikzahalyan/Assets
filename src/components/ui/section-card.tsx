import { type ReactNode } from 'react'
import { Icon } from './icon'

/**
 * Section-icon colour convention (reused across the app — keep in sync with the
 * `project_section_icon_colors` memory). Each entity icon has ONE tone:
 *   blue   → person / user / employee / assignment (user-check)
 *   green  → location / branch (map-pin)
 *   orange → license / key (key-round)
 * `undefined` = the default muted tone.
 */
const ICON_TONES: Record<string, string> = {
  blue:   'bg-sky-500/15 text-sky-300',
  green:  'bg-emerald-500/15 text-emerald-300',
  orange: 'bg-amber-500/15 text-amber-300',
  violet: 'bg-violet-500/15 text-violet-300',
  cyan:   'bg-cyan-500/15 text-cyan-300',
  rose:   'bg-rose-500/15 text-rose-300',
}

export interface SectionCardProps {
  title?: string
  icon?: string
  /** Optional colour tone for the header icon box (see ICON_TONES). Default: muted. */
  iconTone?: keyof typeof ICON_TONES
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
  iconTone,
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
        <header className="flex items-center justify-between px-5 py-3.5 max-md:px-3.5 max-md:py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className={`w-7 h-7 rounded-md inline-flex items-center justify-center ${iconTone ? ICON_TONES[iconTone] : 'bg-surface-2 text-text-tertiary'}`}>
                <Icon name={icon} size={14} />
              </span>
            )}
            <h2 className="text-[13px] font-bold uppercase tracking-[0.04em] text-text-primary">{title}</h2>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={`p-5 max-md:p-3.5 ${bodyClassName}`}>{children}</div>
    </section>
  )
}
