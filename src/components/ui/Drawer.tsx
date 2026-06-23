import { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useModalA11y } from './useModalA11y'
import { MODAL_BACKDROP_ABS } from './styles'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  ariaLabel?: string
}

/**
 * Right-side desktop Drawer primitive.
 *
 * Portals to document.body. Locks body scroll while open. Closes on ESC or
 * backdrop click. Full a11y: focus trap, #root inert, focus restore on close.
 *
 * Animation classes `anim-drawer-slide-in` and `anim-backdrop-fade` are
 * defined in src/index.css — do not redefine here.
 */
export function Drawer({ open, onClose, children, ariaLabel }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const prevOverflow = useRef<string>('')

  useModalA11y(open, panelRef)

  // Body-scroll-lock — mirrors MobileSheet pattern.
  useEffect(() => {
    if (open) {
      prevOverflow.current = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = prevOverflow.current
    }
    return () => {
      document.body.style.overflow = prevOverflow.current
    }
  }, [open])

  // ESC close — mirrors MobileSheet pattern.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={MODAL_BACKDROP_ABS}
        onClick={onClose}
      />
      {/* Panel — right-side drawer on desktop, full-screen on mobile */}
      <div
        ref={panelRef}
        data-drawer
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="absolute top-0 right-0 h-full bg-surface border-l border-border shadow-2xl shadow-slate-900/20 anim-drawer-slide-in flex flex-col max-md:w-full max-md:max-w-full"
        style={{ width: '100%', maxWidth: 'clamp(320px, 42vw, 680px)' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
