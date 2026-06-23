import { Icon } from '@/components/ui'
import { STAT_TONES } from './partsTokens'

export interface StatTileProps {
  /** Colour tone — maps to STAT_TONES entry */
  tone: keyof typeof STAT_TONES
  /** Lucide icon name */
  icon: string
  /** Label shown above the value */
  label: string
  /** Numeric value */
  value: number
  /** Unit suffix — defaults to «шт» */
  unit?: string
}

/**
 * Stat metric tile for the PartsPage header strip.
 * Matches prototype parts.html lines 1321-1339:
 *   - dark card bg-surface with coloured icon plaque
 *   - coloured value text (tone.value) + muted unit suffix
 *   - label: 12px uppercase tracking-[0.08em]
 */
export function StatTile({ tone, icon, label, value, unit = 'шт' }: StatTileProps) {
  const t = STAT_TONES[tone] ?? STAT_TONES.slate
  return (
    <div
      className="relative bg-surface border border-border rounded-xl px-3.5 py-2.5 flex items-center gap-3 min-w-0"
    >
      <span
        className={`w-8 h-8 rounded-lg ${t.iconBg} ${t.iconText} inline-flex items-center justify-center flex-shrink-0`}
      >
        <Icon name={icon} size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] uppercase tracking-[0.08em] text-text-subtle font-semibold leading-none truncate">
          {label}
        </div>
        <div className={`mt-1 text-[20px] font-bold tabular-nums ${t.value} leading-none whitespace-nowrap`}>
          {value}
          <span className="ml-1 text-[13px] font-medium text-text-subtle">{unit}</span>
        </div>
      </div>
    </div>
  )
}
