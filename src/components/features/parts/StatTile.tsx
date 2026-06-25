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
/* Per-tone mobile tinted background + border overrides.
   Desktop: bg-surface / border-border (unchanged).
   Mobile (max-md): coloured tint per §11 spec. */
const MOBILE_TONE_STYLE: Record<string, string> = {
  emerald: 'max-md:[background:rgba(16,185,129,0.12)] max-md:[border-color:rgba(16,185,129,0.35)]',
  violet:  'max-md:[background:rgba(139,92,246,0.12)]  max-md:[border-color:rgba(139,92,246,0.35)]',
  rose:    'max-md:[background:rgba(244,63,94,0.12)]   max-md:[border-color:rgba(244,63,94,0.35)]',
  blue:    'max-md:[background:rgba(59,130,246,0.12)]  max-md:[border-color:rgba(59,130,246,0.35)]',
  amber:   'max-md:[background:rgba(245,158,11,0.12)]  max-md:[border-color:rgba(245,158,11,0.35)]',
}

export function StatTile({ tone, icon, label, value, unit = 'шт' }: StatTileProps) {
  const t = STAT_TONES[tone] ?? STAT_TONES.slate!
  const mobileTone = MOBILE_TONE_STYLE[tone] ?? ''
  return (
    <div
      className={`relative bg-surface border border-border rounded-xl px-3.5 py-2.5 flex items-center gap-3 min-w-0 max-md:rounded-2xl max-md:p-[14px] max-md:gap-3 ${mobileTone}`}
    >
      {/* Icon badge: 32px desktop → 40px mobile, radius 8px → 10px */}
      <span
        className={`w-8 h-8 rounded-lg ${t.iconBg} ${t.iconText} inline-flex items-center justify-center flex-shrink-0 max-md:w-10 max-md:h-10 max-md:rounded-[10px]`}
      >
        <Icon name={icon} size={15} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] uppercase tracking-[0.08em] text-text-subtle font-semibold leading-none truncate">
          {label}
        </div>
        {/* Value: 20px desktop → 22px mobile */}
        <div className={`mt-1 text-[20px] font-bold tabular-nums ${t.value} leading-none whitespace-nowrap max-md:text-[22px]`}>
          {value}
          <span className="ml-1 text-[13px] font-medium text-text-subtle">{unit}</span>
        </div>
      </div>
    </div>
  )
}
