import { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useModalA11y } from '@/components/ui/useModalA11y'
import { MODAL_BACKDROP_ABS } from '@/components/ui'

export interface EmployeeModalShellProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  width?: string
}

/**
 * Lightweight modal shell matching Warehouse/prototypes/employees.html <Modal>
 * (prototype lines 1414-1437). Portals to document.body, locks body scroll,
 * closes on ESC or backdrop click, uses shared useModalA11y for focus trap +
 * restore + #root inert.
 *
 * Animation classes `anim-backdrop-fade` and `anim-modal-pop` are defined in
 * src/index.css — do not redefine here.
 */
export function EmployeeModalShell({
  open,
  onClose,
  children,
  width = 'max-w-lg',
}: EmployeeModalShellProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const prevOverflow = useRef<string>('')

  useModalA11y(open, panelRef)

  // Body-scroll-lock
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

  // ESC close
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 max-md:items-end max-md:p-0">
      {/* Backdrop */}
      <div
        className={MODAL_BACKDROP_ABS}
        onClick={onClose}
      />
      {/* Panel — centered on desktop, bottom-sheet on mobile */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${width} bg-surface rounded-2xl shadow-2xl shadow-slate-900/20 border border-border/60 anim-modal-pop overflow-hidden max-md:rounded-t-[18px] max-md:rounded-b-none max-md:max-w-full max-md:max-h-[85vh] max-md:overflow-y-auto`}
      >
        {/* Pull-handle — mobile only */}
        <div aria-hidden="true" className="hidden max-md:block mx-auto mt-2.5 mb-0 w-10 h-1 rounded-full bg-[rgba(148,163,184,0.35)]" />
        {children}
      </div>
    </div>,
    document.body,
  )
}
