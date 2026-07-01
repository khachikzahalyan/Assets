import { Icon } from '@/components/ui'
import { TILE_ACCENT } from './detailFormat'
import type { StorageSlot } from './detailFormat'

interface SpecTileProps {
  icon:            string
  label:           string
  value:           string
  accent:          string
  /** Optional type badge to show before the value (e.g. 'SSD', 'NVMe', 'HDD'). */
  badge?:          string
  /** Accent key for the badge chip — falls back to the tile accent when omitted. */
  badgeAccent?:    string
  /**
   * Optional Tailwind class for the value text.
   * Defaults to text-text-primary when absent.
   * Pass e.g. "text-emerald-300" to colour factory-status values green.
   */
  valueClassName?: string
  /**
   * When present, renders a list of drive entries (badge + capacity) instead of
   * the single badge+value layout. Used for the combined Накопители tile.
   */
  slots?:          StorageSlot[]
}

export function SpecTile({ icon, label, value, accent, badge, badgeAccent, valueClassName, slots }: SpecTileProps) {
  const tone      = TILE_ACCENT[accent]      ?? TILE_ACCENT['slate']!
  const badgeTone = TILE_ACCENT[badgeAccent ?? accent] ?? TILE_ACCENT['slate']!

  return (
    <div className="bg-bg border border-border rounded-lg p-3 flex items-center gap-3 max-md:p-[10px] max-md:gap-[9px]">
      <div className={`w-9 h-9 max-md:w-7 max-md:h-7 rounded-lg inline-flex items-center justify-center shrink-0 ${tone.bg} ${tone.text}`}>
        <Icon name={icon} size={18} className="max-md:hidden" />
        <Icon name={icon} size={13} className="md:hidden" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] max-md:text-[8.5px] tracking-widest max-md:tracking-[0.7px] max-md:font-bold text-text-subtle uppercase mb-0.5">{label}</p>
        {slots && slots.length > 0 ? (
          // Multi-drive layout: all drives in ONE row (badge chip + capacity each), wrapping if needed
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            {slots.map((slot, i) => {
              const slotBadgeTone = TILE_ACCENT[slot.badgeAccent ?? accent] ?? TILE_ACCENT['slate']!
              return (
                <div key={i} className="flex items-center gap-1.5">
                  {slot.badge && (
                    <span
                      className={`inline-flex items-center rounded ring-1 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider ${slotBadgeTone.bg} ${slotBadgeTone.text} ring-current/30`}
                    >
                      {slot.badge}
                    </span>
                  )}
                  <p className="text-[13px] max-md:text-[12px] max-md:font-semibold text-text-primary">{slot.value}</p>
                </div>
              )
            })}
          </div>
        ) : (
          // Single value layout (default)
          <div className="flex items-center gap-1.5 flex-wrap">
            {badge && (
              <span
                className={`inline-flex items-center rounded ring-1 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider ${badgeTone.bg} ${badgeTone.text} ring-current/30`}
              >
                {badge}
              </span>
            )}
            <p className={`text-[13px] max-md:text-[12px] max-md:font-semibold ${valueClassName ?? 'text-text-primary'}`}>{value}</p>
          </div>
        )}
      </div>
    </div>
  )
}
