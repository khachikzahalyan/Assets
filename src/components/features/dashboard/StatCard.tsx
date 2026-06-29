import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

export type StatCardAccent = 'orange' | 'green' | 'blue' | 'violet' | 'amber'

export interface StatCardProps {
  icon: string
  label: string
  value: number | null
  to: string
  accent: StatCardAccent
  /** Orange gradient hero card — bigger glow, special label colour. */
  featured?: boolean
  testId?: string
}

const ACCENT: Record<
  StatCardAccent,
  { iconBox: string; number: string; label: string; hoverBorder: string }
> = {
  orange: {
    iconBox:     'bg-accent/15 text-accent',
    number:      'text-text-primary',
    label:       'text-accent',
    hoverBorder: 'hover:border-accent/50',
  },
  green: {
    iconBox:     'bg-success/15 text-success',
    number:      'text-success',
    label:       'text-text-subtle',
    hoverBorder: 'hover:border-success/40',
  },
  blue: {
    iconBox:     'bg-info/15 text-info',
    number:      'text-info',
    label:       'text-text-subtle',
    hoverBorder: 'hover:border-info/40',
  },
  violet: {
    iconBox:     'bg-violet-500/15 text-violet-300',
    number:      'text-violet-300',
    label:       'text-text-subtle',
    hoverBorder: 'hover:border-violet-500/40',
  },
  amber: {
    iconBox:     'bg-warning/15 text-warning',
    number:      'text-warning',
    label:       'text-text-subtle',
    hoverBorder: 'hover:border-warning/40',
  },
}

export function StatCard({
  icon,
  label,
  value,
  to,
  accent,
  featured = false,
  testId,
}: StatCardProps) {
  const cls = ACCENT[accent]

  return (
    <Link
      to={to}
      data-testid={testId}
      className={cn(
        'block rounded-xl border p-[18px] relative overflow-hidden',
        'transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        featured
          ? 'bg-gradient-to-br from-accent/15 to-accent/[0.06] border-accent/30'
          : 'bg-surface border-border',
        cls.hoverBorder,
      )}
    >
      {featured && (
        // Soft radial glow in top-right corner
        <span
          className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-accent/20 blur-2xl pointer-events-none"
          aria-hidden="true"
        />
      )}
      <div className="relative flex flex-col gap-2">
        {/* 32×32 tinted icon box */}
        <span
          className={cn(
            'w-8 h-8 rounded-[9px] inline-flex items-center justify-center flex-shrink-0',
            cls.iconBox,
          )}
          aria-hidden="true"
        >
          <Icon name={icon} size={15} />
        </span>
        {/* 32px bold value */}
        <div
          className={cn(
            'text-[32px] font-bold leading-none tracking-tight tabular-nums',
            cls.number,
          )}
        >
          {value ?? '—'}
        </div>
        {/* 11.5px label */}
        <div className={cn('text-[11.5px]', cls.label)}>{label}</div>
      </div>
    </Link>
  )
}
