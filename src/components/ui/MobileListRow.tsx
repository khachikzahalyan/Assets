import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'

export interface MobileListRowProps {
  /** Full 28×28 icon tile — caller provides the styled span. */
  iconTile: ReactNode
  /** Title line — caller provides with its own text styling. */
  title: ReactNode
  /** Subline — caller provides with its own text/color styling. */
  subline?: ReactNode
  /** Right column (status pill + code) — caller provides full column div. */
  right?: ReactNode
  /** Full-width block below the flex row (e.g. activate button for licenses). */
  footer?: ReactNode
  /**
   * Tailwind border-left class for the left accent bar.
   * Defaults to 'border-l-transparent'.
   */
  accentClass?: string
  onClick?: () => void
  /** Forwarded to outer div — parent injects flexGrow/flexShrink. */
  outerStyle?: CSSProperties
  /** Extra Tailwind classes merged onto the outer div (e.g. highlight ring). */
  className?: string
  /** data-testid placed on the outer div. */
  dataTestId?: string
  /** Ref forwarded to the outer div (used by callers for scrollIntoView). */
  rowRef?: RefObject<HTMLDivElement | null>
}

/**
 * Generic mobile list row — shared presentational primitive for all mobile
 * entity lists (assets, licenses, etc). No domain imports.
 *
 * Layout:
 *   outer div  (border-l accent bar · padding · active/focus/highlight styles)
 *     inner flex row: [iconTile] [middle: title + subline, flex-1] [right column]
 *     [footer]  (optional, full-width below the flex row)
 *
 * Interactivity: role="button" + tabIndex + Enter/Space keyboard handling are
 * only applied when onClick is provided. Inert rows (catalog, pending-users)
 * omit those attributes — clean a11y, no false interactive semantics.
 */
export function MobileListRow({
  iconTile,
  title,
  subline,
  right,
  footer,
  accentClass = 'border-l-transparent',
  onClick,
  outerStyle,
  className,
  dataTestId,
  rowRef,
}: MobileListRowProps) {
  const isClickable = onClick !== undefined

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  const outerClass = [
    'px-[14px] py-[7px] box-border',
    'border-b border-border border-l-[3px]',
    accentClass,
    'bg-surface last:border-b-0',
    'transition-[background-color,box-shadow] duration-500',
    isClickable ? 'cursor-pointer active:bg-surface-2' : '',
    isClickable
      ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40'
      : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={rowRef}
      style={outerStyle}
      {...(isClickable
        ? { role: 'button' as const, tabIndex: 0, onClick, onKeyDown: handleKeyDown }
        : {})}
      className={outerClass}
      {...(dataTestId !== undefined ? { 'data-testid': dataTestId } : {})}
    >
      <div className="flex items-center gap-[9px]">
        {iconTile}
        <div className="flex-1 min-w-0">
          {title}
          {subline}
        </div>
        {right}
      </div>
      {footer}
    </div>
  )
}
