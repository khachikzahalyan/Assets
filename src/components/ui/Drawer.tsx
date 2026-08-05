import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalA11y } from './useModalA11y'
import { useBodyScrollLock } from './useBodyScrollLock'
import { useEscapeKey } from './useEscapeKey'
import { MODAL_BACKDROP_ABS } from './styles'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  ariaLabel?: string
}

/**
 * Right-side drawer on desktop; bottom-sheet on mobile (≤767px).
 *
 * Portals to document.body. Locks body scroll while open. Closes on ESC or
 * backdrop click. Full a11y: focus trap, #root inert, focus restore on close.
 *
 * Animation classes `anim-drawer-slide-in` (overridden to amsSheetIn via
 * CSS media query on mobile) and `anim-backdrop-fade` are defined in
 * src/index.css — do not redefine here.
 *
 * Desktop panel sizing (clamp width) lives in `.ams-drawer-panel` in
 * src/index.css so it doesn't bleed through to mobile via inline style.
 */
export function Drawer({ open, onClose, children, ariaLabel }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useModalA11y(open, panelRef)

  // Body-scroll-lock — shared ref-counted lock (composes with nested lockers).
  useBodyScrollLock(open)

  // ESC close — mirrors MobileSheet pattern.
  useEscapeKey(open, onClose)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={MODAL_BACKDROP_ABS}
        onClick={onClose}
      />
      {/* Panel — right-side drawer on desktop, bottom-sheet on mobile */}
      <div
        ref={panelRef}
        data-drawer
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        /* Mobile: min-h 70dvh so the sheet always rises to ~70% of the screen —
           the flex-1 scroll region absorbs the extra height (10+ assets stay
           comfortably scrollable); max-h 92dvh caps very long content. */
        className="ams-drawer-panel absolute top-0 right-0 h-full bg-surface border-l border-border shadow-2xl shadow-slate-900/20 light:shadow-slate-300/50 anim-drawer-slide-in flex flex-col max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:h-auto max-md:min-h-[70dvh] max-md:max-h-[92dvh] max-md:w-full max-md:max-w-full max-md:rounded-t-[18px] max-md:border-l-0 max-md:border-t max-md:border-border max-md:overflow-hidden"
      >
        {/* Pull-handle — mobile only */}
        <div
          aria-hidden="true"
          className="md:hidden mx-auto mt-2.5 mb-1 w-10 h-1 rounded-full bg-[rgba(148,163,184,0.35)] flex-shrink-0"
        />
        {children}
      </div>
    </div>,
    document.body,
  )
}
