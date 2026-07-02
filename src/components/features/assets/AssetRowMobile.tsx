import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Asset } from '@/domain/asset'
import type { ChipColor } from '@/components/ui/chip'
import { CHIP_PALETTE } from '@/components/ui/chip'
import { Icon } from '@/components/ui'

/**
 * Maps ChipColor → Tailwind border-left class for the mobile row status accent bar.
 * Colours are the -400 lightness variants used in the prototype, matching the
 * CHIP_DOT hues closely without introducing new design tokens.
 */
const STATUS_BORDER_L: Record<ChipColor, string> = {
  green:  'border-l-emerald-400',
  blue:   'border-l-sky-400',
  amber:  'border-l-amber-400',
  red:    'border-l-rose-400',
  orange: 'border-l-orange-400',
  gray:   'border-l-slate-500',
  indigo: 'border-l-accent',
  violet: 'border-l-violet-400',
  teal:   'border-l-teal-400',
  cyan:   'border-l-cyan-400',
}

export interface MobileCardProps {
  a: Asset
  title: string
  displayStatus: { id: string; name: string; color?: string }
  statusColor: ChipColor
  /** One-line subline: "Assignee · Dept", plain dept/branch name, or warehouse label. */
  subline: string
  isAuditOrIntern: boolean
  cat: { name: string; lucideIcon?: string } | undefined
  /** Per-category icon-box tint from CATEGORY_COLOR. Null = muted fallback tile. */
  catColor: { bg: string; icon: string } | null
  isFocused: boolean
  onRowClick?: (a: Asset) => void
  /**
   * Inline styles applied to the outer card div.
   * Used by the parent list (AssetsTable mobile branch) to inject flex-stretch behavior
   * (flexGrow + flexShrink) so all rows distribute available Zone-2 height evenly,
   * matching the desktop placeholder/row fill contract.
   */
  outerStyle?: CSSProperties
}

/**
 * Mobile asset list row — matches prototype file 1, section ④.
 * Rendered inside AssetsTable only when isMobile (matchMedia ≤767px).
 *
 * Layout:
 *   [28px icon tile] [name / subline, flex-1] [status pill / inv-code, right]
 *
 * Left accent bar colour maps to the row's display status via STATUS_BORDER_L.
 * Status pill reuses CHIP_PALETTE colours so it stays consistent with Chip.
 * Inv-code is plain monospace — no accent border (overrides previous style).
 */
export function MobileCard({
  a,
  title,
  displayStatus,
  statusColor,
  subline,
  isAuditOrIntern,
  cat,
  catColor,
  isFocused,
  onRowClick,
  outerStyle,
}: MobileCardProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [highlight, setHighlight] = useState(false)

  useEffect(() => {
    if (!isFocused) return
    rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setHighlight(true)
    const timer = setTimeout(() => setHighlight(false), 2500)
    return () => clearTimeout(timer)
  }, [isFocused])

  const borderLClass = STATUS_BORDER_L[statusColor] ?? 'border-l-slate-500'
  const pillPalette  = CHIP_PALETTE[statusColor] ?? CHIP_PALETTE.gray
  // Remote work mode: mobile has no room for the «УДАЛЁННЫЙ» text badge (desktop
  // AssetRow), so we show an icon-only chip in the same cyan palette.
  const isRemote = a.assignment?.workMode === 'remote'

  return (
    <div
      ref={rowRef}
      style={outerStyle}
      role="button"
      tabIndex={0}
      onClick={() => onRowClick?.(a)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onRowClick?.(a)
        }
      }}
      className={[
        'flex items-center gap-[9px] px-[14px] py-[7px]',
        'border-b border-border border-l-[3px]',
        borderLClass,
        'cursor-pointer box-border last:border-b-0',
        'active:bg-surface-2',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
        'transition-[background-color,box-shadow] duration-500',
        highlight ? 'bg-accent/5 ring-2 ring-inset ring-accent/45' : 'bg-surface',
      ].join(' ')}
    >
      {/* Category icon tile — 28×28px, tinted via CATEGORY_COLOR inline style.
          colour is set on the wrapper span so the Lucide icon inherits via currentColor. */}
      <span
        className="w-[28px] h-[28px] rounded-[8px] inline-flex items-center justify-center flex-shrink-0"
        style={
          catColor
            ? { backgroundColor: catColor.bg, color: catColor.icon }
            : { backgroundColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.40)' }
        }
      >
        <Icon name={cat?.lucideIcon ?? 'box'} size={15} aria-hidden="true" />
      </span>

      {/* Middle column: name + subline */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0 mb-[2px]">
          <span className="text-[13px] font-bold text-text-primary leading-snug truncate">
            {title}
          </span>
          {/* Icon-only remote chip — same cyan palette as the desktop «УДАЛЁННЫЙ» badge */}
          {isRemote && (
            <span
              className="shrink-0 inline-flex items-center justify-center w-[16px] h-[16px] rounded-[4px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
              aria-label="Удалённый"
            >
              <Icon name="house" size={9} aria-hidden="true" />
            </span>
          )}
        </div>
        <div
          className={[
            'text-[11px] leading-snug truncate',
            isAuditOrIntern ? 'text-amber-300' : 'text-text-tertiary',
          ].join(' ')}
        >
          {subline}
        </div>
      </div>

      {/* Right column: status pill on top, inv-code below */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {/* Bespoke status pill — sized to prototype spec (10px/700, rounded-[5px], px-[7px]).
            Uses CHIP_PALETTE classes for bg/text/border so colours stay in sync with Chip. */}
        <span
          className={[
            'inline-flex items-center border rounded-[5px] px-[7px] py-[2px]',
            'text-[10px] font-bold whitespace-nowrap leading-none',
            pillPalette,
          ].join(' ')}
        >
          {'● '}{displayStatus.name}
        </span>
        {/* Inventory code — plain monospace, no accent border/box */}
        <span className="font-['JetBrains_Mono',ui-monospace,monospace] text-[10px] text-text-subtle whitespace-nowrap">
          {a.invCode}
        </span>
      </div>
    </div>
  )
}
