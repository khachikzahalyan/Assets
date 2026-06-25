import { type ReactNode } from 'react'

/**
 * ListCard — three-zone full-height card shell for list pages.
 *
 * Layout contract:
 *   Zone 1 (toolbar):    flex-shrink-0   — filter bars, toolbars, tabs
 *   Zone 2 (body fill):  flex-1 min-h-0 overflow-hidden — the table/list/state region
 *   Zone 3 (pagination): flex-shrink-0   — optional; omitted when prop is undefined
 *
 * FILL CONTRACT: This card fills its parent's height via `flex-1 min-h-0` on the outer
 * card div. For Zone 2 to truly fill (no empty band below the table on tall monitors),
 * the table component rendered inside Zone 2 MUST:
 *   - be `height: 100%` at its wrapper level
 *   - use `flex: 1 1 0` on its body-row container so rows distribute to fill
 *   - use `flex: 1 1 0` on real rows AND placeholder rows
 * The parent page must use ListPageShell (or equivalent w-full h-full flex flex-col)
 * to opt into full-height rendering.
 */
export interface ListCardProps {
  /** Sticky top zone: filter bar(s) / toolbar. Rendered with flex-shrink-0. */
  toolbar: ReactNode
  /** Fill zone: the table / list / loading / error / empty region. Rendered flex-1 min-h-0 overflow-hidden. */
  children: ReactNode
  /** Pinned bottom zone: pagination. Rendered flex-shrink-0. Optional. */
  pagination?: ReactNode
  /** Extra classes for the outer card. */
  className?: string
  /**
   * When true, the card goes edge-to-edge on mobile (max-md): removes side/bottom borders + rounding.
   * Used by pages that want a full-bleed mobile list (e.g. Assets). Default false preserves
   * desktop-style chrome on mobile (e.g. Employees).
   */
  flushMobile?: boolean
}

export function ListCard({ toolbar, children, pagination, className, flushMobile = false }: ListCardProps) {
  return (
    <div
      className={[
        'bg-surface rounded-lg border border-border shadow-sm shadow-black/30',
        'flex flex-col flex-1 min-h-0',
        flushMobile ? 'max-md:rounded-none max-md:border-x-0 max-md:border-b-0' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')
        .trim()}
    >
      {/* Zone 1: toolbar / filter bar — never shrinks */}
      <div className="flex-shrink-0">{toolbar}</div>

      {/* Zone 2: body fill — grows to consume all remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>

      {/* Zone 3: pagination — never shrinks; omitted when not provided */}
      {pagination !== undefined && (
        <div className="flex-shrink-0">{pagination}</div>
      )}
    </div>
  )
}

/**
 * ListPageShell — full-height page root wrapper for list pages.
 *
 * Establishes the flex column from the app-shell-content boundary down to the
 * ListCard so the card can fill all available viewport height.
 *
 * Usage:
 *   <ListPageShell header={<PageHeader />}>
 *     <ListCard toolbar={...} pagination={...}>{tableRegion}</ListCard>
 *   </ListPageShell>
 */
export interface ListPageShellProps {
  /** The PageHeader / above-card content (group tabs etc.) that sits above the ListCard. */
  header?: ReactNode
  /** Expected to be a <ListCard/>. */
  children: ReactNode
  /** Extra classes for the root div. */
  className?: string
  /**
   * When true, the page root goes edge-to-edge on mobile (max-md): collapses gap to 0
   * and applies negative side/top margins to bleed past the page padding.
   * Used by pages that want a full-bleed mobile list (e.g. Assets). Default false preserves
   * desktop-style chrome on mobile (e.g. Employees).
   */
  flushMobile?: boolean
}

export function ListPageShell({ header, children, className, flushMobile = false }: ListPageShellProps) {
  return (
    <div
      className={[
        'w-full h-full flex flex-col min-h-0 gap-2',
        flushMobile ? 'max-md:gap-0' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')
        .trim()}
    >
      {header}
      {children}
    </div>
  )
}
