import { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  ariaLabel?: string
}

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Local a11y hook — ported from Warehouse/prototypes/employees.html useModalA11y (lines 424-487).
 * Responsibilities:
 *   1. Save and restore focus to the previously-focused element on close.
 *   2. Set `#root` inert while open to screen-reader-isolate the drawer.
 *   3. Move focus into the drawer panel (first focusable child, or panel itself).
 *   4. Trap Tab/Shift+Tab inside the panel.
 */
function useModalA11y(open: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return

    // 1. Save trigger element for focus restore.
    const previouslyFocused = document.activeElement as HTMLElement | null

    // 2. Make the rest of the app inert.
    const appRoot = document.getElementById('root')
    if (appRoot) appRoot.setAttribute('inert', '')

    // 3. Move focus into the drawer.
    const container = containerRef.current
    const focusableList = container
      ? container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      : ([] as unknown as NodeListOf<HTMLElement>)
    const firstFocusable: HTMLElement | null = focusableList[0] ?? container ?? null

    // Defer to allow the slide-in animation to start first.
    const focusTimer = setTimeout(() => {
      if (firstFocusable && typeof firstFocusable.focus === 'function') {
        firstFocusable.focus({ preventScroll: true })
      }
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }, 0)

    // 4. Tab trap.
    function onTabKey(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return
      const list = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      if (list.length === 0) {
        e.preventDefault()
        return
      }
      const first: HTMLElement = list[0]!
      const last: HTMLElement = list[list.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onTabKey)

    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', onTabKey)
      if (appRoot) appRoot.removeAttribute('inert')
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [open, containerRef])
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
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] anim-backdrop-fade"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        data-drawer
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="absolute top-0 right-0 h-full bg-[#1B1F24] border-l border-[#2A2F36] shadow-2xl shadow-slate-900/20 anim-drawer-slide-in flex flex-col"
        style={{ width: '100%', maxWidth: 'clamp(320px, 42vw, 680px)' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
