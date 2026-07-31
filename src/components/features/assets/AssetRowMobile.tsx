import { memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Asset } from '@/domain/asset'
import type { ChipColor } from '@/components/ui/chip'
import { CHIP_PALETTE } from '@/components/ui/chip'
import { Icon, MobileListRow } from '@/components/ui'

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
 * Wraps ui/MobileListRow with domain-specific slot content.
 * Highlight/scrollIntoView logic remains here; onClick is passed through
 * to avoid double keyboard handling.
 */
export const MobileCard = memo(function MobileCard({
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

  // Status is conveyed by the pill only — no colored left accent bar (owner request).
  const pillPalette  = CHIP_PALETTE[statusColor] ?? CHIP_PALETTE.gray
  // Remote work mode: mobile has no room for the «УДАЛЁННЫЙ» text badge (desktop
  // AssetRow), so we show an icon-only chip in the same cyan palette.
  const isRemote = a.assignment?.workMode === 'remote'

  const iconTile = (
    <span
      className={[
        'w-[1.75rem] h-[1.75rem] rounded-[8px] inline-flex items-center justify-center flex-shrink-0',
        !catColor ? 'bg-white/[0.04] light:bg-black/[0.05] text-white/40 light:text-black/30' : '',
      ].join(' ')}
      {...(catColor ? { style: { backgroundColor: catColor.bg, color: catColor.icon } } : {})}
    >
      <Icon name={cat?.lucideIcon ?? 'box'} size={15} aria-hidden="true" />
    </span>
  )

  const titleNode = (
    <div className="flex items-center gap-1 min-w-0 mb-0.5">
      <span className="text-13 font-bold text-text-primary leading-snug truncate">
        {title}
      </span>
      {/* Icon-only remote chip — same cyan palette as the desktop «УДАЛЁННЫЙ» badge */}
      {isRemote && (
        <span
          className="shrink-0 inline-flex items-center justify-center w-[16px] h-[16px] rounded-[4px] bg-cyan-500/15 text-cyan-300 light:text-cyan-700 border border-cyan-500/30"
          aria-label="Удалённый"
        >
          <Icon name="house" size={9} aria-hidden="true" />
        </span>
      )}
    </div>
  )

  const sublineNode = (
    <div
      className={[
        'text-11 leading-snug truncate',
        isAuditOrIntern ? 'text-amber-300 light:text-amber-700' : 'text-text-tertiary',
      ].join(' ')}
    >
      {subline}
    </div>
  )

  const right = (
    <div className="flex flex-col items-end gap-1 flex-shrink-0">
      {/* Bespoke status pill — sized to prototype spec (10px/700, rounded-[5px], px-[0.4375rem]).
          Uses CHIP_PALETTE classes for bg/text/border so colours stay in sync with Chip. */}
      <span
        className={[
          'inline-flex items-center border rounded-[5px] px-[0.4375rem] py-0.5',
          'text-10 font-bold whitespace-nowrap leading-none',
          pillPalette,
        ].join(' ')}
      >
        {'● '}{displayStatus.name}
      </span>
      {/* Inventory code — plain monospace, no accent border/box */}
      <span className="font-['JetBrains_Mono',ui-monospace,monospace] text-10 text-text-subtle whitespace-nowrap">
        {a.invCode}
      </span>
    </div>
  )

  return (
    <MobileListRow
      rowRef={rowRef}
      iconTile={iconTile}
      title={titleNode}
      subline={sublineNode}
      right={right}
      {...(outerStyle !== undefined ? { outerStyle } : {})}
      onClick={() => onRowClick?.(a)}
      {...(highlight ? { className: 'bg-accent/5 ring-2 ring-inset ring-accent/45' } : {})}
    />
  )
})
