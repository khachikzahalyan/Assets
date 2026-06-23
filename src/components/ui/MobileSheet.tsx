import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface MobileSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/**
 * Slide-up bottom-sheet for mobile (≤767px).
 * Renders via createPortal to document.body.
 * Body-scroll is locked while open and restored on unmount/close.
 * Closes on: backdrop tap, Escape key.
 * Pull-handle rendered via ::before CSS on .ams-mobile-sheet-panel.
 */
export function MobileSheet({ open, onClose, title, children }: MobileSheetProps) {
  const prevOverflow = useRef<string>('')

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

  // ESC key close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onPointerDown={e => {
        // close if the backdrop itself (not the panel) was tapped
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Panel */}
      <div
        className="ams-mobile-sheet-panel w-full bg-surface rounded-t-[18px] overflow-y-auto anim-sheet-in"
        style={{
          maxHeight: '85vh',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          boxSizing: 'border-box',
        }}
        // prevent backdrop tap from firing when tapping panel
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Pull-handle */}
        <div
          aria-hidden="true"
          className="mx-auto mt-2.5 mb-3.5 w-10 h-1 rounded-full bg-[rgba(148,163,184,0.35)] flex-shrink-0"
        />

        {title && (
          <div className="px-4 pb-3 border-b border-border">
            <span className="text-[15px] font-semibold text-text-primary">{title}</span>
          </div>
        )}

        {children}
      </div>
    </div>,
    document.body,
  )
}
